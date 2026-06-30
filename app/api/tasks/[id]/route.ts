import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"
import { normalizeAssignees } from "@/app/api/tasks/route"

type Params = { params: Promise<{ id: string }> }
const STATUSES = ["BACKLOG", "TODO", "DOING", "REVIEW", "DONE"]
const PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"]

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, client: { select: { id: true, name: true } },
      subtasks: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true, assignee: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  const activity = await prisma.activity.findMany({ where: { entity: "TASK", entityId: id }, orderBy: { createdAt: "desc" }, take: 100 })
  // Molde de recorrência ligado a esta tarefa (recurrenceId é scalar, sem relação)
  const recurrence = task.recurrenceId
    ? await prisma.taskRecurrence.findUnique({ where: { id: task.recurrenceId }, select: { id: true, freq: true, interval: true, weekday: true, weekdays: true, dayOfMonth: true, active: true, nextRunAt: true } })
    : null
  return NextResponse.json({ task, activity, recurrence })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const before = await prisma.task.findUnique({ where: { id }, select: { title: true, status: true, priority: true, assigneeId: true, assigneeIds: true, dueDate: true, projectId: true, parentTaskId: true } })
  if (!before) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  const actor = { userId: auth.user.userId, name: auth.user.name }
  const logs: { type: string; payload?: Record<string, unknown> }[] = []

  if (typeof b.title === "string" && b.title.trim() && b.title.trim() !== before.title) { data.title = b.title.trim(); logs.push({ type: "EDITED", payload: { field: "título" } }) }
  if (typeof b.description === "string") data.description = b.description.trim() || null
  if (STATUSES.includes(b.status) && b.status !== before.status) {
    // Regra: tarefa-mãe só fecha com o RESULTADO descrito.
    if (b.status === "DONE" && !before.parentTaskId) {
      const result = typeof b.result === "string" ? b.result.trim() : ""
      if (!result) return NextResponse.json({ error: "Para concluir, descreva o resultado da tarefa.", needResult: true }, { status: 422 })
      logs.push({ type: "COMPLETED", payload: { result } })
    } else {
      logs.push({ type: b.status === "DONE" ? "COMPLETED" : b.status === before.status ? "EDITED" : "STATUS_CHANGED", payload: { from: before.status, to: b.status } })
    }
    data.status = b.status
    data.completedAt = b.status === "DONE" ? new Date() : null
  }
  if (PRIORITIES.includes(b.priority) && b.priority !== before.priority) { data.priority = b.priority; logs.push({ type: "EDITED", payload: { field: "prioridade", to: b.priority } }) }
  // Responsáveis: aceita assigneeIds[] (múltiplos) ou assigneeId (único, legado)
  const nextAssignees = normalizeAssignees(b)
  if (nextAssignees !== undefined) {
    const cur = [...before.assigneeIds].sort().join(",")
    if (nextAssignees.slice().sort().join(",") !== cur) {
      data.assigneeIds = nextAssignees
      data.assigneeId = nextAssignees[0] ?? null
      logs.push({ type: "ASSIGNED", payload: { count: nextAssignees.length } })
    }
  }
  if ("dueDate" in b) {
    const newDue = b.dueDate ? new Date(b.dueDate) : null
    const changed = (newDue?.getTime() ?? null) !== (before.dueDate?.getTime() ?? null)
    if (changed) { data.dueDate = newDue; logs.push({ type: "DUE_DATE", payload: { to: b.dueDate ?? null } }) }
  }
  // Mover de projeto: recalcula o cliente a partir do novo projeto.
  if ("projectId" in b && (b.projectId || null) !== before.projectId && b.projectId) {
    const proj = await prisma.project.findUnique({ where: { id: b.projectId }, select: { clientId: true } })
    if (proj) { data.projectId = b.projectId; data.clientId = proj.clientId; logs.push({ type: "MOVED", payload: { to: b.projectId } }) }
  }

  const task = await prisma.task.update({
    where: { id }, data,
    include: { assignee: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, client: { select: { id: true, name: true } } },
  })
  for (const l of logs) await logActivity("TASK", id, actor, l.type, l.payload)
  return NextResponse.json({ task })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  await prisma.task.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
