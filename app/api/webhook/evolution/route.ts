import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { reportError } from "@/lib/observability"
import { uploadBase64ToMinIO } from "@/lib/storage"
import {
  asRecord,
  contentToText,
  extractMessageContent,
  getNestedMessage,
  isGroupJid,
  isStorableContent,
  isValidJid,
  jidToPhone,
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

  // Valida o secret. Modo padrão (compatível): só rejeita secret ERRADO — algumas versões
  // da Evolution não anexam secret à URL, então POST sem secret é aceito.
  // Modo estrito (EVOLUTION_WEBHOOK_REQUIRE_SECRET=true): exige o secret correto sempre —
  // fecha o buraco de injeção. Ligar SÓ depois de confirmar que a URL registrada leva ?secret=.
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (webhookSecret) {
    const provided = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-webhook-secret")
    const strict = process.env.EVOLUTION_WEBHOOK_REQUIRE_SECRET === "true"
    const bad = strict ? provided !== webhookSecret : (provided != null && provided !== webhookSecret)
    if (bad) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
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
    const remoteJid: string | undefined = key?.remoteJid

    // Aceita grupos e individuais; ignora status/broadcast e JIDs invalidos.
    if (!isValidJid(remoteJid) || remoteJid === "status@broadcast") {
      await touchRuntime()
      return NextResponse.json({ ok: true })
    }

    const isGroup = isGroupJid(remoteJid)

    // Grupos continuam curados (so guardamos grupos vinculados a um cliente).
    // Conversas individuais sao capturadas todas (cliente vinculado depois).
    const group = isGroup ? await prisma.group.findUnique({ where: { remoteJid } }) : null
    if (isGroup && !group?.clientId) {
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
    const contactName = !key.fromMe && pushName ? pushName : null
    const fallbackName = isGroup
      ? (group?.name ?? "Grupo")
      : (contactName ?? jidToPhone(remoteJid) ?? remoteJid.split("@")[0])

    const conversation = await prisma.waConversation.upsert({
      where: { remoteJid },
      update: {
        lastMessageAt: timestamp,
        unreadCount: { increment: key.fromMe ? 0 : 1 },
        ...(isGroup && group ? { groupId: group.id, clientId: group.clientId } : {}),
        ...(!isGroup && contactName ? { name: contactName } : {}),
      },
      create: {
        remoteJid,
        isGroup,
        name: fallbackName,
        groupId: group?.id ?? null,
        clientId: group?.clientId ?? null,
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
    reportError("webhook.evolution", err)
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
