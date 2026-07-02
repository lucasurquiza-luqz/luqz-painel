"use client"

import { useState } from "react"
import { Eye, Loader2, X } from "lucide-react"

// Barra fixa no topo enquanto a equipe está vendo o painel COMO um cliente.
export function ImpersonationBanner({ clientName }: { clientName: string }) {
  const [leaving, setLeaving] = useState(false)
  async function exit() {
    setLeaving(true)
    await fetch("/api/impersonate", { method: "DELETE" }).catch(() => {})
    window.location.href = "/clientes"
  }
  return (
    <div className="flex items-center justify-center gap-3 bg-[#FF8F50] px-4 py-1.5 text-[13px] font-medium text-black print:hidden">
      <Eye size={15} />
      <span>Vendo como cliente: <b>{clientName}</b> · modo leitura</span>
      <button onClick={exit} disabled={leaving} className="ml-1 flex items-center gap-1 rounded-md bg-black/15 px-2 py-0.5 text-xs hover:bg-black/25">
        {leaving ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Sair
      </button>
    </div>
  )
}
