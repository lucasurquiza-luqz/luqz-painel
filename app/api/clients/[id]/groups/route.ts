import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { groupId, linked } = await req.json()

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { clientId: linked ? clientId : null },
  })

  // Ao vincular: garante que a conversa existe para o chat aparecer imediatamente
  if (linked) {
    await prisma.waConversation.upsert({
      where: { groupId },
      update: {},
      create: { groupId, clientId },
    })
  }

  return NextResponse.json({ group })
}
