import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { getClientPerformance } from "@/lib/ads/realizado"
import { chatComplete } from "@/lib/ai/provider"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

type Params = { params: Promise<{ id: string }> }

// Leitura de IA da performance do mês (o que ganha/perde, o que otimizar) — ancorada nos números.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const body = await req.json().catch(() => ({}))
  const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null
  if (!month) return NextResponse.json({ error: "Mês inválido." }, { status: 400 })

  const [client, perf, plans] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { name: true, segment: true } }),
    getClientPerformance(id, month),
    prisma.mediaPlan.findMany({ where: { clientId: id, month }, select: { platform: true, budget: true, targetLeads: true, targetCpa: true, targetRoas: true } }),
  ])
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })

  const t = perf.current.total
  const p = perf.previous
  const metas = plans.map((pl) => `${pl.platform}: verba ${pl.budget ?? "—"}, leads ${pl.targetLeads ?? "—"}, CPA ${pl.targetCpa ?? "—"}, ROAS ${pl.targetRoas ?? "—"}`).join(" | ") || "(sem metas)"

  const system = `Voce e um analista de performance de midia de uma agencia. Leia os numeros e produza uma leitura curta e ACIONAVEL (3-5 frases):
o que esta indo bem, o que esta ruim, e 1-2 acoes concretas de otimizacao. Compare com a meta e com o mes anterior. Use SO os numeros fornecidos; nao invente. Portugues do Brasil, direto.`
  const user = `Cliente: ${client.name}${client.segment ? ` (${client.segment})` : ""} — mes ${month}.
REALIZADO: gasto R$${t.spend.toFixed(0)}, ${t.results} resultados, CPA ${t.cpa?.toFixed(2) ?? "—"}, ROAS ${t.roas?.toFixed(2) ?? "—"}, impressoes ${t.impressions}, cliques ${t.clicks}.
MES ANTERIOR: gasto R$${p.spend.toFixed(0)}, ${p.results} resultados, CPA ${p.cpa?.toFixed(2) ?? "—"}, ROAS ${p.roas?.toFixed(2) ?? "—"}.
POR FUNIL: ${perf.current.breakdown.map((b) => `${b.objective} ${b.count}`).join(", ") || "—"}.
POR FONTE: ${perf.current.byProvider.map((b) => ("error" in b && b.error ? `${b.provider} erro` : `${b.provider} R$${(b as { spend: number }).spend?.toFixed(0)}`)).join(", ")}.
METAS: ${metas}.`

  try {
    const reading = await chatComplete("ASSISTANT", system, [{ role: "user", content: user }])
    return NextResponse.json({ reading })
  } catch (error) {
    if (error instanceof AiProviderNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na leitura." }, { status: 502 })
  }
}
