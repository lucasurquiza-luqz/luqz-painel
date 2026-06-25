import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string; resourceId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, resourceId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.clientResource.findFirst({ where: { id: resourceId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Link nao encontrado." }, { status: 404 })

  await prisma.clientResource.delete({ where: { id: resourceId } })
  return NextResponse.json({ ok: true })
}
