import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { serializePlan, sanitizePlanFunnels, effectivePlanFunnels } from "@/lib/media-plan"
import { sanitizeFunnel } from "@/app/api/clients/[id]/media-plans/route"

type Params = { params: Promise<{ id: string; planId: string }> }

const num = (value: unknown) => (typeof value === "number" && isFinite(value) ? value : null)
const int = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null)
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)

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
  if ("targetCpl" in body) data.targetCpl = num(body.targetCpl)
  if ("targetRoas" in body) data.targetRoas = num(body.targetRoas)
  if ("targetTicket" in body) data.targetTicket = num(body.targetTicket)
  if ("objective" in body) data.objective = str(body.objective)
  if ("funnel" in body) data.funnel = (sanitizeFunnel(body.funnel) ?? Prisma.JsonNull) as Prisma.InputJsonValue
  if ("funnels" in body) data.funnels = (sanitizePlanFunnels(body.funnels) ?? Prisma.JsonNull) as Prisma.InputJsonValue
  if ("narrative" in body) data.narrative = str(body.narrative)
  if ("notes" in body) data.notes = str(body.notes)
  if ("funnelId" in body) {
    const fid = typeof body.funnelId === "string" && body.funnelId ? body.funnelId : null
    data.funnelId = fid ? ((await prisma.clientFunnel.findFirst({ where: { id: fid, clientId: id }, select: { id: true } }))?.id ?? null) : null
  }

  const plan = await prisma.mediaPlan.update({
    where: { id: planId },
    data,
    include: { createdBy: { select: { name: true } }, campaignFunnel: { select: { id: true, name: true } } },
  })
  const s = serializePlan(plan)
  return NextResponse.json({ plan: { ...s, funnels: effectivePlanFunnels(s) } })
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
