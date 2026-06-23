import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ itemId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { itemId } = await params
  const { action } = await req.json()

  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "Acao de revisao invalida." }, { status: 400 })
  }

  const current = await prisma.contextItem.findUnique({ where: { id: itemId } })
  if (!current) return NextResponse.json({ error: "Item nao encontrado." }, { status: 404 })
  if (current.status !== "PROPOSED") {
    return NextResponse.json({ error: "Apenas propostas podem ser revisadas." }, { status: 409 })
  }

  let item
  try {
    item = await prisma.$transaction(async (tx) => {
      if (action === "APPROVE" && current.supersedesId) {
        const replaced = await tx.contextItem.updateMany({
          where: { id: current.supersedesId, clientId: current.clientId, status: "ACTIVE" },
          data: { status: "SUPERSEDED" },
        })
        if (replaced.count !== 1) throw new Error("CONTEXT_VERSION_CONFLICT")
      }

      return tx.contextItem.update({
        where: { id: itemId },
        data: {
          status: action === "APPROVE" ? "ACTIVE" : "REJECTED",
          reviewedById: auth.user.userId,
          reviewedAt: new Date(),
        },
        include: {
          source: true,
          createdBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "CONTEXT_VERSION_CONFLICT") {
      return NextResponse.json(
        { error: "A versão anterior já foi substituída. Revise a proposta antes de aprovar." },
        { status: 409 },
      )
    }
    throw error
  }

  return NextResponse.json({ item })
}
