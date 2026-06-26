import type { AiFunction, AiProvider } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getProviderApiKey } from "@/lib/ai/credentials"
import { AiProviderNotConfiguredError, openaiComplete } from "@/lib/ai/openai"
import { anthropicComplete } from "@/lib/ai/anthropic"

export type ChatMessage = { role: "user" | "assistant"; content: string }

// Padrões por função (usados quando não há config salva nem env).
export const DEFAULTS: Record<AiFunction, { provider: AiProvider; model: string }> = {
  ASSISTANT: { provider: "OPENAI", model: "gpt-4o" },
  GROUP_SUMMARY: { provider: "OPENAI", model: "gpt-4o-mini" },
  MEETING_SUMMARY: { provider: "OPENAI", model: "gpt-4o-mini" },
}

// Sugestões de modelo por provider (a UI permite texto livre também).
export const MODEL_OPTIONS: Record<AiProvider, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
  ANTHROPIC: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
}

export async function resolveModel(fn: AiFunction): Promise<{ provider: AiProvider; model: string }> {
  const cfg = await prisma.aiModelConfig.findUnique({ where: { function: fn } })
  if (cfg) return { provider: cfg.provider, model: cfg.model }
  const d = DEFAULTS[fn]
  // Compatibilidade: OPENAI_MODEL no ambiente ainda vale como override do padrão OpenAI.
  if (d.provider === "OPENAI" && process.env.OPENAI_MODEL) return { provider: "OPENAI", model: process.env.OPENAI_MODEL }
  return d
}

async function keyFor(provider: AiProvider): Promise<string> {
  const envFallback = provider === "OPENAI" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY
  const key = await getProviderApiKey(provider, envFallback)
  if (!key) throw new AiProviderNotConfiguredError(provider)
  return key
}

function route(provider: AiProvider) {
  return provider === "ANTHROPIC" ? anthropicComplete : openaiComplete
}

// Chat livre (assistente).
export async function chatComplete(fn: AiFunction, system: string, messages: ChatMessage[]): Promise<string> {
  const { provider, model } = await resolveModel(fn)
  const key = await keyFor(provider)
  return route(provider)({ key, model, system, messages, temperature: 0.3 })
}

// Resposta JSON (resumos). Extrai JSON mesmo se vier com cercas/ruído.
export async function completeJSON(fn: AiFunction, system: string, userPrompt: string): Promise<unknown> {
  const { provider, model } = await resolveModel(fn)
  const key = await keyFor(provider)
  const text = await route(provider)({ key, model, system, messages: [{ role: "user", content: userPrompt }], json: true, temperature: 0.2 })
  return parseJSON(text)
}

function parseJSON(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error("Resposta da IA não é um JSON válido.")
  }
}
