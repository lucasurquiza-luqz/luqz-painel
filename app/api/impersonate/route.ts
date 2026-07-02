import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sessionOptions, type SessionData } from "@/lib/auth"

// Liga o modo "ver como cliente": ADMIN/OPERADOR passa a enxergar o painel COMO o
// cliente (preview read-only). Só o papel REAL de equipe pode ligar.
export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "OPERADOR") return NextResponse.json({ error: "Acesso negado." }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clientId = typeof body.clientId === "string" ? body.clientId : ""
  if (!clientId) return NextResponse.json({ error: "Informe o cliente." }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } })
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })

  session.impersonateClientId = client.id
  await session.save()
  return NextResponse.json({ ok: true, client })
}

// Desliga o impersonate (volta a ser equipe).
export async function DELETE() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  delete session.impersonateClientId
  await session.save()
  return NextResponse.json({ ok: true })
}
