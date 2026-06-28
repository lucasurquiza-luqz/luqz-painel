import { META_DEFAULT_ACTIONS, META_PURCHASE_ACTIONS, META_PAGEVIEW_ACTIONS, type AdConfig, type AdMetrics, type AdObjective, type AdNode, type AdStatus, type CampaignNode, type ResultBreakdown, type DateRange, type MetaBreakdownRow, type MetaDeep } from "@/lib/ads/types"

const GRAPH = "https://graph.facebook.com/v21.0"
type Action = { action_type: string; value: string }

const sumActions = (arr: Action[] | undefined, keys: Set<string>) =>
  (arr ?? []).filter((a) => keys.has(a.action_type)).reduce((s, a) => s + Number(a.value ?? 0), 0)

// Eventos de resultado conforme a config (custom override ou padrão dos objetivos).
function resultKeys(config: AdConfig): Set<string> {
  if (config.resultActions.length) return new Set(config.resultActions)
  const keys = new Set<string>()
  for (const obj of config.objectives) for (const k of META_DEFAULT_ACTIONS[obj]) keys.add(k)
  return keys
}
// Quais eventos estão sendo contados como "resultado" (para revisão de conversões).
export const metaResultKeys = (config: AdConfig): string[] => [...resultKeys(config)]

// Lê insights de uma conta Meta no mês (com série DIÁRIA), token DO CLIENTE, conforme a config.
export async function fetchMetaInsights(accountId: string, token: string, { since, until }: DateRange, config: AdConfig): Promise<AdMetrics> {
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const url =
    `${GRAPH}/${acct}/insights?level=account&time_increment=1&fields=spend,impressions,clicks,actions,action_values` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=400&access_token=${encodeURIComponent(token)}`

  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meta Ads: ${body?.error?.message ?? `status ${res.status}`}`)

  const rows: Array<Record<string, unknown>> = Array.isArray(body.data) ? body.data : []
  const wanted = resultKeys(config)
  const purchaseKeys = config.objectives.includes("ECOMMERCE") || config.trackRevenue ? META_PURCHASE_ACTIONS : new Set<string>()

  let spend = 0, impressions = 0, clicks = 0, pageViews = 0, results = 0, revenue = 0
  const perObjective = new Map<AdObjective, number>()
  const daily: import("@/lib/ads/types").DailyPoint[] = []

  for (const r of rows) {
    const rSpend = Number(r.spend ?? 0)
    const rImpr = Number(r.impressions ?? 0)
    const rClicks = Number(r.clicks ?? 0)
    const rPv = sumActions(r.actions as Action[], META_PAGEVIEW_ACTIONS)
    const rResults = sumActions(r.actions as Action[], wanted)
    const rRev = config.trackRevenue ? sumActions(r.action_values as Action[], purchaseKeys) : 0
    spend += rSpend
    impressions += rImpr
    clicks += rClicks
    pageViews += rPv
    results += rResults
    revenue += rRev
    // breakdown por objetivo (eventos custom ainda contam pro funil configurado)
    if (config.resultActions.length) {
      const tag: AdObjective = config.objectives[0] ?? "CUSTOM"
      perObjective.set(tag, (perObjective.get(tag) ?? 0) + rResults)
    } else {
      for (const obj of config.objectives) {
        perObjective.set(obj, (perObjective.get(obj) ?? 0) + sumActions(r.actions as Action[], new Set(META_DEFAULT_ACTIONS[obj])))
      }
    }
    daily.push({ date: String(r.date_start ?? ""), spend: rSpend, results: rResults, impressions: rImpr, clicks: rClicks, pageViews: rPv, revenue: rRev })
  }

  const breakdown: ResultBreakdown[] = [...perObjective.entries()].map(([objective, count]) => ({ objective, count }))
  return {
    provider: "META",
    spend, impressions, clicks, pageViews, results, breakdown,
    cpa: results > 0 ? spend / results : null,
    revenue: config.trackRevenue ? revenue : null,
    roas: config.trackRevenue && spend > 0 ? revenue / spend : null,
    daily,
  }
}

// Soma os valores de um campo de ação-array do Meta (video_p25_watched_actions etc).
const sumField = (arr: Action[] | undefined) => (arr ?? []).reduce((s, a) => s + Number(a.value ?? 0), 0)

const GENDER_LABEL: Record<string, string> = { male: "Homens", female: "Mulheres", unknown: "Não informado" }

