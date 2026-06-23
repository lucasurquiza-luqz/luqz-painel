import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

// Cria WaConversation para todos os grupos ja vinculados a clientes que ainda nao tem conversa
export async function POST() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

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
