import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

// Aprova em lote, em TODA a carteira, as propostas de contexto SIMPLES (sem
// versionamento) — para ativar de uma vez o contexto importado (diretórios/Torre),
// que é curado. Itens versionados (supersedesId) ficam de fora (revisão 1 a 1).
export async function POST() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const result = await prisma.contextItem.updateMany({
    where: { status: "PROPOSED", supersedesId: null },
    data: { status: "ACTIVE", reviewedById: auth.user.userId, reviewedAt: new Date() },
  })

  return NextResponse.json({ approved: result.count })
}
