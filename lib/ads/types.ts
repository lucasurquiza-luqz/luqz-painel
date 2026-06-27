export type AdObjective = "LEAD" | "WHATSAPP" | "ECOMMERCE" | "CUSTOM"

export type ResultBreakdown = { objective: AdObjective; count: number }
export type DailyPoint = { date: string; spend: number; results: number }

// Árvore de exploração: Campanha → Conjunto (com público) → Anúncio (com preview).
export type AdNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; hookRate: number | null; convRate: number | null; thumbnail: string | null; permalink: string | null }
export type AdsetNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; audience: string | null; ads: AdNode[] }
export type CampaignNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; adsets: AdsetNode[] }

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

// "YYYY-MM" → primeiro e último dia do mês.
export function monthRange(month: string): { since: string; until: string } {
  const [y, m] = month.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { since: `${month}-01`, until: `${month}-${String(lastDay).padStart(2, "0")}` }
}
