import { formatInTimeZone } from "date-fns-tz"
import { prisma } from "@/lib/db"
import { getClientPerformance, getClientPerformanceByMonth, type Performance } from "@/lib/ads/realizado"
import { previousRange, type DateRange } from "@/lib/ads/types"

const TZ = "America/Sao_Paulo"

export type CachedPerformance = { performance: Performance; fetchedAt: string; cached: boolean }

// Período arbitrário, sempre ao vivo (sem cache) — para intervalos custom/presets de dias.
export async function getLivePerformance(clientId: string, range: DateRange): Promise<CachedPerformance> {
  const performance = await getClientPerformance(clientId, range, previousRange(range))
  return { performance, fetchedAt: new Date().toISOString(), cached: false }
}

// Refaz a leitura nas APIs de Ads e regrava o snapshot do mês.
export async function refreshPerformanceSnapshot(clientId: string, month: string): Promise<Performance> {
  const performance = await getClientPerformanceByMonth(clientId, month)
  await prisma.performanceSnapshot.upsert({
    where: { clientId_month: { clientId, month } },
    create: { clientId, month, data: performance as object },
    update: { data: performance as object, fetchedAt: new Date() },
  })
  return performance
}

// Lê do cache; se não existir (ou forceRefresh), busca e grava.
export async function getCachedPerformance(clientId: string, month: string, forceRefresh = false): Promise<CachedPerformance> {
  if (!forceRefresh) {
    const snap = await prisma.performanceSnapshot.findUnique({ where: { clientId_month: { clientId, month } } })
    if (snap) return { performance: snap.data as unknown as Performance, fetchedAt: snap.fetchedAt.toISOString(), cached: true }
  }
  const performance = await refreshPerformanceSnapshot(clientId, month)
  return { performance, fetchedAt: new Date().toISOString(), cached: false }
}

// Cron: atualiza o snapshot do mês atual de todos os clientes ativos com conta de Ads.
export async function refreshActiveSnapshots(): Promise<{ refreshed: number; failed: number }> {
  const month = formatInTimeZone(new Date(), TZ, "yyyy-MM")
  const clients = await prisma.client.findMany({
    where: { active: true, adAccounts: { some: {} } },
    select: { id: true },
  })
  let refreshed = 0, failed = 0
  for (const c of clients) {
    try { await refreshPerformanceSnapshot(c.id, month); refreshed++ }
    catch (e) { failed++; console.error(`[cron] perf snapshot ${c.id}:`, e instanceof Error ? e.message : e) }
  }
  return { refreshed, failed }
}

// Histórico mensal a partir dos snapshots já gravados.
export async function getPerformanceHistory(clientId: string, limit = 6): Promise<Array<{ month: string; spend: number; results: number; cpa: number | null }>> {
  const snaps = await prisma.performanceSnapshot.findMany({
    where: { clientId },
    orderBy: { month: "desc" },
    take: limit,
  })
  return snaps
    .map((s) => {
      const t = (s.data as unknown as Performance).current.total
      return { month: s.month, spend: t.spend, results: t.results, cpa: t.cpa }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
}
