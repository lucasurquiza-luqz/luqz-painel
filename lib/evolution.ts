const BASE_URL = process.env.EVOLUTION_URL!
const API_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = encodeURIComponent(process.env.EVOLUTION_INSTANCE!)
const TIMEOUT_MS = 15_000

const headers = {
  "apikey": API_KEY,
  "Content-Type": "application/json",
}

async function evoFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function evoJSON(res: Response): Promise<unknown> {
  let body = ""
  try { body = await res.text() } catch { /* ignore */ }
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${body}`)
  try { return JSON.parse(body) } catch { return { ok: true } }
}

export interface EvoGroup {
  id: string
  subject: string
  size: number
}

export async function fetchGroups(): Promise<EvoGroup[]> {
  const res = await evoFetch(
    `${BASE_URL}/group/fetchAllGroups/${INSTANCE}?getParticipants=false`,
    { headers }
  )
  if (!res.ok) throw new Error(`Evolution API error: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function sendText(remoteJid: string, text: string) {
  const res = await evoFetch(`${BASE_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ number: remoteJid, text }),
  })
  return evoJSON(res)
}

// media pode ser URL publica ou base64 puro (sem prefixo data:)
export async function sendMedia(
  remoteJid: string,
  media: string,
  mediaType: "image" | "document" | "video" | "audio",
  caption: string,
  fileName?: string
) {
  // Audio usa endpoint especifico do WhatsApp (envia como nota de voz)
  if (mediaType === "audio") {
    return sendWhatsAppAudio(remoteJid, media)
  }

  const body: Record<string, string> = {
    number: remoteJid,
    mediatype: mediaType,
    media,
    caption,
  }
  if (fileName) body.fileName = fileName

  const res = await evoFetch(`${BASE_URL}/message/sendMedia/${INSTANCE}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  return evoJSON(res)
}

export async function sendWhatsAppAudio(remoteJid: string, audio: string) {
  const res = await evoFetch(`${BASE_URL}/message/sendWhatsAppAudio/${INSTANCE}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ number: remoteJid, audio, encoding: true }),
  })
  return evoJSON(res)
}

// Normaliza respostas da Evolution que ora vem como array, ora embrulhadas.
function toArrayPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== "object") return []

  const obj = data as Record<string, unknown>
  for (const key of ["messages", "records", "chats", "data", "response", "result", "rows"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[]
  }
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) return value
  }
  return []
}

// Busca o historico de mensagens de um chat/grupo a partir de `since`.
// Usado pelo backfill para preencher dias anteriores ao webhook ficar ativo.
export async function fetchMessages(remoteJid: string, since?: Date): Promise<unknown[]> {
  const where: Record<string, unknown> = { key: { remoteJid } }
  if (since) where.messageTimestamp = { gte: Math.floor(since.getTime() / 1000) }

  const res = await evoFetch(`${BASE_URL}/chat/findMessages/${INSTANCE}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ where }),
  })
  return toArrayPayload(await evoJSON(res))
}

// Estado de conexao da instancia ("open", "connecting", "close"...).
export async function getConnectionState(): Promise<string | null> {
  try {
    const res = await evoFetch(`${BASE_URL}/instance/connectionState/${INSTANCE}`, { headers })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const instance = (data?.instance as Record<string, unknown> | undefined) ?? data
    const state = instance?.state ?? instance?.status
    return typeof state === "string" ? state : null
  } catch {
    return null
  }
}

// Cria a instancia na Evolution (idempotente: ignora se ja existe).
export async function createInstance(): Promise<unknown> {
  const res = await evoFetch(`${BASE_URL}/instance/create`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      instanceName: process.env.EVOLUTION_INSTANCE,
      integration: "WHATSAPP-BAILEYS",
    }),
  })
  // 403/409 = ja existe; nao e erro para o nosso fluxo.
  if (res.status === 403 || res.status === 409) return { exists: true }
  return evoJSON(res)
}

// (Re)registra o webhook na Evolution apontando para o Dash, com os eventos
// necessarios para ler grupos. Formato flat (mesmo do LUQZCRM, comprovado).
// Timeout maior porque o set pode ser lento.
export async function setWebhook(url: string): Promise<unknown> {
  const body = {
    enabled: true,
    url,
    webhook_by_events: false,
    webhookByEvents: false,
    webhook_base64: true,
    webhookBase64: true,
    events: [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE",
      "GROUPS_UPSERT",
      "GROUPS_UPDATE",
    ],
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(`${BASE_URL}/webhook/set/${INSTANCE}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    return await evoJSON(res)
  } finally {
    clearTimeout(timer)
  }
}

// Le a configuracao atual do webhook (para diagnostico).
export async function getWebhook(): Promise<unknown> {
  try {
    const res = await evoFetch(`${BASE_URL}/webhook/find/${INSTANCE}`, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Inicia o pareamento da instancia e retorna o QR code (base64) e/ou codigo.
// Usado pela tela de conexao para o usuario escanear com o WhatsApp.
export async function connectInstance(): Promise<unknown> {
  const res = await evoFetch(`${BASE_URL}/instance/connect/${INSTANCE}`, { headers })
  return evoJSON(res)
}

// Desconecta a instancia (logout). Forca novo pareamento na proxima conexao.
export async function logoutInstance(): Promise<unknown> {
  const res = await evoFetch(`${BASE_URL}/instance/logout/${INSTANCE}`, {
    method: "DELETE",
    headers,
  })
  return evoJSON(res)
}
