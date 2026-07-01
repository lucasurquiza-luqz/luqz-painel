import { prisma } from "./db"
import { decryptSecret } from "./crypto-secrets"

const IG_BASE = "https://graph.facebook.com/v21.0"

type TimeValue = { value: number; end_time: string }
type InsightRow = { name: string; period: string; values?: TimeValue[]; total_value?: unknown }

async function igGet(path: string, params: Record<string, string>): Promise<unknown> {
  const res = await fetch(`${IG_BASE}/${path}?${new URLSearchParams(params)}`)
  if (!res.ok) throw new Error(`${path} [${res.status}]: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// Cada leitura e isolada: se uma metrica falha, as outras seguem.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

// IG usa end_time como o limite do dia seguinte; o valor descreve o dia anterior.
function dayKey(endTime: string): string {
  const d = new Date(endTime)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function seriesByDay(row: InsightRow | undefined): Map<string, number> {
  const map = new Map<string, number>()
  for (const v of row?.values ?? []) {
    if (typeof v.value === "number") map.set(dayKey(v.end_time), v.value)
  }
  return map
}

// Extrai um breakdown de follower_demographics em [{label, value}] ordenado desc.
function extractBreakdown(json: unknown): { label: string; value: number }[] {
  const rows =
    (json as { data?: { total_value?: { breakdowns?: { results?: { dimension_values?: string[]; value?: number }[] }[] } }[] })
      ?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []
  return rows
    .map((r) => ({ label: r.dimension_values?.[0] ?? "?", value: r.value ?? 0 }))
    .sort((a, b) => b.value - a.value)
}

export async function syncInstagramInsights(accountId: string): Promise<{ ok: boolean; error?: string }> {
  const account = await prisma.instagramAccount.findUnique({ where: { id: accountId } })
  if (!account) return { ok: false, error: "Conta não encontrada." }

  let token: string
  try {
    token = decryptSecret(account.tokenEnc)
  } catch {
    return { ok: false, error: "Token inválido (falha ao decifrar)." }
  }
  const ig = account.igUserId

  // Perfil (seguidores / total de posts)
  const profile = await safe(
    () => igGet(ig, { fields: "followers_count,media_count", access_token: token }) as Promise<{ followers_count?: number; media_count?: number }>,
    {}
  )

  // Series diarias (~ultimos 30 dias)
  const reachRes = await safe(() => igGet(`${ig}/insights`, { metric: "reach", period: "day", access_token: token }) as Promise<{ data?: InsightRow[] }>, { data: [] })
  const viewsRes = await safe(() => igGet(`${ig}/insights`, { metric: "profile_views", period: "day", access_token: token }) as Promise<{ data?: InsightRow[] }>, { data: [] })
  const newFollRes = await safe(() => igGet(`${ig}/insights`, { metric: "follower_count", period: "day", access_token: token }) as Promise<{ data?: InsightRow[] }>, { data: [] })

  const reachByDay = seriesByDay(reachRes.data?.[0])
  const viewsByDay = seriesByDay(viewsRes.data?.[0])
  const newFollByDay = seriesByDay(newFollRes.data?.[0])

  // Demografia (cidade / pais / genero / idade) — cada uma isolada
  const demographics: Record<string, { label: string; value: number }[]> = {}
  for (const breakdown of ["city", "country", "gender", "age"]) {
    const json = await safe(
      () => igGet(`${ig}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", timeframe: "last_30_days", breakdown, access_token: token }),
      null as unknown
    )
    if (json) demographics[breakdown] = extractBreakdown(json).slice(0, 8)
  }

  // Melhores horarios (online_followers) — media por hora do dia
  const bestTimes = await safe(async () => {
    const json = (await igGet(`${ig}/insights`, { metric: "online_followers", period: "lifetime", access_token: token })) as { data?: { values?: { value: Record<string, number> }[] }[] }
    const hourly = new Array(24).fill(0)
    const counts = new Array(24).fill(0)
    for (const v of json.data?.[0]?.values ?? []) {
      for (const [h, n] of Object.entries(v.value ?? {})) {
        const hi = Number(h)
        if (hi >= 0 && hi < 24) { hourly[hi] += n; counts[hi]++ }
      }
    }
    return hourly.map((sum, h) => (counts[h] ? Math.round(sum / counts[h]) : 0))
  }, [] as number[])

  // Persiste a serie diaria
  const allDays = new Set([...reachByDay.keys(), ...viewsByDay.keys(), ...newFollByDay.keys()])
  const today = new Date().toISOString().slice(0, 10)
  for (const day of allDays) {
    const followers = day === today ? profile.followers_count ?? null : null
    await prisma.instagramDailyStat.upsert({
      where: { accountId_date: { accountId, date: new Date(day) } },
      create: {
        accountId,
        date: new Date(day),
        reach: reachByDay.get(day) ?? null,
        profileViews: viewsByDay.get(day) ?? null,
        newFollowers: newFollByDay.get(day) ?? null,
        followers,
      },
      update: {
        reach: reachByDay.get(day) ?? undefined,
        profileViews: viewsByDay.get(day) ?? undefined,
        newFollowers: newFollByDay.get(day) ?? undefined,
        ...(followers != null ? { followers } : {}),
      },
    })
  }

  // KPIs = soma dos ultimos 30 dias
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
  const data = {
    followersCount: profile.followers_count ?? null,
    mediaCount: profile.media_count ?? null,
    kpis: {
      reach: sum(reachByDay),
      profileViews: sum(viewsByDay),
      newFollowers: sum(newFollByDay),
    },
    demographics,
    bestTimes,
    rangeDays: 30,
  }

  await prisma.instagramSnapshot.upsert({
    where: { accountId },
    create: { accountId, data },
    update: { data, fetchedAt: new Date() },
  })

  return { ok: true }
}

// Cron diario: sincroniza todas as contas conectadas.
export async function syncAllInstagramInsights(): Promise<{ synced: number; failed: number }> {
  const accounts = await prisma.instagramAccount.findMany({ select: { id: true } })
  let synced = 0
  let failed = 0
  for (const a of accounts) {
    const r = await syncInstagramInsights(a.id)
    if (r.ok) synced++
    else failed++
  }
  return { synced, failed }
}
