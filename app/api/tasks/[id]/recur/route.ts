import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { computeNextRun } from "@/lib/recurrence"
import { logActivity } from "@/lib/tasks"
import type { RecurFreq } from "@prisma/client"

type Params = { params: Promise<{ id: string }> }
const FREQ = ["DIARIA", "SEMANAL", "MENSAL"]

// Define (ou atualiza) a recorrência DIRETO na tarefa, estilo ClickUp.
// Cria um molde TaskRecurrence ligado ao projeto e carimba task.recurrenceId.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const task = await prisma.task.findUnique({
    where: { id },
    select: { projectId: true, clientId: true, title: true, description: true, assigneeId: true, priority: true, dueDate: true, recurrenceId: true },
  })
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })
  if (!task.projectId) return NextResponse.json({ error: "A tarefa precisa de um projeto para repetir." }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  if (!FREQ.includes(b.freq)) return NextResponse.json({ error: "Frequência inválida." }, { status: 400 })
  const freq = b.freq as RecurFreq
  const interval = Number.isFinite(b.interval) && b.interval > 0 ? Math.floor(b.interval) : 1

  // Cadência derivada da data de vencimento da tarefa (ou de hoje).
  const ref = task.dueDate ?? new Date()
  const weekday = freq === "SEMANAL" ? ref.getUTCDay() : null
  const dayOfMonth = freq === "MENSAL" ? ref.getUTCDate() : null
  const nextRunAt = computeNextRun({ freq, interval, weekday, dayOfMonth }, ref)

  const data = { freq, interval, weekday, dayOfMonth, nextRunAt, active: true }
  let recurrence
  if (task.recurrenceId && (await prisma.taskRecurrence.findUnique({ where: { id: task.recurrenceId }, select: { id: true } }))) {
    recurrence = await prisma.taskRecurrence.update({ where: { id: task.recurrenceId }, data })
  } else {
    recurrence = await prisma.taskRecurrence.create({
      data: {
        ...data, projectId: task.projectId, clientId: task.clientId, title: task.title,
        description: task.description, assigneeId: task.assigneeId, priority: task.priority, createdById: auth.user.userId,
      },
    })
    await prisma.task.update({ where: { id }, data: { recurrenceId: recurrence.id } })
  }
  await logActivity("TASK", id, { userId: auth.user.userId, name: auth.user.name }, "EDITED", { field: "recorrência", to: freq })
  return NextResponse.json({ recurrence: { id: recurrence.id, freq, interval, weekday, dayOfMonth, active: true, nextRunAt } })
}

// Para de repetir: remove o molde e limpa o vínculo na tarefa.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const task = await prisma.task.findUnique({ where: { id }, select: { recurrenceId: true } })
  if (task?.recurrenceId) {
    await prisma.taskRecurrence.delete({ where: { id: task.recurrenceId } }).catch(() => {})
    await prisma.task.update({ where: { id }, data: { recurrenceId: null } })
    await logActivity("TASK", id, { userId: auth.user.userId, name: auth.user.name }, "EDITED", { field: "recorrência", to: null })
  }
  return NextResponse.json({ ok: true })
}
