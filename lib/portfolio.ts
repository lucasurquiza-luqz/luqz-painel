import { prisma } from "@/lib/db"
import { formatInTimeZone } from "date-fns-tz"
import { getClientsMonthTotals, type MonthTotal } from "@/lib/ads/snapshot"
import { computeAlerts, type Alert } from "@/lib/alerts"

const TZ = "America/Sao_Paulo"
const num = (v: unknown) => (v == null ? null : Number(v))

export type PortfolioPerformance = {
  month: string
  results: Map<string, MonthTotal>
  alertsByClient: Map<string, Alert[]>
  totals: { spend: number; results: number; cpaAvg: number | null; accountsInAlert: number; totalAlerts: number }
}

// Performance + alertas da carteira no mês corrente — dos snapshots + metas (sem chamar API).
// Fonte única usada pela Torre e pelo Resumo Diário.
export async function getPortfolioPerformance(clients: { id: string; active: boolean }[]): Promise<PortfolioPerformance> {
  const month = formatInTimeZone(new Date(), TZ, "yyyy-MM")
  const results = await getClientsMonthTotals(clients.map((c) => c.id), month)

  const plans = await prisma.mediaPlan.findMany({ where: { month }, select: { clientId: true, platform: true, budget: true, targetCpa: true, targetRoas: true } })
  const planByClient = new Map<string, (typeof plans)[number]>()
  for (const p of plans) { if (!planByClient.has(p.clientId) || p.platform === "TOTAL") planByClient.set(p.clientId, p) }

  const dayOfMonth = Number(formatInTimeZone(new Date(), TZ, "d"))
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()

  const alertsByClient = new Map<string, Alert[]>()
  let spend = 0, resultsSum = 0, accountsInAlert = 0, totalAlerts = 0
  for (const c of clients) {
    const r = results.get(c.id)
    if (!r) continue
    spend += r.spend; resultsSum += r.results
    if (!c.active) continue
    const p = planByClient.get(c.id)
    const a = computeAlerts({ configured: r.configured, spend: r.spend, cpa: r.cpa, roas: r.roas, targetCpa: num(p?.targetCpa), targetRoas: num(p?.targetRoas), budget: num(p?.budget), dayOfMonth, daysInMonth })
    if (a.length) { alertsByClient.set(c.id, a); accountsInAlert++; totalAlerts += a.length }
  }
  return { month, results, alertsByClient, totals: { spend, results: resultsSum, cpaAvg: resultsSum > 0 ? spend / resultsSum : null, accountsInAlert, totalAlerts } }
}
