import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import type { RecurFreq, TaskPriority } from "@prisma/client"

type Params = { params: Promise<{ id: string }> }
const FREQ = ["DIARIA", "SEMANAL", "MENSAL"]
const PRIO = ["BAIXA", "MEDIA", "ALTA", "URGENTE"]

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const recurrences = await prisma.taskRecurrence.findMany({
    where: { projectId: id }, orderBy: { createdAt: "desc" },
    select: { id: true, title: true, freq: true, interval: true, weekday: true, dayOfMonth: true, priority: true, assigneeId: true, active: true, nextRunAt: true },
  })
  return NextResponse.json({ recurrences })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const project = await prisma.project.findUnique({ where: { id }, select: { clientId: true } })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const title = typeof b.title === "string" ? b.title.trim() : ""
  if (!title) return NextResponse.json({ error: "Informe o título." }, { status: 400 })

  // Próximo disparo: a partir da data informada (ou amanhã).
  const start = b.startDate ? new Date(b.startDate) : new Date(Date.now() + 86_400_000)

  const recurrence = await prisma.taskRecurrence.create({
    data: {
      projectId: id, clientId: project.clientId, title,
      description: typeof b.description === "string" ? b.description.trim() || null : null,
      assigneeId: typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null,
      priority: PRIO.includes(b.priority) ? (b.priority as TaskPriority) : "MEDIA",
      freq: FREQ.includes(b.freq) ? (b.freq as RecurFreq) : "SEMANAL",
      interval: Number.isFinite(b.interval) && b.interval > 0 ? Math.floor(b.interval) : 1,
      weekday: b.weekday != null ? Number(b.weekday) : null,
      dayOfMonth: b.dayOfMonth != null ? Number(b.dayOfMonth) : null,
      nextRunAt: start,
      createdById: auth.user.userId,
    },
  })
  return NextResponse.json({ recurrence })
}
