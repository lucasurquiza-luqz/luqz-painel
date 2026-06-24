import { fromZonedTime } from "date-fns-tz"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { generateGroupDailySummary } from "@/lib/ai/group-summary"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

type Params = { params: Promise<{ id: string }> }
const TZ = "America/Sao_Paulo"
const MAX_MESSAGES_PER_SUMMARY = 400
const MAX_CHARACTERS_PER_SUMMARY = 120_000

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
        conversation: { select: { id: true, group: { select: { id: true, name: true } } } },
        generatedBy: { select: { id: true, name: true } },
        items: {
          include: { reviewedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: 60,
    }),
    prisma.waConversation.findMany({
      where: { clientId },
      select: { id: true, group: { select: { id: true, name: true, active: true } } },
      orderBy: { group: { name: "asc" } },
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

  return NextResponse.json({
    availableConversations,
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
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const conversations = await prisma.waConversation.findMany({
    where: { clientId },
    select: { id: true, group: { select: { name: true } } },
    orderBy: { group: { name: "asc" } },
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

  const existing = await prisma.groupDailySummary.findUnique({
    where: { conversationId_date: { conversationId: conversation.id, date: dayStart } },
  })
  if (existing) {
    return NextResponse.json({ error: "Ja existe um resumo gerado para esta data." }, { status: 409 })
  }

  const messages = await prisma.waMessage.findMany({
    where: { conversationId: conversation.id, timestamp: { gte: dayStart, lt: dayEnd } },
    orderBy: { timestamp: "asc" },
  })

  if (messages.length === 0) {
    return NextResponse.json({ error: "Nenhuma mensagem encontrada nesta data." }, { status: 400 })
  }

  const characterCount = messages.reduce((total, message) => total + (message.text?.length ?? 0), 0)
  if (messages.length > MAX_MESSAGES_PER_SUMMARY || characterCount > MAX_CHARACTERS_PER_SUMMARY) {
    return NextResponse.json(
      { error: "O volume deste dia excede o limite seguro do resumo. Divisao em blocos ainda precisa ser implementada." },
      { status: 413 }
    )
  }

  let draft
  try {
    draft = await generateGroupDailySummary(
      messages.map((message) => ({
        id: message.id,
        fromName: message.fromName,
        isFromMe: message.isFromMe,
        text: message.text,
        timestamp: message.timestamp,
      }))
    )
  } catch (error) {
    if (error instanceof AiProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar resumo com IA." },
      { status: 502 }
    )
  }

  let summary
  try {
    summary = await prisma.groupDailySummary.create({
      data: {
        clientId,
        conversationId: conversation.id,
        date: dayStart,
        status: draft.items.length === 0 ? "REVIEWED" : "DRAFT",
        messageCount: messages.length,
        rawSummary: draft.rawSummary,
        generatedById: auth.user.userId,
        items: {
          create: draft.items.map((item) => ({
            kind: item.kind,
            text: item.text,
            responsible: item.responsible,
            sourceMessageIds: item.sourceMessageIds,
          })),
        },
      },
      include: { items: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este grupo já possui um resumo para a data informada." }, { status: 409 })
    }
    throw error
  }

  return NextResponse.json({ summary }, { status: 201 })
}
