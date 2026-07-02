import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { decryptSecret } from "@/lib/crypto-secrets"
import { fetchMetaDeep } from "@/lib/ads/meta"
import { effectiveObjectives, monthRange, type AdConfig, type AdObjective, type DateRange } from "@/lib/ads/types"

type Params = { params: Promise<{ id: string }> }
const validDate = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)

// Análises profundas Meta: posicionamentos, demografia, alcance/frequência e vídeo.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR", "CLIENTE"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const sp = req.nextUrl.searchParams
  const month = sp.get("month"), since = sp.get("since"), until = sp.get("until")
  const range: DateRange | null =
    validDate(since) && validDate(until) ? { since, until } : month && /^\d{4}-\d{2}$/.test(month) ? monthRange(month) : null
  if (!range) return NextResponse.json({ error: "Informe month ou since/until." }, { status: 400 })

  const account = await prisma.clientAdAccount.findUnique({ where: { clientId_provider: { clientId: id, provider: "META" } } })
  if (!account?.tokenEnc) return NextResponse.json({ error: "Conta Meta sem token cadastrado." }, { status: 400 })

  const config: AdConfig = {
    objectives: effectiveObjectives(account.objectives as AdObjective[], account.objective as AdObjective),
    resultActions: account.resultActions,
    trackRevenue: account.trackRevenue,
  }

  try {
    const deep = await fetchMetaDeep(account.accountId, decryptSecret(account.tokenEnc), range, config)
    return NextResponse.json({ deep })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler análises Meta." }, { status: 502 })
  }
}
