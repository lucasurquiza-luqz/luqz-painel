import { NextRequest, NextResponse } from "next/server"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { getCachedPerformance, getPerformanceHistory, refreshPerformanceSnapshot } from "@/lib/ads/snapshot"

type Params = { params: Promise<{ id: string }> }

function validMonth(m: string | null): m is string {
  return !!m && /^\d{4}-\d{2}$/.test(m)
}

// GET: lê do cache (snapshot). Se não existir, busca uma vez e grava.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const month = req.nextUrl.searchParams.get("month")
  if (!validMonth(month)) return NextResponse.json({ error: "Informe o mês no formato AAAA-MM." }, { status: 400 })

  try {
    const [cached, history] = await Promise.all([getCachedPerformance(id, month), getPerformanceHistory(id)])
    return NextResponse.json({ ...cached, history })
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
