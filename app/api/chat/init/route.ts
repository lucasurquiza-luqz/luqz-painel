import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// Cria WaConversation para todos os grupos ja vinculados a clientes que ainda nao tem conversa
export async function POST() {
  const groups = await prisma.group.findMany({
    where: { clientId: { not: null } },
  })

  let created = 0
  for (const g of groups) {
    const exists = await prisma.waConversation.findUnique({ where: { groupId: g.id } })
    if (!exists && g.clientId) {
      await prisma.waConversation.create({ data: { groupId: g.id, clientId: g.clientId } })
      created++
    }
  }

  return NextResponse.json({ ok: true, created })
}
