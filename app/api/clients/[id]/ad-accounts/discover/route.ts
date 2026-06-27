import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { decryptSecret } from "@/lib/crypto-secrets"
import { discoverMetaActions } from "@/lib/ads/meta"

type Params = { params: Promise<{ id: string }> }

// Config fluida: lista os eventos de conversão presentes na conta (Meta), pra o usuário escolher.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const provider = req.nextUrl.searchParams.get("provider")
  if (provider !== "META") {
    // Google: conversões são unificadas; descoberta de ações fica para depois.
    return NextResponse.json({ actions: [] })
  }

  const account = await prisma.clientAdAccount.findUnique({
    where: { clientId_provider: { clientId: id, provider: "META" } },
  })
  if (!account?.tokenEnc) return NextResponse.json({ error: "Conta Meta sem token cadastrado." }, { status: 400 })

  try {
    const actions = await discoverMetaActions(account.accountId, decryptSecret(account.tokenEnc))
    return NextResponse.json({ actions })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao descobrir eventos." }, { status: 502 })
  }
}
