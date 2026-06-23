import { NextRequest, NextResponse } from "next/server"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { sessionOptions, type SessionData } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha obrigatorios." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.active || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ error: "E-mail ou senha invalidos." }, { status: 401 })
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.userId = user.id
  session.name = user.name
  session.email = user.email
  session.role = user.role as SessionData["role"]
  if (user.role === "CLIENTE" && user.clientId) {
    session.clientId = user.clientId
  }
  await session.save()

  return NextResponse.json({
    ok: true,
    role: user.role,
    clientId: user.clientId ?? null,
  })
}
