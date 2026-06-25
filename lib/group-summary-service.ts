import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { generateGroupDailySummary } from "@/lib/ai/group-summary"

const MAX_MESSAGES_PER_SUMMARY = 400
const MAX_CHARACTERS_PER_SUMMARY = 120_000

export class SummaryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

type CreateInput = {
  clientId: string
  conversationId: string
  // Início do dia (00:00 em SP, já convertido para UTC pelo chamador).
  dayStart: Date
  // Autor humano (geração manual) ou null (geração automática pela IA).
  generatedById: string | null
}

// Gera e persiste o resumo diário de um grupo. Compartilhado entre a geração
// manual (route) e a automática (cron). Lança SummaryError para casos esperados.
export async function createGroupDailySummary(input: CreateInput) {
  const { clientId, conversationId, dayStart, generatedById } = input
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const existing = await prisma.groupDailySummary.findUnique({
    where: { conversationId_date: { conversationId, date: dayStart } },
  })
  if (existing) throw new SummaryError("Ja existe um resumo gerado para esta data.", 409)

  const messages = await prisma.waMessage.findMany({
    where: { conversationId, timestamp: { gte: dayStart, lt: dayEnd } },
    orderBy: { timestamp: "asc" },
  })
  if (messages.length === 0) throw new SummaryError("Nenhuma mensagem encontrada nesta data.", 400)

  const characterCount = messages.reduce((total, message) => total + (message.text?.length ?? 0), 0)
  if (messages.length > MAX_MESSAGES_PER_SUMMARY || characterCount > MAX_CHARACTERS_PER_SUMMARY) {
    throw new SummaryError(
      "O volume deste dia excede o limite seguro do resumo. Divisao em blocos ainda precisa ser implementada.",
      413
    )
  }

  const draft = await generateGroupDailySummary(
    messages.map((message) => ({
      id: message.id,
      fromName: message.fromName,
      isFromMe: message.isFromMe,
      text: message.text,
      timestamp: message.timestamp,
    }))
  )

  try {
    return await prisma.groupDailySummary.create({
      data: {
        clientId,
        conversationId,
        date: dayStart,
        status: draft.items.length === 0 ? "REVIEWED" : "DRAFT",
        messageCount: messages.length,
        rawSummary: draft.rawSummary,
        sentiment: draft.sentiment,
        confidence: draft.confidence,
        analysis: draft.analysis || null,
        attentionPoints: draft.attentionPoints,
        generatedByAi: generatedById === null,
        generatedById,
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
      throw new SummaryError("Este grupo já possui um resumo para a data informada.", 409)
    }
    throw error
  }
}
