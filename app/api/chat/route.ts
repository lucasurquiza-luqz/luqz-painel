import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions, type SessionData, isEquipe } from "@/lib/auth"

// GET /api/chat?clientId=xxx — lista conversas do cliente
export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  // CLIENTE: usa o clientId da sessao, nao do query param
  let clientId = req.nextUrl.searchParams.get("clientId")
  if (!isEquipe(session.role) && session.clientId) {
    clientId = session.clientId
  }

  if (!clientId) return NextResponse.json({ error: "clientId obrigatorio" }, { status: 400 })

  const conversations = await prisma.waConversation.findMany({
    where: { clientId },
    orderBy: { lastMessageAt: "desc" },
    include: {
      group: { select: { id: true, name: true, participants: true } },
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  })

  return NextResponse.json({ conversations })
}
