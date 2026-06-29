import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { sendText } from "@/lib/evolution"

// Inicia uma conversa individual com um número (envia a 1ª mensagem).
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { phone, text, name } = await req.json().catch(() => ({}))
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : ""
  if (digits.length < 10) return NextResponse.json({ error: "Telefone inválido (use DDI+DDD+número, ex: 5531999998888)." }, { status: 400 })
  if (!text?.trim()) return NextResponse.json({ error: "Escreva a primeira mensagem." }, { status: 400 })

  const remoteJid = `${digits}@s.whatsapp.net`

  try {
    await sendText(remoteJid, text.trim())
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao enviar pelo WhatsApp." }, { status: 502 })
  }

  const conversation = await prisma.waConversation.upsert({
    where: { remoteJid },
    create: { remoteJid, isGroup: false, name: typeof name === "string" && name.trim() ? name.trim() : digits, lastMessageAt: new Date() },
    update: { lastMessageAt: new Date() },
  })
  await prisma.waMessage.create({
    data: { conversationId: conversation.id, fromJid: "me", fromName: auth.user.name, text: text.trim(), isFromMe: true, timestamp: new Date() },
  })

  return NextResponse.json({ conversation })
}
