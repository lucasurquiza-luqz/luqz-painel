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

  // Filtro de responsavel: "me" (minhas), "none" (sem dono) ou todas.
  const assignee = req.nextUrl.searchParams.get("assignee")
  const where: { clientId?: string; assignedToId?: string | null } = {}
  if (clientId) where.clientId = clientId
  if (assignee === "me") where.assignedToId = auth.user.userId
  else if (assignee === "none") where.assignedToId = null

  const conversations = await prisma.waConversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    include: {
      group: { select: { id: true, name: true, participants: true } },
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  })

  return NextResponse.json({ conversations })
}
