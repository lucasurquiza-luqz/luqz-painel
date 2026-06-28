import { monthRange, AdsNotConfiguredError, type AdConfig, type AdMetrics, type GoogleCampaign, type GoogleAdGroup, type GoogleKeyword } from "@/lib/ads/types"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const ADS_API = "https://googleads.googleapis.com/v21"

// Credenciais centrais do MCC (env do Dash) — Google é centralizado.
function googleEnv() {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, "")
  if (!developerToken || !clientId || !clientSecret || !refreshToken || !loginCustomerId) {
    throw new AdsNotConfiguredError("Credenciais do Google Ads (MCC) não configuradas no ambiente do Dash.")
  }
  return { developerToken, clientId, clientSecret, refreshToken, loginCustomerId }
}

async function accessToken(env: ReturnType<typeof googleEnv>): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: env.refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Google OAuth: ${body?.error_description ?? res.status}`)
  return body.access_token as string
}

// Executa um GAQL e devolve as linhas achatadas (searchStream → results[]).
async function gaql(cid: string, query: string): Promise<Record<string, any>[]> {
  const env = googleEnv()
  const token = await accessToken(env)
  const res = await fetch(`${ADS_API}/customers/${cid.replace(/-/g, "")}/googleAds:searchStream`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "developer-token": env.developerToken, "login-customer-id": env.loginCustomerId, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(body) ? body[0]?.error?.message : body?.error?.message
    throw new Error(`Google Ads: ${msg ?? res.status}`)
  }
  return (Array.isArray(body) ? body : [body]).flatMap((b) => b.results ?? [])
}

const ratios = <T extends { spend: number; impressions: number; clicks: number; results: number }>(n: T) =>
  ({ ...n, cpa: n.results > 0 ? n.spend / n.results : null, ctr: n.impressions > 0 ? (n.clicks / n.impressions) * 100 : null })

// Árvore do mês: Campanha → Grupo de anúncios → Palavra-chave (via MCC central).
export async function fetchGoogleTree(customerId: string, month: string): Promise<GoogleCampaign[]> {
  const cid = customerId.replace(/-/g, "")
  const { since, until } = monthRange(month)
  const where = `WHERE segments.date BETWEEN '${since}' AND '${until}'`
  const M = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions"

  const [adGroupRows, kwRows] = await Promise.all([
    gaql(cid, `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ${M} FROM ad_group ${where}`),
    gaql(cid, `SELECT ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ${M} FROM keyword_view ${where}`),
  ])

  const mtr = (row: Record<string, any>) => ({
    spend: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
    impressions: Number(row.metrics?.impressions ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    results: Math.round(Number(row.metrics?.conversions ?? 0)),
  })

  // Palavras-chave agrupadas por ad_group.
  const kwByGroup = new Map<string, GoogleKeyword[]>()
  for (const row of kwRows) {
    const gId = String(row.adGroup?.id ?? "")
    const kw = row.adGroupCriterion?.keyword
    if (!gId || !kw?.text) continue
    const list = kwByGroup.get(gId) ?? []
    list.push(ratios({ text: String(kw.text), matchType: String(kw.matchType ?? "—"), ...mtr(row) }))
    kwByGroup.set(gId, list)
  }

  // Campanhas → grupos.
  const campaigns = new Map<string, GoogleCampaign>()
  for (const row of adGroupRows) {
    const cId = String(row.campaign?.id ?? ""), gId = String(row.adGroup?.id ?? "")
    if (!cId || !gId) continue
    const m = mtr(row)
    let c = campaigns.get(cId)
    if (!c) { c = { id: cId, name: String(row.campaign?.name ?? "—"), spend: 0, impressions: 0, clicks: 0, results: 0, cpa: null, ctr: null, adGroups: [] }; campaigns.set(cId, c) }
    c.spend += m.spend; c.impressions += m.impressions; c.clicks += m.clicks; c.results += m.results
    c.adGroups.push(ratios({ id: gId, name: String(row.adGroup?.name ?? "—"), ...m, keywords: (kwByGroup.get(gId) ?? []).sort((a, b) => b.spend - a.spend) }))
  }

  return [...campaigns.values()]
    .filter((c) => c.impressions > 0)
    .map((c) => ({ ...ratios(c), adGroups: c.adGroups.filter((g) => g.impressions > 0).sort((a, b) => b.spend - a.spend) }))
    .sort((a, b) => b.spend - a.spend)
}

// Lista as contas gerenciadas pelo MCC (id + nome) — para auto-mapear aos clientes.
export async function listMccAccounts(): Promise<{ customerId: string; name: string }[]> {
  const env = googleEnv()
  const token = await accessToken(env)
  const query = "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager FROM customer_client WHERE customer_client.level <= 2"
  const res = await fetch(`${ADS_API}/customers/${env.loginCustomerId}/googleAds:searchStream`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "developer-token": env.developerToken, "login-customer-id": env.loginCustomerId, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(body) ? body[0]?.error?.message : body?.error?.message
    throw new Error(`Google Ads: ${msg ?? res.status}`)
  }
  const out: { customerId: string; name: string }[] = []
  for (const batch of Array.isArray(body) ? body : [body]) {
    for (const row of batch.results ?? []) {
      const cc = row.customerClient
      if (!cc || cc.manager) continue // pula contas gerenciadoras
      out.push({ customerId: String(cc.id), name: String(cc.descriptiveName ?? cc.id) })
    }
  }
  return out
}

// Lê métricas de um customer (sem traços) no mês, via MCC central.
export async function fetchGoogleInsights(customerId: string, month: string, config: AdConfig): Promise<AdMetrics> {
  const env = googleEnv()
  const cid = customerId.replace(/-/g, "")
  const { since, until } = monthRange(month)
  const token = await accessToken(env)

  const query = `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'`
  const res = await fetch(`${ADS_API}/customers/${cid}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": env.developerToken,
      "login-customer-id": env.loginCustomerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(body) ? body[0]?.error?.message : body?.error?.message
    throw new Error(`Google Ads: ${msg ?? res.status}`)
  }

  let costMicros = 0, impressions = 0, clicks = 0, conversions = 0, convValue = 0
  const perDay = new Map<string, { spend: number; results: number; impressions: number; clicks: number; revenue: number }>()
  const batches = Array.isArray(body) ? body : [body]
  for (const batch of batches) {
    for (const row of batch.results ?? []) {
      const c = Number(row.metrics?.costMicros ?? 0) / 1_000_000
      const conv = Number(row.metrics?.conversions ?? 0)
      const impr = Number(row.metrics?.impressions ?? 0)
      const clk = Number(row.metrics?.clicks ?? 0)
      const val = Number(row.metrics?.conversionsValue ?? 0)
      costMicros += Number(row.metrics?.costMicros ?? 0)
      impressions += impr
      clicks += clk
      conversions += conv
      convValue += val
      const date = String(row.segments?.date ?? "")
      const prev = perDay.get(date) ?? { spend: 0, results: 0, impressions: 0, clicks: 0, revenue: 0 }
      perDay.set(date, { spend: prev.spend + c, results: prev.results + conv, impressions: prev.impressions + impr, clicks: prev.clicks + clk, revenue: prev.revenue + val })
    }
  }
  const spend = costMicros / 1_000_000
  const results = Math.round(conversions)
  const objective = config.objectives[0] ?? "CUSTOM"
  const daily = [...perDay.entries()]
    .map(([date, v]) => ({ date, spend: v.spend, results: Math.round(v.results), impressions: v.impressions, clicks: v.clicks, pageViews: 0, revenue: config.trackRevenue ? v.revenue : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    provider: "GOOGLE",
    spend, impressions, clicks, pageViews: 0, results,
    breakdown: [{ objective, count: results }],
    cpa: results > 0 ? spend / results : null,
    revenue: config.trackRevenue ? convValue : null,
    roas: config.trackRevenue && spend > 0 ? convValue / spend : null,
    daily,
  }
}
