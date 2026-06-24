import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

const VALID_PERCEPTIONS = ["GREAT", "GOOD", "NEUTRAL", "CONCERN", "CRITICAL"] as const

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params

  const checkins = await prisma.teamCheckin.findMany({
    where: { clientId },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json({ checkins })
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const body = await req.json().catch(() => ({}))

  const { perception, justification, validUntil } = body

  if (!VALID_PERCEPTIONS.includes(perception)) {
    return NextResponse.json({ error: "Percepcao invalida." }, { status: 400 })
  }
  if (!justification || typeof justification !== "string" || justification.trim().length < 10) {
    return NextResponse.json({ error: "Justificativa obrigatoria (minimo 10 caracteres)." }, { status: 400 })
  }

  let validUntilDate: Date | null = null
  if (validUntil && typeof validUntil === "string") {
    const parsed = new Date(validUntil)
    if (!isNaN(parsed.getTime())) validUntilDate = parsed
  }

  const checkin = await prisma.teamCheckin.create({
    data: {
      clientId,
      authorId: auth.user.userId,
      perception,
      justification: justification.trim(),
      validUntil: validUntilDate,
    },
    include: { author: { select: { name: true } } },
  })

  return NextResponse.json({ checkin }, { status: 201 })
}