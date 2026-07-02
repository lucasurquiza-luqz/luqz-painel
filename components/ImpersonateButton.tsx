"use client"

import { useState } from "react"
import { Eye, Loader2 } from "lucide-react"

// Botão da equipe pra começar a ver o painel COMO este cliente (preview read-only).
export function ImpersonateButton({ clientId }: { clientId: string }) {
  const [busy, setBusy] = useState(false)
  async function start() {
    setBusy(true)
    const res = await fetch("/api/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) })
    if (res.ok) window.location.href = `/clientes/${clientId}`
    else setBusy(false)
  }
  return (
    <button onClick={start} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Ver como cliente
    </button>
  )
}
