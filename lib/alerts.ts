// Regras de alerta proativo de performance — puras e testadas (alerts.test.ts).
// Entram na Torre/Visão Geral; depois podem virar notificação ativa.

export type AlertLevel = "attention" | "critical"
export type Alert = { code: string; label: string; level: AlertLevel }

export type AlertInput = {
  configured: boolean // cliente tem conta de Ads
  spend: number
  cpa: number | null
  roas: number | null
  targetCpa?: number | null
  targetRoas?: number | null
  budget?: number | null
  dayOfMonth: number // dia de hoje (1..31)
  daysInMonth: number
}

const CPA_TOLERANCE = 1.1 // 10% acima da meta = alerta
const PACE_FLOOR = 0.5 // gastou menos de 50% do ritmo esperado = verba ociosa

export function computeAlerts(i: AlertInput): Alert[] {
  if (!i.configured) return []
  const out: Alert[] = []

  // Sem veiculação: conta configurada, zero gasto (depois do 1º dia). Ofusca os demais.
  if (i.spend === 0) {
    if (i.dayOfMonth >= 2) out.push({ code: "no_delivery", label: "Sem veiculação", level: "critical" })
    return out
  }

  if (i.targetCpa && i.targetCpa > 0 && i.cpa != null && i.cpa > i.targetCpa * CPA_TOLERANCE)
    out.push({ code: "cpa_high", label: "CPA acima da meta", level: "attention" })

  if (i.targetRoas && i.targetRoas > 0 && i.roas != null && i.roas < i.targetRoas)
    out.push({ code: "roas_low", label: "ROAS abaixo da meta", level: "attention" })

  if (i.budget && i.budget > 0) {
    const expected = i.budget * (i.dayOfMonth / i.daysInMonth)
    if (i.spend < expected * PACE_FLOOR)
      out.push({ code: "underpacing", label: "Verba ociosa (ritmo baixo)", level: "attention" })
  }

  return out
}

// Pior nível de um conjunto de alertas (pra ordenar/colorir).
export const worstLevel = (alerts: Alert[]): AlertLevel | null =>
  alerts.some((a) => a.level === "critical") ? "critical" : alerts.length ? "attention" : null
