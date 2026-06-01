"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Smartphone, Users, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface Group {
  id: string
  name: string
  participants: number
  clientId: string | null
}

export default function ClienteGruposPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [groups, setGroups] = useState<Group[]>([])
  const [clientGroups, setClientGroups] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [allRes, clientRes] = await Promise.all([
      fetch("/api/groups/all"),
      fetch(`/api/clients/${clientId}`),
    ])
    const allData = await allRes.json()
    const clientData = await clientRes.json()
    setGroups(allData.groups ?? [])
    setClientGroups(new Set((clientData.client?.groups ?? []).map((g: Group) => g.id)))
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function toggleGroup(groupId: string, isLinked: boolean) {
    setLinking(groupId)
    await fetch(`/api/clients/${clientId}/groups`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, linked: !isLinked }),
    })
    await load()
    setLinking(null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Grupos</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Vincule grupos WhatsApp a este cliente</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-600 text-sm">Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Smartphone size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum grupo sincronizado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const isLinked = clientGroups.has(g.id)
            const isOtherClient = !isLinked && g.clientId !== null

            return (
              <div
                key={g.id}
                className={cn(
                  "flex items-center gap-4 border rounded-2xl px-5 py-4 transition-colors",
                  isLinked ? "bg-blue-600/8 border-blue-500/30" : "bg-zinc-900 border-white/8",
                  isOtherClient && "opacity-40"
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{g.name}</p>
                  <p className="text-xs text-zinc-500">{g.participants} membros</p>
                </div>
                {isOtherClient ? (
                  <span className="text-xs text-zinc-600 px-2">Outro cliente</span>
                ) : (
                  <button
                    onClick={() => toggleGroup(g.id, isLinked)}
                    disabled={linking === g.id}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0",
                      isLinked
                        ? "bg-blue-600/20 text-blue-400 hover:bg-red-900/20 hover:text-red-400"
                        : "bg-zinc-800 text-zinc-400 hover:bg-blue-600/20 hover:text-blue-400"
                    )}
                  >
                    {linking === g.id
                      ? <RefreshCw size={12} className="animate-spin" />
                      : isLinked ? "Desvincular" : "Vincular"
                    }
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
