import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string; docId: string }> }

const CATEGORIES = new Set(["PROPOSTA", "CONTRATO", "BRIEFING", "RELATORIO", "CRIATIVO", "ESTRATEGIA", "APRESENTACAO", "OUTRO"])
const VISIBILITIES = new Set(["INTERNAL", "CLIENT"])
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, docId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.clientDocument.findFirst({ where: { id: docId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  // Aprovação explícita (action) — registra quem aprovou e quando.
  if (body.action === "APPROVE") {
    data.status = "APPROVED"
    data.approvedById = auth.user.userId
    data.approvedAt = new Date()
  } else if (body.action === "UNAPPROVE") {
    data.status = "DRAFT"
    data.approvedById = null
    data.approvedAt = null
  }

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
  if (typeof body.category === "string" && CATEGORIES.has(body.category)) data.category = body.category
  if (typeof body.visibility === "string" && VISIBILITIES.has(body.visibility)) data.visibility = body.visibility
  if ("notes" in body) data.notes = str(body.notes)
  if ("externalUrl" in body) data.externalUrl = str(body.externalUrl)

  const document = await prisma.clientDocument.update({
    where: { id: docId },
    data,
    include: { uploadedBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
  })
  return NextResponse.json({ document })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, docId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.clientDocument.findFirst({ where: { id: docId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 })

  await prisma.clientDocument.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
