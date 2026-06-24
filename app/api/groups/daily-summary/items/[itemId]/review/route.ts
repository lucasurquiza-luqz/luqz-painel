import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ itemId: string }> }

const KIND_TO_CONTEXT: Record<string, "DECISION" | "FACT" | "PERCEPTION"> = {
  DECISION: "DECISION",
  COMMITMENT: "DECISION",
  RISK: "PERCEPTION",
  PRAISE: "PERCEPTION",
  PENDING: "FACT",
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { itemId } = await params
  const { action } = await req.json()

  if (!["APPROVE", "REJECT", "DISCARD"].includes(action)) {
    return NextResponse.json({ error: "Acao de revisao invalida." }, { status: 400 })
  }

  const current = await prisma.groupDailySummaryItem.findUnique({
    where: { id: itemId },
    include: { summary: true },
  })
  if (!current) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 })
  if (current.status !== "PROPOSED") {
    return NextResponse.json({ error: "Apenas itens propostos podem ser revisados." }, { status: 409 })
  }

  if (action !== "APPROVE") {
    const item = await prisma.groupDailySummaryItem.update({
      where: { id: itemId },
      data: {
        status: action === "REJECT" ? "REJECTED" : "DISCARDED",
        reviewedById: auth.user.userId,
        reviewedAt: new Date(),
      },
    })
    await markSummaryReviewedIfDone(current.summaryId)
    return NextResponse.json({ item })
  }

  const dateLabel = current.summary.date.toISOString().slice(0, 10)

  const item = await prisma.$transaction(async (tx) => {
    const source = await tx.contextSource.create({
      data: {
        clientId: current.summary.clientId,
        type: "GROUP",
        label: `Resumo diario do grupo · ${dateLabel}`,
        reference: current.summaryId,
        capturedAt: current.summary.generatedAt,
      },
    })

    const contextItem = await tx.contextItem.create({
      data: {
        clientId: current.summary.clientId,
        sourceId: source.id,
        domain: "OPERACIONAL",
        kind: KIND_TO_CONTEXT[current.kind] ?? "FACT",
        status: "PROPOSED",
        visibility: "INTERNAL",
        title: `${current.kind} · ${dateLabel}`,
        content: current.responsible ? `${current.text} (responsavel: ${current.responsible})` : current.text,
        createdById: auth.user.userId,
      },
    })

    return tx.groupDailySummaryItem.update({
      where: { id: itemId },
      data: {
        status: "APPROVED",
        reviewedById: auth.user.userId,
        reviewedAt: new Date(),
        contextItemId: contextItem.id,
      },
    })
  })

  await markSummaryReviewedIfDone(current.summaryId)
  return NextResponse.json({ item })
}

async function markSummaryReviewedIfDone(summaryId: string) {
  const pending = await prisma.groupDailySummaryItem.count({
    where: { summaryId, status: "PROPOSED" },
  })
  if (pending === 0) {
    await prisma.groupDailySummary.update({ where: { id: summaryId }, data: { status: "REVIEWED" } })
  }
}
