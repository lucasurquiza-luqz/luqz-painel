import { prisma } from "@/lib/db"
import { decryptSecret } from "@/lib/crypto-secrets"
import { fetchMetaInsights } from "@/lib/ads/meta"
import { fetchGoogleInsights } from "@/lib/ads/google"
import { effectiveObjectives, type AdConfig, type AdMetrics, type AdObjective, type ResultBreakdown } from "@/lib/ads/types"

export type ProviderResult = (AdMetrics & { error?: undefined }) | { provider: "META" | "GOOGLE"; error: string }
export type Realizado = {
  byProvider: ProviderResult[]
  total: { spend: number; impressions: number; clicks: number; results: number; cpa: number | null; revenue: number | null; roas: number | null }
  breakdown: ResultBreakdown[]
  trackRevenue: boolean
  configured: boolean
}

export async function getClientRealizado(clientId: string, month: string): Promise<Realizado> {
  const accounts = await prisma.clientAdAccount.findMany({ where: { clientId } })
  const byProvider: ProviderResult[] = []

  for (const acc of accounts) {
    const config: AdConfig = {
      objectives: effectiveObjectives(acc.objectives as AdObjective[], acc.objective as AdObjective),
      resultActions: acc.resultActions,
      trackRevenue: acc.trackRevenue,
    }
    try {
      if (acc.provider === "META") {
        if (!acc.tokenEnc) { byProvider.push({ provider: "META", error: "Sem token cadastrado." }); continue }
        byProvider.push(await fetchMetaInsights(acc.accountId, decryptSecret(acc.tokenEnc), month, config))
      } else {
        byProvider.push(await fetchGoogleInsights(acc.accountId, month, config))
      }
    } catch (error) {
      byProvider.push({ provider: acc.provider, error: error instanceof Error ? error.message : "Falha ao ler." })
    }
  }

  const ok = byProvider.filter((r): r is AdMetrics => !("error" in r && r.error !== undefined))
  const spend = ok.reduce((s, r) => s + r.spend, 0)
  const results = ok.reduce((s, r) => s + r.results, 0)

  // Breakdown consolidado por objetivo (soma entre providers).
  const byObj = new Map<AdObjective, number>()
  for (const r of ok) for (const b of r.breakdown) byObj.set(b.objective, (byObj.get(b.objective) ?? 0) + b.count)
  const breakdown = [...byObj.entries()].map(([objective, count]) => ({ objective, count }))

  const revenueVals = ok.map((r) => r.revenue).filter((v): v is number => v != null)
  const revenue = revenueVals.length ? revenueVals.reduce((s, v) => s + v, 0) : null

  return {
    byProvider,
    total: {
      spend,
      impressions: ok.reduce((s, r) => s + r.impressions, 0),
      clicks: ok.reduce((s, r) => s + r.clicks, 0),
      results,
      cpa: results > 0 ? spend / results : null,
      revenue,
      roas: revenue != null && spend > 0 ? revenue / spend : null,
    },
    breakdown,
    trackRevenue: accounts.some((a) => a.trackRevenue),
    configured: accounts.length > 0,
  }
}
