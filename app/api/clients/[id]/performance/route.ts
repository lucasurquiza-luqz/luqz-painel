import { NextRequest, NextResponse } from "next/server"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { getCachedPerformance, getLivePerformance, getPerformanceHistory, refreshPerformanceSnapshot } from "@/lib/ads/snapshot"

type Params = { params: Promise<{ id: string }> }

function validMonth(m: string | null): m is string {
  return !!m && /^\d{4}-\d{2}$/.test(m)
}
function validDate(d: string | null): d is string {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)
}

// GET: mês fechado → cache (snapshot); intervalo since/until → leitura ao vivo.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const sp = req.nextUrl.searchParams
  const month = sp.get("month")
  const since = sp.get("since"), until = sp.get("until")

  try {
    if (validMonth(month)) {
      const [cached, history] = await Promise.all([getCachedPerformance(id, month), getPerformanceHistory(id)])
      return NextResponse.json({ ...cached, history })
    }
    if (validDate(since) && validDate(until)) {
      const [live, history] = await Promise.all([getLivePerformance(id, { since, until }), getPerformanceHistory(id)])
      return NextResponse.json({ ...live, history })
    }
    return NextResponse.json({ error: "Informe ?month=AAAA-MM ou ?since=&until= (AAAA-MM-DD)." }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler performance." }, { status: 502 })
  }
}

// POST: força atualização do snapshot (botão "atualizar agora").
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const month = typeof body.month === "string" ? body.month : null
  if (!validMonth(month)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 })

  try {
    const performance = await refreshPerformanceSnapshot(id, month)
    return NextResponse.json({ performance, fetchedAt: new Date().toISOString(), cached: false })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao atualizar." }, { status: 502 })
  }
}
