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
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      teamMembers: { orderBy: { role: "asc" }, include: { user: { select: { id: true, name: true } } } },
    },
  })
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
  // Decimal não serializa bem em JSON: converte para number.
  return NextResponse.json({
    client: { ...client, contractValue: client.contractValue ? Number(client.contractValue) : null },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { name, description, active, statusReason } = body
  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 })
  }
  if (active === false && !statusReason?.trim()) {
    return NextResponse.json({ error: "Informe o motivo da inativacao." }, { status: 400 })
  }

  const current = await prisma.client.findUnique({ where: { id }, select: { active: true } })
  if (!current) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
  const statusChanged = typeof active === "boolean" && active !== current.active

  // Campos opcionais de perfil/contrato (Bloco 0.1). Só atualiza o que veio no corpo.
  const profile = buildProfileUpdate(body)

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
      ...profile,
    },
  })
  return NextResponse.json({ client })
}

// Monta o patch dos campos de perfil/contrato presentes no corpo (Bloco 0.1).
function buildProfileUpdate(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}

  const text = (key: string) => {
    if (!(key in body)) return
    const value = body[key]
    if (value === null) data[key] = null
    else if (typeof value === "string") data[key] = value.trim() || null
  }
  for (const key of ["segment", "website", "instagram", "region", "logoUrl", "product", "billingCycle", "projectPhase"]) {
    text(key)
  }

  const date = (key: string) => {
    if (!(key in body)) return
    const value = body[key]
    if (!value || typeof value !== "string") data[key] = null
    else {
      const parsed = new Date(value)
      data[key] = isNaN(parsed.getTime()) ? null : parsed
    }
  }
  date("contractStart")
  date("renewalDate")

  if ("contractValue" in body) {
    const value = body.contractValue
    data.contractValue = typeof value === "number" && isFinite(value) ? value : null
  }

  return data
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  await prisma.client.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
