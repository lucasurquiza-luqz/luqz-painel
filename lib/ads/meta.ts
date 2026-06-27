import { monthRange, META_DEFAULT_ACTIONS, META_PURCHASE_ACTIONS, type AdConfig, type AdMetrics } from "@/lib/ads/types"

const GRAPH = "https://graph.facebook.com/v21.0"

type Action = { action_type: string; value: string }

// Lê insights de uma conta Meta no mês, com o token DO CLIENTE, conforme a config de conversão.
export async function fetchMetaInsights(accountId: string, token: string, month: string, config: AdConfig): Promise<AdMetrics> {
  const { since, until } = monthRange(month)
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const url =
    `${GRAPH}/${acct}/insights?level=account&fields=spend,impressions,clicks,actions,action_values` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&access_token=${encodeURIComponent(token)}`

  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meta Ads: ${body?.error?.message ?? `status ${res.status}`}`)

  const row = Array.isArray(body.data) ? body.data[0] : null
  const spend = row ? Number(row.spend ?? 0) : 0
  const impressions = row ? Number(row.impressions ?? 0) : 0
  const clicks = row ? Number(row.clicks ?? 0) : 0

  const wanted = new Set(config.resultActions.length ? config.resultActions : META_DEFAULT_ACTIONS[config.objective])
  const sumActions = (arr: Action[] | undefined, keys: Set<string>) =>
    (arr ?? []).filter((a) => keys.has(a.action_type)).reduce((s, a) => s + Number(a.value ?? 0), 0)

  const results = sumActions(row?.actions, wanted)
  const revenue = config.trackRevenue ? sumActions(row?.action_values, META_PURCHASE_ACTIONS) : 0

  return {
    provider: "META",
    spend,
    impressions,
    clicks,
    results,
    cpa: results > 0 ? spend / results : null,
    revenue: config.trackRevenue ? revenue : null,
    roas: config.trackRevenue && spend > 0 ? revenue / spend : null,
  }
}

// Lista os eventos (action_type) presentes na conta nos últimos 90d — pra config fluida.
export async function discoverMetaActions(accountId: string, token: string): Promise<{ actionType: string; count: number }[]> {
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const url = `${GRAPH}/${acct}/insights?level=account&fields=actions&date_preset=last_90d&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Meta Ads: ${body?.error?.message ?? `status ${res.status}`}`)
  const row = Array.isArray(body.data) ? body.data[0] : null
  const actions: Action[] = row?.actions ?? []
  return actions
    .map((a) => ({ actionType: a.action_type, count: Number(a.value ?? 0) }))
    .sort((a, b) => b.count - a.count)
}
