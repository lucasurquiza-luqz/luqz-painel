import { prisma } from "@/lib/db"
import type { ActivityEntity } from "@prisma/client"

// Registra um evento no histórico (tarefa ou projeto). userName é congelado no momento.
export async function logActivity(
  entity: ActivityEntity,
  entityId: string,
  actor: { userId: string; name: string } | null,
  type: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activity.create({
      data: { entity, entityId, userId: actor?.userId ?? null, userName: actor?.name ?? null, type, payload: (payload ?? undefined) as object | undefined },
    })
  } catch {
    // histórico nunca derruba a operação principal
  }
}
