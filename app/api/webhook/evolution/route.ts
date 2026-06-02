import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Evolution API envia varios tipos de evento — so processamos mensagens de grupo
export async function POST(req: NextRequest) {
  // Valida o secret configurado na Evolution API (campo "Authorization" ou "apikey")
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET
  if (webhookSecret) {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("apikey") ?? ""
    if (authHeader !== webhookSecret) {
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

    // So processa mensagens de grupo (remoteJid termina em @g.us)
    if (!key?.remoteJid?.endsWith("@g.us")) return NextResponse.json({ ok: true })

    // Ignora mensagens sem conteudo util
    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      message?.documentMessage?.caption ||
      message?.videoMessage?.caption ||
      null

    const mediaType = messageType === "imageMessage"
      ? "image"
      : messageType === "documentMessage"
      ? "document"
      : messageType === "videoMessage"
      ? "video"
      : messageType === "audioMessage"
      ? "audio"
      : null

    // Encontra o grupo no banco pelo remoteJid
    const group = await prisma.group.findUnique({
      where: { remoteJid: key.remoteJid },
    })

    if (!group?.clientId) return NextResponse.json({ ok: true })

    // Busca ou cria a conversa para este grupo
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

    // Salva a mensagem (idempotente pelo evolutionId)
    await prisma.waMessage.upsert({
      where: { evolutionId: key.id },
      update: {},
      create: {
        conversationId: conversation.id,
        evolutionId: key.id,
        fromJid: key.fromMe ? "me" : (key.participant ?? key.remoteJid),
        fromName: key.fromMe ? "LUQZ" : (pushName ?? null),
        text,
        mediaType,
        mediaName: message?.documentMessage?.fileName ?? null,
        isFromMe: key.fromMe ?? false,
        timestamp: new Date(messageTimestamp * 1000),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[webhook/evolution]", err)
    return NextResponse.json({ ok: true }) // sempre retorna 200 pro Evolution
  }
}
