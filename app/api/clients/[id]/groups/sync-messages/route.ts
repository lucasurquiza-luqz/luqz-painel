import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { syncConversationMessages } from "@/lib/wa-sync"

type Params = { params: Promise<{ id: string }> }

const MAX_DAYS = 30
const DEFAULT_DAYS = 7

// Backfill: puxa o historico recente dos grupos do cliente direto da Evolution.
// Destrava resumir dias anteriores ao webhook ficar ativo.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const body = await req.json().catch(() => ({}))

  const days = Math.min(
    MAX_DAYS,
    Math.max(1, Number.isFinite(body.days) ? Number(body.days) : DEFAULT_DAYS)
  )
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const requestedConversationId =
    typeof body.conversationId === "string" ? body.conversationId : null

  const conversations = await prisma.waConversation.findMany({
    where: {
      clientId,
      ...(requestedConversationId ? { id: requestedConversationId } : {}),
    },
    select: { id: true, name: true, remoteJid: true },
    orderBy: { name: "asc" },
  })

  if (conversations.length === 0) {
    return NextResponse.json(
      { error: "Cliente nao possui conversa de WhatsApp vinculada." },
      { status: 404 }
    )
  }

  const results: { group: string; fetched: number; stored: number; error?: string }[] = []
  let totalStored = 0

  for (const conversation of conversations) {
    try {
      const result = await syncConversationMessages({
        conversationId: conversation.id,
        remoteJid: conversation.remoteJid,
        since,
      })
      totalStored += result.stored
      results.push({
        group: conversation.name,
        fetched: result.fetched,
        stored: result.stored,
      })
    } catch (err) {
      results.push({
        group: conversation.name,
        fetched: 0,
        stored: 0,
        error: err instanceof Error ? err.message : "Falha ao sincronizar.",
      })
    }
  }

  return NextResponse.json({ days, totalStored, results })
}
