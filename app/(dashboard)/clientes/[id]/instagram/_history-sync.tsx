"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { History, Loader2, Check } from "lucide-react"

// Backfill do histórico em lotes: chama o endpoint repetidamente com o cursor
// até acabar. Evita o timeout de puxar centenas de posts numa request só.
export function HistorySyncButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")

  async function run() {
    setState("running")
    setError("")
    setTotal(0)
    let after = ""
    try {
      for (let i = 0; i < 60; i++) {
        const res = await fetch("/api/instagram/media/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, after }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar.")
        setTotal(data.total)
        if (!data.nextAfter) break
        after = data.nextAfter
      }
      setState("done")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
      setState("error")
    }
  }

  return (
    <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <History size={16} className="text-zinc-400" />
        <h3 className="text-sm font-medium text-zinc-200">Sincronizar histórico</h3>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Puxa as métricas de todos os posts (não só os recentes), para a Análise e os Top posts cobrirem o histórico completo. Pode levar 1-2 minutos.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={state === "running"}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-sm font-medium rounded-xl cursor-pointer"
        >
          {state === "running" ? <Loader2 size={15} className="animate-spin" /> : state === "done" ? <Check size={15} className="text-green-400" /> : <History size={15} />}
          {state === "running" ? "Sincronizando..." : state === "done" ? "Concluído" : "Sincronizar histórico"}
        </button>
        {(state === "running" || state === "done") && <span className="text-xs text-zinc-500">{total} posts no cache</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}