// Análises profundas Meta: posicionamentos, demografia, alcance/frequência e retenção de vídeo.
export async function fetchMetaDeep(accountId: string, token: string, { since, until }: DateRange, config: AdConfig): Promise<MetaDeep> {
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const tr = encodeURIComponent(JSON.stringify({ since, until }))
  const wanted = resultKeys(config)

  const get = async (params: string) => {
    const res = await fetch(`${GRAPH}/${acct}/insights?level=account&time_range=${tr}&limit=500&access_token=${encodeURIComponent(token)}&${params}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Meta Ads: ${body?.error?.message ?? `status ${res.status}`}`)
    return (Array.isArray(body.data) ? body.data : []) as Record<string, unknown>[]
  }
  const row = (key: string, r: Record<string, unknown>): MetaBreakdownRow => {
    const spend = Number(r.spend ?? 0), impressions = Number(r.impressions ?? 0), clicks = Number(r.clicks ?? 0)
    const results = sumActions(r.actions as Action[], wanted)
    return { key, spend, impressions, clicks, results, cpa: results > 0 ? spend / results : null, ctr: impressions > 0 ? (clicks / impressions) * 100 : null }
  }
  // Agrega várias linhas (mesma chave) numa só.
  const aggregate = (rows: Record<string, unknown>[], keyOf: (r: Record<string, unknown>) => string) => {
    const m = new Map<string, MetaBreakdownRow>()
    for (const r of rows) {
      const k = keyOf(r)
      const cur = m.get(k) ?? { key: k, spend: 0, impressions: 0, clicks: 0, results: 0, cpa: null, ctr: null }
      const add = row(k, r)
      cur.spend += add.spend; cur.impressions += add.impressions; cur.clicks += add.clicks; cur.results += add.results
      m.set(k, cur)
    }
    return [...m.values()]
      .map((v) => ({ ...v, cpa: v.results > 0 ? v.spend / v.results : null, ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null }))
      .sort((a, b) => b.spend - a.spend)
  }

  const [placeRows, demoRows, totalRows] = await Promise.all([
    get("fields=spend,impressions,clicks,actions&breakdowns=publisher_platform,platform_position"),
    get("fields=spend,impressions,clicks,actions&breakdowns=age,gender"),
    get("fields=spend,reach,frequency,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions"),
  ])

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const placements = aggregate(placeRows, (r) => `${cap(String(r.publisher_platform ?? "—"))} · ${String(r.platform_position ?? "—").replace(/_/g, " ")}`)
  const byAge = aggregate(demoRows, (r) => String(r.age ?? "—"))
  const byGender = aggregate(demoRows, (r) => GENDER_LABEL[String(r.gender ?? "unknown")] ?? String(r.gender))

  const tot = totalRows[0] ?? {}
  return {
    placements, byAge, byGender,
    reach: Number(tot.reach ?? 0),
    frequency: Number(tot.frequency ?? 0),
    video: {
      plays: sumField(tot.video_play_actions as Action[]),
      p25: sumField(tot.video_p25_watched_actions as Action[]),
      p50: sumField(tot.video_p50_watched_actions as Action[]),
      p75: sumField(tot.video_p75_watched_actions as Action[]),
      p100: sumField(tot.video_p100_watched_actions as Action[]),
      thruplay: sumField(tot.video_thruplay_watched_actions as Action[]),
    },
  }
}

// Resumo legível do público (targeting) de um conjunto.
function summarizeTargeting(t: Record<string, unknown> | null): string | null {
  if (!t) return null
  const parts: string[] = []
  if (t.age_min || t.age_max) parts.push(`${t.age_min ?? "?"}-${t.age_max ?? "?"} anos`)
  const g = Array.isArray(t.genders) ? t.genders : null
  if (g) parts.push(g.includes(1) && !g.includes(2) ? "Homens" : g.includes(2) && !g.includes(1) ? "Mulheres" : "Todos")
  const geo = t.geo_locations as { countries?: string[]; cities?: { name: string }[] } | undefined
  if (geo?.cities?.length) parts.push(geo.cities.slice(0, 2).map((c) => c.name).join(", "))
  else if (geo?.countries?.length) parts.push(geo.countries.join(", "))
  const flex = (t.flexible_spec as Array<{ interests?: { name: string }[] }> | undefined) ?? []
  const interests = flex.flatMap((f) => f.interests ?? []).map((i) => i.name).slice(0, 3)
  if (interests.length) parts.push(`int: ${interests.join(", ")}`)
  const custom = Array.isArray(t.custom_audiences) ? t.custom_audiences.length : 0
  if (custom) parts.push(`${custom} público(s) salvo(s)`)
  return parts.join(" · ") || "Aberto / sem segmentação detalhada"
}

