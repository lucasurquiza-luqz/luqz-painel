import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { chatComplete, type ChatMessage } from "@/lib/ai/provider"
import { buildPortfolioGrounding } from "@/lib/ai/context-grounding"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

// Assistente da carteira (global). Só equipe (ADMIN/OPERADOR).
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const messages: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages.filter((m: ChatMessage) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string").slice(-12)
    : []
  if (messages.length === 0) return NextResponse.json({ error: "Envie ao menos uma mensagem." }, { status: 400 })

  try {
    const grounding = await buildPortfolioGrounding()
    if (grounding.itemCount === 0) {
      return NextResponse.json({
        answer: "Ainda não há contexto **aprovado** em nenhum cliente. Aprove o contexto de alguns clientes (aba Contexto → \"Aprovar propostas\") para eu poder responder sobre a carteira.",
        clientCount: grounding.clientCount,
        itemCount: 0,
      })
    }
    const answer = await chatComplete("ASSISTANT", grounding.systemPrompt, messages)
    return NextResponse.json({ answer, clientCount: grounding.clientCount, itemCount: grounding.itemCount })
  } catch (error) {
    if (error instanceof AiProviderNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no assistente." }, { status: 502 })
  }
}
