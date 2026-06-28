export type AdObjective = "LEAD" | "WHATSAPP" | "ECOMMERCE" | "CUSTOM"

export type ResultBreakdown = { objective: AdObjective; count: number }
export type DailyPoint = { date: string; spend: number; results: number; impressions: number; clicks: number; pageViews: number; revenue: number }

// Árvore de exploração: Campanha → Conjunto (com público) → Anúncio (com preview).
export type AdNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; hookRate: number | null; convRate: number | null; thumbnail: string | null; permalink: string | null }
export type AdsetNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; audience: string | null; ads: AdNode[] }
export type CampaignNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; adsets: AdsetNode[] }

// Análises profundas do Meta (placements, demografia, alcance, vídeo).
export type MetaBreakdownRow = { key: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }
export type MetaDeep = {
  placements: MetaBreakdownRow[]
  byAge: MetaBreakdownRow[]
  byGender: MetaBreakdownRow[]
  reach: number
  frequency: number
  video: { plays: number; p25: number; p50: number; p75: number; p100: number; thruplay: number }
}

// Árvore de exploração Google: Campanha → Grupo de anúncios → Palavra-chave.
export type GoogleKeyword = { text: string; matchType: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }
export type GoogleAdGroup = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; keywords: GoogleKeyword[] }
export type GoogleCampaign = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; adGroups: GoogleAdGroup[] }
export type GoogleSearchTerm = { term: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }

export type AdMetrics = {
  provider: "META" | "GOOGLE"
  spend: number
  impressions: number
  clicks: number
  pageViews: number // visualizações de página (landing_page_view)
  results: number // total de conversões de mídia
  breakdown: ResultBreakdown[] // por objetivo/funil
  cpa: number | null
  revenue: number | null
  roas: number | null
  daily: DailyPoint[]
}

export type AdConfig = {
  objectives: AdObjective[]
  resultActions: string[]
  trackRevenue: boolean
}

export class AdsNotConfiguredError extends Error {}

export const OBJECTIVE_LABEL: Record<AdObjective, string> = {
  LEAD: "Leads",
  WHATSAPP: "Conversas",
  ECOMMERCE: "Compras",
  CUSTOM: "Resultados",
}

// Eventos Meta (action_type) padrão por objetivo.
export const META_DEFAULT_ACTIONS: Record<AdObjective, string[]> = {
  LEAD: ["offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped", "leadgen_grouped", "lead"],
  WHATSAPP: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"],
  ECOMMERCE: ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"],
  CUSTOM: [],
}
export const META_PURCHASE_ACTIONS = new Set(["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"])
export const META_PAGEVIEW_ACTIONS = new Set(["landing_page_view", "omni_landing_page_view"])

// Objetivos efetivos (back-compat com o campo objective legado).
export function effectiveObjectives(objectives: AdObjective[], legacy: AdObjective): AdObjective[] {
  return objectives.length ? objectives : [legacy]
}

export type DateRange = { since: string; until: string }

// "YYYY-MM" → primeiro e último dia do mês.
export function monthRange(month: string): DateRange {
  const [y, m] = month.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { since: `${month}-01`, until: `${month}-${String(lastDay).padStart(2, "0")}` }
}

// Janela imediatamente anterior, de mesmo tamanho (comparação período-a-período).
export function previousRange({ since, until }: DateRange): DateRange {
  const s = new Date(`${since}T00:00:00Z`), u = new Date(`${until}T00:00:00Z`)
  const days = Math.round((u.getTime() - s.getTime()) / 86_400_000) + 1
  const prevUntil = new Date(s.getTime() - 86_400_000)
  const prevSince = new Date(prevUntil.getTime() - (days - 1) * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { since: iso(prevSince), until: iso(prevUntil) }
}
