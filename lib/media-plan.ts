import { Prisma } from "@prisma/client"

// Decimal não serializa bem em JSON: converte os campos monetários para number.
export function serializePlan<T extends {
  budget: Prisma.Decimal | null
  targetCpa: Prisma.Decimal | null
  targetRoas: Prisma.Decimal | null
  targetTicket: Prisma.Decimal | null
  targetCpl?: Prisma.Decimal | null
}>(plan: T) {
  return {
    ...plan,
    budget: plan.budget != null ? Number(plan.budget) : null,
    targetCpa: plan.targetCpa != null ? Number(plan.targetCpa) : null,
    targetRoas: plan.targetRoas != null ? Number(plan.targetRoas) : null,
    targetTicket: plan.targetTicket != null ? Number(plan.targetTicket) : null,
    targetCpl: plan.targetCpl != null ? Number(plan.targetCpl) : null,
  }
}

// ===== Projeção de funil (parte "calculável" do plano híbrido) =====
// stages[0] = topo (Leads), calculado por budget/cpl (ou targetLeads). Cada etapa
// seguinte tem uma taxa de conversão (0–1) sobre a anterior. Cada etapa pode ter
// um ticket (receita por unidade) — receita total = soma de todas as etapas com
// ticket. Puro e testável.
export type FunnelStage = { label: string; rate?: number | null; ticket?: number | null }
export type FunnelInput = { budget: number | null; cpl: number | null; targetLeads: number | null; stages: FunnelStage[]; ticket: number | null }
export type FunnelRow = { label: string; value: number; cost: number | null; rate: number | null; ticket: number | null; revenue: number | null }
export type FunnelProjection = { rows: FunnelRow[]; revenue: number | null; roas: number | null; cac: number | null; finalLabel: string | null }

export function projectFunnel({ budget, cpl, targetLeads, stages, ticket }: FunnelInput): FunnelProjection {
  const rows: FunnelRow[] = []
  if (!stages.length) return { rows, revenue: null, roas: null, cac: null, finalLabel: null }

  // Topo (Leads): por CPL se houver, senão pela meta absoluta de leads.
  const leads = cpl && cpl > 0 && budget ? budget / cpl : (targetLeads ?? 0)
  // Se alguma etapa tem ticket próprio, usamos ticket por etapa. Senão, o ticket
  // global (targetTicket) aplica só na última etapa (retrocompatível).
  const useStageTickets = stages.some((s) => s.ticket != null && s.ticket > 0)

  for (let i = 0; i < stages.length; i++) {
    const value = i === 0 ? leads : rows[i - 1].value * (stages[i].rate ?? 0)
    const effTicket = useStageTickets ? (stages[i].ticket ?? null) : (i === stages.length - 1 ? (ticket ?? null) : null)
    const revenue = effTicket && effTicket > 0 ? value * effTicket : null
    rows.push({ label: stages[i].label || (i === 0 ? "Leads" : `Etapa ${i + 1}`), value, cost: value > 0 && budget ? budget / value : null, rate: i === 0 ? null : (stages[i].rate ?? 0), ticket: effTicket, revenue })
  }

  const hasRevenue = rows.some((r) => r.revenue != null)
  const revenue = hasRevenue ? rows.reduce((s, r) => s + (r.revenue ?? 0), 0) : null
  const roas = revenue != null && budget && budget > 0 ? revenue / budget : null
  const final = rows[rows.length - 1]
  const cac = final.value > 0 && budget ? budget / final.value : null
  return { rows, revenue, roas, cac, finalLabel: final.label }
}
