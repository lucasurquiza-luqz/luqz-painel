import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { serializePlan, sanitizePlanFunnels, effectivePlanFunnels } from "@/lib/media-plan"

type Params = { params: Promise<{ id: string }> }

const PLATFORMS = new Set(["META", "GOOGLE", "TOTAL"])

const num = (value: unknown) => (typeof value === "number" && isFinite(value) ? value : null)
const int = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null)
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)
// Funil = lista de etapas [{ label, rate, ticket }]; a 1ª (topo) ignora rate.
export function sanitizeFunnel(value: unknown): { label: string; rate: number | null; ticket: number | null }[] | null {
  if (!Array.isArray(value)) return null
  const stages = value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      label: typeof s.label === "string" ? s.label.trim() : "",
      rate: typeof s.rate === "number" && isFinite(s.rate) ? s.rate : null,
      ticket: typeof s.ticket === "number" && isFinite(s.ticket) && s.ticket > 0 ? s.ticket : null,
    }))
    .filter((s) => s.label)
  return stages.length ? stages : null
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR", "CLIENTE"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const month = req.nextUrl.searchParams.get("month")
  const plans = await prisma.mediaPlan.findMany({
    where: { clientId: id, ...(month && /^\d{4}-\d{2}$/.test(month) ? { month } : {}) },
    orderBy: [{ month: "desc" }, { platform: "asc" }],
    include: { createdBy: { select: { name: true } }, campaignFunnel: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ plans: plans.map(serializePlan).map((p) => ({ ...p, funnels: effectivePlanFunnels(p) })) })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : ""
  if (!month) return NextResponse.json({ error: "Informe o período no formato AAAA-MM." }, { status: 400 })
  const platform = typeof body.platform === "string" && PLATFORMS.has(body.platform) ? body.platform : "TOTAL"

  // Funil de campanha (opcional): precisa pertencer ao cliente.
  let funnelId: string | null = null
  if (typeof body.funnelId === "string" && body.funnelId) {
    const f = await prisma.clientFunnel.findFirst({ where: { id: body.funnelId, clientId: id }, select: { id: true } })
    funnelId = f?.id ?? null
  }

  try {
    const plan = await prisma.mediaPlan.create({
      data: {
        clientId: id,
        month,
        platform: platform as never,
        funnelId,
        budget: num(body.budget),
        targetLeads: int(body.targetLeads),
        targetCpa: num(body.targetCpa),
        targetCpl: num(body.targetCpl),
        targetRoas: num(body.targetRoas),
        targetTicket: num(body.targetTicket),
        objective: str(body.objective),
        funnel: (sanitizeFunnel(body.funnel) ?? undefined) as Prisma.InputJsonValue | undefined,
        funnels: (sanitizePlanFunnels(body.funnels) ?? undefined) as Prisma.InputJsonValue | undefined,
        narrative: str(body.narrative),
        notes: str(body.notes),
        createdById: auth.user.userId,
      },
      include: { createdBy: { select: { name: true } }, campaignFunnel: { select: { id: true, name: true } } },
    })
    const s = serializePlan(plan)
    return NextResponse.json({ plan: { ...s, funnels: effectivePlanFunnels(s) } }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe um plano para este período/plataforma/funil." }, { status: 409 })
    }
    throw error
  }
}
