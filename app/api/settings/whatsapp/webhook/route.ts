import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { getWebhook, setWebhook } from "@/lib/evolution"

const WEBHOOK_PATH = "/api/webhook/evolution"

// Resolve a base do webhook: override explicito > env dedicada > app url publica.
// A env dedicada permite apontar para a URL INTERNA do container quando a
// Evolution nao alcanca o dominio publico.
function resolveBase(override?: string | null): string | null {
  const candidate =
    (override && override.trim()) ||
    process.env.EVOLUTION_WEBHOOK_TARGET_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!candidate) return null
  return candidate.replace(/\/$/, "")
}

// A Evolution (2.3) rejeita webhook com query string; registra a URL limpa.
// O handler aceita POST sem secret, validando apenas se um secret for enviado.
function buildWebhookUrl(base: string): string {
  return `${base}${WEBHOOK_PATH}`
}

function maskSecret(url: string): string {
  return url.replace(/secret=[^&]+/, "secret=***")
}

export async function GET() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const config = await getWebhook()
  const base = resolveBase()
  return NextResponse.json({
    webhook: config,
    expectedUrl: base ? maskSecret(buildWebhookUrl(base)) : null,
  })
}

// Reconfigura o webhook da Evolution para apontar ao Dash com os eventos de grupo.
// Aceita { baseUrl } opcional para apontar a uma URL alternativa (ex: interna).
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const override = typeof body.baseUrl === "string" ? body.baseUrl : null
  const base = resolveBase(override)
  if (!base) {
    return NextResponse.json(
      { error: "Nenhuma URL de destino. Informe uma URL ou configure NEXT_PUBLIC_APP_URL." },
      { status: 400 }
    )
  }

  const url = buildWebhookUrl(base)

  try {
    await setWebhook(url)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao configurar webhook na Evolution." },
      { status: 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: "Webhook reconfigurado com eventos de grupo.",
    registeredUrl: maskSecret(url),
  })
}
