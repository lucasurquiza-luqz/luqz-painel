import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

// GET /api/chat?clientId=xxx — lista conversas do cliente
export async function GET(req: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  // CLIENTE: usa o clientId da sessao, nao do query param
  let clientId = req.nextUrl.searchParams.get("clientId")
  if (auth.user.role === "CLIENTE") {
    clientId = auth.user.clientId
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
