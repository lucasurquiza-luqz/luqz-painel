import { Prisma } from "@prisma/client"

// Decimal não serializa bem em JSON: converte os campos monetários para number.
export function serializePlan<T extends {
  budget: Prisma.Decimal | null
  targetCpa: Prisma.Decimal | null
  targetRoas: Prisma.Decimal | null
  targetTicket: Prisma.Decimal | null
}>(plan: T) {
  return {
    ...plan,
    budget: plan.budget != null ? Number(plan.budget) : null,
    targetCpa: plan.targetCpa != null ? Number(plan.targetCpa) : null,
    targetRoas: plan.targetRoas != null ? Number(plan.targetRoas) : null,
    targetTicket: plan.targetTicket != null ? Number(plan.targetTicket) : null,
  }
}
