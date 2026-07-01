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
// seguinte tem uma taxa de conversão (0–1) sobre a anterior. Puro e testável.
export type FunnelStage = { label: string; rate?: number | null }
export type FunnelInput = { budget: number | null; cpl: number | null; targetLeads: number | null; stages: FunnelStage[]; ticket: number | null }
export type FunnelRow = { label: string; value: number; cost: number | null; rate: number | null }
export type FunnelProjection = { rows: FunnelRow[]; revenue: number | null; roas: number | null; cac: number | null; finalLabel: string | null }

export function projectFunnel({ budget, cpl, targetLeads, stages, ticket }: FunnelInput): FunnelProjection {
  const rows: FunnelRow[] = []
  if (!stages.length) return { rows, revenue: null, roas: null, cac: null, finalLabel: null }

  // Topo (Leads): por CPL se houver, senão pela meta absoluta de leads.
  const leads = cpl && cpl > 0 && budget ? budget / cpl : (targetLeads ?? 0)
  rows.push({ label: stages[0].label || "Leads", value: leads, cost: leads > 0 && budget ? budget / leads : null, rate: null })

  for (let i = 1; i < stages.length; i++) {
    const rate = stages[i].rate ?? 0
    const value = rows[i - 1].value * rate
    rows.push({ label: stages[i].label || `Etapa ${i + 1}`, value, cost: value > 0 && budget ? budget / value : null, rate })
  }

  const final = rows[rows.length - 1]
  const revenue = ticket && ticket > 0 ? final.value * ticket : null
  const roas = revenue != null && budget && budget > 0 ? revenue / budget : null
  const cac = final.value > 0 && budget ? budget / final.value : null
  return { rows, revenue, roas, cac, finalLabel: final.label }
}
