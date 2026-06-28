import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { decryptSecret } from "@/lib/crypto-secrets"
import { discoverMetaActions, metaResultKeys } from "@/lib/ads/meta"
import { fetchGoogleConversionActions } from "@/lib/ads/google"
import { effectiveObjectives, monthRange, type AdConfig, type AdObjective, type DateRange } from "@/lib/ads/types"

type Params = { params: Promise<{ id: string }> }
const validDate = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)

// Revisão de conversões: o que está sendo CONTADO vs o que existe na conta.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const sp = req.nextUrl.searchParams
  const month = sp.get("month"), since = sp.get("since"), until = sp.get("until")
  const range: DateRange =
    validDate(since) && validDate(until) ? { since, until } : month && /^\d{4}-\d{2}$/.test(month) ? monthRange(month) : monthRange(new Date().toISOString().slice(0, 7))

  const accounts = await prisma.clientAdAccount.findMany({ where: { clientId: id } })
  const metaAcc = accounts.find((a) => a.provider === "META")
  const googleAcc = accounts.find((a) => a.provider === "GOOGLE")

  const result: { meta: unknown; google: unknown } = { meta: null, google: null }

  if (metaAcc?.tokenEnc) {
    const config: AdConfig = {
      objectives: effectiveObjectives(metaAcc.objectives as AdObjective[], metaAcc.objective as AdObjective),
      resultActions: metaAcc.resultActions,
      trackRevenue: metaAcc.trackRevenue,
    }
    try {
      const available = await discoverMetaActions(metaAcc.accountId, decryptSecret(metaAcc.tokenEnc))
      result.meta = { counting: metaResultKeys(config), custom: metaAcc.resultActions.length > 0, objectives: config.objectives, available }
    } catch (e) {
      result.meta = { error: e instanceof Error ? e.message : "Falha ao ler eventos Meta." }
    }
  }

  if (googleAcc) {
    try {
      result.google = { actions: await fetchGoogleConversionActions(googleAcc.accountId, range) }
    } catch (e) {
      result.google = { error: e instanceof Error ? e.message : "Falha ao ler conversões Google." }
    }
  }

  return NextResponse.json(result)
}
