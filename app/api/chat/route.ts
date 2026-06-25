import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

// GET /api/chat            — todas as conversas (interno): chat global
// GET /api/chat?clientId=x — conversas de um cliente
export async function GET(req: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  // CLIENTE: sempre limitado ao proprio cliente, ignora o query param.
  let clientId = req.nextUrl.searchParams.get("clientId")
  if (auth.user.role === "CLIENTE") {
    clientId = auth.user.clientId
  }

  const conversations = await prisma.waConversation.findMany({
    where: clientId ? { clientId } : {},
    orderBy: { lastMessageAt: "desc" },
    include: {
      group: { select: { id: true, name: true, participants: true } },
      client: { select: { id: true, name: true } },
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  })

  return NextResponse.json({ conversations })
}
