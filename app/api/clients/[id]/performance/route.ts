import { NextRequest, NextResponse } from "next/server"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { getClientPerformance } from "@/lib/ads/realizado"

type Params = { params: Promise<{ id: string }> }

// Painel Performance: realizado do mês (com série diária) + comparação com o mês anterior.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const month = req.nextUrl.searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Informe o mês no formato AAAA-MM." }, { status: 400 })
  }

  try {
    const performance = await getClientPerformance(id, month)
    return NextResponse.json({ performance })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler performance." }, { status: 502 })
  }
}
