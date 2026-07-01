import { NextRequest, NextResponse } from "next/server"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { monthRange } from "@/lib/ads/types"
import { funnelBreakdown } from "@/lib/ads/funnel-breakdown"

type Params = { params: Promise<{ id: string }> }

// Investimento + resultados por funil (com split por plataforma) no mês.
// Leitura ao vivo das campanhas (não usa snapshot). Liberado ao CLIENTE do próprio cliente.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR", "CLIENTE"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const month = req.nextUrl.searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Informe ?month=AAAA-MM." }, { status: 400 })

  try {
    const breakdown = await funnelBreakdown(id, monthRange(month))
    return NextResponse.json(breakdown)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler por funil." }, { status: 502 })
  }
}
