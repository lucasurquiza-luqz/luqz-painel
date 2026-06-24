"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { RefreshCw, Users, Smartphone, DownloadCloud, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Group {
  id: string
  name: string
  participants: number
  clientId: string | null
}

interface WaStatus {
  connectionState: string | null
  runtime: { lastWebhookAt: string | null; lastMessageAt: string | null } | null
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("pt-BR")
}

export default function ClienteConfiguracoesPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [groups, setGroups] = useState<Group[]>([])
  const [clientGroups, setClientGroups] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState("")
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState("")

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

  const loadStatus = useCallback(async () => {
    // Diagnostico e restrito a Admin; degrada em silencio para Operador.
    try {
      const res = await fetch("/api/diagnostics/whatsapp")
      if (res.ok) setWaStatus(await res.json())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { load(); loadStatus() }, [load, loadStatus])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg("")
    const res = await fetch("/api/groups/sync", { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      setSyncMsg(`${data.created} novos, ${data.updated} atualizados`)
      await load()
    } else {
      setSyncMsg("Erro ao sincronizar")
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(""), 4000)
  }

  async function handleBackfill() {
    setBackfilling(true)
    setBackfillMsg("")
    const res = await fetch(`/api/clients/${clientId}/groups/sync-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 7 }),
    })
    const data = await res.json()
    if (res.ok) {
      setBackfillMsg(
        data.totalStored > 0
          ? `${data.totalStored} mensagem(ns) importada(s) dos ultimos ${data.days} dias.`
          : `Nenhuma mensagem nova encontrada na Evolution nos ultimos ${data.days} dias.`
      )
      await loadStatus()
    } else {
      setBackfillMsg(data.error ?? "Erro ao sincronizar mensagens.")
    }
    setBackfilling(false)
  }

  const connectionState = waStatus?.connectionState ?? null
  const isConnected = connectionState === "open"

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Configuracoes</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Grupos e configuracoes do cliente</p>
      </div>

      {/* Saude da integracao WhatsApp */}
      {waStatus && (
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2.5 mb-4">
            <MessageCircle size={16} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Integracao WhatsApp</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <StatusCell label="Conexao" value={connectionState ?? "desconhecida"} tone={isConnected ? "good" : "warn"} />
            <StatusCell label="Ultimo webhook" value={formatDateTime(waStatus.runtime?.lastWebhookAt)} />
            <StatusCell label="Ultima mensagem" value={formatDateTime(waStatus.runtime?.lastMessageAt)} />
          </div>
          {!isConnected && (
            <p className="text-xs text-amber-300/90 mb-3">
              A instancia nao esta conectada. Enquanto isso, nenhuma mensagem nova chega pelo webhook.
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/25 text-orange-300 text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud size={13} className={backfilling ? "animate-pulse" : ""} />
              {backfilling ? "Sincronizando mensagens..." : "Sincronizar mensagens (7 dias)"}
            </button>
            {backfillMsg && <span className="text-xs text-zinc-400">{backfillMsg}</span>}
          </div>
          <p className="text-[11px] text-zinc-600 mt-2">
            Puxa o historico recente dos grupos vinculados direto da Evolution. Diagnostico completo em Configuracoes da agencia.
          </p>
        </div>
      )}

      {/* Secao de Grupos */}
      <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Smartphone size={16} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Grupos WhatsApp</h2>
            <span className="text-xs text-zinc-600">
              {clientGroups.size} vinculado{clientGroups.size !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {syncMsg && <span className="text-xs text-zinc-500">{syncMsg}</span>}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/8 text-zinc-400 hover:text-zinc-200 text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando..." : "Sincronizar grupos"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-zinc-600 text-sm">Carregando...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-zinc-600">
            <Smartphone size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum grupo sincronizado.</p>
            <p className="text-xs text-zinc-700 mt-1">Clique em "Sincronizar grupos" para buscar da Evolution API.</p>
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
                    "flex items-center gap-4 border rounded-xl px-4 py-3 transition-colors",
                    isLinked ? "bg-orange-500/8 border-orange-500/25" : "bg-zinc-800/50 border-white/8",
                    isOtherClient && "opacity-35"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <Users size={14} className="text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{g.name}</p>
                    <p className="text-xs text-zinc-500">{g.participants} membros</p>
                  </div>
                  {isOtherClient ? (
                    <span className="text-xs text-zinc-600">Outro cliente</span>
                  ) : (
                    <button
                      onClick={() => toggleGroup(g.id, isLinked)}
                      disabled={linking === g.id}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0",
                        isLinked
                          ? "bg-orange-500/15 text-orange-400 hover:bg-red-900/20 hover:text-red-400"
                          : "bg-zinc-700 text-zinc-400 hover:bg-orange-500/15 hover:text-orange-400"
                      )}
                    >
                      {linking === g.id
                        ? <RefreshCw size={11} className="animate-spin" />
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
    </div>
  )

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
}

function StatusCell({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const valueColor = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-zinc-200"
  return (
    <div className="rounded-xl border border-white/8 bg-zinc-800/40 px-3 py-2">
      <p className="text-[11px] text-zinc-600">{label}</p>
      <p className={cn("mt-0.5 text-xs font-semibold truncate", valueColor)}>{value}</p>
    </div>
  )
}
