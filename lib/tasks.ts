import { prisma } from "@/lib/db"
import type { ActivityEntity } from "@prisma/client"
import { computeNextRun, type RecurRule } from "@/lib/recurrence"
import { reportError } from "@/lib/observability"

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

// Cron: gera as tarefas dos moldes recorrentes que já venceram (nextRunAt <= agora)
// e reagenda o próximo disparo. Roda 1x/dia.
export async function generateRecurringTasks(): Promise<{ created: number }> {
  const now = new Date()
  const due = await prisma.taskRecurrence.findMany({ where: { active: true, nextRunAt: { lte: now } } })
  let created = 0
  for (const r of due) {
    try {
      await prisma.task.create({
        data: {
          title: r.title, description: r.description, status: "TODO", priority: r.priority,
          assigneeId: r.assigneeId, assigneeIds: r.assigneeId ? [r.assigneeId] : [], projectId: r.projectId, clientId: r.clientId,
          dueDate: r.nextRunAt, recurrenceId: r.id, createdById: r.createdById,
        },
      })
      const rule: RecurRule = { freq: r.freq, interval: r.interval, weekday: r.weekday, weekdays: r.weekdays, dayOfMonth: r.dayOfMonth }
      // avança até o próximo disparo no futuro (cobre moldes atrasados)
      let next = computeNextRun(rule, r.nextRunAt)
      let guard = 0
      while (next <= now && guard++ < 60) next = computeNextRun(rule, next)
      await prisma.taskRecurrence.update({ where: { id: r.id }, data: { lastRunAt: now, nextRunAt: next } })
      created++
    } catch (e) {
      reportError("cron.recurringTask", e, { recurrenceId: r.id })
    }
  }
  return { created }
}
