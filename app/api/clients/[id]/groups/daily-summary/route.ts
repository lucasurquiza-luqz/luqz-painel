import { fromZonedTime } from "date-fns-tz"
import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { generateGroupDailySummary } from "@/lib/ai/group-summary"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

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
  const summaries = await prisma.groupDailySummary.findMany({
    where: { clientId },
    include: {
      generatedBy: { select: { id: true, name: true } },
      items: {
        include: { reviewedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { date: "desc" },
    take: 30,
  })

  return NextResponse.json({ summaries })
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

  const conversation = await prisma.waConversation.findFirst({
    where: { clientId },
    select: { id: true },
  })
  if (!conversation) {
    return NextResponse.json({ error: "Cliente nao possui conversa de WhatsApp vinculada." }, { status: 404 })
  }

  const existing = await prisma.groupDailySummary.findUnique({
    where: { clientId_date: { clientId, date: dayStart } },
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

  const summary = await prisma.groupDailySummary.create({
    data: {
      clientId,
      conversationId: conversation.id,
      date: dayStart,
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

  return NextResponse.json({ summary }, { status: 201 })
}
