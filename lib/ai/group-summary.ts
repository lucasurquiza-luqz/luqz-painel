import { completeJSON } from "@/lib/ai/openai"

export type GroupSummaryMessageInput = {
  id: string
  fromName: string | null
  isFromMe: boolean
  text: string | null
  timestamp: Date
}

export type GroupSummaryItemDraft = {
  kind: "DECISION" | "COMMITMENT" | "RISK" | "PRAISE" | "PENDING"
  text: string
  responsible: string | null
  sourceMessageIds: string[]
}

export type GroupSummaryDraft = {
  rawSummary: string
  items: GroupSummaryItemDraft[]
}

const SYSTEM_PROMPT = `Voce le mensagens de um grupo de WhatsApp entre uma agencia e um cliente e produz um resumo factual do dia.
Nunca invente informacao que nao esteja no texto. Se nao houver decisao, pendencia, risco, elogio ou compromisso, deixe a lista correspondente vazia.
Responda em JSON com o formato exato:
{
  "rawSummary": "paragrafo curto e factual em portugues do Brasil, sem opiniao",
  "items": [
    { "kind": "DECISION" | "COMMITMENT" | "RISK" | "PRAISE" | "PENDING", "text": "string objetiva", "responsible": "nome ou null", "sourceMessageIds": ["id1", "id2"] }
  ]
}`

const KIND_LABEL: Record<GroupSummaryItemDraft["kind"], string> = {
  DECISION: "decisao",
  COMMITMENT: "compromisso",
  RISK: "risco",
  PRAISE: "elogio",
  PENDING: "pendencia",
}

function buildUserPrompt(messages: GroupSummaryMessageInput[]): string {
  const lines = messages.map((message) => {
    const author = message.isFromMe ? "Equipe LUQZ" : message.fromName ?? "Cliente"
    return `[${message.id}] ${author}: ${message.text ?? "(midia sem texto)"}`
  })
  return `Mensagens do dia (uma por linha, com id entre colchetes):\n\n${lines.join("\n")}`
}

const VALID_KINDS = new Set(Object.keys(KIND_LABEL))

export async function generateGroupDailySummary(
  messages: GroupSummaryMessageInput[]
): Promise<GroupSummaryDraft> {
  const result = await completeJSON(SYSTEM_PROMPT, buildUserPrompt(messages))
  const payload = result as { rawSummary?: unknown; items?: unknown }

  if (typeof payload.rawSummary !== "string" || !Array.isArray(payload.items)) {
    throw new Error("Resposta da IA fora do formato esperado.")
  }

  const validMessageIds = new Set(messages.map((message) => message.id))

  const items: GroupSummaryItemDraft[] = payload.items
    .filter((raw): raw is Record<string, unknown> => typeof raw === "object" && raw !== null)
    .filter((raw) => typeof raw.kind === "string" && VALID_KINDS.has(raw.kind) && typeof raw.text === "string")
    .map((raw) => ({
      kind: raw.kind as GroupSummaryItemDraft["kind"],
      text: (raw.text as string).trim(),
      responsible: typeof raw.responsible === "string" ? raw.responsible.trim() : null,
      sourceMessageIds: Array.isArray(raw.sourceMessageIds)
        ? raw.sourceMessageIds.filter((id): id is string => typeof id === "string" && validMessageIds.has(id))
        : [],
    }))

  return { rawSummary: payload.rawSummary.trim(), items }
}
