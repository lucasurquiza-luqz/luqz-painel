import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"
import type { Prisma, TaskStatus, TaskPriority } from "@prisma/client"

const STATUSES = ["BACKLOG", "TODO", "DOING", "REVIEW", "DONE"]
const PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"]

const taskSelect = {
  id: true, title: true, status: true, priority: true, dueDate: true, completedAt: true,
  clientId: true, projectId: true, assigneeId: true, createdAt: true,
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
}

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const sp = req.nextUrl.searchParams
  const where: Prisma.TaskWhereInput = {}
  const assignee = sp.get("assignee")
  if (assignee === "me") where.assigneeId = auth.user.userId
  else if (assignee) where.assigneeId = assignee
  const status = sp.get("status")
  if (status && STATUSES.includes(status)) where.status = status as TaskStatus
  if (sp.get("clientId")) where.clientId = sp.get("clientId")
  if (sp.get("projectId")) where.projectId = sp.get("projectId")
  if (sp.get("open") === "1") where.status = { not: "DONE" }

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

  const task = await prisma.task.create({
    data: {
      title,
      description: typeof b.description === "string" ? b.description.trim() || null : null,
      status: STATUSES.includes(b.status) ? (b.status as TaskStatus) : "TODO",
      priority: PRIORITIES.includes(b.priority) ? (b.priority as TaskPriority) : "MEDIA",
      assigneeId: typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null,
      projectId: typeof b.projectId === "string" && b.projectId ? b.projectId : null,
      clientId: typeof b.clientId === "string" && b.clientId ? b.clientId : null,
      dueDate: b.dueDate ? new Date(b.dueDate) : null,
      createdById: auth.user.userId,
    },
    select: taskSelect,
  })
  await logActivity("TASK", task.id, { userId: auth.user.userId, name: auth.user.name }, "CREATED", { title })
  return NextResponse.json({ task })
}
