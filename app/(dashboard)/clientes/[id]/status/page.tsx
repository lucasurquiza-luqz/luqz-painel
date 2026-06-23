"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Activity, CircleCheck, CirclePause, Clock3, Loader2, Save } from "lucide-react"
import { Button, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

type StatusHistory = {
  id: string
  active: boolean
  reason: string | null
  source: "MANUAL" | "ROSTER_IMPORT"
  changedAt: string
  changedBy: { id: string; name: string }
}

type ClientStatus = {
  id: string
  name: string
  active: boolean
  statusReason: string | null
  statusChangedAt: string | null
  clickupFolderId: string | null
  statusHistory: StatusHistory[]
}

export default function StatusClientePage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [client, setClient] = useState<ClientStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ active: true, reason: "" })

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`/api/clients/${clientId}/status`)
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível carregar o status.")
      setLoading(false)
      return
    }
    setClient(payload.client)
    setForm({ active: payload.client.active, reason: payload.client.statusReason ?? "" })
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  async function saveStatus(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const response = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: form.active, statusReason: form.reason }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível alterar o status.")
      setSaving(false)
      return
    }
    setSaving(false)
    await load()
  }

  if (loading) return <main className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></main>

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader eyebrow="Situação da conta" title={`Status · ${client?.name ?? "Cliente"}`} description="Sinalização operacional com motivo, data, responsável e histórico preservado." />
      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <Panel className={cn("overflow-hidden p-6", client?.active ? "border-emerald-400/20" : "border-white/10")}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="dash-eyebrow">Status atual</p><div className="mt-4 flex items-center gap-3">{client?.active ? <CircleCheck size={28} className="text-emerald-400" /> : <CirclePause size={28} className="text-zinc-600" />}<div><p className="dash-display text-3xl text-white">{client?.active ? "Ativo" : "Inativo"}</p><p className="mt-1 text-sm text-zinc-600">{client?.active ? "Conta incluída na operação e nos indicadores da carteira." : "Conta fora da operação ativa, com histórico preservado."}</p></div></div></div>
              <StatusBadge status={client?.active ? "healthy" : "unknown"}>{client?.active ? "Operação ativa" : "Fora da operação"}</StatusBadge>
            </div>
            {!client?.active && client?.statusReason && <div className="mt-6 rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-700">Motivo atual</p><p className="mt-2 text-sm leading-6 text-zinc-400">{client.statusReason}</p></div>}
          </Panel>

          <Panel className="p-6">
            <div className="flex items-center gap-3"><Clock3 size={18} className="text-[#FF8F50]" /><div><h2 className="text-base font-semibold text-white">Histórico de status</h2><p className="mt-1 text-sm text-zinc-600">Mudanças não apagam o estado anterior.</p></div></div>
            <div className="mt-6 space-y-0">
              {client?.statusHistory.length ? client.statusHistory.map((event, index) => (
                <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < client.statusHistory.length - 1 && <div className="absolute bottom-0 left-[7px] top-4 w-px bg-white/8" />}
                  <div className={cn("relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-4 border-[#111111]", event.active ? "bg-emerald-400" : "bg-zinc-600")} />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-zinc-200">{event.active ? "Cliente ativado" : "Cliente inativado"}</p><span className="text-[10px] uppercase tracking-wider text-zinc-700">{event.source === "ROSTER_IMPORT" ? "Roster oficial" : "Alteração manual"}</span></div>{event.reason && <p className="mt-1 text-sm text-zinc-500">{event.reason}</p>}<p className="mt-2 text-xs text-zinc-700">{event.changedBy.name} · {new Date(event.changedAt).toLocaleString("pt-BR")}</p></div>
                </div>
              )) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-700">O status atual é anterior à implantação do histórico.</div>}
            </div>
          </Panel>
        </section>

        <aside>
          <Panel className="sticky top-6 p-5">
            <div className="flex items-center gap-2"><Activity size={17} className="text-[#FF8F50]" /><h2 className="text-base font-semibold text-white">Atualizar status</h2></div>
            <form onSubmit={saveStatus} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm({ active: true, reason: "" })} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium", form.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-zinc-600")}><CircleCheck size={15} /> Ativo</button><button type="button" onClick={() => setForm({ ...form, active: false })} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium", !form.active ? "border-white/20 bg-white/[0.07] text-zinc-200" : "border-white/10 text-zinc-600")}><CirclePause size={15} /> Inativo</button></div>
              {!form.active && <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-400">Motivo da inativação</span><textarea required rows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="dash-input w-full resize-none rounded-lg px-3.5 py-3 text-sm" placeholder="Registre por que a conta saiu da operação ativa." /></label>}
              <Button type="submit" className="w-full" disabled={saving || (client?.active === form.active && (form.active || client?.statusReason === form.reason))}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar alteração</Button>
            </form>
          </Panel>
        </aside>
      </div>
    </main>
  )
}
