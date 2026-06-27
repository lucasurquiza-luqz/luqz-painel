import { NextRequest, NextResponse } from "next/server"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { chatComplete, type ChatMessage } from "@/lib/ai/provider"
import { buildClientGrounding } from "@/lib/ai/context-grounding"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const body = await req.json().catch(() => ({}))
  const messages: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages.filter((m: ChatMessage) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string").slice(-12)
    : []
  if (messages.length === 0) return NextResponse.json({ error: "Envie ao menos uma mensagem." }, { status: 400 })

  try {
    const grounding = await buildClientGrounding(id)
    if (!grounding.hasSignal) {
      return NextResponse.json({
        answer: "Ainda não há dados deste cliente: nem contexto aprovado, nem check-in, próxima ação ou atividade. Comece registrando um check-in ou aprovando o contexto (aba Contexto) — aí eu consigo te ajudar a gerir a conta.",
        itemCount: 0,
      })
    }
    const answer = await chatComplete("ASSISTANT", grounding.systemPrompt, messages)
    return NextResponse.json({ answer, itemCount: grounding.itemCount })
  } catch (error) {
    if (error instanceof AiProviderNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no assistente." }, { status: 502 })
  }
}
