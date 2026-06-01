import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions, type SessionData } from "@/lib/auth"
import { sendText, sendMedia } from "@/lib/evolution"

type Params = { params: Promise<{ conversationId: string }> }

// GET — busca mensagens da conversa
export async function GET(req: NextRequest, { params }: Params) {
  const { conversationId } = await params
  const cursor = req.nextUrl.searchParams.get("cursor") // para paginacao futura

  const messages = await prisma.waMessage.findMany({
    where: { conversationId },
    orderBy: { timestamp: "asc" },
    take: 100,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  // Zera contador de nao lidas
  await prisma.waConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  })

  return NextResponse.json({ messages })
}

// POST — envia mensagem para o grupo
export async function POST(req: NextRequest, { params }: Params) {
  const { conversationId } = await params
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const { text, mediaPath, mediaType, mediaName } = await req.json()

  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    include: { group: true },
  })
  if (!conversation) return NextResponse.json({ error: "Conversa nao encontrada" }, { status: 404 })

  const remoteJid = conversation.group.remoteJid

  try {
    if (mediaPath) {
      const mediaUrl = `${process.env.NEXT_PUBLIC_APP_URL}${mediaPath}`
      await sendMedia(remoteJid, mediaUrl, (mediaType as "image" | "document" | "video") ?? "document", text ?? "", mediaName ?? undefined)
    } else {
      await sendText(remoteJid, text)
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar" },
      { status: 500 }
    )
  }

  // Salva a mensagem enviada localmente
  const message = await prisma.waMessage.create({
    data: {
      conversationId,
      fromJid: "me",
      fromName: session.name,
      text: text ?? null,
      mediaUrl: mediaPath ? `${process.env.NEXT_PUBLIC_APP_URL}${mediaPath}` : null,
      mediaType: mediaType ?? null,
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
