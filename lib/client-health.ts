import { prisma } from "@/lib/db"

// Lógica compartilhada de saúde de relacionamento, usada pela Visão 360 do
// cliente e pela Torre da agência. A leitura é SEMPRE explicável (dimensão +
// evidência + tendência + confiança) e nunca inventa: "Sem leitura" quando falta dado.

export type Level = "healthy" | "attention" | "critical" | "unknown"

export const PERCEPTION: Record<string, { label: string; level: Level; rank: number }> = {
  GREAT: { label: "Ótimo", level: "healthy", rank: 4 },
  GOOD: { label: "Bom", level: "healthy", rank: 3 },
  NEUTRAL: { label: "Neutro", level: "attention", rank: 2 },
  CONCERN: { label: "Preocupante", level: "attention", rank: 1 },
  CRITICAL: { label: "Crítico", level: "critical", rank: 0 },
}

export const LEVEL_LABEL: Record<Level, string> = {
  healthy: "Saudável",
  attention: "Atenção",
  critical: "Crítico",
  unknown: "Sem leitura",
}

// Ordem de atenção para a Torre: crítico primeiro, saudável por último.
export const LEVEL_ORDER: Record<Level, number> = {
  critical: 0,
  attention: 1,
  unknown: 2,
  healthy: 3,
}

