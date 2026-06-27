import { monthRange, AdsNotConfiguredError, type AdMetrics } from "@/lib/ads/types"

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

// Lê métricas de um customer (sem traços) no mês, via MCC central.
export async function fetchGoogleInsights(customerId: string, month: string): Promise<AdMetrics> {
  const env = googleEnv()
  const cid = customerId.replace(/-/g, "")
  const { since, until } = monthRange(month)
  const token = await accessToken(env)

  const query = `SELECT metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'`
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

  let costMicros = 0
  let conversions = 0
  const batches = Array.isArray(body) ? body : [body]
  for (const batch of batches) {
    for (const row of batch.results ?? []) {
      costMicros += Number(row.metrics?.costMicros ?? 0)
      conversions += Number(row.metrics?.conversions ?? 0)
    }
  }
  const spend = costMicros / 1_000_000
  const leads = Math.round(conversions)
  return { provider: "GOOGLE", spend, leads, cpa: leads > 0 ? spend / leads : null }
}
