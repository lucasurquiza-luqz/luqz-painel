// Cálculo do próximo disparo de uma tarefa recorrente — puro e testado.
export type RecurFreq = "DIARIA" | "SEMANAL" | "MENSAL"
export type RecurRule = { freq: RecurFreq; interval: number; weekday?: number | null; weekdays?: number[] | null; dayOfMonth?: number | null }

// Avança `from` para o próximo disparo conforme a regra. Trabalha em UTC (datas
// guardadas em UTC; o cron roda 1x/dia, granularidade de dia basta).
export function computeNextRun(rule: RecurRule, from: Date): Date {
  const n = Math.max(1, rule.interval || 1)
  const d = new Date(from.getTime())
  if (rule.freq === "DIARIA") {
    d.setUTCDate(d.getUTCDate() + n)
    return d
  }
  if (rule.freq === "SEMANAL") {
    // dias da semana selecionados (personalizado) ou um único weekday legado
    const days = (rule.weekdays && rule.weekdays.length ? rule.weekdays : rule.weekday != null ? [rule.weekday] : [])
      .filter((w) => w >= 0 && w <= 6).sort((a, b) => a - b)
    if (days.length === 0) {
      // semanal simples, sem dia fixo: avança N semanas
      d.setUTCDate(d.getUTCDate() + n * 7)
      return d
    }
    const cw = d.getUTCDay()
    const nextThisWeek = days.find((w) => w > cw)
    if (nextThisWeek !== undefined) {
      d.setUTCDate(d.getUTCDate() + (nextThisWeek - cw)) // próximo dia da lista nesta semana
    } else {
      // pula N semanas até o primeiro dia da lista (volta ao domingo da semana atual)
      d.setUTCDate(d.getUTCDate() - cw + n * 7 + days[0])
    }
    return d
  }
  // MENSAL: avança n meses; fixa o dia do mês (clamp pro último dia se faltar).
  const day = rule.dayOfMonth ?? d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}
