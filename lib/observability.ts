// Ponto único de captura de erro. Hoje: log estruturado (greppável).
// Amanhã: plugar Sentry aqui (basta checar SENTRY_DSN e encaminhar) sem tocar nos callers.
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
  // TODO(observabilidade): se process.env.SENTRY_DSN, encaminhar { scope, err, meta } ao Sentry.
}
