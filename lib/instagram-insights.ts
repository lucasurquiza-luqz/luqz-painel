import { prisma } from "./db"
import { Prisma } from "@prisma/client"
import { decryptSecret } from "./crypto-secrets"

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
  saves: number
  shares: number
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
        metric: "reach,views,profile_views,website_clicks,accounts_engaged,total_interactions,saves,shares",
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
      saves: byName.get("saves") ?? 0,
      shares: byName.get("shares") ?? 0,
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
  }

  const jsonData = data as unknown as Prisma.InputJsonValue
  await prisma.instagramSnapshot.upsert({
    where: { accountId },
    create: { accountId, data: jsonData },
    update: { data: jsonData, fetchedAt: new Date() },
  })

  return { ok: true }
}

type MediaItem = { id: string; permalink?: string; media_type?: string; timestamp?: string; like_count?: number; comments_count?: number; caption?: string; media_url?: string; thumbnail_url?: string }

// Mapa igMediaId -> pilar, a partir dos posts agendados (carrega o pilar pro cache de midia).
async function loadPillarHints(accountId: string): Promise<Map<string, string>> {
  const rows = await prisma.instagramScheduledPost.findMany({
    where: { accountId, igMediaId: { not: null }, pillar: { not: null } },
    select: { igMediaId: true, pillar: true },
  })
  const map = new Map<string, string>()
  for (const r of rows) if (r.igMediaId && r.pillar) map.set(r.igMediaId, r.pillar)
  return map
}

// Busca insights de UM post e grava/atualiza no cache. pillarHint = pilar herdado do agendamento.
async function upsertMediaWithInsights(accountId: string, token: string, m: MediaItem, pillarHint?: string): Promise<void> {
  const ins = await safe(
    () => igGet(`${m.id}/insights`, { metric: "reach,views,saved,shares,total_interactions", access_token: token }) as Promise<{ data?: InsightRow[] }>,
    { data: [] }
  )
  const byName = new Map<string, number>()
  for (const row of ins.data ?? []) byName.set(row.name, row.values?.[0]?.value ?? row.total_value?.value ?? 0)

  const fields = {
    mediaType: m.media_type ?? null,
    permalink: m.permalink ?? null,
    thumb: m.thumbnail_url ?? m.media_url ?? null,
    caption: (m.caption ?? "").slice(0, 300),
    timestamp: m.timestamp ? new Date(m.timestamp) : null,
    likes: m.like_count ?? 0,
    comments: m.comments_count ?? 0,
    reach: byName.get("reach") ?? null,
    views: byName.get("views") ?? null,
    saved: byName.get("saved") ?? null,
    shares: byName.get("shares") ?? null,
    interactions: byName.get("total_interactions") ?? null,
  }
  await prisma.instagramMedia.upsert({
    where: { id: m.id },
    // No create herda o pilar do agendamento; no update preserva o pilar (marcacao manual).
    create: { id: m.id, accountId, ...fields, pillar: pillarHint ?? null },
    update: { ...fields, fetchedAt: new Date() },
  })
}

// Busca UMA pagina da lista de midias.
async function fetchMediaPage(ig: string, token: string, after: string, limit = 50): Promise<{ items: MediaItem[]; nextAfter: string | null }> {
  const params: Record<string, string> = {
    fields: "id,permalink,media_type,timestamp,like_count,comments_count,caption,media_url,thumbnail_url",
    limit: String(limit),
    access_token: token,
  }
  if (after) params.after = after
  const page = await safe(
    () => igGet(`${ig}/media`, params) as Promise<{ data?: MediaItem[]; paging?: { cursors?: { after?: string }; next?: string } }>,
    null as { data?: MediaItem[]; paging?: { cursors?: { after?: string }; next?: string } } | null
  )
  const nextAfter = page?.paging?.next && page?.paging?.cursors?.after ? page.paging.cursors.after : null
  return { items: page?.data ?? [], nextAfter }
}

async function resolveToken(accountId: string): Promise<{ ig: string; token: string } | null> {
  const account = await prisma.instagramAccount.findUnique({ where: { id: accountId } })
  if (!account) return null
  try {
    return { ig: account.igUserId, token: decryptSecret(account.tokenEnc) }
  } catch {
    return null
  }
}

// Cache de metricas por post (alimenta Top posts + aba Analise).
// Puxa os `maxPosts` mais recentes. Usado no refresh normal e no cron.
export async function syncInstagramMedia(accountId: string, maxPosts = 90): Promise<{ ok: boolean; count?: number; error?: string }> {
  const creds = await resolveToken(accountId)
  if (!creds) return { ok: false, error: "Conta/token inválido." }

  const items: MediaItem[] = []
  let after = ""
  while (items.length < maxPosts) {
    const { items: pageItems, nextAfter } = await fetchMediaPage(creds.ig, creds.token, after)
    if (!pageItems.length) break
    items.push(...pageItems)
    if (!nextAfter) break
    after = nextAfter
  }

  const pillarHints = await loadPillarHints(accountId)
  let count = 0
  for (const m of items.slice(0, maxPosts)) {
    await upsertMediaWithInsights(accountId, creds.token, m, pillarHints.get(m.id))
    count++
  }
  return { ok: true, count }
}

// Backfill do historico em LOTE (uma pagina por chamada, pra nao estourar timeout).
// Retorna o cursor da proxima pagina (null = acabou) e o total ja em cache.
export async function backfillInstagramMediaPage(accountId: string, after: string): Promise<{ ok: boolean; count: number; nextAfter: string | null; total: number; error?: string }> {
  const creds = await resolveToken(accountId)
  if (!creds) return { ok: false, count: 0, nextAfter: null, total: 0, error: "Conta/token inválido." }

  const { items, nextAfter } = await fetchMediaPage(creds.ig, creds.token, after || "", 40)
  const pillarHints = await loadPillarHints(accountId)
  for (const m of items) await upsertMediaWithInsights(accountId, creds.token, m, pillarHints.get(m.id))
  const total = await prisma.instagramMedia.count({ where: { accountId } })
  return { ok: true, count: items.length, nextAfter, total }
}

export async function syncAllInstagramInsights(): Promise<{ synced: number; failed: number }> {
  const accounts = await prisma.instagramAccount.findMany({ select: { id: true } })
  let synced = 0
  let failed = 0
  for (const a of accounts) {
    const r = await syncInstagramInsights(a.id)
    await syncInstagramMedia(a.id).catch(() => null)
    if (r.ok) synced++
    else failed++
  }
  return { synced, failed }
}
