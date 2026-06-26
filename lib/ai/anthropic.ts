import type { LowLevelArgs } from "@/lib/ai/openai"

const API_URL = "https://api.anthropic.com/v1/messages"
const VERSION = "2023-06-01"
const TIMEOUT_MS = 60_000
const MAX_TOKENS = 4096

// Chamada de baixo nível à Anthropic (Claude). Mesma assinatura do openaiComplete.
export async function anthropicComplete({ key, model, system, messages, json, temperature = 0.3 }: LowLevelArgs): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  // Anthropic não tem response_format JSON: instruímos e extraímos.
  const sys = json ? `${system}\n\nResponda APENAS com um objeto JSON válido, sem texto antes/depois e sem cercas de código.` : system
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-api-key": key, "anthropic-version": VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature,
        system: sys,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`[luqz-dash] Anthropic falhou: status=${res.status} requestId=${res.headers.get("request-id") ?? "-"}`)
      throw new Error(`O provedor de IA (Anthropic) recusou a solicitação (status ${res.status}).`)
    }
    const parsed = JSON.parse(body)
    const text = Array.isArray(parsed.content)
      ? parsed.content.filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim()
      : ""
    if (!text) throw new Error("Resposta da Anthropic sem conteúdo.")
    return text
  } finally {
    clearTimeout(timer)
  }
}
