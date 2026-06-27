import { monthRange, META_DEFAULT_ACTIONS, META_PURCHASE_ACTIONS, type AdConfig, type AdMetrics, type AdObjective, type BreakdownLevel, type BreakdownRow, type ResultBreakdown } from "@/lib/ads/types"

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

// Lê insights de uma conta Meta no mês (com série DIÁRIA), token DO CLIENTE, conforme a config.
export async function fetchMetaInsights(accountId: string, token: string, month: string, config: AdConfig): Promise<AdMetrics> {
  const { since, until } = monthRange(month)
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

  let spend = 0, impressions = 0, clicks = 0, results = 0, revenue = 0
  const perObjective = new Map<AdObjective, number>()
  const daily: { date: string; spend: number; results: number }[] = []

  for (const r of rows) {
    const rSpend = Number(r.spend ?? 0)
    const rResults = sumActions(r.actions as Action[], wanted)
    spend += rSpend
    impressions += Number(r.impressions ?? 0)
    clicks += Number(r.clicks ?? 0)
    results += rResults
    if (config.trackRevenue) revenue += sumActions(r.action_values as Action[], purchaseKeys)
    // breakdown por objetivo
    if (config.resultActions.length) {
      perObjective.set("CUSTOM", (perObjective.get("CUSTOM") ?? 0) + rResults)
    } else {
      for (const obj of config.objectives) {
        perObjective.set(obj, (perObjective.get(obj) ?? 0) + sumActions(r.actions as Action[], new Set(META_DEFAULT_ACTIONS[obj])))
      }
    }
    daily.push({ date: String(r.date_start ?? ""), spend: rSpend, results: rResults })
  }

  const breakdown: ResultBreakdown[] = [...perObjective.entries()].map(([objective, count]) => ({ objective, count }))
  return {
    provider: "META",
    spend, impressions, clicks, results, breakdown,
    cpa: results > 0 ? spend / results : null,
    revenue: config.trackRevenue ? revenue : null,
    roas: config.trackRevenue && spend > 0 ? revenue / spend : null,
    daily,
  }
}

// Quebra por campanha / público (adset) / criativo (ad) no mês — "melhores".
export async function fetchMetaBreakdown(accountId: string, token: string, month: string, config: AdConfig, level: BreakdownLevel): Promise<BreakdownRow[]> {
  const { since, until } = monthRange(month)
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const nameField = level === "campaign" ? "campaign_name" : level === "adset" ? "adset_name" : "ad_name"
  const url =
    `${GRAPH}/${acct}/insights?level=${level}&fields=${nameField},spend,impressions,clicks,actions` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=200&access_token=${encodeURIComponent(token)}`

  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meta Ads: ${body?.error?.message ?? `status ${res.status}`}`)

  const wanted = resultKeys(config)
  const rows: BreakdownRow[] = (Array.isArray(body.data) ? body.data : []).map((r: Record<string, unknown>) => {
    const spend = Number(r.spend ?? 0)
    const impressions = Number(r.impressions ?? 0)
    const clicks = Number(r.clicks ?? 0)
    const results = sumActions(r.actions as Action[], wanted)
    return {
      name: String(r[nameField] ?? "—"),
      spend, impressions, clicks, results,
      cpa: results > 0 ? spend / results : null,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    }
  })
  // Ordena por resultado desc, depois por gasto desc.
  return rows.sort((a, b) => b.results - a.results || b.spend - a.spend)
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
