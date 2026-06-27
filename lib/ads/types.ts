export type AdObjective = "LEAD" | "WHATSAPP" | "ECOMMERCE" | "CUSTOM"

export type ResultBreakdown = { objective: AdObjective; count: number }
export type DailyPoint = { date: string; spend: number; results: number }
export type BreakdownRow = {
  name: string
  spend: number
  impressions: number
  clicks: number
  results: number
  cpa: number | null
  ctr: number | null
  // Métricas de vídeo/criativo (nível anúncio):
  hookRate?: number | null // visualizações de 3s ÷ impressões
  thruplayRate?: number | null // thruplays ÷ impressões
  convRate?: number | null // resultados ÷ cliques
  permalink?: string | null // link do anúncio (Instagram/Facebook)
  thumbnail?: string | null // preview/imagem do criativo
}
export type BreakdownLevel = "campaign" | "adset" | "ad"

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
