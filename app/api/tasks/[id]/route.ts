import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"

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
    },
  })
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  const activity = await prisma.activity.findMany({ where: { entity: "TASK", entityId: id }, orderBy: { createdAt: "desc" }, take: 100 })
  return NextResponse.json({ task, activity })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const before = await prisma.task.findUnique({ where: { id }, include: { assignee: { select: { name: true } } } })
  if (!before) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  const actor = { userId: auth.user.userId, name: auth.user.name }
  const logs: { type: string; payload?: Record<string, unknown> }[] = []

  if (typeof b.title === "string" && b.title.trim() && b.title.trim() !== before.title) { data.title = b.title.trim(); logs.push({ type: "EDITED", payload: { field: "título" } }) }
  if (typeof b.description === "string") data.description = b.description.trim() || null
  if (STATUSES.includes(b.status) && b.status !== before.status) {
    data.status = b.status
    data.completedAt = b.status === "DONE" ? new Date() : null
    logs.push({ type: b.status === "DONE" ? "COMPLETED" : "STATUS_CHANGED", payload: { from: before.status, to: b.status } })
  }
  if (PRIORITIES.includes(b.priority) && b.priority !== before.priority) { data.priority = b.priority; logs.push({ type: "EDITED", payload: { field: "prioridade", to: b.priority } }) }
  if ("assigneeId" in b && (b.assigneeId || null) !== before.assigneeId) {
    data.assigneeId = b.assigneeId || null
    logs.push({ type: "ASSIGNED", payload: { to: b.assigneeId || null } })
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
