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

// media pode ser URL publica ou base64 (data:mime;base64,...)
export async function sendMedia(
  remoteJid: string,
  media: string,
  mediaType: "image" | "document" | "video" | "audio",
  caption: string,
  fileName?: string
) {
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
