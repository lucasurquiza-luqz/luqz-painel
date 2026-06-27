import { prisma } from "@/lib/db"
import { decryptSecret } from "@/lib/crypto-secrets"
import { fetchMetaInsights } from "@/lib/ads/meta"
import { fetchGoogleInsights } from "@/lib/ads/google"
import type { AdMetrics } from "@/lib/ads/types"

export type ProviderResult = (AdMetrics & { error?: undefined }) | { provider: "META" | "GOOGLE"; error: string }
export type Realizado = {
  byProvider: ProviderResult[]
  total: { spend: number; leads: number; cpa: number | null }
  configured: boolean
}

// Lê o realizado (Meta token-por-cliente + Google MCC central) de um cliente no mês.
// Erro de um provider não derruba o outro — vira { provider, error }.
export async function getClientRealizado(clientId: string, month: string): Promise<Realizado> {
  const accounts = await prisma.clientAdAccount.findMany({ where: { clientId } })
  const byProvider: ProviderResult[] = []

  for (const acc of accounts) {
    try {
      if (acc.provider === "META") {
        if (!acc.tokenEnc) { byProvider.push({ provider: "META", error: "Sem token cadastrado." }); continue }
        byProvider.push(await fetchMetaInsights(acc.accountId, decryptSecret(acc.tokenEnc), month))
      } else {
        byProvider.push(await fetchGoogleInsights(acc.accountId, month))
      }
    } catch (error) {
      byProvider.push({ provider: acc.provider, error: error instanceof Error ? error.message : "Falha ao ler." })
    }
  }

  const ok = byProvider.filter((r): r is AdMetrics => !("error" in r && r.error !== undefined))
  const spend = ok.reduce((s, r) => s + r.spend, 0)
  const leads = ok.reduce((s, r) => s + r.leads, 0)
  return {
    byProvider,
    total: { spend, leads, cpa: leads > 0 ? spend / leads : null },
    configured: accounts.length > 0,
  }
}
