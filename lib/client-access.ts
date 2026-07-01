// Guard de rota para o papel CLIENTE (usado pelo middleware, edge-safe: sem Prisma).
//
// Um CLIENTE só enxerga um subconjunto do painel do seu PRÓPRIO cliente. As APIs
// já são protegidas por requireApiUser + canAccessClient; aqui bloqueamos as PÁGINAS
// internas por URL (o menu só as esconde, não impede a navegação direta).
//
// Mantém em sincronia com os itens NÃO-internos do clientNav em components/Sidebar.tsx:
// tudo que o cliente vê no menu deve estar aqui, e nada além disso.
const CLIENT_SUFFIXES = [
  "/plano-de-midia",
  "/relatorio",
  "/relatorio-semanal",
  "/chat",
] as const

// Página inicial do CLIENTE (pós-login e destino de qualquer rota negada).
export function clientHome(clientId: string): string {
  return `/clientes/${clientId}/chat`
}

// O CLIENTE pode abrir esta página? Só rotas do próprio cliente e dentro da allowlist.
export function isClientAllowedPath(pathname: string, clientId: string): boolean {
  const base = `/clientes/${clientId}`
  if (pathname === base) return true // Visão geral (a própria página se restringe por papel)
  if (!pathname.startsWith(`${base}/`)) return false
  const suffix = pathname.slice(base.length) // ex.: "/relatorio" ou "/relatorio/2026-06"
  return CLIENT_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}/`))
}
