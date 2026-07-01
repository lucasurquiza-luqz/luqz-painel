"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Check, Loader2, Layers } from "lucide-react"
import { PILLAR_PALETTE, DEFAULT_PILLARS } from "@/lib/instagram-pillars"

type Pillar = { id?: string; label: string; color: string }

export function PillarsConfig({ clientId, initial }: { clientId: string; initial: Pillar[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<Pillar[]>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  function update(i: number, patch: Partial<Pillar>) {
    setRows((r) => r.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
    setSaved(false)
  }
  function add() {
    setRows((r) => [...r, { label: "", color: PILLAR_PALETTE[r.length % PILLAR_PALETTE.length] }])
    setSaved(false)
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/instagram/pillars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, pillars: rows.filter((p) => p.label.trim()) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.")
      setRows(data.pillars)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={16} className="text-zinc-400" />
        <h3 className="text-sm font-medium text-zinc-200">Pilares de conteúdo</h3>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Os temas que organizam o conteúdo deste cliente. Você marca cada post com um pilar e a Análise mostra qual rende mais.</p>

      <div className="space-y-2">
        {rows.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <ColorPicker value={p.color} onChange={(c) => update(i, { color: c })} />
            <input
              value={p.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Nome do pilar"
              className="flex-1 bg-zinc-800 border border-white/8 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
            <button type="button" onClick={() => remove(i)} className="p-2 text-zinc-500 hover:text-red-400 cursor-pointer"><X size={15} /></button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer">
          <Plus size={14} /> Adicionar pilar
        </button>
        {rows.length === 0 && (
          <button type="button" onClick={() => setRows(DEFAULT_PILLARS.map((p) => ({ ...p })))} className="text-xs text-orange-400 hover:underline cursor-pointer">
            usar sugestão
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/8">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl cursor-pointer">
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
          {saving ? "Salvando..." : saved ? "Salvo" : "Salvar pilares"}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-7 h-7 rounded-lg border border-white/15 cursor-pointer" style={{ background: value }} />
      {open && (
        <div className="absolute z-10 top-9 left-0 bg-zinc-800 border border-white/10 rounded-xl p-2 grid grid-cols-4 gap-1.5 shadow-xl">
          {PILLAR_PALETTE.map((c) => (
            <button key={c} type="button" onClick={() => { onChange(c); setOpen(false) }} className="w-6 h-6 rounded-md border border-white/10 cursor-pointer" style={{ background: c }} />
          ))}
        </div>
      )}
    </div>
  )
}
