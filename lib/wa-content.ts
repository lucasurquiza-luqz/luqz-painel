// Extracao robusta de mensagens da Evolution / Baileys.
// Compartilhado entre o webhook (tempo real) e o backfill (historico).
// Desembrulha envelopes (ephemeral, viewOnce, edited, documentWithCaption)
// para que mensagens de grupo nao cheguem com texto nulo ao Contexto Vivo.

export interface WaContent {
  text: string | null
  mediaType: string | null
  mediaName: string | null
}

const EMPTY: WaContent = { text: null, mediaType: null, mediaName: null }

const MEDIA_ENTRIES = [
  ["imageMessage", "image"],
  ["videoMessage", "video"],
  ["audioMessage", "audio"],
  ["documentMessage", "document"],
  ["stickerMessage", "sticker"],
] as const

const MEDIA_LABELS: Record<string, string> = {
  image: "Imagem",
  video: "Video",
  audio: "Audio",
  document: "Documento",
  sticker: "Figurinha",
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

// Remove um nivel de envelope. Reaplicado recursivamente por extractMessageContent.
function unwrapMessage(msg: Record<string, unknown>): Record<string, unknown> {
  return (
    asRecord(asRecord(msg.ephemeralMessage)?.message) ??
    asRecord(asRecord(msg.viewOnceMessage)?.message) ??
    asRecord(asRecord(msg.viewOnceMessageV2)?.message) ??
    asRecord(asRecord(msg.documentWithCaptionMessage)?.message) ??
    asRecord(asRecord(msg.editedMessage)?.message) ??
    msg
  )
}

function mediaContent(media: Record<string, unknown>, type: string): WaContent {
  const mimetype =
    typeof media.mimetype === "string"
      ? media.mimetype
      : typeof media.mimeType === "string"
        ? media.mimeType
        : null
  const caption = typeof media.caption === "string" ? media.caption : null
  const fileName = typeof media.fileName === "string" ? media.fileName : null
  return {
    text: caption,
    mediaType: type,
    mediaName: fileName ?? mimetype ?? MEDIA_LABELS[type] ?? "Midia",
  }
}

// Busca recursiva por qualquer no de midia perdido em estruturas aninhadas.
function findMediaContent(value: unknown): WaContent | null {
  const obj = asRecord(value)
  if (!obj) return null

  for (const [key, type] of MEDIA_ENTRIES) {
    const media = asRecord(obj[key])
    if (media) return mediaContent(media, type)
  }

  for (const nested of Object.values(obj)) {
    const found = findMediaContent(nested)
    if (found) return found
  }

  return null
}

// Extrai texto e metadados de midia de um payload `message` da Evolution.
export function extractMessageContent(msgData: Record<string, unknown> | null | undefined): WaContent {
  if (!msgData) return EMPTY

  const unwrapped = unwrapMessage(msgData)
  if (unwrapped !== msgData) return extractMessageContent(unwrapped)

  if (typeof msgData.conversation === "string" && msgData.conversation.length > 0) {
    return { text: msgData.conversation, mediaType: null, mediaName: null }
  }

  const extended = asRecord(msgData.extendedTextMessage)
  if (typeof extended?.text === "string" && extended.text.length > 0) {
    return { text: extended.text, mediaType: null, mediaName: null }
  }

  for (const [key, type] of MEDIA_ENTRIES) {
    const media = asRecord(msgData[key])
    if (media) return mediaContent(media, type)
  }

  const fallback = findMediaContent(msgData)
  if (fallback) return fallback

  return EMPTY
}

// Uma mensagem so e armazenada se tiver texto util ou midia reconhecida.
// Evita poluir o resumo com mensagens de protocolo, reacoes e envelopes vazios.
export function isStorableContent(content: WaContent): boolean {
  return Boolean((content.text && content.text.trim().length > 0) || content.mediaType)
}

// Texto exibivel para chat e evidencia: usa o texto real ou rotula a midia.
export function contentToText(content: WaContent): string | null {
  if (content.text && content.text.trim().length > 0) return content.text
  if (content.mediaType) return `[${MEDIA_LABELS[content.mediaType] ?? "Midia"}]`
  return null
}

// === Helpers de payload (compartilhados entre webhook e backfill) ===

export function getMessageKey(item: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(item.key)
  if (direct) return direct
  const message = asRecord(item.message)
  return asRecord(message?.key)
}

// Retorna o no `message` ja desembrulhado de um nivel para extracao.
export function getNestedMessage(item: Record<string, unknown>): Record<string, unknown> | null {
  const direct = asRecord(item.message)
  const nested =
    asRecord(direct?.message) ??
    asRecord(asRecord(direct?.ephemeralMessage)?.message) ??
    asRecord(asRecord(direct?.viewOnceMessage)?.message) ??
    asRecord(asRecord(direct?.viewOnceMessageV2)?.message) ??
    asRecord(asRecord(direct?.documentWithCaptionMessage)?.message)
  return nested ?? direct
}

export function getMessageTimestamp(item: Record<string, unknown>): Date {
  const message = asRecord(item.message)
  const raw =
    item.messageTimestamp ?? item.messageTimestampLong ?? message?.messageTimestamp ?? item.createdAt
  if (typeof raw === "number") return new Date(raw > 10_000_000_000 ? raw : raw * 1000)
  if (typeof raw === "string") {
    const numeric = Number(raw)
    if (!Number.isNaN(numeric)) return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
    const date = new Date(raw)
    if (!Number.isNaN(date.getTime())) return date
  }
  return new Date()
}

// Id estavel para deduplicacao. Prefere o id da Evolution; cai para um id sintetico.
export function getEvolutionMessageId(
  item: Record<string, unknown>,
  remoteJid: string
): string | null {
  const key = getMessageKey(item)
  if (typeof key?.id === "string" && key.id.length > 0) return key.id
  if (typeof item.id === "string" && item.id.length > 0) return item.id
  const timestamp = item.messageTimestamp ?? item.createdAt
  if (timestamp != null) return `${remoteJid}:${String(timestamp)}`
  return null
}