// Árvore completa do mês: Campanha → Conjunto (com público) → Anúncio (com preview).
export async function fetchMetaTree(accountId: string, token: string, { since, until }: DateRange, config: AdConfig): Promise<CampaignNode[]> {
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const tr = encodeURIComponent(JSON.stringify({ since, until }))
  const url =
    `${GRAPH}/${acct}/insights?level=ad&fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,video_thruplay_watched_actions` +
    `&time_range=${tr}&limit=500&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meta Ads: ${body?.error?.message ?? `status ${res.status}`}`)

  const wanted = resultKeys(config)
  type Acc = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number }
  const campaigns = new Map<string, Acc & { adsets: Map<string, Acc & { ads: AdNode[] }> }>()

  for (const r of (Array.isArray(body.data) ? body.data : []) as Record<string, unknown>[]) {
    const cId = String(r.campaign_id ?? ""), aId = String(r.adset_id ?? ""), adId = String(r.ad_id ?? "")
    const spend = Number(r.spend ?? 0), impressions = Number(r.impressions ?? 0), clicks = Number(r.clicks ?? 0)
    const results = sumActions(r.actions as Action[], wanted)
    const views3s = sumActions(r.actions as Action[], new Set(["video_view"]))

    let c = campaigns.get(cId)
    if (!c) { c = { id: cId, name: String(r.campaign_name ?? "—"), spend: 0, impressions: 0, clicks: 0, results: 0, adsets: new Map() }; campaigns.set(cId, c) }
    let s = c.adsets.get(aId)
    if (!s) { s = { id: aId, name: String(r.adset_name ?? "—"), spend: 0, impressions: 0, clicks: 0, results: 0, ads: [] }; c.adsets.set(aId, s) }
    for (const node of [c, s]) { node.spend += spend; node.impressions += impressions; node.clicks += clicks; node.results += results }
    s.ads.push({
      id: adId, name: String(r.ad_name ?? "—"), status: null, spend, impressions, clicks, results,
      cpa: results > 0 ? spend / results : null,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      hookRate: impressions > 0 ? (views3s / impressions) * 100 : null,
      convRate: clicks > 0 ? (results / clicks) * 100 : null,
      thumbnail: null, permalink: null,
    })
  }

  // Status (effective_status), público e preview — em lote e EM PARALELO (latência menor).
  const campaignIds = [...campaigns.keys()].filter(Boolean)
  const adsetIds = [...campaigns.values()].flatMap((c) => [...c.adsets.keys()]).filter(Boolean).slice(0, 100)
  const allAds = [...campaigns.values()].flatMap((c) => [...c.adsets.values()].flatMap((s) => s.ads))
  const topAdIds = [...allAds].sort((a, b) => b.spend - a.spend).slice(0, 40).map((a) => a.id).filter(Boolean)
  const audience = new Map<string, string | null>()
  const mStatus = (s: unknown): AdStatus => (s == null ? null : String(s) === "ACTIVE" ? "active" : "paused")
  const batch = (ids: string[], fields: string) =>
    ids.length ? fetch(`${GRAPH}/?ids=${ids.join(",")}&fields=${fields}&access_token=${encodeURIComponent(token)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null)
  const [campBody, targetBody, creativeBody] = await Promise.all([
    batch(campaignIds, "effective_status"),
    batch(adsetIds, "effective_status,targeting"),
    batch(topAdIds, "effective_status,creative{instagram_permalink_url,effective_object_story_id,thumbnail_url,image_url}"),
  ])
  if (targetBody) for (const id of adsetIds) audience.set(id, summarizeTargeting(targetBody?.[id]?.targeting ?? null))
  const adStatus = new Map<string, AdStatus>()
  if (creativeBody) for (const ad of allAds) {
    const cr = creativeBody?.[ad.id]?.creative
    if (cr) { ad.permalink = cr.instagram_permalink_url ?? (cr.effective_object_story_id ? `https://facebook.com/${cr.effective_object_story_id}` : null); ad.thumbnail = cr.image_url ?? cr.thumbnail_url ?? null }
    adStatus.set(ad.id, mStatus(creativeBody?.[ad.id]?.effective_status))
  }

  const finish = (a: Acc) => ({ ...a, cpa: a.results > 0 ? a.spend / a.results : null, ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : null })
  return [...campaigns.values()]
    .filter((c) => c.impressions > 0)
    .sort((a, b) => b.spend - a.spend)
    .map((c) => ({
      ...finish(c),
      status: mStatus(campBody?.[c.id]?.effective_status),
      adsets: [...c.adsets.values()].filter((s) => s.impressions > 0).sort((a, b) => b.spend - a.spend).map((s) => ({
        ...finish(s),
        status: mStatus(targetBody?.[s.id]?.effective_status),
        audience: audience.get(s.id) ?? null,
        ads: s.ads.filter((ad) => ad.impressions > 0).sort((a, b) => b.spend - a.spend).map((ad) => ({ ...ad, status: adStatus.get(ad.id) ?? null })),
      })),
    }))
}

// Lista os eventos (action_type) presentes na conta nos últimos 90d — pra IA/ajuste avançado.
export async function discoverMetaActions(accountId: string, token: string): Promise<{ actionType: string; count: number }[]> {
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const url = `${GRAPH}/${acct}/insights?level=account&fields=actions&date_preset=last_90d&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meta Ads: ${body?.error?.message ?? `status ${res.status}`}`)
  const row = Array.isArray(body.data) ? body.data[0] : null
  const actions: Action[] = row?.actions ?? []
  return actions.map((a) => ({ actionType: a.action_type, count: Number(a.value ?? 0) })).sort((a, b) => b.count - a.count)
}
