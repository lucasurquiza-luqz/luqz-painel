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

  let body: string
  try {
    body = await res.text()
  } catch {
    body = ""
  }

  if (!res.ok) throw new Error(`Evolution ${res.status}: ${body}`)

  try {
    return JSON.parse(body)
  } catch {
    return { ok: true }
  }
}

export async function sendMedia(
  remoteJid: string,
  mediaUrl: string,
  mediaType: "image" | "document" | "video" | "audio",
  caption: string,
  fileName?: string
) {
  const body: Record<string, string> = {
    number: remoteJid,
    mediatype: mediaType,
    media: mediaUrl,
    caption,
  }
  if (fileName) body.fileName = fileName

  const res = await evoFetch(`${BASE_URL}/message/sendMedia/${INSTANCE}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  let resBody: string
  try {
    resBody = await res.text()
  } catch {
    resBody = ""
  }

  if (!res.ok) throw new Error(`Evolution ${res.status}: ${resBody}`)

  try {
    return JSON.parse(resBody)
  } catch {
    return { ok: true }
  }
}
