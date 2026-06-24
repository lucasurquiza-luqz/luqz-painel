import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { getWebhook, setWebhook } from "@/lib/evolution"

function buildWebhookUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  if (!base) return null
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET
  const path = "/api/webhook/evolution"
  return secret ? `${base}${path}?secret=${encodeURIComponent(secret)}` : `${base}${path}`
}

export async function GET() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const config = await getWebhook()
  return NextResponse.json({ webhook: config, expectedUrl: buildWebhookUrl() })
}

// Reconfigura o webhook da Evolution para apontar ao Dash com os eventos de grupo.
export async function POST() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const url = buildWebhookUrl()
  if (!url) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL nao configurada no ambiente." },
      { status: 400 }
    )
  }

  try {
    await setWebhook(url)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao configurar webhook na Evolution." },
      { status: 502 }
    )
  }

  // Nao devolve a URL com secret para a interface.
  return NextResponse.json({ ok: true, message: "Webhook reconfigurado com eventos de grupo." })
}
