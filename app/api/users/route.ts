import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET() {
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
  const { name, email, password, role, clientId } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nome, e-mail e senha obrigatorios." }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: "E-mail ja cadastrado." }, { status: 409 })

  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name, email, password: hash,
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
