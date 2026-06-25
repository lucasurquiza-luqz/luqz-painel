import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string; actionId: string }> }

// Conclui (DONE) ou cancela (CANCELLED) a ação aberta.
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId, actionId } = await params
  const body = await req.json().catch(() => ({}))
  const action = body.action

  if (action !== "DONE" && action !== "CANCELLED") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  }

  const result = await prisma.clientNextAction.updateMany({
    where: { id: actionId, clientId, status: "OPEN" },
    data: { status: action, completedAt: new Date() },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: "Ação não encontrada ou já encerrada." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
