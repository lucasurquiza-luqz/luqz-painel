import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const message = await prisma.scheduledMessage.findUnique({
    where: { id },
    include: {
      groups: { include: { group: { select: { id: true, name: true } } } },
    },
  })
  if (!message) return NextResponse.json({ error: "Nao encontrado." }, { status: 404 })
  return NextResponse.json({ message })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Cancelamento simples (so status)
  if (body.status && Object.keys(body).length === 1) {
    const message = await prisma.scheduledMessage.update({ where: { id }, data: { status: body.status } })
    return NextResponse.json({ message })
  }

  // Edicao completa
  const { text, scheduledAt, groupIds, mediaPath, mediaType, mediaName } = body

  const current = await prisma.scheduledMessage.findUnique({ where: { id } })
  if (!current || current.status !== "PENDING") {
    return NextResponse.json({ error: "Apenas mensagens pendentes podem ser editadas." }, { status: 400 })
  }

  // Atualiza grupos: apaga os antigos e cria os novos
  await prisma.groupMessage.deleteMany({ where: { messageId: id } })

  const message = await prisma.scheduledMessage.update({
    where: { id },
    data: {
      text,
      scheduledAt: new Date(scheduledAt),
      ...(mediaPath && { mediaPath, mediaType, mediaName }),
      groups: {
        create: (groupIds as string[]).map((groupId) => ({ groupId })),
      },
    },
  })

  return NextResponse.json({ message })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.scheduledMessage.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
