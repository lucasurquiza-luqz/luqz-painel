import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { generateMeetingSummary } from "@/lib/ai/meeting-summary"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

type Params = { params: Promise<{ id: string; meetingId: string }> }
const MAX_CONTENT_CHARS = 60_000

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId, meetingId } = await params

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, clientId },
    include: { summary: { select: { id: true } } },
  })

  if (!meeting) return NextResponse.json({ error: "Reuniao nao encontrada." }, { status: 404 })
  if (meeting.summary) return NextResponse.json({ error: "Esta reuniao ja possui um resumo." }, { status: 409 })

  if (meeting.rawContent.length > MAX_CONTENT_CHARS) {
    return NextResponse.json(
      { error: "O conteudo desta reuniao excede o limite seguro para processamento." },
      { status: 413 }
    )
  }

  let draft
  try {
    draft = await generateMeetingSummary({
      title: meeting.title,
      kind: meeting.kind,
      participants: meeting.participants,
      rawContent: meeting.rawContent,
    })
  } catch (error) {
    if (error instanceof AiProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar resumo com IA." },
      { status: 502 }
    )
  }

  const summary = await prisma.meetingSummary.create({
    data: {
      meetingId: meeting.id,
      clientId,
      status: draft.items.length === 0 ? "REVIEWED" : "DRAFT",
      rawSummary: draft.rawSummary,
      generatedById: auth.user.userId,
      items: {
        create: draft.items.map((item) => ({
          kind: item.kind,
          text: item.text,
          responsible: item.responsible,
          deadline: item.deadline,
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json({ summary }, { status: 201 })
}