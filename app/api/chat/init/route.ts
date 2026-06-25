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
    if (!g.clientId) continue
    const exists = await prisma.waConversation.findUnique({ where: { remoteJid: g.remoteJid } })
    if (!exists) {
      await prisma.waConversation.create({
        data: {
          remoteJid: g.remoteJid,
          isGroup: true,
          name: g.name,
          groupId: g.id,
          clientId: g.clientId,
        },
      })
      created++
    }
  }

  return NextResponse.json({ ok: true, created })
}
