"use client"

import { useEffect } from "react"
import { RefreshCw } from "lucide-react"

// Rede de segurança do segmento do cliente: se qualquer página (desempenho,
// relatório, plano, etc.) estourar no render, mostra um card de retry DENTRO do
// app em vez de derrubar pra tela de erro do navegador (que perdia o contexto).
export default function ClienteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[cliente] erro na página:", error) }, [error])
  return (
    <main className="mx-auto max-w-2xl p-6 lg:p-8">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
        <p className="text-sm font-semibold text-white">Não foi possível carregar esta página</p>
        <p className="mt-1 text-xs text-zinc-500">Tente de novo. Se persistir, avise o time.</p>
        <button onClick={reset} className="mx-auto mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10">
          <RefreshCw size={14} /> Tentar de novo
        </button>
        {error?.digest && <p className="mt-3 text-[10px] text-zinc-700">ref: {error.digest}</p>}
      </div>
    </main>
  )
}
