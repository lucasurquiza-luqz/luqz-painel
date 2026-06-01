"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Smartphone, Users } from "lucide-react"

interface Group {
  id: string
  name: string
  participants: number
  active: boolean
  syncedAt: string
}

export default function GruposPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/groups")
    const data = await res.json()
    setGroups(data.groups ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    setError("")
    const res = await fetch("/api/groups/sync", { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Erro ao sincronizar.")
    } else {
      await load()
    }
    setSyncing(false)
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    })
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, active: !active } : g))
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Grupos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Grupos WhatsApp sincronizados da Evolution API</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-sm font-medium rounded-xl transition-colors cursor-pointer border border-white/8"
        >
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 px-4 py-3 rounded-xl border border-red-800/30 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-center py-20 text-zinc-600 text-sm">Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Smartphone size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum grupo sincronizado.</p>
          <p className="text-xs text-zinc-700 mt-1">Clique em "Sincronizar" para buscar os grupos da Evolution API.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-4 bg-zinc-900 border border-white/8 rounded-2xl px-5 py-4"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">{g.name}</p>
                <p className="text-xs text-zinc-500">{g.participants} membros</p>
              </div>
              <button
                onClick={() => toggleActive(g.id, g.active)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                  g.active ? "bg-blue-600" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    g.active ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
