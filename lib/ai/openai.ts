const API_URL = "https://api.openai.com/v1/chat/completions"
const TIMEOUT_MS = 60_000

export class AiProviderNotConfiguredError extends Error {
  constructor(provider?: string) {
    super(
      `Nenhuma chave de IA configurada${provider ? ` para ${provider}` : ""}. Cadastre em Configurações > IA ou defina a variável de ambiente.`
    )
  }
}

export type LowLevelArgs = {
  key: string
  model: string
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  json?: boolean
  temperature?: number
}

// Chamada de baixo nível à OpenAI (a chave/modelo vêm resolvidos do provider).
export async function openaiComplete({ key, model, system, messages, json, temperature = 0.3 }: LowLevelArgs): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "system", content: system }, ...messages],
      }),
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`[luqz-dash] OpenAI falhou: status=${res.status} requestId=${res.headers.get("x-request-id") ?? "-"}`)
      throw new Error(`O provedor de IA (OpenAI) recusou a solicitação (status ${res.status}).`)
    }
    const content = JSON.parse(body).choices?.[0]?.message?.content
    if (!content) throw new Error("Resposta da OpenAI sem conteúdo.")
    return content as string
  } finally {
    clearTimeout(timer)
  }
}
