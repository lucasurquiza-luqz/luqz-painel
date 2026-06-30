import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { getClientsMonthTotals } from "@/lib/ads/snapshot"
import { formatInTimeZone } from "date-fns-tz"

// Totais de performance do mês (dos snapshots, sem chamar API) p/ TODOS os clientes.
// Usado na lista de clientes pra mostrar o Resultado por linha.
export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const clients = await prisma.client.findMany({ select: { id: true } })
  const month = formatInTimeZone(new Date(), "America/Sao_Paulo", "yyyy-MM")
  const map = await getClientsMonthTotals(clients.map((c) => c.id), month)
  return NextResponse.json({ month, results: Object.fromEntries(map) })
}
