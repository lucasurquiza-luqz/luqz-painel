import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import type { ContextKind } from "@prisma/client"

type Params = { params: Promise<{ itemId: string }> }

function toContextKind(kind: string): ContextKind {
  if (kind === "OBJECTION" || kind === "RISK") return "PERCEPTION"
  return "DECISION"
}

async function markSummaryReviewedIfDone(summaryId: string) {
  const pending = await prisma.meetingSummaryItem.count({
    where: { summaryId, status: "PROPOSED" },
  })
  if (pending === 0) {
    await prisma.meetingSummary.update({ where: { id: summaryId }, data: { status: "REVIEWED" } })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { itemId } = await params
  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (!["APPROVE", "REJECT", "DISCARD"].includes(action)) {
    return NextResponse.json({ error: "Acao de revisao invalida." }, { status: 400 })
  }

  const current = await prisma.meetingSummaryItem.findUnique({
    where: { id: itemId },
    include: {
      summary: {
        include: { meeting: { select: { id: true, title: true, clientId: true } } },
      },
    },
  })

  if (!current) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 })
  if (current.status !== "PROPOSED") {
    return NextResponse.json({ error: "Apenas itens propostos podem ser revisados." }, { status: 409 })
  }

  const { clientId, id: meetingId, title: meetingTitle } = current.summary.meeting

  if (action !== "APPROVE") {
    const result = await prisma.meetingSummaryItem.updateMany({
      where: { id: itemId, status: "PROPOSED" },
      data: {
        status: action === "REJECT" ? "REJECTED" : "DISCARDED",
        reviewedById: auth.user.userId,
        reviewedAt: new Date(),
      },
    })
    if (result.count !== 1) {
      return NextResponse.json({ error: "Este item ja foi revisado por outra pessoa." }, { status: 409 })
    }
    await markSummaryReviewedIfDone(current.summaryId)
    return NextResponse.json({ ok: true })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.meetingSummaryItem.updateMany({
        where: { id: itemId, status: "PROPOSED" },
        data: { status: "APPROVED", reviewedById: auth.user.userId, reviewedAt: new Date() },
      })
      if (claimed.count !== 1) throw new Error("ALREADY_REVIEWED")

      const source = await tx.contextSource.create({
        data: {
          clientId,
          type: "MEETING",
          label: meetingTitle,
          reference: meetingId,
          capturedAt: current.summary.generatedAt,
        },
      })

      const contextItem = await tx.contextItem.create({
        data: {
          clientId,
          sourceId: source.id,
          domain: "OPERACIONAL",
          kind: toContextKind(current.kind),
          status: "PROPOSED",
          visibility: "INTERNAL",
          title: current.text.slice(0, 120),
          content: current.responsible
            ? `${current.text} (responsavel: ${current.responsible})`
            : current.text,
          createdById: auth.user.userId,
        },
      })

      await tx.meetingSummaryItem.update({
        where: { id: itemId },
        data: { contextItemId: contextItem.id },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_REVIEWED") {
      return NextResponse.json({ error: "Este item ja foi revisado por outra pessoa." }, { status: 409 })
    }
    throw error
  }

  await markSummaryReviewedIfDone(current.summaryId)
  return NextResponse.json({ ok: true })
}
