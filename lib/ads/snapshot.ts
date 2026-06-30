import { formatInTimeZone } from "date-fns-tz"
import { prisma } from "@/lib/db"
import { getClientPerformance, getClientPerformanceByMonth, type Performance } from "@/lib/ads/realizado"
import { previousRange, type DateRange } from "@/lib/ads/types"
import { reportError } from "@/lib/observability"

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
  // Em lotes paralelos — serial trava com dezenas de contas (cada uma chama Meta+Google).
  let refreshed = 0, failed = 0
  const BATCH = 5
  for (let i = 0; i < clients.length; i += BATCH) {
    const results = await Promise.allSettled(clients.slice(i, i + BATCH).map((c) => refreshPerformanceSnapshot(c.id, month)))
    for (const r of results) {
      if (r.status === "fulfilled") refreshed++
      else { failed++; reportError("cron.perfSnapshot", r.reason, { month }) }
    }
  }
  return { refreshed, failed }
}

// Totais do mês (só do que já está em snapshot — sem chamar API) para vários clientes.
// Usado na Torre pra mostrar Resultado por cliente de forma barata.
export type MonthTotal = { spend: number; results: number; cpa: number | null; roas: number | null }
export async function getClientsMonthTotals(clientIds: string[], month: string): Promise<Map<string, MonthTotal>> {
  if (!clientIds.length) return new Map()
  const snaps = await prisma.performanceSnapshot.findMany({ where: { clientId: { in: clientIds }, month } })
  const out = new Map<string, MonthTotal>()
  for (const s of snaps) {
    const t = (s.data as unknown as Performance).current?.total
    if (t) out.set(s.clientId, { spend: t.spend, results: t.results, cpa: t.cpa, roas: t.roas })
  }
  return out
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
