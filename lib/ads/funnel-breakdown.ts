import { prisma } from "@/lib/db"
import { decryptSecret } from "@/lib/crypto-secrets"
import { fetchMetaTree } from "@/lib/ads/meta"
import { fetchGoogleTree } from "@/lib/ads/google"
import { effectiveObjectives, type AdConfig, type AdObjective, type DateRange } from "@/lib/ads/types"

// Investimento + resultados por funil, com split por plataforma. Agrupa campanhas
// (Meta + Google) pelos termos de cada ClientFunnel. Base do "por funil" e
// "por plataforma" do dashboard do cliente e do report semanal.
export type PlatSeg = { spend: number; results: number }
export type FunnelBreakdownRow = { funnelId: string | null; name: string; spend: number; results: number; cpa: number | null; meta: PlatSeg; google: PlatSeg }
export type FunnelBreakdown = { rows: FunnelBreakdownRow[]; platform: { meta: PlatSeg; google: PlatSeg }; total: PlatSeg }

type Camp = { name: string; spend: number; results: number; platform: "META" | "GOOGLE" }
const seg = (): PlatSeg => ({ spend: 0, results: 0 })

export async function funnelBreakdown(clientId: string, range: DateRange): Promise<FunnelBreakdown> {
  const [accounts, funnels] = await Promise.all([
    prisma.clientAdAccount.findMany({ where: { clientId } }),
    prisma.clientFunnel.findMany({ where: { clientId }, orderBy: { order: "asc" }, select: { id: true, name: true, terms: true } }),
  ])

  const camps: Camp[] = []
  for (const acc of accounts) {
    try {
      if (acc.provider === "META" && acc.tokenEnc) {
        const config: AdConfig = { objectives: effectiveObjectives(acc.objectives as AdObjective[], acc.objective as AdObjective), resultActions: acc.resultActions, trackRevenue: acc.trackRevenue }
        const tree = await fetchMetaTree(acc.accountId, decryptSecret(acc.tokenEnc), range, config)
        for (const c of tree) camps.push({ name: c.name, spend: c.spend, results: c.results, platform: "META" })
      } else if (acc.provider === "GOOGLE") {
        const tree = await fetchGoogleTree(acc.accountId, range)
        for (const c of tree) camps.push({ name: c.name, spend: c.spend, results: c.results, platform: "GOOGLE" })
      }
    } catch { /* fonte que falha não derruba o breakdown */ }
  }

  const byId = new Map<string, { meta: PlatSeg; google: PlatSeg }>()
  const none = { meta: seg(), google: seg() }
  const platform = { meta: seg(), google: seg() }
  for (const c of camps) {
    const p = c.platform === "META" ? "meta" : "google"
    platform[p].spend += c.spend; platform[p].results += c.results
    const nl = c.name.toLowerCase()
    const f = funnels.find((g) => g.terms.some((t) => nl.includes(t.toLowerCase())))
    const bucket = f ? (byId.get(f.id) ?? { meta: seg(), google: seg() }) : none
    bucket[p].spend += c.spend; bucket[p].results += c.results
    if (f) byId.set(f.id, bucket)
  }

  const mkRow = (funnelId: string | null, name: string, b: { meta: PlatSeg; google: PlatSeg }): FunnelBreakdownRow => {
    const spend = b.meta.spend + b.google.spend
    const results = b.meta.results + b.google.results
    return { funnelId, name, spend, results, cpa: results > 0 ? spend / results : null, meta: b.meta, google: b.google }
  }
  const rows = funnels.filter((f) => byId.has(f.id)).map((f) => mkRow(f.id, f.name, byId.get(f.id)!))
  if (none.meta.spend + none.google.spend > 0 || none.meta.results + none.google.results > 0) rows.push(mkRow(null, "Outras campanhas", none))

  return { rows, platform, total: { spend: platform.meta.spend + platform.google.spend, results: platform.meta.results + platform.google.results } }
}
