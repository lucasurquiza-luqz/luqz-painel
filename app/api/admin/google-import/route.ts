import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { normalizeName } from "@/lib/clickup"
import { listMccAccounts } from "@/lib/ads/google"
import { AdsNotConfiguredError } from "@/lib/ads/types"

// Auto-import Google: lista as contas do MCC e casa com os clientes do Dash por nome.
// Sem token por cliente — o Google usa as credenciais centrais do MCC (env).
export async function POST() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  let mccAccounts
  try {
    mccAccounts = await listMccAccounts()
  } catch (error) {
    if (error instanceof AdsNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao listar o MCC." }, { status: 502 })
  }

  const clients = await prisma.client.findMany({ select: { id: true, name: true } })
  const byName = new Map(clients.map((c) => [normalizeName(c.name), c]))

  const report = { configured: 0, matched: [] as string[], unmatched: [] as string[] }
  for (const acc of mccAccounts) {
    const client = byName.get(normalizeName(acc.name))
    if (!client) { report.unmatched.push(`${acc.name} (${acc.customerId})`); continue }
    await prisma.clientAdAccount.upsert({
      where: { clientId_provider: { clientId: client.id, provider: "GOOGLE" } },
      create: { clientId: client.id, provider: "GOOGLE", accountId: acc.customerId },
      update: { accountId: acc.customerId },
    })
    report.configured++
    report.matched.push(`${client.name} ← ${acc.name}`)
  }
  return NextResponse.json({ report })
}
