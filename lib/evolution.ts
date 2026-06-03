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

// Converte URL para base64 para enviar diretamente (evita que Evolution precise baixar)
async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Nao foi possivel baixar o arquivo: ${res.status}`)
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream"
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  return { base64: `data:${mime};base64,${base64}`, mime }
}

export async function sendMedia(
  remoteJid: string,
  mediaUrl: string,
  mediaType: "image" | "document" | "video" | "audio",
  caption: string,
  fileName?: string
) {
  // Tenta converter para base64 primeiro (mais confiavel que URL publica)
  let media = mediaUrl
  try {
    const { base64 } = await urlToBase64(mediaUrl)
    media = base64
  } catch {
    // Se nao conseguir baixar, usa a URL direta
    media = mediaUrl
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
