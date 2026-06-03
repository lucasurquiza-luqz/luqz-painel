import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { uploadBase64ToMinIO } from "@/lib/storage"

const BASE_URL = process.env.EVOLUTION_URL!
const API_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = encodeURIComponent(process.env.EVOLUTION_INSTANCE!)

const MEDIA_TYPES: Record<string, string> = {
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio",
  documentMessage: "document",
  stickerMessage: "image",
}

const MIME_EXTS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "application/pdf": "pdf",
}

async function downloadMediaFromEvolution(
  key: { remoteJid: string; fromMe: boolean; id: string }
): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/message/getBase64FromMediaMessage/${INSTANCE}`,
      {
        method: "POST",
        headers: { apikey: API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.base64 ? { base64: data.base64, mimetype: data.mimetype ?? "application/octet-stream" } : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  // Valida secret via query param
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (webhookSecret) {
    const secret = req.nextUrl.searchParams.get("secret")
    if (secret !== webhookSecret) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
  }

  try {
    const body = await req.json()
    const { event, data } = body

    if (event !== "messages.upsert") return NextResponse.json({ ok: true })

    const msg = Array.isArray(data) ? data[0] : data
    if (!msg) return NextResponse.json({ ok: true })

    const { key, pushName, message, messageTimestamp, messageType } = msg

    if (!key?.remoteJid?.endsWith("@g.us")) return NextResponse.json({ ok: true })

    // Texto da mensagem
    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      message?.documentMessage?.caption ||
      message?.videoMessage?.caption ||
      null

    // Tipo de midia
    const mediaCategory = MEDIA_TYPES[messageType] ?? null

    // Baixa e armazena midia no MinIO
    let mediaUrl: string | null = null
    let mediaName: string | null = message?.documentMessage?.fileName ?? null

    if (mediaCategory && !key.fromMe) {
      const mediaData = await downloadMediaFromEvolution(key)
      if (mediaData) {
        const ext = MIME_EXTS[mediaData.mimetype] ?? "bin"
        const storageKey = `wa-media/${Date.now()}-${key.id.slice(-8)}.${ext}`
        try {
          mediaUrl = await uploadBase64ToMinIO(storageKey, mediaData.base64, mediaData.mimetype)
        } catch {
          // Se falhar o upload, continua sem a midia
        }
      }
    }

    const group = await prisma.group.findUnique({ where: { remoteJid: key.remoteJid } })
    if (!group?.clientId) return NextResponse.json({ ok: true })

    const conversation = await prisma.waConversation.upsert({
      where: { groupId: group.id },
      update: {
        lastMessageAt: new Date(messageTimestamp * 1000),
        unreadCount: { increment: key.fromMe ? 0 : 1 },
      },
      create: {
        groupId: group.id,
        clientId: group.clientId,
        lastMessageAt: new Date(messageTimestamp * 1000),
        unreadCount: key.fromMe ? 0 : 1,
      },
    })

    await prisma.waMessage.upsert({
      where: { evolutionId: key.id },
      update: {},
      create: {
        conversationId: conversation.id,
        evolutionId: key.id,
        fromJid: key.fromMe ? "me" : (key.participant ?? key.remoteJid),
        fromName: key.fromMe ? "LUQZ" : (pushName ?? null),
        text,
        mediaUrl,
        mediaType: mediaCategory,
        mediaName,
        isFromMe: key.fromMe ?? false,
        timestamp: new Date(messageTimestamp * 1000),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[webhook/evolution]", err)
    return NextResponse.json({ ok: true })
  }
}