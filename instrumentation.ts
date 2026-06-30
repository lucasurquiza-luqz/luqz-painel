// DSN do projeto Sentry (chave de ingestão — pública por natureza). Env sobrescreve.
const SENTRY_DSN = process.env.SENTRY_DSN ?? "https://8d89450591267259f8fe1f6addc92de4@o4511651587424256.ingest.de.sentry.io/4511651589587024"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (SENTRY_DSN) {
      const Sentry = await import("@sentry/node")
      Sentry.init({ dsn: SENTRY_DSN, environment: process.env.NODE_ENV, tracesSampleRate: 0 })
    }
    const { startCron } = await import("./lib/cron")
    startCron()
  }
}
