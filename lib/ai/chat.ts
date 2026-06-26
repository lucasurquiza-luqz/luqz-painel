import { getProviderApiKey } from "@/lib/ai/credentials"
import { AiProviderNotConfiguredError } from "@/lib/ai/openai"

const API_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"
const TIMEOUT_MS = 60_000

export type ChatMessage = { role: "user" | "assistant"; content: string }

// Completa um chat em texto livre (assistente ancorado em contexto).
export async function chatComplete(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = await getProviderApiKey("OPENAI", process.env.OPENAI_API_KEY)
  if (!apiKey) throw new AiProviderNotConfiguredError()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    })

    const body = await res.text()
    if (!res.ok) {
      const requestId = res.headers.get("x-request-id")
      console.error(`[luqz-dash] OpenAI chat falhou: status=${res.status}${requestId ? ` requestId=${requestId}` : ""}`)
      throw new Error(`O provedor de IA recusou a solicitação (status ${res.status}).`)
    }

    const parsed = JSON.parse(body)
    const content = parsed.choices?.[0]?.message?.content
    if (!content) throw new Error("Resposta da IA sem conteúdo.")
    return content as string
  } finally {
    clearTimeout(timer)
  }
}
