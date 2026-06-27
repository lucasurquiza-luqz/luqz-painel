import { monthRange, type AdMetrics } from "@/lib/ads/types"

const GRAPH = "https://graph.facebook.com/v21.0"
const LEAD_ACTIONS = new Set([
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
  "onsite_web_lead",
])

// Lê insights de uma conta Meta (act_...) no mês, com o token DO CLIENTE.
export async function fetchMetaInsights(accountId: string, token: string, month: string): Promise<AdMetrics> {
  const { since, until } = monthRange(month)
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`
  const url =
    `${GRAPH}/${acct}/insights?level=account&fields=spend,actions` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&access_token=${encodeURIComponent(token)}`

  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.message ?? `status ${res.status}`
    throw new Error(`Meta Ads: ${msg}`)
  }
  const row = Array.isArray(body.data) ? body.data[0] : null
  const spend = row ? Number(row.spend ?? 0) : 0
  const leads = row?.actions
    ? row.actions.filter((a: { action_type: string }) => LEAD_ACTIONS.has(a.action_type)).reduce((s: number, a: { value: string }) => s + Number(a.value ?? 0), 0)
    : 0
  return { provider: "META", spend, leads, cpa: leads > 0 ? spend / leads : null }
}
