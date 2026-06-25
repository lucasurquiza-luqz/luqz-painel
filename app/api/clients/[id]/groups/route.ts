import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { groupId, linked } = await req.json()

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { clientId: linked ? clientId : null },
  })

  // Reflete o vinculo na conversa do chat (vincular/desvincular o cliente).
  await prisma.waConversation.upsert({
    where: { remoteJid: group.remoteJid },
    update: { clientId: linked ? clientId : null, groupId: group.id, isGroup: true },
    create: {
      remoteJid: group.remoteJid,
      isGroup: true,
      name: group.name,
      groupId: group.id,
      clientId: linked ? clientId : null,
    },
  })

  return NextResponse.json({ group })
}
