import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { decryptSecret } from "@/lib/crypto-secrets"
import { fetchMetaTree } from "@/lib/ads/meta"
import { fetchGoogleTree } from "@/lib/ads/google"
import { effectiveObjectives, type AdConfig, type AdObjective, type DateRange } from "@/lib/ads/types"
import { effectivePlanFunnels, projectFunnel, serializePlan, type PlanFunnel } from "@/lib/media-plan"

type Params = { params: Promise<{ id: string }> }
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x }

// Campanha achatada (nome + gasto + resultados), para agrupar por funil.
type Camp = { name: string; spend: number; results: number }

// Lê campanhas (Meta + Google) num período e agrega por funil de campanha.
async function funnelAgg(clientId: string, range: DateRange, funnels: { id: string; name: string; terms: string[] }[]) {
  const accounts = await prisma.clientAdAccount.findMany({ where: { clientId } })
  const camps: Camp[] = []
  for (const acc of accounts) {
    try {
      if (acc.provider === "META" && acc.tokenEnc) {
        const config: AdConfig = { objectives: effectiveObjectives(acc.objectives as AdObjective[], acc.objective as AdObjective), resultActions: acc.resultActions, trackRevenue: acc.trackRevenue }
        const tree = await fetchMetaTree(acc.accountId, decryptSecret(acc.tokenEnc), range, config)
        for (const c of tree) camps.push({ name: c.name, spend: c.spend, results: c.results })
      } else if (acc.provider === "GOOGLE") {
        const tree = await fetchGoogleTree(acc.accountId, range)
        for (const c of tree) camps.push({ name: c.name, spend: c.spend, results: c.results })
      }
    } catch { /* fonte que falha não derruba o report */ }
  }
  const byId = new Map<string, { spend: number; results: number }>()
  let noneSpend = 0, noneResults = 0, totalSpend = 0, totalResults = 0
  for (const c of camps) {
    totalSpend += c.spend; totalResults += c.results
    const nl = c.name.toLowerCase()
    const f = funnels.find((g) => g.terms.some((t) => nl.includes(t.toLowerCase())))
    if (f) { const cur = byId.get(f.id) ?? { spend: 0, results: 0 }; cur.spend += c.spend; cur.results += c.results; byId.set(f.id, cur) }
    else { noneSpend += c.spend; noneResults += c.results }
  }
  return { byId, none: { spend: noneSpend, results: noneResults }, total: { spend: totalSpend, results: totalResults } }
}

// Report semanal: semana fechada (seg–dom) + mês até aqui, por funil, com pacing pra meta do mês.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  // Datas em UTC (granularidade de dia). Referência = hoje (ou ?ref=AAAA-MM-DD).
  const refParam = req.nextUrl.searchParams.get("ref")
  const ref = refParam && /^\d{4}-\d{2}-\d{2}$/.test(refParam) ? new Date(`${refParam}T00:00:00Z`) : new Date(`${iso(new Date())}T00:00:00Z`)
  // Semana fechada anterior (seg–dom).
  const dow = (ref.getUTCDay() + 6) % 7 // 0=seg
  const thisMonday = addDays(ref, -dow)
  const weekEnd = addDays(thisMonday, -1) // domingo passado
  const weekStart = addDays(thisMonday, -7) // segunda passada
  const week: DateRange = { since: iso(weekStart), until: iso(weekEnd) }
  // Checkpoint ancorado no MÊS DA SEMANA reportada (não no dia de hoje). Evita o
  // "mês vazio" quando o report roda no começo do mês (dia 01 mostraria julho zerado,
  // sendo que a última semana fechada ainda é de junho).
  const monthStart = new Date(Date.UTC(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), 1))
  const mtd: DateRange = { since: iso(monthStart), until: iso(weekEnd) }
  const month = `${weekEnd.getUTCFullYear()}-${String(weekEnd.getUTCMonth() + 1).padStart(2, "0")}`
  const daysTotal = new Date(Date.UTC(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth() + 1, 0)).getUTCDate()
  const daysElapsed = weekEnd.getUTCDate()

  const funnels = await prisma.clientFunnel.findMany({ where: { clientId: id }, orderBy: { order: "asc" }, select: { id: true, name: true, terms: true } })
  const planRows = await prisma.mediaPlan.findMany({ where: { clientId: id, month }, include: { campaignFunnel: { select: { id: true, name: true } } } })
  const planFunnels: PlanFunnel[] = planRows.flatMap((p) => effectivePlanFunnels(serializePlan(p) as never))

  const [wk, mt] = await Promise.all([funnelAgg(id, week, funnels), funnelAgg(id, mtd, funnels)])

  const projTop = (f: PlanFunnel) => projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket }).rows[0]?.value ?? 0

  // Por funil: só os que têm realizado no mês ou plano atrelado.
  const rows = funnels.map((f) => {
    const sf = planFunnels.find((x) => x.campaignFunnelId === f.id)
    const w = wk.byId.get(f.id) ?? { spend: 0, results: 0 }
    const m = mt.byId.get(f.id) ?? { spend: 0, results: 0 }
    const metaResults = sf ? Math.round(projTop(sf)) : null
    const budget = sf?.budget ?? null
    const expected = metaResults != null ? Math.round((metaResults * daysElapsed) / daysTotal) : null
    const projection = daysElapsed > 0 ? Math.round((m.results / daysElapsed) * daysTotal) : null
    const status = metaResults && projection != null ? (projection >= metaResults ? "on" : projection >= metaResults * 0.9 ? "warn" : "off") : null
    return {
      funnelId: f.id, name: f.name, objective: sf?.objective ?? null, platform: sf?.platform ?? null,
      week: { spend: w.spend, results: w.results, cpa: w.results > 0 ? w.spend / w.results : null },
      mtd: { spend: m.spend, results: m.results, cpa: m.results > 0 ? m.spend / m.results : null },
      meta: { budget, results: metaResults }, expected, projection, status,
    }
  }).filter((r) => r.mtd.results > 0 || r.mtd.spend > 0 || r.meta.results != null)

  // Consolidado.
  const metaResultsTotal = Math.round(planFunnels.reduce((s, f) => s + projTop(f), 0))
  const budgetTotal = planFunnels.reduce((s, f) => s + (f.budget ?? 0), 0)
  const overall = {
    week: wk.total, mtd: mt.total,
    meta: { budget: budgetTotal || null, results: metaResultsTotal || null },
    expected: metaResultsTotal ? Math.round((metaResultsTotal * daysElapsed) / daysTotal) : null,
    projection: daysElapsed > 0 ? Math.round((mt.total.results / daysElapsed) * daysTotal) : null,
  }

  // O que fizemos na semana: tarefas concluídas no intervalo da semana.
  const start = new Date(`${week.since}T00:00:00Z`), endEx = addDays(new Date(`${week.until}T00:00:00Z`), 1)
  const completed = await prisma.task.findMany({
    where: { clientId: id, status: "DONE", parentTaskId: null, completedAt: { gte: start, lt: endEx } },
    orderBy: { completedAt: "desc" }, select: { id: true, title: true, project: { select: { name: true } } }, take: 60,
  })
  const actions = completed.map((t) => ({ id: t.id, title: t.title, project: t.project?.name ?? null }))

  return NextResponse.json({ week, mtd, month, daysElapsed, daysTotal, overall, funnels: rows, actions })
}
