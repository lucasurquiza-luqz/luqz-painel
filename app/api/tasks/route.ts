import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"
import type { Prisma, TaskStatus, TaskPriority } from "@prisma/client"

const STATUSES = ["BACKLOG", "TODO", "DOING", "REVIEW", "DONE"]
const PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"]

const taskSelect = {
  id: true, title: true, status: true, priority: true, dueDate: true, dueHasTime: true, completedAt: true,
  clientId: true, projectId: true, assigneeId: true, assigneeIds: true, tagIds: true, estimateMin: true, order: true, createdAt: true,
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
}

// Normaliza entrada de responsáveis: aceita assigneeIds[] ou assigneeId único.
export function normalizeAssignees(b: { assigneeIds?: unknown; assigneeId?: unknown }): string[] | undefined {
  if (Array.isArray(b.assigneeIds)) return [...new Set(b.assigneeIds.filter((x): x is string => typeof x === "string" && !!x))]
  if ("assigneeId" in b) return typeof b.assigneeId === "string" && b.assigneeId ? [b.assigneeId] : []
  return undefined
}

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const sp = req.nextUrl.searchParams
  const where: Prisma.TaskWhereInput = {}
  const assignee = sp.get("assignee")
  if (assignee === "me") where.assigneeIds = { has: auth.user.userId }
  else if (assignee) where.assigneeIds = { has: assignee }
  const status = sp.get("status")
  if (status && STATUSES.includes(status)) where.status = status as TaskStatus
  if (sp.get("clientId")) where.clientId = sp.get("clientId")
  if (sp.get("projectId")) where.projectId = sp.get("projectId")
  if (sp.get("open") === "1") where.status = { not: "DONE" }
  // Subtarefas: ?parent=<id> lista filhas; senão, só tarefas de topo.
  const parent = sp.get("parent")
  where.parentTaskId = parent ? parent : null

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    select: taskSelect,
    take: 300,
  })
  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const b = await req.json().catch(() => ({}))
  const title = typeof b.title === "string" ? b.title.trim() : ""
  if (!title) return NextResponse.json({ error: "Informe o título da tarefa." }, { status: 400 })

  // Hierarquia: toda tarefa vive num projeto; o cliente vem do projeto.
  const projectId = typeof b.projectId === "string" && b.projectId ? b.projectId : null
  if (!projectId) return NextResponse.json({ error: "Escolha um projeto para a tarefa." }, { status: 400 })
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 400 })

  // Subtarefa: precisa pertencer ao mesmo projeto da mãe.
  const parentTaskId = typeof b.parentTaskId === "string" && b.parentTaskId ? b.parentTaskId : null
  if (parentTaskId) {
    const parent = await prisma.task.findUnique({ where: { id: parentTaskId }, select: { projectId: true } })
    if (!parent || parent.projectId !== projectId) return NextResponse.json({ error: "Subtarefa deve estar no mesmo projeto da tarefa-mãe." }, { status: 400 })
  }

  const assigneeIds = normalizeAssignees(b) ?? []
  const task = await prisma.task.create({
    data: {
      title,
      description: typeof b.description === "string" ? b.description.trim() || null : null,
      status: STATUSES.includes(b.status) ? (b.status as TaskStatus) : "TODO",
      priority: PRIORITIES.includes(b.priority) ? (b.priority as TaskPriority) : "MEDIA",
      assigneeIds,
      assigneeId: assigneeIds[0] ?? null,
      tagIds: Array.isArray(b.tagIds) ? b.tagIds.filter((x: unknown): x is string => typeof x === "string") : [],
      estimateMin: Number.isFinite(b.estimateMin) && b.estimateMin > 0 ? Math.floor(b.estimateMin) : null,
      projectId,
      parentTaskId,
      clientId: project.clientId, // derivado do projeto
      dueDate: b.dueDate ? new Date(b.dueDate) : null,
      dueHasTime: !!b.dueHasTime,
      createdById: auth.user.userId,
    },
    select: taskSelect,
  })
  await logActivity("TASK", task.id, { userId: auth.user.userId, name: auth.user.name }, "CREATED", { title })
  return NextResponse.json({ task })
}
