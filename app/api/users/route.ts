import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { requireApiUser } from "@/lib/api-auth"

const ALLOWED_ROLES = ["ADMIN", "OPERADOR", "CLIENTE"] as const

export async function GET() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      active: true, createdAt: true, clientId: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const { name, email, password, role, clientId } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nome, e-mail e senha obrigatorios." }, { status: 400 })
  }

  if (role && !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Papel invalido." }, { status: 400 })
  }

  if (role === "CLIENTE" && !clientId) {
    return NextResponse.json({ error: "Cliente obrigatorio para este papel." }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) return NextResponse.json({ error: "E-mail ja cadastrado." }, { status: 409 })

  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(), email: normalizedEmail, password: hash,
      role: role ?? "OPERADOR",
      clientId: role === "CLIENTE" ? (clientId ?? null) : null,
    },
    select: {
      id: true, name: true, email: true, role: true,
      active: true, createdAt: true, clientId: true,
      client: { select: { name: true } },
    },
  })

  return NextResponse.json({ user }, { status: 201 })
}
