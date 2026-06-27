export type AdMetrics = {
  provider: "META" | "GOOGLE"
  spend: number
  leads: number
  cpa: number | null
}

export class AdsNotConfiguredError extends Error {}

// "YYYY-MM" → primeiro e último dia do mês (YYYY-MM-DD).
export function monthRange(month: string): { since: string; until: string } {
  const [y, m] = month.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { since: `${month}-01`, until: `${month}-${String(lastDay).padStart(2, "0")}` }
}
