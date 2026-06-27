export type AdObjective = "LEAD" | "WHATSAPP" | "ECOMMERCE" | "CUSTOM"

export type AdMetrics = {
  provider: "META" | "GOOGLE"
  spend: number
  impressions: number
  clicks: number
  results: number // conversões de mídia (conforme o objetivo/eventos do cliente)
  cpa: number | null // custo por resultado
  revenue: number | null // ecommerce
  roas: number | null
}

export type AdConfig = {
  objective: AdObjective
  resultActions: string[]
  trackRevenue: boolean
}

export class AdsNotConfiguredError extends Error {}

export const OBJECTIVE_LABEL: Record<AdObjective, string> = {
  LEAD: "Leads",
  WHATSAPP: "Conversas (WhatsApp)",
  ECOMMERCE: "Compras",
  CUSTOM: "Resultados",
}

// Eventos Meta (action_type) padrão por objetivo — usados quando o cliente não escolheu específicos.
export const META_DEFAULT_ACTIONS: Record<AdObjective, string[]> = {
  LEAD: ["offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped", "leadgen_grouped", "lead"],
  WHATSAPP: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"],
  ECOMMERCE: ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"],
  CUSTOM: [],
}
export const META_PURCHASE_ACTIONS = new Set(["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"])

// "YYYY-MM" → primeiro e último dia do mês (YYYY-MM-DD).
export function monthRange(month: string): { since: string; until: string } {
  const [y, m] = month.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { since: `${month}-01`, until: `${month}-${String(lastDay).padStart(2, "0")}` }
}
