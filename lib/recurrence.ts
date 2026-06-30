// Cálculo do próximo disparo de uma tarefa recorrente — puro e testado.
export type RecurFreq = "DIARIA" | "SEMANAL" | "MENSAL"
export type RecurRule = { freq: RecurFreq; interval: number; weekday?: number | null; dayOfMonth?: number | null }

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
    d.setUTCDate(d.getUTCDate() + n * 7)
    if (rule.weekday != null) {
      // ajusta para o dia da semana desejado dentro da semana resultante
      const diff = (rule.weekday - d.getUTCDay() + 7) % 7
      d.setUTCDate(d.getUTCDate() + diff)
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
