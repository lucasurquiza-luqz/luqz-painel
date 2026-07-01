"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function EditScheduleForm({
  postId,
  backHref,
  initialCaption,
  initialScheduledAt,
}: {
  postId: string
  backHref: string
  initialCaption: string
  initialScheduledAt: string
}) {
  const router = useRouter()
  const [caption, setCaption] = useState(initialCaption)
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`/api/instagram/schedules/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, scheduledAt: new Date(scheduledAt).toISOString() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Falha ao salvar.")
      }
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Legenda ({caption.length}/2200)</label>
        <textarea
          required
          value={caption}
          maxLength={2200}
          onChange={(e) => setCaption(e.target.value)}
          rows={6}
          className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
        />
      </div>

      <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Data e hora da publicação</label>
        <input
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 [color-scheme:dark]"
        />
      </div>

      {error && <p className="text-xs text-red-400 bg-red-900/20 px-4 py-3 rounded-xl border border-red-800/30">{error}</p>}

      <div className="flex gap-3">
        <Link href={backHref} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors text-center">
          Cancelar
        </Link>
        <button type="submit" disabled={loading} className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
          {loading ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  )
}
