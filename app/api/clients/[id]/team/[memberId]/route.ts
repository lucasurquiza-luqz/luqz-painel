import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string; memberId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, memberId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.clientTeamMember.findFirst({ where: { id: memberId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Responsavel nao encontrado." }, { status: 404 })

  await prisma.clientTeamMember.delete({ where: { id: memberId } })
  return NextResponse.json({ ok: true })
}
