"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Instagram, Search, Check, Loader2, Unplug, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

type Account = { igUserId: string; username: string | null }
type Candidate = { igUserId: string; username: string | null; pageName: string }

export function AccountConfig({ clientId, initial }: { clientId: string; initial: Account | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(!initial)
  const [token, setToken] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<string>("")
  const [busy, setBusy] = useState<"" | "detect" | "connect" | "disconnect">("")
  const [error, setError] = useState("")

  async function detect() {
    setError("")
    setCandidates([])
    setSelected("")
    if (!token.trim()) { setError("Cole o token primeiro."); return }
    setBusy("detect")
    try {
      const res = await fetch("/api/instagram/accounts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Falha ao detectar.")
      setCandidates(data.candidates)
      if (data.candidates.length === 1) setSelected(data.candidates[0].igUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
    } finally {
      setBusy("")
    }
  }

  async function connect() {
    setError("")
    const chosen = candidates.find((c) => c.igUserId === selected)
    if (!chosen) { setError("Selecione uma conta."); return }
    setBusy("connect")
    try {
      const res = await fetch("/api/instagram/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, igUserId: chosen.igUserId, username: chosen.username, token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Falha ao conectar.")
      setToken("")
      setCandidates([])
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
    } finally {
      setBusy("")
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar a conta de Instagram deste cliente?")) return
    setError("")
    setBusy("disconnect")
    try {
      const res = await fetch(`/api/instagram/accounts?clientId=${clientId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Falha ao desconectar.")
      setEditing(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Conta conectada */}
      {initial && !editing && (
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/30 to-pink-500/30 flex items-center justify-center">
              <Instagram size={18} className="text-orange-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100">@{initial.username ?? "conta"}</p>
              <p className="text-xs text-zinc-500">Conta business · ID {initial.igUserId}</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
              <Check size={12} /> Conectada
            </span>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg cursor-pointer">
              <RefreshCw size={13} /> Trocar conta / token
            </button>
            <button onClick={disconnect} disabled={busy === "disconnect"} className="flex items-center gap-2 text-xs text-red-300 bg-red-900/20 hover:bg-red-900/30 px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50">
              {busy === "disconnect" ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />} Desconectar
            </button>
          </div>
        </div>
      )}

      {/* Conectar / trocar */}
      {editing && (
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">
              {initial ? "Trocar conta ou token" : "Conectar conta de Instagram"}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Cole o token de acesso (Graph API, com <span className="text-zinc-400">instagram_content_publish</span>). O Dash detecta a conta automaticamente.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Token de acesso</label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={3}
              placeholder="EAAxxxxx..."
              className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none break-all"
            />
            <button onClick={detect} disabled={busy === "detect"} className="mt-2 flex items-center gap-2 text-sm text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50">
              {busy === "detect" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {busy === "detect" ? "Detectando..." : "Detectar conta"}
            </button>
          </div>

          {candidates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Conta encontrada</label>
              <div className="space-y-2">
                {candidates.map((c) => (
                  <button
                    key={c.igUserId}
                    type="button"
                    onClick={() => setSelected(c.igUserId)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-colors cursor-pointer",
                      selected === c.igUserId ? "border-orange-500/40 bg-orange-500/10" : "border-white/8 bg-zinc-800/50 hover:border-white/15"
                    )}
                  >
                    <Instagram size={16} className="text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100">@{c.username ?? c.igUserId}</p>
                      <p className="text-xs text-zinc-500 truncate">Página: {c.pageName || "—"}</p>
                    </div>
                    {selected === c.igUserId && <Check size={16} className="text-orange-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400 bg-red-900/20 px-4 py-3 rounded-xl border border-red-800/30">{error}</p>}

          <div className="flex gap-2">
            {initial && (
              <button onClick={() => { setEditing(false); setError(""); setCandidates([]); setToken("") }} className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2.5 cursor-pointer">
                Cancelar
              </button>
            )}
            <button
              onClick={connect}
              disabled={!selected || busy === "connect"}
              className="flex items-center gap-2 py-2.5 px-5 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {busy === "connect" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {initial ? "Salvar conta" : "Conectar"}
            </button>
          </div>
        </div>
      )}

      {!initial && !editing && (
        <p className="text-xs text-zinc-600">Sem conta conectada.</p>
      )}
    </div>
  )
}
