import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { decryptSecret } from "@/lib/crypto-secrets"
import { fetchMetaTree } from "@/lib/ads/meta"
import { fetchGoogleTree } from "@/lib/ads/google"
import { effectiveObjectives, type AdConfig, type AdObjective } from "@/lib/ads/types"

type Params = { params: Promise<{ id: string }> }

// Explorador: Meta (Campanha → Conjunto → Anúncio) ou Google (Campanha → Grupo → Palavra-chave).
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const month = req.nextUrl.searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 })
  const provider = req.nextUrl.searchParams.get("provider") === "GOOGLE" ? "GOOGLE" : "META"

  const account = await prisma.clientAdAccount.findUnique({ where: { clientId_provider: { clientId: id, provider } } })
  if (!account) return NextResponse.json({ error: `Conta ${provider} não configurada.` }, { status: 400 })

  try {
    if (provider === "GOOGLE") {
      const campaigns = await fetchGoogleTree(account.accountId, month)
      return NextResponse.json({ provider, campaigns })
    }
    if (!account.tokenEnc) return NextResponse.json({ error: "Conta Meta sem token cadastrado." }, { status: 400 })
    const config: AdConfig = {
      objectives: effectiveObjectives(account.objectives as AdObjective[], account.objective as AdObjective),
      resultActions: account.resultActions,
      trackRevenue: account.trackRevenue,
    }
    const campaigns = await fetchMetaTree(account.accountId, decryptSecret(account.tokenEnc), month, config)
    return NextResponse.json({ provider, campaigns })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao explorar." }, { status: 502 })
  }
}
