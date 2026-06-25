import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ conversationId: string }> }

// Clientes disponíveis + vínculo atual da conversa.
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { conversationId } = await params
  const [conversation, clients] = await Promise.all([
    prisma.waConversation.findUnique({ where: { id: conversationId }, select: { id: true, clientId: true } }),
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  if (!conversation) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })

  return NextResponse.json({ clientId: conversation.clientId, clients })
}

// Vincula (ou desvincula) a conversa a um cliente.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { conversationId } = await params
  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isGroup: true, groupId: true },
  })
  if (!conversation) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  let clientId: string | null = null
  if (typeof body.clientId === "string" && body.clientId) {
    const client = await prisma.client.findUnique({ where: { id: body.clientId }, select: { id: true } })
    if (!client) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 })
    clientId = client.id
  }

  await prisma.waConversation.update({ where: { id: conversationId }, data: { clientId } })

  // Para grupos, mantém o vínculo do Group em sincronia com a conversa.
  if (conversation.isGroup && conversation.groupId) {
    await prisma.group.update({ where: { id: conversation.groupId }, data: { clientId } })
  }

  return NextResponse.json({ ok: true })
}
