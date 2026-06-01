import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// GET /api/chat?clientId=xxx — lista conversas do cliente
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId")
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
