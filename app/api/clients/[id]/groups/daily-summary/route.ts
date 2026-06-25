import { fromZonedTime } from "date-fns-tz"
import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"
import { createGroupDailySummary, SummaryError } from "@/lib/group-summary-service"

type Params = { params: Promise<{ id: string }> }
const TZ = "America/Sao_Paulo"

function parseDateParam(value: string | null): Date {
  const raw = value ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Data invalida.")
  return fromZonedTime(`${raw}T00:00:00`, TZ)
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const [summaries, availableConversations] = await Promise.all([
    prisma.groupDailySummary.findMany({
      where: { clientId },
      include: {
        conversation: { select: { id: true, name: true } },
        generatedBy: { select: { id: true, name: true } },
        items: {
          include: { reviewedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: 60,
    }),
    // Resumo diário é por grupo: só conversas de grupo entram.
    prisma.waConversation.findMany({
      where: { clientId, isGroup: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const evidenceIds = [...new Set(summaries.flatMap((summary) =>
    summary.items.flatMap((item) => item.sourceMessageIds)
  ))]
  const evidenceMessages = evidenceIds.length
    ? await prisma.waMessage.findMany({
        where: { id: { in: evidenceIds }, conversation: { clientId } },
        select: {
          id: true,
          conversationId: true,
          fromName: true,
          isFromMe: true,
          text: true,
          timestamp: true,
        },
      })
    : []
  const evidenceById = new Map(evidenceMessages.map((message) => [message.id, message]))

  // Contagem de mensagens já capturadas (pelo webhook) no dia selecionado —
  // mostra que os dados estão lá, independente do backfill.
  const reqConvId = req.nextUrl.searchParams.get("conversationId")
  const reqDate = req.nextUrl.searchParams.get("date")
  let dayMessageCount: number | null = null
  if (reqConvId && reqDate && /^\d{4}-\d{2}-\d{2}$/.test(reqDate)) {
    const dayStart = parseDateParam(reqDate)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    dayMessageCount = await prisma.waMessage.count({
      where: { conversationId: reqConvId, timestamp: { gte: dayStart, lt: dayEnd } },
    })
  }

  return NextResponse.json({
    availableConversations,
    dayMessageCount,
    summaries: summaries.map((summary) => ({
      ...summary,
      items: summary.items.map((item) => ({
        ...item,
        evidence: item.sourceMessageIds.flatMap((messageId) => {
          const message = evidenceById.get(messageId)
          return message && message.conversationId === summary.conversationId ? [message] : []
        }),
      })),
    })),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const body = await req.json().catch(() => ({}))

  let dayStart: Date
  try {
    dayStart = parseDateParam(body.date ?? null)
  } catch {
    return NextResponse.json({ error: "Data invalida. Use o formato AAAA-MM-DD." }, { status: 400 })
  }

  const conversations = await prisma.waConversation.findMany({
    where: { clientId, isGroup: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  if (conversations.length === 0) {
    return NextResponse.json({ error: "Cliente nao possui conversa de WhatsApp vinculada." }, { status: 404 })
  }

  const requestedConversationId = typeof body.conversationId === "string" ? body.conversationId : null
  const conversation = requestedConversationId
    ? conversations.find((candidate) => candidate.id === requestedConversationId)
    : conversations.length === 1 ? conversations[0] : null

  if (!conversation) {
    return NextResponse.json(
      { error: requestedConversationId ? "Grupo nao encontrado neste cliente." : "Selecione o grupo que deseja resumir." },
      { status: 400 }
    )
  }

  try {
    const summary = await createGroupDailySummary({
      clientId,
      conversationId: conversation.id,
      dayStart,
      generatedById: auth.user.userId,
    })
    return NextResponse.json({ summary }, { status: 201 })
  } catch (error) {
    if (error instanceof SummaryError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof AiProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar resumo com IA." },
      { status: 502 }
    )
  }
}
