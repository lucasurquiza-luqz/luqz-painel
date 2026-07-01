"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, Send, RotateCcw, Ban, Loader2 } from "lucide-react"

type Props = { clientId: string; postId: string; status: string }

export function PostActions({ clientId, postId, status }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<"" | "publish" | "cancel">("")
  const [error, setError] = useState("")

  async function publishNow() {
    if (!confirm("Publicar este post agora, mesmo antes do horário?")) return
    setBusy("publish")
    setError("")
    try {
      const res = await fetch(`/api/instagram/schedules/${postId}/publish-now`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Falha ao publicar.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
    } finally {
      setBusy("")
    }
  }

  async function cancel() {
    setBusy("cancel")
    setError("")
    try {
      const res = await fetch(`/api/instagram/schedules/${postId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Falha ao cancelar.")
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
    } finally {
      setBusy("")
    }
  }

  const btn = "flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"

  return (
    <div className="flex items-center gap-1">
      {error && <span className="text-[11px] text-red-400 mr-1">{error}</span>}

      {status === "PENDING" && (
        <>
          <Link href={`/clientes/${clientId}/instagram/programados/${postId}/editar`} className={`${btn} text-zinc-500 hover:text-orange-400 hover:bg-orange-900/10`}>
            <Pencil size={12} /> Editar
          </Link>
          <button onClick={publishNow} disabled={!!busy} className={`${btn} text-zinc-500 hover:text-green-400 hover:bg-green-900/10`}>
            {busy === "publish" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Publicar agora
          </button>
          <button onClick={cancel} disabled={!!busy} className={`${btn} text-zinc-500 hover:text-red-400 hover:bg-red-900/10`}>
            {busy === "cancel" ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Cancelar
          </button>
        </>
      )}

      {status === "FAILED" && (
        <>
          <button onClick={publishNow} disabled={!!busy} className={`${btn} text-zinc-500 hover:text-green-400 hover:bg-green-900/10`}>
            {busy === "publish" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Tentar de novo
          </button>
          <button onClick={cancel} disabled={!!busy} className={`${btn} text-zinc-500 hover:text-red-400 hover:bg-red-900/10`}>
            <Ban size={12} /> Cancelar
          </button>
        </>
      )}
    </div>
  )
}
