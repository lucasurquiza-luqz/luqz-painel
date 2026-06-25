"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Target, Trash2, X } from "lucide-react"
import { Button, Input, PageHeader, Panel } from "@/components/ui/primitives"

type Plan = {
  id: string
  month: string
  platform: "META" | "GOOGLE" | "TOTAL"
  budget: number | null
  targetLeads: number | null
  targetCpa: number | null
  targetRoas: number | null
  targetTicket: number | null
  notes: string | null
  createdBy: { name: string }
}

const PLATFORM_LABEL: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads", TOTAL: "Consolidado" }

function fmtMonth(month: string): string {
  const [y, m] = month.split("-")
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  return `${names[Number(m) - 1] ?? m}/${y}`
}
function brl(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
function currentMonth(): string {
  // Sem Date.now em util compartilhado, mas aqui no client tudo bem.
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function MetasPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/media-plans`)
    const payload = await res.json()
    if (res.ok) setPlans(payload.plans)
    else setError(payload.error ?? "Não foi possível carregar as metas.")
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  async function remove(plan: Plan) {
    setError("")
    const res = await fetch(`/api/clients/${clientId}/media-plans/${plan.id}`, { method: "DELETE" })
    if (!res.ok) { setError((await res.json()).error ?? "Erro ao remover."); return }
    await load()
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link href={`/clientes/${clientId}`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100">
          <ArrowLeft size={18} />
        </Link>
        <PageHeader eyebrow="Saúde de resultado" title="Metas / Plano de mídia" description="Defina os alvos por mês e plataforma (verba, leads, CPA, ROAS, ticket). O realizado virá da integração de Ads." />
      </div>

      <div className="flex justify-end"><Button onClick={() => setAdding((v) => !v)}><Plus size={16} /> Nova meta</Button></div>

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {adding && <AddPlan clientId={clientId} onAdded={() => { setAdding(false); void load() }} onCancel={() => setAdding(false)} onError={setError} />}

      {loading ? (
        <Panel className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : plans.length === 0 ? (
        <Panel className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
          <Target size={30} className="text-zinc-700" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-300">Nenhuma meta definida</h3>
          <p className="mt-2 max-w-sm text-sm text-zinc-600">Defina o plano de mídia do mês para acompanhar realizado vs meta quando a integração de Ads estiver no ar.</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <Panel key={plan.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{fmtMonth(plan.month)}</span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">{PLATFORM_LABEL[plan.platform]}</span>
                </div>
                <button onClick={() => remove(plan)} className="text-zinc-600 hover:text-red-400" aria-label="Remover"><Trash2 size={15} /></button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Metric label="Verba" value={brl(plan.budget)} />
                <Metric label="Leads" value={plan.targetLeads != null ? String(plan.targetLeads) : "—"} />
                <Metric label="CPA alvo" value={brl(plan.targetCpa)} />
                <Metric label="ROAS alvo" value={plan.targetRoas != null ? `${plan.targetRoas}x` : "—"} />
                <Metric label="Ticket" value={brl(plan.targetTicket)} />
              </div>
              {plan.notes && <p className="mt-3 text-xs leading-5 text-zinc-500">{plan.notes}</p>}
            </Panel>
          ))}
        </div>
      )}
    </main>
  )
}

function AddPlan({ clientId, onAdded, onCancel, onError }: { clientId: string; onAdded: () => void; onCancel: () => void; onError: (m: string) => void }) {
  const [form, setForm] = useState({
    month: currentMonth(),
    platform: "TOTAL",
    budget: "",
    targetLeads: "",
    targetCpa: "",
    targetRoas: "",
    targetTicket: "",
    notes: "",
  })
  const [busy, setBusy] = useState(false)

  const dec = (value: string) => {
    const cleaned = value.trim().replace(/\./g, "").replace(",", ".")
    return cleaned ? Number(cleaned) : null
  }

  async function submit() {
    if (!form.month) { onError("Informe o mês."); return }
    setBusy(true)
    onError("")
    const res = await fetch(`/api/clients/${clientId}/media-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: form.month,
        platform: form.platform,
        budget: dec(form.budget),
        targetLeads: form.targetLeads.trim() ? Number(form.targetLeads.trim()) : null,
        targetCpa: dec(form.targetCpa),
        targetRoas: dec(form.targetRoas),
        targetTicket: dec(form.targetTicket),
        notes: form.notes,
      }),
    })
    setBusy(false)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao salvar meta."); return }
    onAdded()
  }

  return (
    <Panel className="space-y-4 border-[#FF8F50]/20 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Nova meta</h2>
        <button onClick={onCancel} className="text-zinc-600 hover:text-white"><X size={18} /></button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Mês"><Input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="[color-scheme:dark]" /></FormField>
        <FormField label="Plataforma">
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm">
            <option value="TOTAL">Consolidado</option>
            <option value="META">Meta Ads</option>
            <option value="GOOGLE">Google Ads</option>
          </select>
        </FormField>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Verba (R$)"><Input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="8000,00" inputMode="decimal" /></FormField>
        <FormField label="Meta de leads"><Input value={form.targetLeads} onChange={(e) => setForm({ ...form, targetLeads: e.target.value })} placeholder="200" inputMode="numeric" /></FormField>
        <FormField label="CPA alvo (R$)"><Input value={form.targetCpa} onChange={(e) => setForm({ ...form, targetCpa: e.target.value })} placeholder="40,00" inputMode="decimal" /></FormField>
        <FormField label="ROAS alvo"><Input value={form.targetRoas} onChange={(e) => setForm({ ...form, targetRoas: e.target.value })} placeholder="3,5" inputMode="decimal" /></FormField>
        <FormField label="Ticket médio (R$)"><Input value={form.targetTicket} onChange={(e) => setForm({ ...form, targetTicket: e.target.value })} placeholder="1500,00" inputMode="decimal" /></FormField>
      </div>
      <FormField label="Observações">
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="dash-input w-full resize-none rounded-lg px-3.5 py-3 text-sm" placeholder="Contexto do plano do mês." />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Salvar meta</Button>
      </div>
    </Panel>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
      <p className="text-[11px] text-zinc-600">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>{children}</label>
}
