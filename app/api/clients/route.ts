import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { groups: true, messages: true } },
    },
  })
  return NextResponse.json({ clients, currentUser: { role: auth.user.role } })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { name, description, active = true, statusReason } = await req.json()
  if (!name) return NextResponse.json({ error: "Nome obrigatorio." }, { status: 400 })
  if (typeof active !== "boolean") return NextResponse.json({ error: "Status invalido." }, { status: 400 })
  if (!active && !statusReason?.trim()) {
    return NextResponse.json({ error: "Informe o motivo para cadastrar um cliente inativo." }, { status: 400 })
  }

  const client = await prisma.client.create({
    data: {
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      active,
      statusReason: active ? null : statusReason.trim(),
      statusChangedAt: new Date(),
      statusHistory: {
        create: {
          active,
          reason: active ? "Cliente cadastrado como ativo." : statusReason.trim(),
          source: "MANUAL",
          changedById: auth.user.userId,
        },
      },
    },
  })
  return NextResponse.json({ client }, { status: 201 })
}
