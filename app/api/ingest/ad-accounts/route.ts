import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { encryptSecret } from "@/lib/crypto-secrets"
import { normalizeName } from "@/lib/clickup"

// Ingestão única de contas de Ads (Meta token por cliente). Protegida por secret.
// A ferramenta local lê os tokens de clientes/[x]/credenciais e configura o Dash.
type AdItem = { clientName: string; provider: "META" | "GOOGLE"; accountId: string; token?: string }

const ALIASES: Record<string, string> = {
  "identifique": "identifique marcas e patentes",
  "camisetando estamparia": "camisetando",
  "glamour emporium": "adriana glamour emporium",
  "cassio eduardo goulart": "dr cassio goulart",
  "sevira marmitas congeladas": "sevira",
  "jf empilhadeiras": "jf pecas de empilhadeiras",
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret")
  if (!process.env.INGEST_SECRET || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const accounts: AdItem[] = Array.isArray(body.accounts) ? body.accounts : []
  if (accounts.length === 0) return NextResponse.json({ error: "Nenhuma conta enviada." }, { status: 400 })

  const clients = await prisma.client.findMany({ select: { id: true, name: true } })
  const byName = new Map(clients.map((c) => [normalizeName(c.name), c]))
  const resolve = (name: string) => { const n = normalizeName(name); return byName.get(ALIASES[n] ?? n) }

  const report = { configured: 0, unmatched: new Set<string>() }
  for (const acc of accounts) {
    if (!acc?.clientName || !acc.accountId || (acc.provider !== "META" && acc.provider !== "GOOGLE")) continue
    const client = resolve(acc.clientName)
    if (!client) { report.unmatched.add(acc.clientName); continue }

    const token = acc.token?.trim()
    await prisma.clientAdAccount.upsert({
      where: { clientId_provider: { clientId: client.id, provider: acc.provider } },
      create: {
        clientId: client.id,
        provider: acc.provider,
        accountId: acc.accountId.trim(),
        tokenEnc: token ? encryptSecret(token) : null,
        lastFour: token ? token.slice(-4) : null,
      },
      update: {
        accountId: acc.accountId.trim(),
        ...(token ? { tokenEnc: encryptSecret(token), lastFour: token.slice(-4) } : {}),
      },
    })
    report.configured++
  }

  return NextResponse.json({ report: { ...report, unmatched: [...report.unmatched] } })
}
