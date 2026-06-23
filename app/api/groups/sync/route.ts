import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { fetchGroups } from "@/lib/evolution"
import { requireApiUser } from "@/lib/api-auth"

export async function POST() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  try {
    const evoGroups = await fetchGroups()

    let created = 0
    let updated = 0

    for (const g of evoGroups) {
      const existing = await prisma.group.findUnique({ where: { remoteJid: g.id } })

      if (existing) {
        await prisma.group.update({
          where: { id: existing.id },
          data: { name: g.subject, participants: g.size, syncedAt: new Date() },
        })
        updated++
      } else {
        await prisma.group.create({
          data: { remoteJid: g.id, name: g.subject, participants: g.size },
        })
        created++
      }
    }

    return NextResponse.json({ ok: true, created, updated, total: evoGroups.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao sincronizar grupos." },
      { status: 500 }
    )
  }
}
