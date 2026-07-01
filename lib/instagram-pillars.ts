// Pilares de conteúdo agora são POR CLIENTE (tabela InstagramPillar).
// Aqui ficam só: a sugestão padrão (para popular um cliente novo) e a paleta de cores.

export const PILLAR_PALETTE = [
  "#ef4444", // vermelho
  "#f59e0b", // âmbar
  "#22c55e", // verde
  "#8b5cf6", // roxo
  "#3b82f6", // azul
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#eab308", // amarelo
]

// Sugestão inicial (ex.: os 4 do Lucas). Serve de ponto de partida ao cadastrar.
export const DEFAULT_PILLARS: { label: string; color: string }[] = [
  { label: "Inimigo Cultural", color: "#ef4444" },
  { label: "Essência · Negócios", color: "#f59e0b" },
  { label: "Essência · Vida/Fé/Esporte", color: "#22c55e" },
  { label: "Essência · Casamento/Dinheiro", color: "#8b5cf6" },
]
