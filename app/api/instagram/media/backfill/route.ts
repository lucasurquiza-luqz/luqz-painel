import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser } from "@/lib/api-auth"
import { backfillInstagramMediaPage } from "@/lib/instagram-insights"

// Backfill do histórico de posts EM LOTE (uma página por chamada, para não estourar
// o timeout do proxy). O cliente chama repetidamente passando o `nextAfter` retornado.
export async function POST(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { clientId, after } = await req.json().catch(() => ({}))
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório." }, { status: 400 })

  const account = await prisma.instagramAccount.findUnique({ where: { clientId: String(clientId) } })
  if (!account) return NextResponse.json({ error: "Cliente sem conta de Instagram." }, { status: 400 })

  const result = await backfillInstagramMediaPage(account.id, after ? String(after) : "")
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

  return NextResponse.json({ count: result.count, nextAfter: result.nextAfter, total: result.total })
}
