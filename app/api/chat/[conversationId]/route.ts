import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions, type SessionData, isEquipe } from "@/lib/auth"
import { sendText, sendMedia } from "@/lib/evolution"

type Params = { params: Promise<{ conversationId: string }> }

async function getAuthorizedConversation(conversationId: string, session: Partial<SessionData>) {
  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    include: { group: true },
  })
  if (!conversation) return null

  // CLIENTE so pode ver a propria conversa
  if (!isEquipe(session.role ?? "") && session.clientId !== conversation.clientId) {
    return null
  }

  return conversation
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { conversationId } = await params
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const conversation = await getAuthorizedConversation(conversationId, session)
  if (!conversation) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })

  const messages = await prisma.waMessage.findMany({
    where: { conversationId },
    orderBy: { timestamp: "asc" },
    take: 100,
  })

  await prisma.waConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  })

  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { conversationId } = await params
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const conversation = await getAuthorizedConversation(conversationId, session)
  if (!conversation) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })

  const { text, mediaUrl, mediaBase64, mediaType, mediaName } = await req.json()
  if (!text?.trim() && !mediaUrl && !mediaBase64) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
  }

  const remoteJid = conversation.group.remoteJid

  try {
    if (mediaUrl || mediaBase64) {
      // Prefere base64 (enviado direto, sem Evolution precisar baixar URL)
      const media = mediaBase64 ?? mediaUrl!
      const type = (["image", "document", "video", "audio"].includes(mediaType)
        ? mediaType
        : "document") as "image" | "document" | "video" | "audio"
      await sendMedia(remoteJid, media, type, text ?? "", mediaName ?? undefined)
    } else {
      await sendText(remoteJid, text)
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar" },
      { status: 500 }
    )
  }

  const hasMedia = !!(mediaUrl || mediaBase64)

  // Para imagens: salva data URI como mediaUrl para exibir no painel sem depender de URL externa
  // Para outros tipos: salva a URL externa (MinIO/local)
  let displayUrl = mediaUrl ?? null
  if (mediaBase64 && mediaType === "image" && !displayUrl) {
    // reconstroi data URI para display
    const mime = mediaName?.toLowerCase().endsWith(".png") ? "image/png"
      : mediaName?.toLowerCase().endsWith(".webp") ? "image/webp"
      : mediaName?.toLowerCase().endsWith(".gif") ? "image/gif"
      : "image/jpeg"
    displayUrl = `data:${mime};base64,${mediaBase64}`
  }

  const message = await prisma.waMessage.create({
    data: {
      conversationId,
      fromJid: "me",
      fromName: session.name,
      text: text?.trim() ?? null,
      mediaUrl: displayUrl,
      mediaType: hasMedia ? (mediaType ?? null) : null,
      mediaName: mediaName ?? null,
      isFromMe: true,
      timestamp: new Date(),
    },
  })

  await prisma.waConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  return NextResponse.json({ message })
}
