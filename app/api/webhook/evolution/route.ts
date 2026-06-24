import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { uploadBase64ToMinIO } from "@/lib/storage"
import {
  asRecord,
  contentToText,
  extractMessageContent,
  getNestedMessage,
  isStorableContent,
} from "@/lib/wa-content"

const BASE_URL = process.env.EVOLUTION_URL!
const API_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = encodeURIComponent(process.env.EVOLUTION_INSTANCE!)

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

function normalizeEvent(event: unknown): string {
  if (typeof event !== "string") return ""
  return event.toLowerCase().replace(/_/g, ".")
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
    return data?.base64
      ? { base64: data.base64, mimetype: data.mimetype ?? "application/octet-stream" }
      : null
  } catch {
    return null
  }
}

// Registra que um webhook chegou e (opcionalmente) o estado da conexao.
async function touchRuntime(patch: { connectionState?: string; messageAt?: Date } = {}) {
  const now = new Date()
  try {
    await prisma.whatsAppRuntime.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        lastWebhookAt: now,
        connectionState: patch.connectionState ?? null,
        lastMessageAt: patch.messageAt ?? null,
      },
      update: {
        lastWebhookAt: now,
        ...(patch.connectionState ? { connectionState: patch.connectionState } : {}),
        ...(patch.messageAt ? { lastMessageAt: patch.messageAt } : {}),
      },
    })
  } catch {
    // Diagnostico nunca pode derrubar a ingestao.
  }
}

export async function POST(req: NextRequest) {
  // Registra que ALGUM POST chegou a este endpoint, antes de qualquer validacao.
  // Torna "Ultimo webhook" um teste confiavel de conectividade Evolution -> Dash:
  // se atualizar, a Evolution alcanca o Dash; se ficar em branco, nao alcanca.
  await touchRuntime()

  // Valida secret via query param OU header (a Evolution pode descartar a query).
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (webhookSecret) {
    const fromQuery = req.nextUrl.searchParams.get("secret")
    const fromHeader = req.headers.get("x-webhook-secret")
    if (fromQuery !== webhookSecret && fromHeader !== webhookSecret) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
  }

  try {
    const body = await req.json()
    const event = normalizeEvent(body.event)
    const data = body.data

    if (event === "connection.update") {
      const state = asRecord(data)?.state
      await touchRuntime({ connectionState: typeof state === "string" ? state : undefined })
      return NextResponse.json({ ok: true })
    }

    if (event === "groups.upsert" || event === "groups.update") {
      await handleGroupEvent(data)
      await touchRuntime()
      return NextResponse.json({ ok: true })
    }

    if (event !== "messages.upsert") return NextResponse.json({ ok: true })

    const msg = Array.isArray(data) ? data[0] : data
    if (!msg) return NextResponse.json({ ok: true })

    const { key, pushName, messageTimestamp } = msg

    if (!key?.remoteJid?.endsWith("@g.us")) return NextResponse.json({ ok: true })

    const group = await prisma.group.findUnique({ where: { remoteJid: key.remoteJid } })
    if (!group?.clientId) {
      // Grupo desconhecido ou nao vinculado a cliente: registra o sinal mas nao guarda.
      await touchRuntime()
      return NextResponse.json({ ok: true })
    }

    const content = extractMessageContent(getNestedMessage(msg))
    if (!isStorableContent(content)) {
      await touchRuntime()
      return NextResponse.json({ ok: true })
    }

    // Download e armazenamento de midia no MinIO (apenas mensagens recebidas).
    let mediaUrl: string | null = null
    if (content.mediaType && !key.fromMe) {
      const mediaData = await downloadMediaFromEvolution(key)
      if (mediaData) {
        const ext = MIME_EXTS[mediaData.mimetype] ?? "bin"
        const storageKey = `wa-media/${Date.now()}-${String(key.id).slice(-8)}.${ext}`
        try {
          mediaUrl = await uploadBase64ToMinIO(storageKey, mediaData.base64, mediaData.mimetype)
        } catch {
          // Sem a midia, segue com o texto/rotulo.
        }
      }
    }

    const timestamp = new Date(Number(messageTimestamp) * 1000)

    const conversation = await prisma.waConversation.upsert({
      where: { groupId: group.id },
      update: {
        lastMessageAt: timestamp,
        unreadCount: { increment: key.fromMe ? 0 : 1 },
      },
      create: {
        groupId: group.id,
        clientId: group.clientId,
        lastMessageAt: timestamp,
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
        text: content.text ?? contentToText(content),
        mediaUrl,
        mediaType: content.mediaType,
        mediaName: content.mediaName,
        isFromMe: key.fromMe ?? false,
        timestamp,
      },
    })

    await touchRuntime({ messageAt: timestamp })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[webhook/evolution]", err)
    return NextResponse.json({ ok: true })
  }
}

// Atualiza o nome dos grupos conhecidos quando a Evolution emite groups.upsert/update.
async function handleGroupEvent(data: unknown) {
  const items = Array.isArray(data) ? data : asRecord(data) ? [data] : []
  for (const raw of items) {
    const group = asRecord(raw)
    const remoteJid = typeof group?.id === "string" ? group.id : null
    const subject = typeof group?.subject === "string" ? group.subject : null
    if (!remoteJid?.endsWith("@g.us") || !subject) continue

    await prisma.group.updateMany({
      where: { remoteJid },
      data: { name: subject, syncedAt: new Date() },
    })
  }
}
