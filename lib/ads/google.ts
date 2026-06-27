import { monthRange, AdsNotConfiguredError, type AdConfig, type AdMetrics } from "@/lib/ads/types"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const ADS_API = "https://googleads.googleapis.com/v17"

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
  const perDay = new Map<string, { spend: number; results: number }>()
  const batches = Array.isArray(body) ? body : [body]
  for (const batch of batches) {
    for (const row of batch.results ?? []) {
      const c = Number(row.metrics?.costMicros ?? 0) / 1_000_000
      const conv = Number(row.metrics?.conversions ?? 0)
      costMicros += Number(row.metrics?.costMicros ?? 0)
      impressions += Number(row.metrics?.impressions ?? 0)
      clicks += Number(row.metrics?.clicks ?? 0)
      conversions += conv
      convValue += Number(row.metrics?.conversionsValue ?? 0)
      const date = String(row.segments?.date ?? "")
      const prev = perDay.get(date) ?? { spend: 0, results: 0 }
      perDay.set(date, { spend: prev.spend + c, results: prev.results + conv })
    }
  }
  const spend = costMicros / 1_000_000
  const results = Math.round(conversions)
  const objective = config.objectives[0] ?? "CUSTOM"
  const daily = [...perDay.entries()].map(([date, v]) => ({ date, spend: v.spend, results: Math.round(v.results) })).sort((a, b) => a.date.localeCompare(b.date))
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
