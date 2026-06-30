// Fórmulas de performance — fonte única da verdade (testadas em calc.test.ts).
// Toda divisão protege contra zero e devolve null quando não dá pra calcular.

export const cpa = (spend: number, results: number): number | null => (results > 0 ? spend / results : null)
export const roas = (revenue: number | null, spend: number): number | null => (revenue != null && spend > 0 ? revenue / spend : null)
export const ctr = (clicks: number, impressions: number): number | null => (impressions > 0 ? (clicks / impressions) * 100 : null)
export const cpc = (spend: number, clicks: number): number | null => (clicks > 0 ? spend / clicks : null)
export const cpm = (spend: number, impressions: number): number | null => (impressions > 0 ? (spend / impressions) * 1000 : null)

// Razões de uma "linha" (campanha/conjunto/anúncio/grupo) — usado nas árvores.
export const rowRatios = <T extends { spend: number; impressions: number; clicks: number; results: number }>(n: T) =>
  ({ ...n, cpa: cpa(n.spend, n.results), ctr: ctr(n.clicks, n.impressions) })
