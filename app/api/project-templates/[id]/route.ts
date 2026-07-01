import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import type { Prisma, ProjectKind } from "@prisma/client"

type Params = { params: Promise<{ id: string }> }
const KINDS = ["CONTEUDO", "TRAFEGO", "ONBOARDING", "WEB", "COMERCIAL", "OUTRO"]

// Detalhe do template (meta + tarefas) — usado pra prefill ao criar projeto.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const template = await prisma.projectTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 })
  return NextResponse.json({ template })
}

// Edita meta + tarefas do template.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim()
  if (KINDS.includes(b.kind)) data.kind = b.kind as ProjectKind
  if ("description" in b) data.description = typeof b.description === "string" ? b.description.trim() || null : null
  if ("objectives" in b) data.objectives = typeof b.objectives === "string" ? b.objectives.trim() || null : null
  if ("notes" in b) data.notes = typeof b.notes === "string" ? b.notes.trim() || null : null
  if ("links" in b) data.links = (Array.isArray(b.links) ? b.links : undefined) as Prisma.InputJsonValue | undefined
  if (Array.isArray(b.tasks)) data.tasks = b.tasks as Prisma.InputJsonValue
  const template = await prisma.projectTemplate.update({ where: { id }, data })
  return NextResponse.json({ template })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  await prisma.projectTemplate.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
