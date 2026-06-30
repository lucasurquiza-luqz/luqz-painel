import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, status: true, clientId: true, client: { select: { id: true, name: true } } },
  })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  return NextResponse.json({ project })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  await prisma.project.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
