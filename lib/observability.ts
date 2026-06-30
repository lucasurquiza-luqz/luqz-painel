// Ponto único de captura de erro: log estruturado (greppável) + Sentry.
// Sentry é inicializado em instrumentation.ts; se não houver client, captureException é no-op.
import * as Sentry from "@sentry/node"

type Meta = Record<string, unknown>

export function reportError(scope: string, err: unknown, meta?: Meta): void {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  try {
    console.error(JSON.stringify({ level: "error", scope, message, ...(meta ?? {}) }))
  } catch {
    console.error(`[${scope}]`, message)
  }
  if (stack) console.error(stack)
  if (Sentry.getClient()) {
    Sentry.captureException(err instanceof Error ? err : new Error(message), { tags: { scope }, extra: meta })
  }
}
