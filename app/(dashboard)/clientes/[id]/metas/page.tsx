"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plug, Plus, RefreshCw, Target, Trash2, X } from "lucide-react"
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
        <PageHeader eyebrow="Saúde de resultado" title="Metas / Plano de mídia" description="Alvos por mês e plataforma (verba, leads, CPA, ROAS, ticket) + realizado dos Ads vs meta." />
      </div>

      <AdIntegrations clientId={clientId} onError={setError} />

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
              <RealizadoBlock clientId={clientId} plan={plan} />
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

// === Configuração das contas de Ads + conversão por cliente (funil flexível) ===
type AdAccount = { provider: "META" | "GOOGLE"; accountId: string; lastFour: string | null; objective: string; resultActions: string[]; trackRevenue: boolean }
const OBJECTIVES = [
  { v: "LEAD", label: "Leads" },
  { v: "WHATSAPP", label: "Conversas (WhatsApp)" },
  { v: "ECOMMERCE", label: "Compras (ecommerce)" },
  { v: "CUSTOM", label: "Custom" },
]
function AdIntegrations({ clientId, onError }: { clientId: string; onError: (m: string) => void }) {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [open, setOpen] = useState(false)
  const [meta, setMeta] = useState({ accountId: "", token: "", objective: "LEAD", trackRevenue: false, resultActions: [] as string[] })
  const [google, setGoogle] = useState({ accountId: "", objective: "LEAD", trackRevenue: false })
  const [discovered, setDiscovered] = useState<{ actionType: string; count: number }[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/ad-accounts`)
    if (res.ok) {
      const data = await res.json()
      setAccounts(data.accounts)
      const m = data.accounts.find((a: AdAccount) => a.provider === "META")
      const g = data.accounts.find((a: AdAccount) => a.provider === "GOOGLE")
      if (m) setMeta((s) => ({ ...s, accountId: m.accountId, objective: m.objective, trackRevenue: m.trackRevenue, resultActions: m.resultActions }))
      if (g) setGoogle({ accountId: g.accountId, objective: g.objective, trackRevenue: g.trackRevenue })
    }
  }, [clientId])
  useEffect(() => { void load() }, [load])

  async function save(provider: "META" | "GOOGLE", payload: Record<string, unknown>) {
    setBusy(true); onError("")
    const res = await fetch(`/api/clients/${clientId}/ad-accounts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...payload }),
    })
    setBusy(false)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao salvar conta."); return }
    setMeta((s) => ({ ...s, token: "" }))
    await load()
  }

  async function discover() {
    setBusy(true); onError(""); setDiscovered(null)
    const res = await fetch(`/api/clients/${clientId}/ad-accounts/discover?provider=META`)
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { onError(data.error ?? "Falha ao descobrir eventos."); return }
    setDiscovered(data.actions)
  }

  function toggleAction(a: string) {
    setMeta((s) => ({ ...s, resultActions: s.resultActions.includes(a) ? s.resultActions.filter((x) => x !== a) : [...s.resultActions, a] }))
  }

  const metaAcc = accounts.find((a) => a.provider === "META")
  const googleAcc = accounts.find((a) => a.provider === "GOOGLE")

  return (
    <Panel className="p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Plug size={15} className="text-[#FF8F50]" /> Integrações de Ads & conversão</span>
        <span className="text-xs text-zinc-500">{metaAcc ? "Meta ✓" : "Meta —"} · {googleAcc ? "Google ✓" : "Google —"}</span>
      </button>
      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Meta */}
          <div className="rounded-lg border border-white/8 bg-black/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-zinc-300">Meta Ads (token por cliente)</p>
            <Input value={meta.accountId} onChange={(e) => setMeta({ ...meta, accountId: e.target.value })} placeholder="act_XXXXXXXX" />
            <Input type="password" value={meta.token} onChange={(e) => setMeta({ ...meta, token: e.target.value })} placeholder={metaAcc?.lastFour ? `token salvo ••••${metaAcc.lastFour} — trocar` : "access token"} />
            <select value={meta.objective} onChange={(e) => setMeta({ ...meta, objective: e.target.value, trackRevenue: e.target.value === "ECOMMERCE" })} className="dash-input min-h-9 w-full rounded-lg px-3 py-2 text-sm">
              {OBJECTIVES.map((o) => <option key={o.v} value={o.v}>Objetivo: {o.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={meta.trackRevenue} onChange={(e) => setMeta({ ...meta, trackRevenue: e.target.checked })} /> Acompanhar receita / ROAS</label>
            <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" disabled={busy || !metaAcc} onClick={discover}>Descobrir eventos da conta</Button>
            {discovered && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-white/8 bg-black/30 p-2">
                {discovered.length === 0 && <p className="text-[11px] text-zinc-600">Nenhum evento nos últimos 90d.</p>}
                {discovered.map((d) => (
                  <label key={d.actionType} className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <input type="checkbox" checked={meta.resultActions.includes(d.actionType)} onChange={() => toggleAction(d.actionType)} />
                    <span className="truncate">{d.actionType}</span><span className="ml-auto text-zinc-600">{d.count}</span>
                  </label>
                ))}
              </div>
            )}
            {meta.resultActions.length > 0 && <p className="text-[11px] text-[#FFB185]">{meta.resultActions.length} evento(s) marcado(s) como resultado.</p>}
            <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" disabled={busy || !meta.accountId} onClick={() => save("META", meta)}>Salvar Meta</Button>
          </div>
          {/* Google */}
          <div className="rounded-lg border border-white/8 bg-black/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-zinc-300">Google Ads (MCC central)</p>
            <Input value={google.accountId} onChange={(e) => setGoogle({ ...google, accountId: e.target.value })} placeholder="customer id (ex: 1284541690)" />
            <select value={google.objective} onChange={(e) => setGoogle({ ...google, objective: e.target.value, trackRevenue: e.target.value === "ECOMMERCE" })} className="dash-input min-h-9 w-full rounded-lg px-3 py-2 text-sm">
              {OBJECTIVES.map((o) => <option key={o.v} value={o.v}>Objetivo: {o.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={google.trackRevenue} onChange={(e) => setGoogle({ ...google, trackRevenue: e.target.checked })} /> Acompanhar receita / ROAS</label>
            <p className="text-[11px] text-zinc-600">Conversões do Google entram automático (sem token aqui — usa o MCC do ambiente).</p>
            <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" disabled={busy || !google.accountId} onClick={() => save("GOOGLE", google)}>Salvar Google</Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

// === Realizado vs meta — funil (gasto → cliques → resultado → ROAS) ===
type ProviderRow = { provider: string; spend?: number; results?: number; cpa?: number | null; revenue?: number | null; roas?: number | null; error?: string }
type Realizado = {
  byProvider: ProviderRow[]
  total: { spend: number; impressions: number; clicks: number; results: number; cpa: number | null; revenue: number | null; roas: number | null }
  objective: string | null
  trackRevenue: boolean
  configured: boolean
}
const OBJ_RESULT_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", CUSTOM: "Resultados" }
function RealizadoBlock({ clientId, plan }: { clientId: string; plan: Plan }) {
  const [data, setData] = useState<Realizado | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  async function fetchRealizado() {
    setLoading(true); setErr("")
    const res = await fetch(`/api/clients/${clientId}/realizado?month=${plan.month}`)
    const payload = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(payload.error ?? "Falha ao ler Ads."); return }
    setData(payload.realizado)
  }

  const pct = (real: number, target: number | null) => (target && target > 0 ? Math.round((real / target) * 100) : null)
  const resultLabel = data?.objective ? OBJ_RESULT_LABEL[data.objective] ?? "Resultados" : "Resultados"

  return (
    <div className="mt-4 border-t border-white/8 pt-3">
      {!data ? (
        <>
          <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={fetchRealizado} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Ver realizado do mês
          </Button>
          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#FFB185]">Realizado (funil)</span>
            <button onClick={fetchRealizado} className="text-xs text-zinc-500 hover:text-zinc-300" disabled={loading}>{loading ? "..." : "atualizar"}</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label={`Gasto${plan.budget ? ` (${pct(data.total.spend, plan.budget)}%)` : ""}`} value={brl(data.total.spend)} />
            <Metric label="Cliques" value={data.total.clicks.toLocaleString("pt-BR")} />
            <Metric label={`${resultLabel}${plan.targetLeads ? ` (${pct(data.total.results, plan.targetLeads)}%)` : ""}`} value={String(data.total.results)} />
            <Metric label={`CPA${plan.targetCpa ? (data.total.cpa && data.total.cpa <= plan.targetCpa ? " ✓" : " ⚠") : ""}`} value={brl(data.total.cpa)} />
          </div>
          {data.trackRevenue && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Receita" value={brl(data.total.revenue)} />
              <Metric label={`ROAS${plan.targetRoas ? (data.total.roas && data.total.roas >= plan.targetRoas ? " ✓" : " ⚠") : ""}`} value={data.total.roas != null ? `${data.total.roas.toFixed(2)}x` : "—"} />
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600">
            {data.byProvider.map((p) => (
              <span key={p.provider} className="rounded bg-white/5 px-2 py-0.5">
                {p.provider}: {p.error ? `erro (${p.error})` : `${brl(p.spend ?? 0)} · ${p.results} ${resultLabel.toLowerCase()}`}
              </span>
            ))}
            {!data.configured && <span className="text-amber-300/70">Nenhuma conta de Ads configurada acima.</span>}
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}
    </div>
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
