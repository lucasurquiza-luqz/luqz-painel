// Os 4 pilares de conteúdo (marca pessoal do Lucas / LUQZ).
// Guardamos a `key` no banco; o `label` é só exibição.
export const INSTAGRAM_PILLARS = [
  { key: "inimigo", label: "Inimigo Cultural", color: "#ef4444" },
  { key: "negocios", label: "Essência · Negócios", color: "#f59e0b" },
  { key: "vida", label: "Essência · Vida/Fé/Esporte", color: "#22c55e" },
  { key: "casamento", label: "Essência · Casamento/Dinheiro", color: "#8b5cf6" },
] as const

export type PillarKey = (typeof INSTAGRAM_PILLARS)[number]["key"]

export const PILLAR_KEYS = INSTAGRAM_PILLARS.map((p) => p.key) as string[]

export function pillarLabel(key: string | null | undefined): string | null {
  return INSTAGRAM_PILLARS.find((p) => p.key === key)?.label ?? null
}

export function pillarColor(key: string | null | undefined): string {
  return INSTAGRAM_PILLARS.find((p) => p.key === key)?.color ?? "#71717a"
}
