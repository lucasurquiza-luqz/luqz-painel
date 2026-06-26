import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

// Aprova em lote as propostas SIMPLES (sem versionamento) de um cliente — útil
// para ativar de uma vez o contexto importado (diretórios/Torre), que é curado.
// Itens que substituem outro (supersedesId) ficam de fora: exigem revisão 1 a 1.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const result = await prisma.contextItem.updateMany({
    where: { clientId: id, status: "PROPOSED", supersedesId: null },
    data: { status: "ACTIVE", reviewedById: auth.user.userId, reviewedAt: new Date() },
  })

  return NextResponse.json({ approved: result.count })
}