export function daysAgo(date: Date | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export type Trend = "up" | "down" | "flat" | "none"

export type Sentiment = "POSITIVE" | "NEUTRAL" | "CONCERN" | "CRITICAL"

// A leitura da IA SINALIZA — nunca vira saúde oficial sem revisão humana.
export const SENTIMENT: Record<Sentiment, { label: string; level: Level }> = {
  POSITIVE: { label: "Positivo", level: "healthy" },
  NEUTRAL: { label: "Neutro", level: "healthy" },
  CONCERN: { label: "Preocupante", level: "attention" },
  CRITICAL: { label: "Crítico", level: "critical" },
}

export interface AiSignal {
  sentiment: Sentiment
  level: Level
  analysis: string
  confidence: string
  ageDays: number
  // A IA enxerga algo pior do que o time registrou? (sinal de atenção)
  divergesFromTeam: boolean
}

export interface Reading {
  level: Level
  trend: Trend
  confidence: string
  summary: string
  evidence?: string
  evidenceMeta?: string
  // Origem da leitura oficial: time, IA (preliminar, sem check-in) ou nenhuma.
  source: "team" | "ai" | "none"
  aiSignal?: AiSignal
}

export type AiReadingInput = {
  sentiment: Sentiment
  analysis: string | null
  confidence: string | null
  date: Date
} | null

export function buildReading(input: {
  latest?: { perception: string; justification: string; createdAt: Date; author: { name: string } } | null
  previous?: { perception: string } | null
  openRisks: number
  ai?: AiReadingInput
}): Reading {
  const { latest, previous, openRisks, ai } = input

  const aiSignal: AiSignal | undefined = ai
    ? {
        sentiment: ai.sentiment,
        level: SENTIMENT[ai.sentiment].level,
        analysis: ai.analysis ?? "",
        confidence: ai.confidence ?? "baixa",
        ageDays: daysAgo(ai.date) ?? 999,
        divergesFromTeam: false, // ajustado abaixo quando há check-in do time
      }
    : undefined

  // === Sem check-in do time: a IA dá uma leitura preliminar (clara como tal). ===
  if (!latest) {
    if (aiSignal) {
      return {
        level: aiSignal.level,
        trend: "none",
        confidence: "baixa",
        source: "ai",
        summary: `Leitura preliminar da IA (sem check-in do time): ${SENTIMENT[aiSignal.sentiment].label}.${
          openRisks > 0 ? ` ${openRisks} risco(s)/pendência(s) aberto(s).` : ""
        } Registre um check-in para confirmar.`,
        evidence: aiSignal.analysis || undefined,
        evidenceMeta: `IA · ${aiSignal.ageDays}d atrás`,
        aiSignal,
      }
    }
    return {
      level: "unknown",
      trend: "none",
      confidence: "baixa",
      source: "none",
      summary:
        openRisks > 0
          ? `Sem check-in do time. Há ${openRisks} risco(s)/pendência(s) aberto(s) sem revisão — registre um check-in para uma leitura confiável.`
          : "Sem check-in do time registrado. Registre a primeira percepção da equipe.",
    }
  }

  const p = PERCEPTION[latest.perception]
  let level: Level = p?.level ?? "unknown"
  if (level === "healthy" && openRisks >= 2) level = "attention"

  const ageDays = daysAgo(latest.createdAt) ?? 999
  const confidence = ageDays <= 14 ? "alta" : ageDays <= 30 ? "média" : "baixa"

  let trend: Trend = "none"
  if (previous && p && PERCEPTION[previous.perception]) {
    const delta = p.rank - PERCEPTION[previous.perception].rank
    trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  }

  // Divergência: a IA enxerga clima pior do que o time registrou.
  if (aiSignal) {
    aiSignal.divergesFromTeam = LEVEL_ORDER[aiSignal.level] < LEVEL_ORDER[level]
  }

  const riskPart = openRisks > 0 ? ` ${openRisks} risco(s)/pendência(s) aberto(s) aguardam revisão.` : ""
  const agePart = ageDays > 30 ? " Baixa confiança: o último check-in é antigo." : ""
  const divergePart =
    aiSignal?.divergesFromTeam
      ? ` ⚠ A IA leu o grupo como "${SENTIMENT[aiSignal.sentiment].label}" — pior que o time. Vale revisar.`
      : ""

  return {
    level,
    trend,
    confidence,
    source: "team",
    summary: `Percepção mais recente do time: ${p?.label ?? latest.perception}.${riskPart}${agePart}${divergePart}`,
    evidence: latest.justification,
    evidenceMeta: `${latest.author.name} · ${ageDays}d atrás`,
    aiSignal,
  }
}

// === Saúde em lote (Torre da agência) ===

export interface NextActionSummary {
  description: string
  responsibleName: string | null
  dueAt: Date | null
  overdue: boolean
}

export interface ClientHealth {
  id: string
  name: string
  active: boolean
  reading: Reading
  openRisks: number
  pendingApprovals: number
  lastActivityAt: Date | null
  lastCheckinPerception: string | null
  nextAction: NextActionSummary | null
}

function countByClient(rows: { summary?: { clientId: string } | null; clientId?: string }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const cid = row.clientId ?? row.summary?.clientId
    if (!cid) continue
    map.set(cid, (map.get(cid) ?? 0) + 1)
  }
  return map
}

