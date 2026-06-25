import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

// Ação corrente (OPEN) do cliente + equipe disponível como responsável.
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const [current, team] = await Promise.all([
    prisma.clientNextAction.findFirst({
      where: { clientId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: { responsible: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OPERADOR"] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return NextResponse.json({ current, team })
}

// Define a próxima ação. Substitui a ação OPEN anterior (vira histórico).
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const body = await req.json().catch(() => ({}))

  const description = typeof body.description === "string" ? body.description.trim() : ""
  if (!description) {
    return NextResponse.json({ error: "Descreva a próxima ação." }, { status: 400 })
  }

  let responsibleId: string | null = null
  if (typeof body.responsibleId === "string" && body.responsibleId) {
    const member = await prisma.user.findFirst({
      where: { id: body.responsibleId, role: { in: ["ADMIN", "OPERADOR"] }, active: true },
      select: { id: true },
    })
    if (!member) return NextResponse.json({ error: "Responsável inválido." }, { status: 400 })
    responsibleId = member.id
  }

  let dueAt: Date | null = null
  if (typeof body.dueAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueAt)) {
    dueAt = new Date(`${body.dueAt}T00:00:00`)
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })

  // Encerra a ação aberta anterior (mantém histórico) e cria a nova.
  await prisma.clientNextAction.updateMany({
    where: { clientId, status: "OPEN" },
    data: { status: "CANCELLED", completedAt: new Date() },
  })
  const action = await prisma.clientNextAction.create({
    data: { clientId, description, responsibleId, dueAt, createdById: auth.user.userId },
    include: { responsible: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ ok: true, action }, { status: 201 })
}
