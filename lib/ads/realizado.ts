import { prisma } from "@/lib/db"
import { decryptSecret } from "@/lib/crypto-secrets"
import { fetchMetaInsights } from "@/lib/ads/meta"
import { fetchGoogleInsights } from "@/lib/ads/google"
import { effectiveObjectives, monthRange, type AdConfig, type AdMetrics, type AdObjective, type DailyPoint, type DateRange, type ResultBreakdown } from "@/lib/ads/types"
import { cpa as calcCpa, roas as calcRoas, ctr as calcCtr, cpc as calcCpc, cpm as calcCpm } from "@/lib/ads/calc"

export type ProviderResult = (AdMetrics & { error?: undefined }) | { provider: "META" | "GOOGLE"; error: string }
export type Totals = { spend: number; impressions: number; clicks: number; pageViews: number; results: number; followers: number; cpa: number | null; revenue: number | null; roas: number | null; ctr: number | null; cpc: number | null; cpm: number | null }
export type Realizado = {
  byProvider: ProviderResult[]
  total: Totals
  breakdown: ResultBreakdown[]
  daily: DailyPoint[]
  trackRevenue: boolean
  configured: boolean
}
export type Performance = {
  month: string
  current: Realizado
  previous: Totals
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

// Performance de um período arbitrário + janela anterior (para tendência).
export async function getClientPerformance(clientId: string, range: DateRange, prevRange: DateRange): Promise<Performance> {
  const [current, previous] = await Promise.all([
    getClientRealizado(clientId, range),
    getClientRealizado(clientId, prevRange),
  ])
  return { month: range.since.slice(0, 7), current, previous: previous.total }
}

// Conveniência: mês fechado (usa o mês anterior como comparação).
export function getClientPerformanceByMonth(clientId: string, month: string): Promise<Performance> {
  return getClientPerformance(clientId, monthRange(month), monthRange(prevMonth(month)))
}

export async function getClientRealizado(clientId: string, range: DateRange): Promise<Realizado> {
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
        byProvider.push(await fetchMetaInsights(acc.accountId, decryptSecret(acc.tokenEnc), range, config))
      } else {
        byProvider.push(await fetchGoogleInsights(acc.accountId, range, config))
      }
    } catch (error) {
      byProvider.push({ provider: acc.provider, error: error instanceof Error ? error.message : "Falha ao ler." })
    }
  }

  const ok = byProvider.filter((r): r is AdMetrics => !("error" in r && r.error !== undefined))
  const spend = ok.reduce((s, r) => s + r.spend, 0)
  const results = ok.reduce((s, r) => s + r.results, 0)
  const followers = ok.reduce((s, r) => s + (r.followers ?? 0), 0)

  // Breakdown consolidado por objetivo (soma entre providers).
  const byObj = new Map<AdObjective, number>()
  for (const r of ok) for (const b of r.breakdown) byObj.set(b.objective, (byObj.get(b.objective) ?? 0) + b.count)
  const breakdown = [...byObj.entries()].map(([objective, count]) => ({ objective, count }))

  const revenueVals = ok.map((r) => r.revenue).filter((v): v is number => v != null)
  const revenue = revenueVals.length ? revenueVals.reduce((s, v) => s + v, 0) : null

  // Série diária mesclada (soma entre providers por data).
  const byDay = new Map<string, Omit<DailyPoint, "date">>()
  for (const r of ok) for (const d of r.daily) {
    const prev = byDay.get(d.date) ?? { spend: 0, results: 0, impressions: 0, clicks: 0, pageViews: 0, revenue: 0 }
    byDay.set(d.date, {
      spend: prev.spend + d.spend, results: prev.results + d.results,
      impressions: prev.impressions + d.impressions, clicks: prev.clicks + d.clicks,
      pageViews: prev.pageViews + d.pageViews, revenue: prev.revenue + d.revenue,
    })
  }
  const daily: DailyPoint[] = [...byDay.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date))

  const impressions = ok.reduce((s, r) => s + r.impressions, 0)
  const clicks = ok.reduce((s, r) => s + r.clicks, 0)
  return {
    byProvider,
    daily,
    total: {
      spend,
      impressions,
      clicks,
      pageViews: ok.reduce((s, r) => s + r.pageViews, 0),
      results,
      followers,
      cpa: calcCpa(spend, results),
      revenue,
      roas: calcRoas(revenue, spend),
      ctr: calcCtr(clicks, impressions),
      cpc: calcCpc(spend, clicks),
      cpm: calcCpm(spend, impressions),
    },
    breakdown,
    trackRevenue: accounts.some((a) => a.trackRevenue),
    configured: accounts.length > 0,
  }
}