// Calcula a saúde de vários clientes em poucas queries batched (não N por cliente).
export async function getClientsHealth(
  clients: { id: string; name: string; active: boolean }[]
): Promise<ClientHealth[]> {
  const ids = clients.map((c) => c.id)
  if (ids.length === 0) return []

  const [
    checkins,
    groupRisks,
    meetingRisks,
    pendingContext,
    pendingGroupItems,
    pendingMeetingItems,
    conversations,
    nextActions,
    aiSummaries,
  ] = await Promise.all([
    prisma.teamCheckin.findMany({
      where: { clientId: { in: ids } },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    }),
    prisma.groupDailySummaryItem.findMany({
      where: { status: "PROPOSED", kind: { in: ["RISK", "PENDING"] }, summary: { clientId: { in: ids } } },
      select: { summary: { select: { clientId: true } } },
    }),
    prisma.meetingSummaryItem.findMany({
      where: { status: "PROPOSED", kind: { in: ["RISK", "OBJECTION"] }, summary: { clientId: { in: ids } } },
      select: { summary: { select: { clientId: true } } },
    }),
    prisma.contextItem.findMany({ where: { clientId: { in: ids }, status: "PROPOSED" }, select: { clientId: true } }),
    prisma.groupDailySummaryItem.findMany({
      where: { status: "PROPOSED", summary: { clientId: { in: ids } } },
      select: { summary: { select: { clientId: true } } },
    }),
    prisma.meetingSummaryItem.findMany({
      where: { status: "PROPOSED", summary: { clientId: { in: ids } } },
      select: { summary: { select: { clientId: true } } },
    }),
    prisma.waConversation.findMany({
      where: { clientId: { in: ids } },
      orderBy: { lastMessageAt: "desc" },
      select: { clientId: true, lastMessageAt: true },
    }),
    prisma.clientNextAction.findMany({
      where: { clientId: { in: ids }, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { clientId: true, description: true, dueAt: true, responsible: { select: { name: true } } },
    }),
    // Último resumo de IA com leitura de clima por cliente (sinaliza a saúde).
    prisma.groupDailySummary.findMany({
      where: { clientId: { in: ids }, sentiment: { not: null } },
      orderBy: { date: "desc" },
      select: { clientId: true, sentiment: true, analysis: true, confidence: true, date: true },
    }),
  ])

  // Últimos 2 check-ins por cliente (já vêm ordenados desc).
  const checkinsByClient = new Map<string, typeof checkins>()
  for (const c of checkins) {
    const arr = checkinsByClient.get(c.clientId) ?? []
    if (arr.length < 2) arr.push(c)
    checkinsByClient.set(c.clientId, arr)
  }

  const groupRiskCount = countByClient(groupRisks)
  const meetingRiskCount = countByClient(meetingRisks)
  const pendingContextCount = countByClient(pendingContext)
  const pendingGroupCount = countByClient(pendingGroupItems)
  const pendingMeetingCount = countByClient(pendingMeetingItems)

  const lastActivity = new Map<string, Date>()
  for (const conv of conversations) {
    if (conv.clientId && conv.lastMessageAt && !lastActivity.has(conv.clientId)) {
      lastActivity.set(conv.clientId, conv.lastMessageAt)
    }
  }

  // Último resumo de IA por cliente (já vem ordenado desc).
  const aiByClient = new Map<string, AiReadingInput>()
  for (const s of aiSummaries) {
    if (aiByClient.has(s.clientId) || !s.sentiment) continue
    aiByClient.set(s.clientId, {
      sentiment: s.sentiment as Sentiment,
      analysis: s.analysis,
      confidence: s.confidence,
      date: s.date,
    })
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const nextActionByClient = new Map<string, NextActionSummary>()
  for (const na of nextActions) {
    if (nextActionByClient.has(na.clientId)) continue // já vem ordenado desc; mantém a mais recente
    nextActionByClient.set(na.clientId, {
      description: na.description,
      responsibleName: na.responsible?.name ?? null,
      dueAt: na.dueAt,
      overdue: na.dueAt ? na.dueAt < startOfToday : false,
    })
  }

  return clients.map((client) => {
    const cc = checkinsByClient.get(client.id) ?? []
    const openRisks = (groupRiskCount.get(client.id) ?? 0) + (meetingRiskCount.get(client.id) ?? 0)
    const pendingApprovals =
      (pendingContextCount.get(client.id) ?? 0) +
      (pendingGroupCount.get(client.id) ?? 0) +
      (pendingMeetingCount.get(client.id) ?? 0)
    const reading = buildReading({
      latest: cc[0] ?? null,
      previous: cc[1] ?? null,
      openRisks,
      ai: aiByClient.get(client.id) ?? null,
    })
    return {
      id: client.id,
      name: client.name,
      active: client.active,
      reading,
      openRisks,
      pendingApprovals,
      lastActivityAt: lastActivity.get(client.id) ?? null,
      lastCheckinPerception: cc[0]?.perception ?? null,
      nextAction: nextActionByClient.get(client.id) ?? null,
    }
  })
}
