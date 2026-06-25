"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, Pencil, Target } from "lucide-react"
import { Button, Input, Panel } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

type TeamMember = { id: string; name: string }
type NextAction = {
  id: string
  description: string
  dueAt: string | null
  responsible: { id: string; name: string } | null
}

function fmtDue(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("pt-BR")
}

function isOverdue(value: string | null) {
  if (!value) return false
  const due = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function NextActionCard({ clientId }: { clientId: string }) {
  const [current, setCurrent] = useState<NextAction | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [description, setDescription] = useState("")
  const [responsibleId, setResponsibleId] = useState("")
  const [dueAt, setDueAt] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/next-action`)
    const payload = await res.json()
    if (res.ok) {
      setCurrent(payload.current)
      setTeam(payload.team ?? [])
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  function startEdit() {
    setDescription(current?.description ?? "")
    setResponsibleId(current?.responsible?.id ?? "")
    setDueAt(current?.dueAt ? current.dueAt.slice(0, 10) : "")
    setError("")
    setEditing(true)
  }

  async function save() {
    if (!description.trim()) { setError("Descreva a próxima ação."); return }
    setSaving(true)
    setError("")
    const res = await fetch(`/api/clients/${clientId}/next-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, responsibleId: responsibleId || null, dueAt: dueAt || null }),
    })
    const payload = await res.json()
    setSaving(false)
    if (!res.ok) { setError(payload.error ?? "Não foi possível salvar."); return }
    setEditing(false)
    await load()
  }

  async function complete() {
    if (!current) return
    setSaving(true)
    await fetch(`/api/clients/${clientId}/next-action/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DONE" }),
    })
    setSaving(false)
    await load()
  }

  const overdue = isOverdue(current?.dueAt ?? null)

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#FF8F50]" />
          <h2 className="text-sm font-semibold text-white">Próxima ação</h2>
        </div>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1 text-xs font-medium text-[#FFB185] hover:text-[#FFD482]">
            <Pencil size={12} /> {current ? "Trocar" : "Definir"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-4 flex min-h-12 items-center justify-center"><Loader2 size={16} className="animate-spin text-[#FF8F50]" /></div>
      ) : editing ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que precisa ser feito agora?"
            rows={2}
            className="dash-input w-full rounded-lg px-3.5 py-2.5 text-sm"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={responsibleId}
              onChange={(e) => setResponsibleId(e.target.value)}
              className="dash-input min-h-11 flex-1 rounded-lg px-3 py-2.5 text-sm"
              aria-label="Responsável"
            >
              <option value="">Sem responsável</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="min-h-11 sm:w-44" />
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
            <Button className="min-h-9 px-3 text-xs" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Salvar
            </Button>
          </div>
        </div>
      ) : current ? (
        <div className="mt-3">
          <p className="text-sm leading-6 text-zinc-200">{current.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-zinc-500">Responsável: <span className="text-zinc-300">{current.responsible?.name ?? "—"}</span></span>
            {current.dueAt && (
              <span className={cn(overdue ? "text-red-300" : "text-zinc-500")}>
                Prazo: {fmtDue(current.dueAt)}{overdue ? " · atrasada" : ""}
              </span>
            )}
            <button onClick={complete} disabled={saving} className="ml-auto flex items-center gap-1 font-medium text-emerald-300 hover:text-emerald-200">
              <CheckCircle2 size={13} /> Concluir
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">Nenhuma ação definida. Clique em “Definir” para registrar quem age, o quê e até quando.</p>
      )}
    </Panel>
  )
}
