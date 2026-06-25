import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { serializePlan } from "@/lib/media-plan"

type Params = { params: Promise<{ id: string }> }

const PLATFORMS = new Set(["META", "GOOGLE", "TOTAL"])

const num = (value: unknown) => (typeof value === "number" && isFinite(value) ? value : null)
const int = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null)

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const month = req.nextUrl.searchParams.get("month")
  const plans = await prisma.mediaPlan.findMany({
    where: { clientId: id, ...(month && /^\d{4}-\d{2}$/.test(month) ? { month } : {}) },
    orderBy: [{ month: "desc" }, { platform: "asc" }],
    include: { createdBy: { select: { name: true } } },
  })
  return NextResponse.json({ plans: plans.map(serializePlan) })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : ""
  if (!month) return NextResponse.json({ error: "Informe o período no formato AAAA-MM." }, { status: 400 })
  const platform = typeof body.platform === "string" && PLATFORMS.has(body.platform) ? body.platform : "TOTAL"

  try {
    const plan = await prisma.mediaPlan.create({
      data: {
        clientId: id,
        month,
        platform: platform as never,
        budget: num(body.budget),
        targetLeads: int(body.targetLeads),
        targetCpa: num(body.targetCpa),
        targetRoas: num(body.targetRoas),
        targetTicket: num(body.targetTicket),
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        createdById: auth.user.userId,
      },
      include: { createdBy: { select: { name: true } } },
    })
    return NextResponse.json({ plan: serializePlan(plan) }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe um plano para este período e plataforma." }, { status: 409 })
    }
    throw error
  }
}
