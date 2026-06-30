import { prisma } from "@/lib/db"

type NotifData = { type: string; title: string; body?: string | null; link?: string | null; taskId?: string | null; actorName?: string | null }

// Cria notificações para vários destinatários (ignora o próprio ator e duplicatas).
export async function notifyUsers(userIds: string[], excludeUserId: string | null, data: NotifData): Promise<void> {
  const targets = [...new Set(userIds.filter((id) => id && id !== excludeUserId))]
  if (!targets.length) return
  try {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({ userId, type: data.type, title: data.title, body: data.body ?? null, link: data.link ?? null, taskId: data.taskId ?? null, actorName: data.actorName ?? null })),
    })
  } catch {
    // notificação nunca derruba a operação principal
  }
}

// Rota pra abrir a tarefa (deep-link via ?task=<id>). A página /tarefas abre o
// card direto pelo id (independe de filtros), então é o destino mais confiável.
export function taskLink(t: { clientId: string | null; projectId: string | null; id: string }): string {
  return `/tarefas?task=${t.id}`
}

// Extrai @menções de um texto, casando com os nomes da equipe. Retorna ids.
// Casa "@Nome Sobrenome" pelo maior nome que aparece após um "@".
export function parseMentions(text: string, team: { id: string; name: string }[]): string[] {
  if (!text.includes("@")) return []
  const lower = text.toLowerCase()
  const hits = new Set<string>()
  for (const u of team) {
    const name = u.name.trim().toLowerCase()
    if (name && lower.includes(`@${name}`)) hits.add(u.id)
  }
  return [...hits]
}
