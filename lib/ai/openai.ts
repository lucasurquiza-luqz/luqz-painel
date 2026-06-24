import { getProviderApiKey } from "@/lib/ai/credentials"

const API_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"
const TIMEOUT_MS = 60_000

export class AiProviderNotConfiguredError extends Error {
  constructor() {
    super("Nenhuma chave da OpenAI configurada. Cadastre em Configurações > IA ou defina OPENAI_API_KEY no ambiente.")
  }
}

export async function completeJSON(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = await getProviderApiKey("OPENAI", process.env.OPENAI_API_KEY)
  if (!apiKey) throw new AiProviderNotConfiguredError()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    })

    const body = await res.text()
    if (!res.ok) {
      const requestId = res.headers.get("x-request-id")
      console.error(`[luqz-dash] OpenAI falhou: status=${res.status}${requestId ? ` requestId=${requestId}` : ""}`)
      throw new Error(`O provedor de IA recusou a solicitação (status ${res.status}).`)
    }

    const parsed = JSON.parse(body)
    const content = parsed.choices?.[0]?.message?.content
    if (!content) throw new Error("Resposta da OpenAI sem conteudo.")

    return JSON.parse(content)
  } finally {
    clearTimeout(timer)
  }
}
