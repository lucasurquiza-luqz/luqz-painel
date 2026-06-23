import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { requireApiUser } from "@/lib/api-auth"

const ALLOWED_ROLES = ["ADMIN", "OPERADOR", "CLIENTE"] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const { name, password, role, clientId, active } = await req.json()

  if (role && !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Papel invalido." }, { status: 400 })
  }

  if (role === "CLIENTE" && !clientId) {
    return NextResponse.json({ error: "Cliente obrigatorio para este papel." }, { status: 400 })
  }

  const data: Record<string, unknown> = {
    ...(typeof name === "string" && name.trim() && { name: name.trim() }),
    ...(typeof active === "boolean" ? { active } : {}),
    ...(role ? { role } : {}),
    ...(role === "CLIENTE" ? { clientId } : {}),
  }

  if (password) {
    data.password = await bcrypt.hash(password, 12)
  }

  // Limpa clientId se role nao for CLIENTE
  if (role && role !== "CLIENTE") {
    data.clientId = null
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, name: true, email: true, role: true,
      active: true, clientId: true,
      client: { select: { name: true } },
    },
  })

  return NextResponse.json({ user })
}
