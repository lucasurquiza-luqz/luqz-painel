import { prisma } from "./db"
import { Prisma } from "@prisma/client"
import { decryptSecret } from "./crypto-secrets"

type TopPost = {
  id: string
  permalink: string | null
  mediaType: string | null
  timestamp: string | null
  likes: number
  comments: number
  caption: string
  thumb: string | null
  engagement: number
}

const IG_BASE = "https://graph.facebook.com/v21.0"
const WINDOWS = [7, 30, 90] as const

type TimeValue = { value: number; end_time: string }
type InsightRow = { name: string; period: string; values?: TimeValue[]; total_value?: { value?: number } }

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
  return d.toISOString().slice(0, 10)
}

function seriesByDay(row: InsightRow | undefined): Map<string, number> {
  const map = new Map<string, number>()
  for (const v of row?.values ?? []) {
    if (typeof v.value === "number") map.set(dayKey(v.end_time), v.value)
  }
  return map
}

function extractBreakdown(json: unknown): { label: string; value: number }[] {
  const rows =
    (json as { data?: { total_value?: { breakdowns?: { results?: { dimension_values?: string[]; value?: number }[] }[] } }[] })
      ?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []
  return rows
    .map((r) => ({ label: r.dimension_values?.[0] ?? "?", value: r.value ?? 0 }))
    .sort((a, b) => b.value - a.value)
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000)

export type PeriodTotals = {
  reach: number
  views: number
  profileViews: number
  websiteClicks: number
  accountsEngaged: number
  interactions: number
  newFollowers: number
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
  const now = new Date()

  // Perfil
  const profile = await safe(
    () => igGet(ig, { fields: "followers_count,media_count", access_token: token }) as Promise<{ followers_count?: number; media_count?: number }>,
    {}
  )

  // Series diarias (grafico + tabela) — since/until obrigatorio, senao a API so devolve ~2 dias.
  const since30 = String(unix(new Date(now.getTime() - 30 * 86400_000)))
  const untilNow = String(unix(now))
  const reachRes = await safe(() => igGet(`${ig}/insights`, { metric: "reach", period: "day", since: since30, until: untilNow, access_token: token }) as Promise<{ data?: InsightRow[] }>, { data: [] })
  const newFollRes = await safe(() => igGet(`${ig}/insights`, { metric: "follower_count", period: "day", since: since30, until: untilNow, access_token: token }) as Promise<{ data?: InsightRow[] }>, { data: [] })
  const reachByDay = seriesByDay(reachRes.data?.[0])
  const newFollByDay = seriesByDay(newFollRes.data?.[0])

  // Reconstroi o total de seguidores por dia: parte do total atual e subtrai o saldo diario.
  const followersByDay = new Map<string, number>()
  const sortedDays = [...new Set([...reachByDay.keys(), ...newFollByDay.keys()])].sort()
  if (profile.followers_count != null && sortedDays.length > 0) {
    let running = profile.followers_count
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      const day = sortedDays[i]
      followersByDay.set(day, running)
      running -= newFollByDay.get(day) ?? 0
    }
  }

  // Totais por janela (7/30/90) — metricas total_value com since/until
  const periods: Record<number, PeriodTotals> = {}
  for (const days of WINDOWS) {
    const since = unix(new Date(now.getTime() - days * 86400_000))
    const until = unix(now)
    const totals = await safe(
      () => igGet(`${ig}/insights`, {
        metric: "reach,views,profile_views,website_clicks,accounts_engaged,total_interactions",
        period: "day",
        metric_type: "total_value",
        since: String(since),
        until: String(until),
        access_token: token,
      }) as Promise<{ data?: InsightRow[] }>,
      { data: [] }
    )
    const byName = new Map<string, number>()
    for (const row of totals.data ?? []) byName.set(row.name, row.total_value?.value ?? 0)

    // novos seguidores na janela = soma da serie
    const cutoff = new Date(now.getTime() - days * 86400_000).toISOString().slice(0, 10)
    let newFoll = 0
    for (const [day, v] of newFollByDay) if (day >= cutoff) newFoll += v

    periods[days] = {
      reach: byName.get("reach") ?? 0,
      views: byName.get("views") ?? 0,
      profileViews: byName.get("profile_views") ?? 0,
      websiteClicks: byName.get("website_clicks") ?? 0,
      accountsEngaged: byName.get("accounts_engaged") ?? 0,
      interactions: byName.get("total_interactions") ?? 0,
      newFollowers: newFoll,
    }
  }

  // Demografia
  const demographics: Record<string, { label: string; value: number }[]> = {}
  for (const breakdown of ["city", "country", "gender", "age"]) {
    const json = await safe(
      () => igGet(`${ig}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", timeframe: "last_30_days", breakdown, access_token: token }),
      null as unknown
    )
    if (json) demographics[breakdown] = extractBreakdown(json).slice(0, 8)
  }

  // Melhores horarios
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

  // Top posts (ranqueia por curtidas + comentarios, ultimos 90 dias)
  const topPosts = await safe<TopPost[]>(async () => {
    const json = (await igGet(`${ig}/media`, {
      fields: "id,permalink,media_type,timestamp,like_count,comments_count,caption,media_url,thumbnail_url",
      limit: "40",
      access_token: token,
    })) as { data?: { id: string; permalink?: string; media_type?: string; timestamp?: string; like_count?: number; comments_count?: number; caption?: string; media_url?: string; thumbnail_url?: string }[] }
    const cutoff = now.getTime() - 90 * 86400_000
    return (json.data ?? [])
      .filter((m) => (m.timestamp ? new Date(m.timestamp).getTime() >= cutoff : true))
      .map((m) => ({
        id: m.id,
        permalink: m.permalink ?? null,
        mediaType: m.media_type ?? null,
        timestamp: m.timestamp ?? null,
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
        caption: (m.caption ?? "").slice(0, 120),
        thumb: m.thumbnail_url ?? m.media_url ?? null,
        engagement: (m.like_count ?? 0) + (m.comments_count ?? 0),
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 6)
  }, [] as TopPost[])

  // Persiste a serie diaria
  const allDays = new Set([...reachByDay.keys(), ...newFollByDay.keys()])
  const today = now.toISOString().slice(0, 10)
  for (const day of allDays) {
    const followers = followersByDay.get(day) ?? (day === today ? profile.followers_count ?? null : null)
    await prisma.instagramDailyStat.upsert({
      where: { accountId_date: { accountId, date: new Date(day) } },
      create: { accountId, date: new Date(day), reach: reachByDay.get(day) ?? null, newFollowers: newFollByDay.get(day) ?? null, followers },
      update: {
        reach: reachByDay.get(day) ?? undefined,
        newFollowers: newFollByDay.get(day) ?? undefined,
        ...(followers != null ? { followers } : {}),
      },
    })
  }

  const data = {
    followersCount: profile.followers_count ?? null,
    mediaCount: profile.media_count ?? null,
    periods,
    demographics,
    bestTimes,
    topPosts,
  }

  const jsonData = data as unknown as Prisma.InputJsonValue
  await prisma.instagramSnapshot.upsert({
    where: { accountId },
    create: { accountId, data: jsonData },
    update: { data: jsonData, fetchedAt: new Date() },
  })

  return { ok: true }
}

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
