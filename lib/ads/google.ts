import { AdsNotConfiguredError, type AdConfig, type AdMetrics, type GoogleCampaign, type GoogleKeyword, type GoogleSearchTerm, type DateRange } from "@/lib/ads/types"
import { rowRatios as ratios } from "@/lib/ads/calc"

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

// Árvore do mês: Campanha → Grupo de anúncios → Palavra-chave (via MCC central).
export async function fetchGoogleTree(customerId: string, { since, until }: DateRange): Promise<GoogleCampaign[]> {
  const cid = customerId.replace(/-/g, "")
  const where = `WHERE segments.date BETWEEN '${since}' AND '${until}'`
  const M = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions"

  const [adGroupRows, kwRows] = await Promise.all([
    gaql(cid, `SELECT campaign.id, campaign.name, campaign.status, ad_group.id, ad_group.name, ad_group.status, ${M} FROM ad_group ${where}`),
    gaql(cid, `SELECT ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ${M} FROM keyword_view ${where}`),
  ])

  const mtr = (row: Record<string, any>) => ({
    spend: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
    impressions: Number(row.metrics?.impressions ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    results: Math.round(Number(row.metrics?.conversions ?? 0)),
  })
  const gStatus = (s: unknown): "active" | "paused" => (String(s ?? "") === "ENABLED" ? "active" : "paused")

  // Palavras-chave agrupadas por ad_group.
  const kwByGroup = new Map<string, GoogleKeyword[]>()
  for (const row of kwRows) {
    const gId = String(row.adGroup?.id ?? "")
    const kw = row.adGroupCriterion?.keyword
    if (!gId || !kw?.text) continue
    const list = kwByGroup.get(gId) ?? []
    list.push(ratios({ text: String(kw.text), matchType: String(kw.matchType ?? "—"), status: gStatus(row.adGroupCriterion?.status), ...mtr(row) }))
    kwByGroup.set(gId, list)
  }

  // Campanhas → grupos. Status da campanha = mais "ativo" entre seus grupos (ENABLED se algum ativo).
  const campaigns = new Map<string, GoogleCampaign>()
  for (const row of adGroupRows) {
    const cId = String(row.campaign?.id ?? ""), gId = String(row.adGroup?.id ?? "")
    if (!cId || !gId) continue
    const m = mtr(row)
    const campActive = gStatus(row.campaign?.status) === "active"
    let c = campaigns.get(cId)
    if (!c) { c = { id: cId, name: String(row.campaign?.name ?? "—"), status: campActive ? "active" : "paused", spend: 0, impressions: 0, clicks: 0, results: 0, cpa: null, ctr: null, adGroups: [] }; campaigns.set(cId, c) }
    c.spend += m.spend; c.impressions += m.impressions; c.clicks += m.clicks; c.results += m.results
    c.adGroups.push(ratios({ id: gId, name: String(row.adGroup?.name ?? "—"), status: gStatus(row.adGroup?.status), ...m, keywords: (kwByGroup.get(gId) ?? []).sort((a, b) => b.spend - a.spend) }))
  }

  return [...campaigns.values()]
    .filter((c) => c.impressions > 0)
    .map((c) => ({ ...ratios(c), adGroups: c.adGroups.filter((g) => g.impressions > 0).sort((a, b) => b.spend - a.spend) }))
    .sort((a, b) => b.spend - a.spend)
}

// Termos de busca reais (o que o usuário digitou) — valor específico do Google.
export async function fetchGoogleSearchTerms(customerId: string, { since, until }: DateRange): Promise<GoogleSearchTerm[]> {
  const cid = customerId.replace(/-/g, "")
  const rows = await gaql(cid, `SELECT search_term_view.search_term, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM search_term_view WHERE segments.date BETWEEN '${since}' AND '${until}'`)
  const m = new Map<string, GoogleSearchTerm>()
  for (const row of rows) {
    const term = String(row.searchTermView?.searchTerm ?? "").trim()
    if (!term) continue
    const cur = m.get(term) ?? { term, spend: 0, impressions: 0, clicks: 0, results: 0, cpa: null, ctr: null }
    cur.spend += Number(row.metrics?.costMicros ?? 0) / 1_000_000
    cur.impressions += Number(row.metrics?.impressions ?? 0)
    cur.clicks += Number(row.metrics?.clicks ?? 0)
    cur.results += Number(row.metrics?.conversions ?? 0)
    m.set(term, cur)
  }
  return [...m.values()]
    .map((t) => ({ ...t, results: Math.round(t.results), cpa: t.results >= 1 ? t.spend / t.results : null, ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 60)
}

// Ações de conversão que alimentam metrics.conversions, com contagem (revisão de conversões).
export async function fetchGoogleConversionActions(customerId: string, { since, until }: DateRange): Promise<{ name: string; conversions: number }[]> {
  const cid = customerId.replace(/-/g, "")
  const rows = await gaql(cid, `SELECT segments.conversion_action_name, metrics.conversions, metrics.all_conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'`)
  const m = new Map<string, number>()
  for (const row of rows) {
    const name = String(row.segments?.conversionActionName ?? "—")
    m.set(name, (m.get(name) ?? 0) + Number(row.metrics?.conversions ?? 0))
  }
  return [...m.entries()].map(([name, conversions]) => ({ name, conversions: Math.round(conversions * 100) / 100 })).sort((a, b) => b.conversions - a.conversions)
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
export async function fetchGoogleInsights(customerId: string, { since, until }: DateRange, config: AdConfig): Promise<AdMetrics> {
  const env = googleEnv()
  const cid = customerId.replace(/-/g, "")
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
