import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { connectInstance, createInstance, getConnectionState, logoutInstance } from "@/lib/evolution"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

// Extrai o QR (imagem base64) de respostas da Evolution em formatos variados.
function extractQr(data: Record<string, unknown> | null): string | null {
  if (!data) return null
  const direct = typeof data.base64 === "string" ? data.base64 : null
  const nested =
    (typeof asRecord(data.qrcode)?.base64 === "string" ? (asRecord(data.qrcode)!.base64 as string) : null) ??
    (typeof asRecord(data.qr)?.base64 === "string" ? (asRecord(data.qr)!.base64 as string) : null)
  const raw = direct ?? nested
  if (!raw) return null
  return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`
}

function extractPairingCode(data: Record<string, unknown> | null): string | null {
  if (!data) return null
  const direct = typeof data.pairingCode === "string" ? data.pairingCode : null
  const nested = typeof asRecord(data.qrcode)?.pairingCode === "string"
    ? (asRecord(data.qrcode)!.pairingCode as string)
    : null
  return direct ?? nested
}

// Estado da conexao + QR para pareamento quando a instancia nao esta conectada.
export async function GET() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const state = await getConnectionState()
  if (state === "open") {
    return NextResponse.json({ state, qr: null, pairingCode: null })
  }

  try {
    // Cria a instancia se ainda nao existir (Evolution nova/dedicada), depois conecta.
    try {
      await createInstance()
    } catch {
      // Ja existe ou erro nao-fatal: segue para o connect.
    }
    const data = asRecord(await connectInstance())
    return NextResponse.json({
      state: state ?? "close",
      qr: extractQr(data),
      pairingCode: extractPairingCode(data),
    })
  } catch (err) {
    return NextResponse.json(
      {
        state: state ?? null,
        qr: null,
        pairingCode: null,
        error: err instanceof Error ? err.message : "Falha ao iniciar conexao.",
      },
      { status: 502 }
    )
  }
}

// Desconecta a instancia (logout).
export async function DELETE() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  try {
    await logoutInstance()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao desconectar." },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, message: "Instancia desconectada." })
}
