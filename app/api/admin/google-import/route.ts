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

  // Casamento fuzzy: nomes no MCC diferem do Dash ("Haroldo Freire" vs "Dr Haroldo Freire",
  // "GADS - Natrilhas", "Santa Helena Google Ads"...). Compara por tokens significativos.
  const STOP = new Set(["dr", "dra", "de", "da", "do", "e", "group", "ltda", "google", "ads", "gads", "ca01", "agencia", "trafego", "solucoes", "digitais", "the"])
  const toks = (s: string) => normalizeName(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t))
  const clientToks = clients.map((c) => ({ c, t: toks(c.name) }))
  const matchClient = (acctName: string) => {
    const at = toks(acctName)
    if (!at.length) return null
    let best: (typeof clientToks)[number] | null = null, score = 0
    for (const ct of clientToks) {
      const shared = at.filter((x) => ct.t.includes(x)).length
      if (shared > score) { score = shared; best = ct }
    }
    if (!best) return null
    if (score >= 2) return best.c
    if (score === 1 && at.length === 1 && best.t.length === 1) return best.c // ambos um token só, iguais
    return null
  }

  const report = { configured: 0, matched: [] as string[], unmatched: [] as string[] }
  for (const acc of mccAccounts) {
    const client = matchClient(acc.name)
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
