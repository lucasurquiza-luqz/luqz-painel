import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"

type Params = { params: Promise<{ id: string }> }

// Duplica a tarefa (cópia) + suas subtarefas, no mesmo projeto.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const src = await prisma.task.findUnique({ where: { id }, include: { subtasks: true } })
  if (!src) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  const copy = await prisma.task.create({
    data: {
      title: `${src.title} (cópia)`, description: src.description, status: "TODO", priority: src.priority,
      assigneeId: src.assigneeId, assigneeIds: src.assigneeIds, tagIds: src.tagIds, estimateMin: src.estimateMin,
      projectId: src.projectId, clientId: src.clientId, dueDate: src.dueDate, dueHasTime: src.dueHasTime,
      createdById: auth.user.userId,
    },
    select: { id: true },
  })
  if (src.subtasks.length) {
    await prisma.task.createMany({
      data: src.subtasks.map((s) => ({
        title: s.title, description: s.description, status: "TODO" as const, priority: s.priority,
        assigneeId: s.assigneeId, assigneeIds: s.assigneeIds, projectId: src.projectId, clientId: src.clientId, parentTaskId: copy.id, createdById: auth.user.userId,
      })),
    })
  }
  await logActivity("TASK", copy.id, { userId: auth.user.userId, name: auth.user.name }, "CREATED", { duplicatedFrom: id })
  return NextResponse.json({ id: copy.id })
}
