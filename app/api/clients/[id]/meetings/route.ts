import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params

  const meetings = await prisma.meeting.findMany({
    where: { clientId },
    include: {
      createdBy: { select: { name: true } },
      summary: {
        select: {
          id: true,
          status: true,
          _count: { select: { items: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: 50,
  })

  return NextResponse.json({ meetings })
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const body = await req.json().catch(() => ({}))

  const { title, kind, date, participants, rawContent } = body

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Titulo obrigatorio." }, { status: 400 })
  }
  if (!["CALL", "IN_PERSON", "ASYNC"].includes(kind)) {
    return NextResponse.json({ error: "Tipo de reuniao invalido." }, { status: 400 })
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data invalida. Use AAAA-MM-DD." }, { status: 400 })
  }
  if (!rawContent || typeof rawContent !== "string" || rawContent.trim().length < 10) {
    return NextResponse.json({ error: "Conteudo da reuniao obrigatorio (minimo 10 caracteres)." }, { status: 400 })
  }
  const safeParticipants = Array.isArray(participants)
    ? participants.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
    : []

  const meeting = await prisma.meeting.create({
    data: {
      clientId,
      title: title.trim(),
      kind,
      date: new Date(`${date}T12:00:00Z`),
      participants: safeParticipants,
      rawContent: rawContent.trim(),
      createdById: auth.user.userId,
    },
    include: { createdBy: { select: { name: true } } },
  })

  return NextResponse.json({ meeting }, { status: 201 })
}