import { prisma } from "@/lib/db"
import { fetchMessages } from "@/lib/evolution"
import {
  asRecord,
  extractMessageContent,
  getEvolutionMessageId,
  getMessageKey,
  getMessageTimestamp,
  getNestedMessage,
  isStorableContent,
} from "@/lib/wa-content"

const DEFAULT_SYNC_DAYS = 7

function getSenderName(item: Record<string, unknown>, fromMe: boolean): string | null {
  if (fromMe) return "LUQZ"
  const pushName = item.pushName
  if (typeof pushName === "string" && pushName.trim().length > 0) return pushName.trim()
  return null
}

export interface SyncResult {
  fetched: number
  stored: number
  lastMessageAt: Date | null
}

// Puxa o historico recente de um grupo da Evolution e materializa em WaMessage.
// Idempotente: dedup por evolutionId, nunca recria mensagens existentes.
export async function syncConversationMessages(input: {
  conversationId: string
  remoteJid: string
  since?: Date
}): Promise<SyncResult> {
  const since =
    input.since ?? new Date(Date.now() - DEFAULT_SYNC_DAYS * 24 * 60 * 60 * 1000)

  const raw = await fetchMessages(input.remoteJid, since)
  let stored = 0
  let lastMessageAt: Date | null = null

  for (const entry of raw) {
    const item = asRecord(entry)
    if (!item) continue

    const key = getMessageKey(item)
    const msgRemoteJid = typeof key?.remoteJid === "string" ? key.remoteJid : input.remoteJid
    if (msgRemoteJid !== input.remoteJid) continue

    const timestamp = getMessageTimestamp(item)
    if (timestamp < since) continue

    const evolutionId = getEvolutionMessageId(item, input.remoteJid)
    if (!evolutionId) continue

    const content = extractMessageContent(getNestedMessage(item))
    if (!isStorableContent(content)) continue

    if (lastMessageAt === null || timestamp > lastMessageAt) lastMessageAt = timestamp

    const fromMe = Boolean(key?.fromMe ?? item.fromMe)
    const participant = typeof key?.participant === "string" ? key.participant : null

    const existing = await prisma.waMessage.findUnique({
      where: { evolutionId },
      select: { id: true },
    })
    if (existing) continue

    await prisma.waMessage.create({
      data: {
        conversationId: input.conversationId,
        evolutionId,
        fromJid: fromMe ? "me" : (participant ?? input.remoteJid),
        fromName: getSenderName(item, fromMe),
        text: content.text,
        mediaType: content.mediaType,
        mediaName: content.mediaName,
        isFromMe: fromMe,
        timestamp,
      },
    })
    stored++
  }

  if (lastMessageAt) {
    // So avanca o ponteiro; nunca retrocede por causa de backfill de dias antigos.
    const conversation = await prisma.waConversation.findUnique({
      where: { id: input.conversationId },
      select: { lastMessageAt: true },
    })
    if (!conversation?.lastMessageAt || lastMessageAt > conversation.lastMessageAt) {
      await prisma.waConversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt },
      })
    }
  }

  return { fetched: raw.length, stored, lastMessageAt }
}
