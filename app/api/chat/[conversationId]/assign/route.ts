import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, requireApiUser, type ApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ conversationId: string }> }

async function getConversation(conversationId: string, user: ApiUser) {
  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, clientId: true, assignedToId: true },
  })
  if (!conversation) return null
  if (!canAccessClient(user, conversation.clientId)) return null
  return conversation
}

// Time disponível + responsável atual + histórico de transferências.
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { conversationId } = await params
  const conversation = await getConversation(conversationId, auth.user)
  if (!conversation) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })

  const [team, transfers, assignedTo] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OPERADOR"] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.waConversationTransfer.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        byUser: { select: { name: true } },
      },
    }),
    conversation.assignedToId
      ? prisma.user.findUnique({ where: { id: conversation.assignedToId }, select: { id: true, name: true } })
      : null,
  ])

  return NextResponse.json({ team, transfers, assignedTo })
}

// Transfere/atribui a conversa. body: { toUserId: string | null, note?: string }
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { conversationId } = await params
  const conversation = await getConversation(conversationId, auth.user)
  if (!conversation) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null

  let toUserId: string | null = null
  if (typeof body.toUserId === "string" && body.toUserId) {
    const member = await prisma.user.findFirst({
      where: { id: body.toUserId, role: { in: ["ADMIN", "OPERADOR"] }, active: true },
      select: { id: true },
    })
    if (!member) return NextResponse.json({ error: "Responsável inválido." }, { status: 400 })
    toUserId = member.id
  }

  if (toUserId === (conversation.assignedToId ?? null) && !note) {
    return NextResponse.json({ error: "Nenhuma mudança." }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.waConversation.update({ where: { id: conversationId }, data: { assignedToId: toUserId } }),
    prisma.waConversationTransfer.create({
      data: {
        conversationId,
        fromUserId: conversation.assignedToId,
        toUserId,
        byUserId: auth.user.userId,
        note,
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
