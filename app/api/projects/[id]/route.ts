import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"
import type { ProjectKind, ProjectStatus } from "@prisma/client"

type Params = { params: Promise<{ id: string }> }
const KINDS = ["CONTEUDO", "TRAFEGO", "ONBOARDING", "WEB", "COMERCIAL", "INTERNO", "OUTRO"]
const STATUSES = ["ATIVO", "PAUSADO", "CONCLUIDO", "ARQUIVADO"]

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, kind: true, notes: true, color: true, status: true,
      startDate: true, dueDate: true, ownerId: true, clientId: true,
      client: { select: { id: true, name: true } },
    },
  })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  const [total, done, activity] = await Promise.all([
    prisma.task.count({ where: { projectId: id, parentTaskId: null } }),
    prisma.task.count({ where: { projectId: id, parentTaskId: null, status: "DONE" } }),
    prisma.activity.findMany({ where: { entity: "PROJECT", entityId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ])
  return NextResponse.json({ project, counts: { total, done }, activity })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim()
  if ("description" in b) data.description = typeof b.description === "string" ? b.description.trim() || null : null
  if ("notes" in b) data.notes = typeof b.notes === "string" ? b.notes : null
  if (KINDS.includes(b.kind)) data.kind = b.kind as ProjectKind
  if (STATUSES.includes(b.status)) data.status = b.status as ProjectStatus
  if ("color" in b) data.color = typeof b.color === "string" ? b.color || null : null
  if ("ownerId" in b) data.ownerId = b.ownerId || null
  if ("startDate" in b) data.startDate = b.startDate ? new Date(b.startDate) : null
  if ("dueDate" in b) data.dueDate = b.dueDate ? new Date(b.dueDate) : null

  const project = await prisma.project.update({ where: { id }, data, select: { id: true, name: true, kind: true, status: true } })
  await logActivity("PROJECT", id, { userId: auth.user.userId, name: auth.user.name }, "EDITED", { fields: Object.keys(data) })
  return NextResponse.json({ project })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  await prisma.project.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
