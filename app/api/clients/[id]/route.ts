import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      groups: { orderBy: { name: "asc" } },
      messages: {
        orderBy: { scheduledAt: "desc" },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
          groups: { include: { group: { select: { name: true } } } },
        },
      },
    },
  })
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
  return NextResponse.json({ client })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { name, description, active, statusReason } = await req.json()
  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 })
  }
  if (active === false && !statusReason?.trim()) {
    return NextResponse.json({ error: "Informe o motivo da inativacao." }, { status: 400 })
  }

  const current = await prisma.client.findUnique({ where: { id }, select: { active: true } })
  if (!current) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
  const statusChanged = typeof active === "boolean" && active !== current.active

  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(typeof name === "string" && name.trim() && { name: name.trim() }),
      ...(typeof description === "string" || description === null ? { description } : {}),
      ...(typeof active === "boolean" ? { active } : {}),
      ...(typeof active === "boolean" ? { statusReason: active ? null : statusReason.trim() } : {}),
      ...(statusChanged ? { statusChangedAt: new Date() } : {}),
      ...(statusChanged ? {
        statusHistory: {
          create: {
            active,
            reason: active ? "Cliente reativado." : statusReason.trim(),
            source: "MANUAL",
            changedById: auth.user.userId,
          },
        },
      } : {}),
    },
  })
  return NextResponse.json({ client })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  await prisma.client.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
