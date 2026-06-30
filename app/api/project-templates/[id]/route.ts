import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

// Detalhe do template (meta + tarefas) — usado pra prefill ao criar projeto.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const template = await prisma.projectTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 })
  return NextResponse.json({ template })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  await prisma.projectTemplate.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
