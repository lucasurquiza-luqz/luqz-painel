import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { serializePlan } from "@/lib/media-plan"

type Params = { params: Promise<{ id: string; planId: string }> }

const num = (value: unknown) => (typeof value === "number" && isFinite(value) ? value : null)
const int = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null)

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, planId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.mediaPlan.findFirst({ where: { id: planId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Plano nao encontrado." }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if ("budget" in body) data.budget = num(body.budget)
  if ("targetLeads" in body) data.targetLeads = int(body.targetLeads)
  if ("targetCpa" in body) data.targetCpa = num(body.targetCpa)
  if ("targetRoas" in body) data.targetRoas = num(body.targetRoas)
  if ("targetTicket" in body) data.targetTicket = num(body.targetTicket)
  if ("notes" in body) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null

  const plan = await prisma.mediaPlan.update({
    where: { id: planId },
    data,
    include: { createdBy: { select: { name: true } } },
  })
  return NextResponse.json({ plan: serializePlan(plan) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, planId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.mediaPlan.findFirst({ where: { id: planId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Plano nao encontrado." }, { status: 404 })

  await prisma.mediaPlan.delete({ where: { id: planId } })
  return NextResponse.json({ ok: true })
}
