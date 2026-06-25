import { fromZonedTime, formatInTimeZone } from "date-fns-tz"
import { prisma } from "@/lib/db"
import { getProviderApiKey } from "@/lib/ai/credentials"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"
import { createGroupDailySummary, SummaryError } from "@/lib/group-summary-service"

const TZ = "America/Sao_Paulo"
// Guard-rails de custo: dias muito silenciosos não geram resumo, e cada
// execução tem teto de grupos processados.
const MIN_MESSAGES = 3
const MAX_GROUPS_PER_RUN = 60

// Início do dia (00:00 SP) em UTC, para um yyyy-MM-dd.
function dayStartUtc(dateInTz: string): Date {
  return fromZonedTime(`${dateInTz}T00:00:00`, TZ)
}

export type AutoSummaryResult = {
  generated: number
  skippedExisting: number
  skippedLowVolume: number
  failed: number
  reason?: string
}

// Gera rascunhos de resumo diário para todos os grupos de clientes ativos no
// dia informado (default: hoje em SP). Idempotente: pula o que já existe.
// É draft — entra na revisão humana, nunca vira saúde oficial sozinho.
export async function generateAutomaticDailySummaries(targetDateInTz?: string): Promise<AutoSummaryResult> {
  // Sem provedor de IA configurado: não há o que fazer (não é erro).
  const apiKey = await getProviderApiKey("OPENAI", process.env.OPENAI_API_KEY)
  if (!apiKey) {
    return { generated: 0, skippedExisting: 0, skippedLowVolume: 0, failed: 0, reason: "IA não configurada" }
  }

  const dateInTz = targetDateInTz ?? formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")
  const dayStart = dayStartUtc(dateInTz)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const conversations = await prisma.waConversation.findMany({
    where: { isGroup: true, clientId: { not: null }, client: { active: true } },
    select: { id: true, clientId: true },
  })

  const result: AutoSummaryResult = { generated: 0, skippedExisting: 0, skippedLowVolume: 0, failed: 0 }
  let processed = 0

  for (const conversation of conversations) {
    if (processed >= MAX_GROUPS_PER_RUN) break
    if (!conversation.clientId) continue

    const existing = await prisma.groupDailySummary.findUnique({
      where: { conversationId_date: { conversationId: conversation.id, date: dayStart } },
      select: { id: true },
    })
    if (existing) {
      result.skippedExisting++
      continue
    }

    const messageCount = await prisma.waMessage.count({
      where: { conversationId: conversation.id, timestamp: { gte: dayStart, lt: dayEnd } },
    })
    if (messageCount < MIN_MESSAGES) {
      result.skippedLowVolume++
      continue
    }

    processed++
    try {
      await createGroupDailySummary({
        clientId: conversation.clientId,
        conversationId: conversation.id,
        dayStart,
        generatedById: null, // gerado pela IA automática
      })
      result.generated++
    } catch (error) {
      if (error instanceof AiProviderNotConfiguredError) {
        result.reason = "IA não configurada"
        break
      }
      // 409 (corrida com geração manual) é benigno; demais são falha.
      if (error instanceof SummaryError && error.status === 409) {
        result.skippedExisting++
      } else {
        result.failed++
        console.error(`[cron] Falha ao gerar resumo do grupo ${conversation.id}:`, error)
      }
    }
  }

  return result
}
