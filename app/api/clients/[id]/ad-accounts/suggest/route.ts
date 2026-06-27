import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { decryptSecret } from "@/lib/crypto-secrets"
import { discoverMetaActions } from "@/lib/ads/meta"
import { completeJSON } from "@/lib/ai/provider"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

type Params = { params: Promise<{ id: string }> }

// IA sugere a config de conversão lendo o contexto aprovado do cliente + os eventos da conta.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const provider = req.nextUrl.searchParams.get("provider") === "GOOGLE" ? "GOOGLE" : "META"

  const [client, context, account] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { name: true, segment: true } }),
    prisma.contextItem.findMany({
      where: { clientId: id, status: "ACTIVE", domain: { in: ["OFERTA", "CLIENTE", "DIRETRIZES", "PERSONA"] } },
      select: { domain: true, title: true, content: true },
      take: 12,
    }),
    prisma.clientAdAccount.findUnique({ where: { clientId_provider: { clientId: id, provider } } }),
  ])
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })

  // Eventos disponíveis (só Meta).
  let discovered: { actionType: string; count: number }[] = []
  if (provider === "META" && account?.tokenEnc) {
    try { discovered = await discoverMetaActions(account.accountId, decryptSecret(account.tokenEnc)) } catch { /* segue sem lista */ }
  }

  const ctxText = context.map((c) => `[${c.domain}] ${c.title}: ${c.content.slice(0, 400)}`).join("\n") || "(sem contexto aprovado)"
  const eventsText = discovered.length ? discovered.map((d) => `${d.actionType} (${d.count})`).join(", ") : "(lista indisponível)"

  const system = `Voce configura a leitura de conversao de Ads de um cliente de agencia.
Escolha os OBJETIVOS de funil do cliente (um ou mais): LEAD (geracao de leads), WHATSAPP (conversas), ECOMMERCE (vendas online).
Se houver lista de eventos da conta Meta, escolha em resultActions os action_types que REALMENTE representam o resultado (senao deixe vazio para usar o padrao do objetivo).
trackRevenue = true apenas se houver venda/receita (ecommerce).
Baseie-se SO no contexto e nos eventos fornecidos; nao invente. Responda JSON:
{"objectives":["LEAD"|"WHATSAPP"|"ECOMMERCE"],"resultActions":[],"trackRevenue":false,"reasoning":"curto"}`

  const user = `Cliente: ${client.name}${client.segment ? ` (nicho: ${client.segment})` : ""}\nProvedor: ${provider}\n\nCONTEXTO APROVADO:\n${ctxText}\n\nEVENTOS DISPONIVEIS NA CONTA (Meta):\n${eventsText}`

  try {
    const raw = (await completeJSON("ASSISTANT", system, user)) as Record<string, unknown>
    const OBJ = new Set(["LEAD", "WHATSAPP", "ECOMMERCE"])
    const objectives = Array.isArray(raw.objectives) ? raw.objectives.filter((x) => typeof x === "string" && OBJ.has(x)) : []
    const resultActions = Array.isArray(raw.resultActions) ? raw.resultActions.filter((x) => typeof x === "string") : []
    return NextResponse.json({
      suggestion: {
        objectives: objectives.length ? objectives : ["LEAD"],
        resultActions,
        trackRevenue: raw.trackRevenue === true,
        reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
      },
    })
  } catch (error) {
    if (error instanceof AiProviderNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na sugestão." }, { status: 502 })
  }
}
