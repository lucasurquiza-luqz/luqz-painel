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

// Envio com retry: a Evolution às vezes reporta "open" mas o socket Baileys
// fecha por um instante ("Connection Closed"). Reenviar após um respiro resolve.
async function evoSend(path: string, body: Record<string, unknown>, tries = 3): Promise<unknown> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await evoFetch(`${BASE_URL}/${path}/${INSTANCE}`, { method: "POST", headers, body: JSON.stringify(body) })
      return await evoJSON(res)
    } catch (err) {
      lastErr = err
      const transient = /connection closed|connection lost|timed out|socket|ECONNRESET|aborted/i.test(err instanceof Error ? err.message : String(err))
      if (!transient || attempt === tries) break
      await new Promise((r) => setTimeout(r, attempt * 900)) // backoff: 0.9s, 1.8s
    }
  }
  throw lastErr
}

export async function sendText(remoteJid: string, text: string) {
  return evoSend("message/sendText", { number: remoteJid, text })
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

  return evoSend("message/sendMedia", body)
}

export async function sendWhatsAppAudio(remoteJid: string, audio: string) {
  return evoSend("message/sendWhatsAppAudio", { number: remoteJid, audio, encoding: true })
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

// (Re)registra o webhook na Evolution apontando para o Dash.
// Formato NESTED (v2.3): `{ webhook: { byEvents, base64, ... } }`. A URL NAO pode
// conter query string (?secret=) nem o campo `headers` — essa versao retorna 400.
// Eventos limitados aos validos/comprovados nesta versao.
export async function setWebhook(url: string): Promise<unknown> {
  const body = {
    webhook: {
      enabled: true,
      url,
      byEvents: false,
      base64: true,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "GROUPS_UPSERT"],
    },
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
