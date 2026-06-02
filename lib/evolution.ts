const BASE_URL = process.env.EVOLUTION_URL!
const API_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = encodeURIComponent(process.env.EVOLUTION_INSTANCE!)

const headers = {
  "apikey": API_KEY,
  "Content-Type": "application/json",
}

export interface EvoGroup {
  id: string
  subject: string
  size: number
}

export async function fetchGroups(): Promise<EvoGroup[]> {
  const res = await fetch(
    `${BASE_URL}/group/fetchAllGroups/${INSTANCE}?getParticipants=false`,
    { headers }
  )
  if (!res.ok) throw new Error(`Evolution API error: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function sendText(remoteJid: string, text: string) {
  const url = `${BASE_URL}/message/sendText/${INSTANCE}`
  const body = { number: remoteJid, text }
  console.log("[evolution] sendText →", url, JSON.stringify(body))

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  const data = await res.text()
  console.log("[evolution] sendText ←", res.status, data)

  if (!res.ok) throw new Error(`Evolution ${res.status}: ${data}`)
  return JSON.parse(data)
}

export async function sendMedia(
  remoteJid: string,
  mediaUrl: string,
  mediaType: "image" | "document" | "video",
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

  const res = await fetch(`${BASE_URL}/message/sendMedia/${INSTANCE}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erro ao enviar mídia: ${err}`)
  }
  return res.json()
}
