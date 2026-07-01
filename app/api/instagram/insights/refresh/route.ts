import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser } from "@/lib/api-auth"
import { syncInstagramInsights } from "@/lib/instagram-insights"

// Atualiza (sob demanda) o cache de insights da conta de um cliente.
export async function POST(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { clientId } = await req.json().catch(() => ({}))
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório." }, { status: 400 })

  const account = await prisma.instagramAccount.findUnique({ where: { clientId: String(clientId) } })
  if (!account) return NextResponse.json({ error: "Cliente sem conta de Instagram." }, { status: 400 })

  const result = await syncInstagramInsights(account.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

  const snapshot = await prisma.instagramSnapshot.findUnique({ where: { accountId: account.id } })
  return NextResponse.json({ ok: true, snapshot })
}
