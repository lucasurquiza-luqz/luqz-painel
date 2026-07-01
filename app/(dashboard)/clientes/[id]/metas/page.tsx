"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Pencil, Plug, Plus, RefreshCw, Target, Trash2, X } from "lucide-react"
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button, Input, PageHeader, Panel } from "@/components/ui/primitives"
import { projectFunnel, type FunnelStage, type PlanFunnel } from "@/lib/media-plan"

type Plan = {
  id: string
  month: string
  platform: "META" | "GOOGLE" | "TOTAL"
  budget: number | null
  targetLeads: number | null
  targetCpa: number | null
  targetCpl: number | null
  targetRoas: number | null
  targetTicket: number | null
  objective: string | null
  funnel: FunnelStage[] | null
  funnels: PlanFunnel[]
  narrative: string | null
  funnelId: string | null
  campaignFunnel: { id: string; name: string } | null
  notes: string | null
  createdBy: { name: string }
}
const OBJ_OPTIONS = [{ v: "LEAD", label: "Leads" }, { v: "WHATSAPP", label: "Conversas" }, { v: "ECOMMERCE", label: "Compras" }, { v: "SEGUIDORES", label: "Seguidores" }]
const projectPlanFunnel = (sf: PlanFunnel) => projectFunnel({ budget: sf.budget, cpl: sf.cpl, targetLeads: null, stages: sf.stages, ticket: sf.ticket })
type InsightRow = { id: string; text: string; createdByName: string | null; createdAt: string }

const PLATFORM_LABEL: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads", TOTAL: "Consolidado" }

function fmtMonth(month: string): string {
  const [y, m] = month.split("-")
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  return `${names[Number(m) - 1] ?? m}/${y}`
}
function brl(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
// Tempo relativo curto (para "atualizado há…").
function relAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return "agora"
  if (m < 60) return `há ${m}min`
  if (h < 24) return `há ${h}h`
  return `há ${d}d`
}
function currentMonth(): string {
  // Sem Date.now em util compartilhado, mas aqui no client tudo bem.
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

// Cache de GETs em memória (TTL 2min) — troca de aba/fonte no mesmo período não refaz a chamada.
const _perfCache = new Map<string, { at: number; data: unknown }>()
async function cachedJson(url: string): Promise<{ ok: boolean; data: { error?: string; [k: string]: unknown } }> {
  const hit = _perfCache.get(url)
  if (hit && Date.now() - hit.at < 120_000) return { ok: true, data: hit.data as Record<string, unknown> }
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (res.ok) _perfCache.set(url, { at: Date.now(), data })
  return { ok: res.ok, data }
}
const clearPerfCache = () => _perfCache.clear()

// Seleção de período: mês fechado (com cache) ou intervalo de dias (ao vivo).
type RangeSel = { since: string; until: string; month: string | null; label: string }
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
function monthSel(ym: string): RangeSel {
  const [y, m] = ym.split("-").map(Number)
  const last = new Date(y, m, 0).getDate()
  return { since: `${ym}-01`, until: `${ym}-${String(last).padStart(2, "0")}`, month: ym, label: fmtMonth(ym) }
}
function prevMonthSel(): RangeSel {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
  return monthSel(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
}
function lastDaysSel(n: number): RangeSel {
  const until = new Date(), since = new Date()
  since.setDate(since.getDate() - (n - 1))
  return { since: isoDay(since), until: isoDay(until), month: null, label: `Últimos ${n} dias` }
}
function daySel(offsetDays: number, label: string): RangeSel {
  const d = new Date(); d.setDate(d.getDate() - offsetDays)
  const iso = isoDay(d)
  return { since: iso, until: iso, month: null, label }
}

export default function MetasPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [campaignFunnels, setCampaignFunnels] = useState<{ id: string; name: string }[]>([])
  useEffect(() => { fetch(`/api/clients/${clientId}/funnels`).then((r) => r.json()).then((d) => setCampaignFunnels(d.funnels ?? [])).catch(() => {}) }, [clientId])
  const funnelName = (fid: string | null) => (fid ? campaignFunnels.find((f) => f.id === fid)?.name ?? null : null)

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
        <PageHeader eyebrow="Saúde de resultado" title="Performance" description="Metas + realizado dos Ads por funil (lead, conversa, compra), vs meta. Multi-fonte: Meta + Google (+ vendas em breve)." />
      </div>

      <AdIntegrations clientId={clientId} onError={setError} />

      <ConversionsReview clientId={clientId} />

      <PerformanceDashboard clientId={clientId} plans={plans} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Metas por mês</h2>
        <Button onClick={() => setAdding((v) => !v)}><Plus size={16} /> Nova meta</Button>
      </div>

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {adding && <AddPlan clientId={clientId} onAdded={() => { setAdding(false); void load() }} onCancel={() => setAdding(false)} onError={setError} />}
      {editingPlan && <AddPlan clientId={clientId} plan={editingPlan} onAdded={() => { setEditingPlan(null); void load() }} onCancel={() => setEditingPlan(null)} onError={setError} />}

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
              {(() => {
                const totalBudget = plan.funnels.reduce((s, f) => s + (f.budget ?? 0), 0) || plan.budget
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{fmtMonth(plan.month)}</span>
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">{PLATFORM_LABEL[plan.platform]}</span>
                      <span className="text-[11px] text-zinc-500">{plan.funnels.length} funil(s) · {brl(totalBudget)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setAdding(false); setEditingPlan(plan); window.scrollTo({ top: 0, behavior: "smooth" }) }} className="rounded-md p-1 text-zinc-600 hover:text-[#FFB185]" aria-label="Editar"><Pencil size={14} /></button>
                      <button onClick={() => remove(plan)} className="rounded-md p-1 text-zinc-600 hover:text-red-400" aria-label="Remover"><Trash2 size={15} /></button>
                    </div>
                  </div>
                )
              })()}
              {plan.funnels.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {plan.funnels.map((sf) => <SubFunnelCard key={sf.id} sf={sf} campaignName={funnelName(sf.campaignFunnelId)} />)}
                </div>
              ) : (
                <p className="mt-4 text-xs text-zinc-600">Plano sem funis. Clique em editar para adicionar.</p>
              )}
              {plan.narrative && (
                <div className="mt-3 rounded-lg border border-white/8 bg-black/20 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Estratégia / cenários</p>
                  <p className="whitespace-pre-wrap text-xs leading-5 text-zinc-400">{plan.narrative}</p>
                </div>
              )}
              {plan.notes && <p className="mt-3 text-xs leading-5 text-zinc-500">{plan.notes}</p>}
            </Panel>
          ))}
        </div>
      )}
    </main>
  )
}

// Card de um sub-funil no plano (projeção + objetivo + funil de campanha).
function SubFunnelCard({ sf, campaignName }: { sf: PlanFunnel; campaignName: string | null }) {
  const proj = projectPlanFunnel(sf)
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-100">{sf.name}</span>
        {sf.platform && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-zinc-300">{PLATFORM_LABEL[sf.platform] ?? sf.platform}</span>}
        <span className="rounded bg-[#FF8F50]/15 px-1.5 py-0.5 text-[10px] text-[#FFB185]">{OBJ_LABEL[sf.objective] ?? sf.objective}</span>
        {campaignName && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">🎯 {campaignName}</span>}
        <span className="ml-auto text-[11px] text-zinc-500">{brl(sf.budget)}{sf.cpl ? ` · CPL ${brl(sf.cpl)}` : ""}</span>
      </div>
      {proj.rows.length > 0 && (
        <>
          <div className="space-y-1">
            {proj.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="w-36 shrink-0 text-zinc-400">{r.label}</span>
                <span className="font-semibold text-zinc-100">{Math.round(r.value).toLocaleString("pt-BR")}</span>
                {r.rate != null && <span className="text-[10px] text-zinc-600">({Math.round(r.rate * 100)}%)</span>}
                <span className="ml-auto flex items-center gap-3">
                  {r.revenue != null && <span className="text-[11px] text-emerald-300/80">{brl(r.revenue)}</span>}
                  {r.cost != null && <span className="text-[10px] text-zinc-500">{brl(r.cost)}/un</span>}
                </span>
              </div>
            ))}
          </div>
          {(proj.revenue != null || proj.roas != null) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 pt-2 text-[11px]">
              {proj.revenue != null && <span className="text-zinc-400">Receita proj.: <b className="text-emerald-300">{brl(proj.revenue)}</b></span>}
              {proj.roas != null && <span className="text-zinc-400">ROAS proj.: <b className="text-emerald-300">{proj.roas.toFixed(2)}x</b></span>}
              {proj.cac != null && <span className="text-zinc-400">CAC: <b className="text-zinc-200">{brl(proj.cac)}</b></span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

type StageForm = { label: string; ratePct: string; ticket: string }
type FunnelForm = { id: string; name: string; objective: string; platform: string; campaignFunnelId: string; budget: string; cpl: string; ticket: string; stages: StageForm[] }
const PLATFORM_OPTS = [{ v: "META", label: "Meta Ads" }, { v: "GOOGLE", label: "Google Ads" }]
const numStr = (n: number | null) => (n != null ? String(n) : "")
const decBR = (v: string) => { const c = v.trim().replace(/\./g, "").replace(",", "."); return c ? Number(c) : null }
const defaultStages = (): StageForm[] => [{ label: "Leads", ratePct: "", ticket: "" }, { label: "Qualificados", ratePct: "40", ticket: "" }, { label: "Vendas", ratePct: "50", ticket: "" }]
let _fseq = 0
const newFunnelForm = (): FunnelForm => ({ id: `nf${_fseq++}`, name: "", objective: "LEAD", platform: "META", campaignFunnelId: "", budget: "", cpl: "", ticket: "", stages: defaultStages() })
const funnelFormFromPlan = (sf: PlanFunnel): FunnelForm => ({
  id: sf.id || `nf${_fseq++}`, name: sf.name, objective: sf.objective, platform: sf.platform ?? "META", campaignFunnelId: sf.campaignFunnelId ?? "",
  budget: numStr(sf.budget), cpl: numStr(sf.cpl), ticket: numStr(sf.ticket),
  stages: sf.stages.length ? sf.stages.map((s, i) => ({ label: s.label, ratePct: i === 0 || s.rate == null ? "" : String(Math.round((s.rate ?? 0) * 1000) / 10), ticket: s.ticket != null ? String(s.ticket) : "" })) : defaultStages(),
})
const funnelFormToPlan = (f: FunnelForm): PlanFunnel => ({
  id: f.id, name: f.name.trim(), objective: f.objective, platform: f.platform || null, campaignFunnelId: f.campaignFunnelId || null,
  budget: decBR(f.budget), cpl: decBR(f.cpl), ticket: decBR(f.ticket),
  stages: f.stages.filter((s) => s.label.trim()).map((s, i) => ({ label: s.label.trim(), rate: i === 0 ? null : (s.ratePct.trim() ? Number(s.ratePct.replace(",", ".")) / 100 : 0), ticket: decBR(s.ticket) })),
})

function AddPlan({ clientId, plan, onAdded, onCancel, onError }: { clientId: string; plan?: Plan; onAdded: () => void; onCancel: () => void; onError: (m: string) => void }) {
  const editing = !!plan
  const [form, setForm] = useState({ month: plan?.month ?? currentMonth(), platform: String(plan?.platform ?? "TOTAL"), narrative: plan?.narrative ?? "", notes: plan?.notes ?? "" })
  const [funnels, setFunnels] = useState<FunnelForm[]>(plan?.funnels?.length ? plan.funnels.map(funnelFormFromPlan) : [newFunnelForm()])
  const [campaignFunnels, setCampaignFunnels] = useState<{ id: string; name: string }[]>([])
  useEffect(() => { fetch(`/api/clients/${clientId}/funnels`).then((r) => r.json()).then((d) => setCampaignFunnels(d.funnels ?? [])).catch(() => {}) }, [clientId])
  const [busy, setBusy] = useState(false)

  const setF = (id: string, patch: Partial<FunnelForm>) => setFunnels((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const addF = () => setFunnels((fs) => [...fs, newFunnelForm()])
  const delF = (id: string) => setFunnels((fs) => fs.filter((f) => f.id !== id))
  const totalBudget = funnels.reduce((s, f) => s + (decBR(f.budget) ?? 0), 0)

  async function submit() {
    if (!form.month) { onError("Informe o mês."); return }
    const payloadFunnels = funnels.filter((f) => f.name.trim()).map(funnelFormToPlan)
    if (!payloadFunnels.length) { onError("Adicione ao menos um funil com nome."); return }
    setBusy(true); onError("")
    const body = { month: form.month, platform: form.platform, narrative: form.narrative, notes: form.notes, funnels: payloadFunnels }
    const res = await fetch(editing ? `/api/clients/${clientId}/media-plans/${plan!.id}` : `/api/clients/${clientId}/media-plans`, {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao salvar plano."); return }
    onAdded()
  }

  return (
    <Panel className="space-y-4 border-[#FF8F50]/20 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{editing ? "Editar plano de mídia" : "Novo plano de mídia"}</h2>
        <button onClick={onCancel} className="text-zinc-600 hover:text-white"><X size={18} /></button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Mês"><Input type="month" value={form.month} disabled={editing} onChange={(e) => setForm({ ...form, month: e.target.value })} className="[color-scheme:dark] disabled:opacity-50" /></FormField>
        <FormField label="Plataforma">
          <select value={form.platform} disabled={editing} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm disabled:opacity-50">
            <option value="TOTAL">Consolidado</option>
            <option value="META">Meta Ads</option>
            <option value="GOOGLE">Google Ads</option>
          </select>
        </FormField>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-300">Funis do plano · total {brl(totalBudget)}</p>
        <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={addF}><Plus size={14} /> funil</Button>
      </div>
      <div className="space-y-3">
        {funnels.map((f, idx) => <SubFunnelEditor key={f.id} f={f} idx={idx} campaignFunnels={campaignFunnels} onChange={(p) => setF(f.id, p)} onRemove={funnels.length > 1 ? () => delF(f.id) : undefined} />)}
      </div>

      <FormField label="Estratégia / cenários / controle semanal (opcional)">
        <textarea rows={4} value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} className="dash-input w-full resize-none rounded-lg px-3.5 py-3 text-sm" placeholder="Diagnóstico, cenários (conservador/realista), metas semanais…" />
      </FormField>
      <FormField label="Observações">
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="dash-input w-full resize-none rounded-lg px-3.5 py-3 text-sm" placeholder="Contexto do plano do mês." />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Salvar plano</Button>
      </div>
    </Panel>
  )
}

// Editor de um sub-funil (nome, objetivo, funil de campanha, verba, CPL, etapas).
function SubFunnelEditor({ f, idx, campaignFunnels, onChange, onRemove }: { f: FunnelForm; idx: number; campaignFunnels: { id: string; name: string }[]; onChange: (p: Partial<FunnelForm>) => void; onRemove?: () => void }) {
  const setStage = (i: number, patch: Partial<StageForm>) => onChange({ stages: f.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const addStage = () => onChange({ stages: [...f.stages, { label: "", ratePct: "30", ticket: "" }] })
  const delStage = (i: number) => onChange({ stages: f.stages.filter((_, j) => j !== i) })
  const preview = projectPlanFunnel(funnelFormToPlan(f))
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-zinc-500">Funil {idx + 1}</span>
        {onRemove && <button onClick={onRemove} className="ml-auto text-zinc-600 hover:text-red-300"><Trash2 size={14} /></button>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Nome do funil"><Input value={f.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Captação / Impulsionar…" /></FormField>
        <FormField label="Plataforma"><select value={f.platform} onChange={(e) => onChange({ platform: e.target.value })} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm">{PLATFORM_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select></FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Objetivo"><select value={f.objective} onChange={(e) => onChange({ objective: e.target.value })} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm">{OBJ_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select></FormField>
        <FormField label="Funil de campanha (realizado)"><select value={f.campaignFunnelId} onChange={(e) => onChange({ campaignFunnelId: e.target.value })} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm"><option value="">— nenhum —</option>{campaignFunnels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <FormField label="Verba (R$)"><Input value={f.budget} onChange={(e) => onChange({ budget: e.target.value })} placeholder="8000,00" inputMode="decimal" /></FormField>
        <FormField label="CPL/CPF alvo (R$)"><Input value={f.cpl} onChange={(e) => onChange({ cpl: e.target.value })} placeholder="12,00" inputMode="decimal" /></FormField>
        <FormField label="Ticket global (opcional)"><Input value={f.ticket} onChange={(e) => onChange({ ticket: e.target.value })} placeholder="750,00" inputMode="decimal" /></FormField>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-zinc-400">Etapas do funil</p>
          <button onClick={addStage} className="text-[11px] text-[#FFB185] hover:underline">+ etapa</button>
        </div>
        <div className="mb-1 flex items-center gap-2 px-1 text-[10px] text-zinc-600"><span className="flex-1">Etapa</span><span className="w-16 text-center">Taxa</span><span className="w-24 text-center">Receita/un</span><span className="w-5" /></div>
        <div className="space-y-2">
          {f.stages.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={s.label} onChange={(e) => setStage(i, { label: e.target.value })} placeholder={i === 0 ? "Topo (Leads/Seguidores)" : "Etapa"} className="flex-1" />
              {i === 0 ? <span className="w-16 shrink-0 text-center text-[9px] text-zinc-600">topo</span> : <div className="flex w-16 shrink-0 items-center gap-1"><Input value={s.ratePct} onChange={(e) => setStage(i, { ratePct: e.target.value })} placeholder="40" inputMode="decimal" className="text-center" /><span className="text-xs text-zinc-500">%</span></div>}
              <Input value={s.ticket} onChange={(e) => setStage(i, { ticket: e.target.value })} placeholder="—" inputMode="decimal" className="w-24 shrink-0 text-center" />
              {f.stages.length > 1 ? <button onClick={() => delStage(i)} className="w-5 shrink-0 text-zinc-600 hover:text-red-300"><Trash2 size={13} /></button> : <span className="w-5" />}
            </div>
          ))}
        </div>
        {preview.rows.length > 0 && (f.budget || f.cpl) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/8 pt-2 text-[11px] text-zinc-500">
            <span>Prévia:</span>
            {preview.rows.map((r, i) => <span key={i} className="text-zinc-400">{r.label} <b className="text-zinc-200">{Math.round(r.value).toLocaleString("pt-BR")}</b></span>)}
            {preview.roas != null && <span className="text-emerald-300">ROAS {preview.roas.toFixed(2)}x</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// === Painel Performance (visual + leitura de IA) ===
type Totals = { spend: number; impressions: number; clicks: number; pageViews: number; results: number; followers: number; cpa: number | null; revenue: number | null; roas: number | null; ctr: number | null; cpc: number | null; cpm: number | null }
type Bd = { objective: string; count: number }[]
type DlyPoint = { date: string; spend: number; results: number; impressions: number; clicks: number; pageViews: number; revenue: number }
type Dly = DlyPoint[]
type ProviderMetrics = { provider: string; error?: string; spend?: number; impressions?: number; clicks?: number; pageViews?: number; results?: number; followers?: number; cpa?: number | null; revenue?: number | null; roas?: number | null; breakdown?: Bd; daily?: Dly }
type Perf = {
  month: string
  current: {
    total: Totals
    breakdown: Bd
    daily: Dly
    byProvider: ProviderMetrics[]
    trackRevenue: boolean
    configured: boolean
  }
  previous: { spend: number; results: number; cpa: number | null; roas: number | null }
}
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", SEGUIDORES: "Seguidores", CUSTOM: "Resultados" }

function Trend({ cur, prev, goodWhenUp = true }: { cur: number | null; prev: number | null; goodWhenUp?: boolean }) {
  if (cur == null || prev == null || prev === 0) return null
  const delta = Math.round(((cur - prev) / prev) * 100)
  if (delta === 0) return <span className="text-[10px] text-zinc-600">estável</span>
  const up = delta > 0
  const good = up === goodWhenUp
  return <span className={`text-[10px] ${good ? "text-emerald-400" : "text-red-400"}`}>{up ? "▲" : "▼"} {Math.abs(delta)}% vs mês ant.</span>
}

// Mini-gráfico de tendência (SVG leve, sem dependência de chart).
function Sparkline({ data, color = "#FF8F50" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const w = 100, h = 26
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`).join(" ")
  const gid = `spk-${color.replace("#", "")}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-2 h-7 w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ label, value, pct, trend, spark, sparkColor }: { label: string; value: string; pct?: number | null; trend?: React.ReactNode; spark?: number[]; sparkColor?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="dash-display mt-1 text-2xl text-white">{value}</p>
      {pct != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[#FF8F50]" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
      {pct != null && <p className="mt-1 text-[10px] text-zinc-600">{pct}% da meta</p>}
      {trend && <div className="mt-1">{trend}</div>}
      {spark && spark.length > 1 && <Sparkline data={spark} color={sparkColor} />}
    </div>
  )
}

const tooltipStyle = { background: "#161616", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }

// Registro de métricas plotáveis na evolução diária.
type MetricKey = "spend" | "results" | "cpa" | "impressions" | "clicks" | "pageViews" | "ctr" | "cpc" | "revenue"
type MetricDef = { label: string; color: string; fmt: (v: number) => string }
const fmtInt = (v: number) => Math.round(v).toLocaleString("pt-BR")

// Evolução diária: até 2 métricas selecionáveis (área no eixo esq. + linha no eixo dir.).
function DailyChart({ daily, resultLabel, trackRevenue }: { daily: DlyPoint[]; resultLabel: string; trackRevenue: boolean }) {
  const METRICS: Record<MetricKey, MetricDef> = {
    spend: { label: "Investimento", color: "#FF8F50", fmt: brl },
    results: { label: resultLabel, color: "#38bdf8", fmt: fmtInt },
    cpa: { label: "CPA", color: "#fca5a5", fmt: brl },
    impressions: { label: "Impressões", color: "#a78bfa", fmt: fmtInt },
    clicks: { label: "Cliques", color: "#34d399", fmt: fmtInt },
    pageViews: { label: "Page views", color: "#fbbf24", fmt: fmtInt },
    ctr: { label: "CTR", color: "#f472b6", fmt: (v) => `${v.toFixed(2)}%` },
    cpc: { label: "CPC", color: "#22d3ee", fmt: brl },
    revenue: { label: "Receita", color: "#4ade80", fmt: brl },
  }
  const [sel, setSel] = useState<MetricKey[]>(["spend", "results"])
  const toggle = (k: MetricKey) =>
    setSel((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].slice(-2)))

  // Chips disponíveis conforme a presença de dados.
  const hasPv = daily.some((d) => d.pageViews > 0)
  const chips = (["spend", "results", "cpa", "impressions", "clicks", "ctr", "cpc"] as MetricKey[])
    .concat(hasPv ? (["pageViews"] as MetricKey[]) : [])
    .concat(trackRevenue ? (["revenue"] as MetricKey[]) : [])

  if (!daily.length) return null
  const data = daily.map((d) => {
    const impressions = d.impressions ?? 0, clicks = d.clicks ?? 0, spend = d.spend ?? 0
    return {
      dia: d.date.slice(8, 10),
      spend: Math.round(spend), results: d.results ?? 0, impressions, clicks,
      pageViews: d.pageViews ?? 0, revenue: Math.round(d.revenue ?? 0),
      cpa: (d.results ?? 0) > 0 ? spend / (d.results ?? 0) : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
    }
  })
  const primary = sel[0], secondary = sel[1]

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">Evolução diária</p>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((k) => {
            const on = sel.includes(k)
            return (
              <button key={k} onClick={() => toggle(k)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition ${on ? "bg-white/10 text-white" : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300"}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: on ? METRICS[k].color : "#52525b" }} />
                {METRICS[k].label}
              </button>
            )
          })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 8, left: -4, bottom: 0 }}>
          <defs>
            <linearGradient id="gPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primary ? METRICS[primary].color : "#FF8F50"} stopOpacity={0.35} />
              <stop offset="100%" stopColor={primary ? METRICS[primary].color : "#FF8F50"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="dia" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
          {secondary && <YAxis yAxisId="r" orientation="right" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />}
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }}
            formatter={(value, name) => {
              const k = (Object.keys(METRICS) as MetricKey[]).find((m) => METRICS[m].label === name)
              return [k ? METRICS[k].fmt(Number(value)) : String(value), name as string]
            }} />
          {primary && <Area yAxisId="l" type="monotone" dataKey={primary} name={METRICS[primary].label} stroke={METRICS[primary].color} strokeWidth={2} fill="url(#gPrimary)" />}
          {secondary && <Line yAxisId="r" type="monotone" dataKey={secondary} name={METRICS[secondary].label} stroke={METRICS[secondary].color} strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Histórico mensal: barras de resultados + linha de CPA.
function HistoryChart({ history, resultLabel }: { history: { month: string; spend: number; results: number; cpa: number | null }[]; resultLabel: string }) {
  if (history.length < 2) return null
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  const data = history.map((h) => ({ mes: `${names[Number(h.month.slice(5)) - 1]}`, [resultLabel]: h.results, CPA: h.cpa ? Math.round(h.cpa) : 0 }))
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="mb-2 text-[11px] text-zinc-500">Histórico mensal</p>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="mes" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
          <YAxis yAxisId="r" orientation="right" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
          <Bar yAxisId="l" dataKey={resultLabel} fill="#FF8F50" radius={[3, 3, 0, 0]} />
          <Line yAxisId="r" type="monotone" dataKey="CPA" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Funil visual: barras com taxa de conversão entre etapas.
// Escala logarítmica nas barras — sem ela, impressões (ordens de grandeza maiores)
// esmagam as demais etapas e elas viram fiapos. O log mantém a ordem e dá presença visual.
function VisualFunnel({ steps, title = "Funil" }: { steps: { label: string; value: number; display: string }[]; title?: string }) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  const logMax = Math.log(max + 1)
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="mb-3 text-[11px] text-zinc-500">{title}</p>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const conv = i > 0 && steps[i - 1].value > 0 ? ((s.value / steps[i - 1].value) * 100) : null
          const width = s.value > 0 ? Math.max(4, (Math.log(s.value + 1) / logMax) * 100) : 0
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">{s.label}</span>
                <span className="font-semibold text-zinc-100">{s.display}{conv != null && <span className="ml-2 text-[10px] text-zinc-600">{conv < 1 ? conv.toFixed(2) : conv.toFixed(0)}%</span>}</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-[#FF8F50] to-[#FFB185]" style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Controle de período: presets rápidos + intervalo personalizado.
// Metas × realizado do mês (barras + pacing), por plataforma.
function MetaProgress({ plan, view, resultLabel, platform, source, pace }: { plan: Plan; view: { spend: number; results: number; cpa: number | null; roas: number | null }; resultLabel: string; platform: string; source: string; pace: { elapsed: number; total: number } | null }) {
  // Metas agregadas dos sub-funis do plano — filtradas pela plataforma selecionada.
  const funnels = plan.funnels.filter((f) => source === "all" || !f.platform || f.platform === source)
  const proj = funnels.map((f) => ({ f, p: projectPlanFunnel(f) }))
  const budgetTarget = proj.reduce((s, x) => s + (x.f.budget ?? 0), 0) || plan.budget
  const leadsTarget = Math.round(proj.reduce((s, x) => s + (x.p.rows[0]?.value ?? 0), 0)) || plan.targetLeads
  const revTarget = proj.reduce((s, x) => s + (x.p.revenue ?? 0), 0)
  const roasTarget = budgetTarget && revTarget ? revTarget / budgetTarget : plan.targetRoas
  // Projeção no ritmo atual (só faz sentido no mês em curso).
  const inMonth = pace && pace.elapsed > 0 && pace.elapsed < pace.total
  const project = (v: number) => (inMonth ? Math.round((v / pace!.elapsed) * pace!.total) : null)

  type Row = { label: string; cur: string; target: string; pct: number; good: boolean; proj?: string; projGood?: boolean }
  const rows: Row[] = []
  if (budgetTarget) { const pj = project(view.spend); rows.push({ label: "Investimento", cur: brl(view.spend), target: brl(budgetTarget), pct: Math.round((view.spend / budgetTarget) * 100), good: true, proj: pj != null ? brl(pj) : undefined, projGood: pj != null ? pj <= budgetTarget * 1.05 : undefined }) }
  if (leadsTarget) { const p = Math.round((view.results / leadsTarget) * 100); const pj = project(view.results); rows.push({ label: resultLabel, cur: String(view.results), target: String(leadsTarget), pct: p, good: p >= 100, proj: pj != null ? String(pj) : undefined, projGood: pj != null ? pj >= leadsTarget : undefined }) }
  if (roasTarget && view.roas != null) rows.push({ label: "ROAS", cur: `${view.roas.toFixed(2)}x`, target: `≥ ${Number(roasTarget).toFixed(2)}x`, pct: Math.round((view.roas / roasTarget) * 100), good: view.roas >= roasTarget })
  if (!rows.length) return null
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-300">🎯 Metas do mês · {platform}</p>
        {inMonth && <span className="text-[10px] text-zinc-600">dia {pace!.elapsed}/{pace!.total} · projeção no ritmo atual</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">{r.label}</span>
              <span className={r.good ? "text-emerald-300" : "text-amber-300"}>{r.cur} <span className="text-zinc-600">/ {r.target} · {r.pct}%</span></span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full ${r.good ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.min(100, Math.max(3, r.pct))}%` }} /></div>
            {r.proj && <p className="mt-1 text-[10px] text-zinc-600">no ritmo: <b className={r.projGood ? "text-emerald-300" : "text-amber-300"}>~{r.proj}</b> até o fim do mês</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function DateRangeControl({ value, onChange }: { value: RangeSel; onChange: (r: RangeSel) => void }) {
  const [custom, setCustom] = useState(value.month === null)
  const presets = [
    { key: "today", label: "Hoje", make: () => daySel(0, "Hoje") },
    { key: "yesterday", label: "Ontem", make: () => daySel(1, "Ontem") },
    { key: "7", label: "7 dias", make: () => lastDaysSel(7) },
    { key: "14", label: "14 dias", make: () => lastDaysSel(14) },
    { key: "30", label: "30 dias", make: () => lastDaysSel(30) },
    { key: "month", label: "Este mês", make: () => monthSel(currentMonth()) },
    { key: "prev", label: "Mês passado", make: prevMonthSel },
  ]
  const chip = (on: boolean) => `rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${on ? "bg-[#FF8F50] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`
  const dateInput = "min-h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-200 [color-scheme:dark]"
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => {
        const r = p.make()
        const on = !custom && value.since === r.since && value.until === r.until
        return <button key={p.key} onClick={() => { setCustom(false); onChange(r) }} className={chip(on)}>{p.label}</button>
      })}
      <button onClick={() => setCustom((c) => !c)} className={chip(custom)}>Personalizado</button>
      {custom && (
        <span className="flex items-center gap-1">
          <input type="date" value={value.since} max={value.until} onChange={(e) => onChange({ ...value, since: e.target.value, month: null, label: "Personalizado" })} className={dateInput} />
          <span className="text-zinc-600">→</span>
          <input type="date" value={value.until} min={value.since} onChange={(e) => onChange({ ...value, until: e.target.value, month: null, label: "Personalizado" })} className={dateInput} />
        </span>
      )}
    </div>
  )
}

type History = { month: string; spend: number; results: number; cpa: number | null }[]
function PerformanceDashboard({ clientId, plans }: { clientId: string; plans: Plan[] }) {
  const [range, setRange] = useState<RangeSel>(() => monthSel(currentMonth()))
  const [perf, setPerf] = useState<Perf | null>(null)
  const [history, setHistory] = useState<History>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState("")
  const [insights, setInsights] = useState<InsightRow[]>([])
  const [showAllInsights, setShowAllInsights] = useState(false)
  const [readingBusy, setReadingBusy] = useState(false)
  const [source, setSource] = useState<string>("all") // "all" | "META" | "GOOGLE"
  const [tab, setTab] = useState<string>("overview") // overview | campaigns | creatives | insights
  const selectSource = (s: string) => { setSource(s); setTab("overview") }

  const qs = range.month ? `month=${range.month}` : `since=${range.since}&until=${range.until}`

  const load = useCallback(async () => {
    setLoading(true); setErr("")
    const { ok, data } = await cachedJson(`/api/clients/${clientId}/performance?${qs}`)
    setLoading(false)
    if (!ok) { setErr(data.error ?? "Falha ao carregar performance."); setPerf(null); return }
    setPerf(data.performance as Perf); setHistory((data.history as History) ?? []); setFetchedAt((data.fetchedAt as string) ?? null)
  }, [clientId, qs])
  useEffect(() => { void load() }, [load])

  // Leituras de IA salvas do mês (histórico).
  useEffect(() => {
    if (!range.month) { setInsights([]); return }
    fetch(`/api/clients/${clientId}/performance/insight?month=${range.month}`).then((r) => r.json()).then((d) => setInsights(d.insights ?? [])).catch(() => {})
  }, [clientId, range.month])

  // Prefetch em paralelo das abas pesadas (campanhas/criativos/análises) assim que o painel abre —
  // quando o usuário clicar na aba, já está em cache. "Não pode demorar."
  useEffect(() => {
    if (!perf?.current.configured) return
    const provs = perf.current.byProvider.filter((p) => !p.error).map((p) => p.provider)
    const q = `since=${range.since}&until=${range.until}` // mesma chave de cache dos componentes
    if (provs.includes("META")) {
      void cachedJson(`/api/clients/${clientId}/performance/explore?${q}`)
      void cachedJson(`/api/clients/${clientId}/performance/meta-insights?${q}`)
    }
    if (provs.includes("GOOGLE")) {
      void cachedJson(`/api/clients/${clientId}/performance/explore?provider=GOOGLE&${q}`)
      void cachedJson(`/api/clients/${clientId}/performance/explore?provider=GOOGLE&view=terms&${q}`)
    }
  }, [clientId, range, perf])

  async function refresh() {
    clearPerfCache()
    // Intervalo ao vivo não tem cache pra reescrever — só recarrega.
    if (!range.month) { await load(); return }
    setRefreshing(true); setErr("")
    const res = await fetch(`/api/clients/${clientId}/performance`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: range.month }),
    })
    const data = await res.json()
    setRefreshing(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao atualizar."); return }
    setPerf(data.performance); setFetchedAt(data.fetchedAt)
  }

  async function genReading() {
    if (!range.month) return
    setReadingBusy(true); setErr("")
    const res = await fetch(`/api/clients/${clientId}/performance/insight`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: range.month }),
    })
    const data = await res.json()
    setReadingBusy(false)
    if (res.ok && data.insight) setInsights((xs) => [data.insight, ...xs])
    else setErr(data.error ?? "Falha na leitura.")
  }

  // Plano do mês para a plataforma selecionada (Meta/Google/Consolidado), com fallback pro TOTAL.
  const planKey = source === "META" ? "META" : source === "GOOGLE" ? "GOOGLE" : "TOTAL"
  const plan = range.month ? (plans.find((p) => p.month === range.month && p.platform === planKey) ?? plans.find((p) => p.month === range.month && p.platform === "TOTAL")) : undefined
  // Pacing: dias decorridos vs total do mês (só projeta no mês em curso).
  const pace = (() => {
    if (!range.month) return null
    const [y, m] = range.month.split("-").map(Number)
    const total = new Date(y, m, 0).getDate()
    const elapsed = range.month === currentMonth() ? Math.min(new Date().getDate(), total) : total
    return { elapsed, total }
  })()
  const t = perf?.current.total
  const pct = (real: number, target: number | null | undefined) => (target && target > 0 ? Math.round((real / target) * 100) : null)

  // Fontes disponíveis (com dados, sem erro) + a "view" da fonte selecionada.
  const okProviders = (perf?.current.byProvider ?? []).filter((p) => !p.error)
  const isAll = source === "all"
  const provider = isAll ? null : okProviders.find((p) => p.provider === source)
  const view: Totals & { breakdown: Bd; daily: Dly } | null = !perf || !t ? null
    : isAll ? { ...t, breakdown: perf.current.breakdown, daily: perf.current.daily }
    : provider ? (() => {
        const spend = provider.spend ?? 0, impressions = provider.impressions ?? 0, clicks = provider.clicks ?? 0
        return {
          spend, impressions, clicks, pageViews: provider.pageViews ?? 0, results: provider.results ?? 0, followers: provider.followers ?? 0,
          cpa: provider.cpa ?? null, revenue: provider.revenue ?? null, roas: provider.roas ?? null,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
          cpc: clicks > 0 ? spend / clicks : null,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
          breakdown: provider.breakdown ?? [], daily: provider.daily ?? [],
        }
      })() : null
  // Rótulo do resultado primário — ignora objetivos secundários (Seguidores).
  const primaryBd = view ? view.breakdown.filter((b) => b.objective !== "SEGUIDORES") : []
  const resultLabel = primaryBd.length === 1 ? OBJ_LABEL[primaryBd[0].objective] ?? "Resultados" : "Resultados"

  // Status de saúde de resultado (consolidado, simples, explicável).
  let status: { label: string; tone: string; why: string } | null = null
  if (t) {
    if (plan?.targetCpa && t.cpa && t.cpa > plan.targetCpa * 1.1) status = { label: "Atenção", tone: "text-amber-300", why: `CPA acima da meta (${brl(t.cpa)} vs ${brl(plan.targetCpa)})` }
    else if (plan?.targetRoas && t.roas != null && t.roas < plan.targetRoas) status = { label: "Atenção", tone: "text-amber-300", why: `ROAS abaixo da meta (${t.roas.toFixed(2)}x vs ${plan.targetRoas}x)` }
    else if (plan?.targetCpa || plan?.targetRoas) status = { label: "Saudável", tone: "text-emerald-300", why: "Dentro das metas" }
  }
  const SOURCE_LABEL: Record<string, string> = { all: "Consolidado", META: "Meta", GOOGLE: "Google" }

  // Frescor do dado: mês em curso lido há mais de 26h = desatualizado (cron roda 06h).
  const staleHours = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime()) / 3_600_000 : null
  const stale = !!range.month && range.month === currentMonth() && staleHours != null && staleHours > 26

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Target size={15} className="text-[#FF8F50]" /> Painel de performance</h2>
        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="flex items-center gap-1.5 text-[10px]" title={`Leitura de ${new Date(fetchedAt).toLocaleString("pt-BR")}`}>
              {stale && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">desatualizado</span>}
              <span className="text-zinc-600">atualizado {relAgo(fetchedAt)}</span>
            </span>
          )}
          <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={refresh} disabled={refreshing || loading}>{refreshing ? <><Loader2 size={13} className="animate-spin" /> atualizando…</> : <><RefreshCw size={13} /> Atualizar</>}</Button>
        </div>
      </div>
      <div className="mt-3"><DateRangeControl value={range} onChange={setRange} /></div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : err ? (
        <p className="mt-4 text-sm text-red-300">{err}</p>
      ) : !perf || !t ? null : !perf.current.configured ? (
        <p className="mt-4 text-sm text-zinc-500">Configure uma conta de Ads acima para ver a performance.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {status && <p className="text-sm"><span className="text-zinc-500">Saúde de resultado: </span><span className={`font-semibold ${status.tone}`}>{status.label}</span> <span className="text-zinc-600">· {status.why}</span></p>}

          {/* Status das integrações (conectada / erro) — sempre visível. */}
          {perf.current.byProvider.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {perf.current.byProvider.map((p) => (
                <span key={p.provider} className={`flex items-center gap-1 rounded px-2 py-1 ${p.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`} title={p.error ?? "Conectada"}>
                  {p.error ? "✗" : "✓"} {SOURCE_LABEL[p.provider] ?? p.provider}{p.error ? ` · ${p.error.slice(0, 60)}` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Navegação de plataforma — Consolidado / Meta / Google */}
          {okProviders.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {["all", ...okProviders.map((p) => p.provider)].map((s) => (
                <button
                  key={s}
                  onClick={() => selectSource(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${source === s ? "bg-[#FF8F50] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
                >
                  {SOURCE_LABEL[s] ?? s}
                  {s !== "all" && <span className="ml-1.5 opacity-60">{brl(okProviders.find((p) => p.provider === s)?.spend ?? 0)}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Sub-abas da plataforma (a "tela" de cada fonte). Consolidado não tem sub-abas. */}
          {!isAll && (
            <div className="flex flex-wrap gap-4 border-b border-white/8 text-sm">
              {(source === "META"
                ? [["overview", "Visão Geral"], ["campaigns", "Campanhas"], ["funnels", "Funis"], ["creatives", "Criativos"], ["insights", "Análises"]]
                : [["overview", "Visão Geral"], ["campaigns", "Campanhas"], ["funnels", "Funis"], ["insights", "Termos & análises"]]
              ).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 pb-2 font-medium transition ${tab === key ? "border-[#FF8F50] text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* === VISÃO GERAL (KPIs + gráfico + funil) === */}
          {(isAll || tab === "overview") && (!view ? (
            <p className="text-sm text-zinc-500">Sem dados para {SOURCE_LABEL[source] ?? source} neste período.</p>
          ) : (
          <>
          {/* Metas do mês (meta × realizado) para a plataforma selecionada. */}
          {range.month && plan && <MetaProgress plan={plan} view={view} resultLabel={resultLabel} platform={SOURCE_LABEL[source] ?? source} source={source} pace={pace} />}

          {/* KPIs principais com mini-tendência. Trend só no consolidado; % de meta por plataforma. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Investimento" value={brl(view.spend)} pct={pct(view.spend, plan?.budget)} trend={isAll ? <Trend cur={view.spend} prev={perf.previous.spend} /> : undefined} spark={view.daily.map((d) => d.spend ?? 0)} sparkColor="#FF8F50" />
            <KpiCard label={resultLabel} value={String(view.results)} pct={pct(view.results, plan?.targetLeads)} trend={isAll ? <Trend cur={view.results} prev={perf.previous.results} /> : undefined} spark={view.daily.map((d) => d.results ?? 0)} sparkColor="#38bdf8" />
            <KpiCard label="CPA" value={brl(view.cpa)} trend={isAll ? <Trend cur={view.cpa} prev={perf.previous.cpa} goodWhenUp={false} /> : undefined} spark={view.daily.map((d) => ((d.results ?? 0) > 0 ? (d.spend ?? 0) / (d.results ?? 0) : 0))} sparkColor="#fca5a5" />
            {perf.current.trackRevenue
              ? <KpiCard label="ROAS" value={view.roas != null ? `${view.roas.toFixed(2)}x` : "—"} trend={isAll ? <Trend cur={view.roas} prev={perf.previous.roas} /> : undefined} spark={view.daily.map((d) => ((d.spend ?? 0) > 0 ? (d.revenue ?? 0) / (d.spend ?? 0) : 0))} sparkColor="#4ade80" />
              : <KpiCard label="Cliques" value={view.clicks.toLocaleString("pt-BR")} spark={view.daily.map((d) => d.clicks ?? 0)} sparkColor="#34d399" />}
          </div>

          {/* Grid de métricas de mídia */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="CTR" value={view.ctr != null ? `${view.ctr.toFixed(2)}%` : "—"} />
            <KpiCard label="CPC" value={brl(view.cpc)} />
            <KpiCard label="CPM" value={brl(view.cpm)} />
            <KpiCard label="Impressões" value={view.impressions.toLocaleString("pt-BR")} />
            <KpiCard label="Cliques" value={view.clicks.toLocaleString("pt-BR")} />
            {view.pageViews > 0 && <KpiCard label="Visualizações de página" value={view.pageViews.toLocaleString("pt-BR")} />}
            {view.followers > 0 && <KpiCard label="Seguidores" value={`+${view.followers.toLocaleString("pt-BR")}`} sparkColor="#a78bfa" />}
            {perf.current.trackRevenue && <KpiCard label="Receita" value={brl(view.revenue)} />}
          </div>

          <DailyChart daily={view.daily} resultLabel={resultLabel} trackRevenue={perf.current.trackRevenue} />
          <VisualFunnel steps={[
            { label: "Impressões", value: view.impressions, display: view.impressions.toLocaleString("pt-BR") },
            { label: "Cliques", value: view.clicks, display: view.clicks.toLocaleString("pt-BR") },
            ...(view.pageViews > 0 ? [{ label: "Visualizações de página", value: view.pageViews, display: view.pageViews.toLocaleString("pt-BR") }] : []),
            { label: resultLabel, value: view.results, display: String(view.results) },
            ...(perf.current.trackRevenue && view.revenue != null ? [{ label: "Receita", value: view.revenue, display: brl(view.revenue) }] : []),
          ]} />

          {/* Histórico, composição de fontes e leitura de IA — só no Consolidado (Visão Geral) */}
          {isAll && <HistoryChart history={history} resultLabel={resultLabel} />}
          {isAll && perf.current.byProvider.length > 1 && (
            <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
              {perf.current.byProvider.map((p) => (
                <span key={p.provider} className="rounded bg-white/5 px-2 py-1">{SOURCE_LABEL[p.provider] ?? p.provider}: {p.error ? `erro` : `${brl(p.spend ?? 0)} · ${p.results} resultados`}</span>
              ))}
            </div>
          )}
          {isAll && range.month && (
            <div className="rounded-xl border border-[#FF8F50]/20 bg-[#FF8F50]/[0.05] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#FFB185]">🤖 Leitura de performance</span>
                <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={genReading} disabled={readingBusy}>{readingBusy ? <Loader2 size={13} className="animate-spin" /> : insights.length ? "Gerar nova" : "Gerar leitura"}</Button>
              </div>
              {insights.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Sem leitura ainda. Gere uma análise do mês (compara com as metas e o mês anterior).</p>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{insights[0].text}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{insights[0].createdByName ?? "IA"} · {new Date(insights[0].createdAt).toLocaleString("pt-BR")}</p>
                  {insights.length > 1 && (
                    <>
                      <button onClick={() => setShowAllInsights((v) => !v)} className="mt-2 text-[11px] font-medium text-[#FFB185] hover:underline">{showAllInsights ? "Ocultar histórico" : `Ver histórico (${insights.length - 1})`}</button>
                      {showAllInsights && (
                        <div className="mt-2 space-y-3 border-t border-white/8 pt-3">
                          {insights.slice(1).map((ins) => (
                            <div key={ins.id}>
                              <p className="whitespace-pre-wrap text-[12px] leading-5 text-zinc-400">{ins.text}</p>
                              <p className="mt-0.5 text-[10px] text-zinc-600">{ins.createdByName ?? "IA"} · {new Date(ins.createdAt).toLocaleString("pt-BR")}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
          </>
          ))}

          {/* === CAMPANHAS === */}
          {!isAll && tab === "campaigns" && source === "META" && <Explorer clientId={clientId} since={range.since} until={range.until} />}
          {!isAll && tab === "campaigns" && source === "GOOGLE" && <GoogleExplorer clientId={clientId} since={range.since} until={range.until} />}

          {/* === FUNIS (agrupa campanhas por nome) === */}
          {!isAll && tab === "funnels" && <FunnelView clientId={clientId} provider={source} since={range.since} until={range.until} plans={plans} month={range.month} />}

          {/* === CRIATIVOS (Meta) === */}
          {!isAll && tab === "creatives" && source === "META" && <CreativesGrid clientId={clientId} since={range.since} until={range.until} />}

          {/* === ANÁLISES === */}
          {!isAll && tab === "insights" && source === "META" && <MetaDeepPanel clientId={clientId} since={range.since} until={range.until} />}
          {!isAll && tab === "insights" && source === "GOOGLE" && <GoogleSearchTerms clientId={clientId} since={range.since} until={range.until} />}
        </div>
      )}
    </Panel>
  )
}

// Explorador: Campanha → Conjunto (público) → Anúncio (preview). Drill-down.
type AdStatus = "active" | "paused" | null
type AdNode = { id: string; name: string; status: AdStatus; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; hookRate: number | null; convRate: number | null; thumbnail: string | null; permalink: string | null }
type AdsetNode = { id: string; name: string; status: AdStatus; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; audience: string | null; ads: AdNode[] }
type CampaignNode = { id: string; name: string; status: AdStatus; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; adsets: AdsetNode[] }
const chevron = (on: boolean) => <span className={`inline-block text-zinc-500 transition-transform ${on ? "rotate-90" : ""}`}>▸</span>

// === Tabela de métricas em árvore (campanha ▸ filho ▸ neto), ordenável, com detalhes ao clicar ===
type TNode = {
  id: string; name: string; status?: AdStatus
  spend: number; impressions: number; clicks: number; results: number
  cpa: number | null; ctr: number | null
  subtitle?: string | null; thumbnail?: string | null; permalink?: string | null
  hookRate?: number | null; convRate?: number | null; matchType?: string | null
  children?: TNode[]
}
type ColKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm" | "results" | "cpa"
const cpcOf = (n: TNode) => (n.clicks > 0 ? n.spend / n.clicks : null)
const cpmOf = (n: TNode) => (n.impressions > 0 ? (n.spend / n.impressions) * 1000 : null)
const TREE_COLS: { key: ColKey; label: string; fmt: (n: TNode) => string; tone?: string }[] = [
  { key: "spend", label: "Gasto", fmt: (n) => brl(n.spend) },
  { key: "impressions", label: "Impr.", fmt: (n) => n.impressions.toLocaleString("pt-BR") },
  { key: "clicks", label: "Cliques", fmt: (n) => n.clicks.toLocaleString("pt-BR") },
  { key: "ctr", label: "CTR", fmt: (n) => (n.ctr != null ? `${n.ctr.toFixed(2)}%` : "—") },
  { key: "cpc", label: "CPC", fmt: (n) => brl(cpcOf(n)) },
  { key: "cpm", label: "CPM", fmt: (n) => brl(cpmOf(n)) },
  { key: "results", label: "Result.", fmt: (n) => String(n.results), tone: "text-sky-300" },
  { key: "cpa", label: "CPA", fmt: (n) => brl(n.cpa), tone: "text-emerald-300" },
]
const colValue = (n: TNode, k: ColKey): number => {
  if (k === "cpc") return cpcOf(n) ?? -Infinity
  if (k === "cpm") return cpmOf(n) ?? -Infinity
  if (k === "ctr") return n.ctr ?? -Infinity
  if (k === "cpa") return n.cpa ?? -Infinity
  return n[k] ?? 0
}
const GRID_COLS = "minmax(180px,1fr) repeat(8, minmax(58px,0.6fr))"

function MetricTree({ nodes, title, levels }: { nodes: TNode[]; title: string; levels: string[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [detail, setDetail] = useState<string | null>(null)
  const [expandAll, setExpandAll] = useState(false)
  const [onlyActive, setOnlyActive] = useState(false)
  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: "spend", dir: -1 })
  const isOpen = (id: string) => open[id] ?? expandAll
  const anyStatus = (arr: TNode[]): boolean => arr.some((n) => n.status != null || (n.children ? anyStatus(n.children) : false))
  const hasStatus = anyStatus(nodes)

  // Filtra pausados (mantém ativos e os sem status conhecido).
  const prune = (arr: TNode[]): TNode[] =>
    arr.filter((n) => !(onlyActive && n.status === "paused")).map((n) => (n.children?.length ? { ...n, children: prune(n.children) } : n))
  const sortTree = (arr: TNode[]): TNode[] =>
    [...arr].sort((a, b) => (colValue(a, sort.key) - colValue(b, sort.key)) * sort.dir)
      .map((n) => (n.children?.length ? { ...n, children: sortTree(n.children) } : n))
  const visible = sortTree(prune(nodes))
  const rows: { n: TNode; depth: number }[] = []
  const walk = (arr: TNode[], depth: number) => { for (const n of arr) { rows.push({ n, depth }); if (n.children?.length && isOpen(n.id)) walk(n.children, depth + 1) } }
  walk(visible, 0)
  const total = visible.reduce((s, n) => s + n.spend, 0) || 1

  const clickRow = (n: TNode) => { if (n.children?.length) setOpen((o) => ({ ...o, [n.id]: !(o[n.id] ?? expandAll) })); else setDetail((d) => (d === n.id ? null : n.id)) }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-400">{title} <span className="text-zinc-600">· {levels.join(" ▸ ")}</span></p>
        <div className="flex items-center gap-3">
          {hasStatus && (
            <button onClick={() => setOnlyActive((v) => !v)} className={`flex items-center gap-1.5 text-[11px] ${onlyActive ? "text-emerald-300" : "text-zinc-500 hover:text-zinc-300"}`}>
              <span className={`h-2 w-2 rounded-full ${onlyActive ? "bg-emerald-400" : "border border-zinc-600"}`} /> Só ativos
            </button>
          )}
          {!!nodes.length && <button onClick={() => { setExpandAll((v) => !v); setOpen({}) }} className="text-[11px] text-zinc-500 hover:text-zinc-300">{expandAll ? "Recolher tudo" : "Expandir tudo"}</button>}
        </div>
      </div>
      {!nodes.length ? (
        <p className="text-xs text-zinc-600">Sem dados com veiculação no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {/* Cabeçalho ordenável */}
            <div className="grid items-center gap-2 border-b border-white/8 pb-2 text-[10px] uppercase tracking-wide text-zinc-600" style={{ gridTemplateColumns: GRID_COLS }}>
              <span>Nome</span>
              {TREE_COLS.map((c) => (
                <button key={c.key} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : -1 }))}
                  className={`flex items-center justify-end gap-0.5 text-right hover:text-zinc-300 ${sort.key === c.key ? "text-[#FFB185]" : ""}`}>
                  {c.label}{sort.key === c.key && <span>{sort.dir === -1 ? "↓" : "↑"}</span>}
                </button>
              ))}
            </div>
            {rows.map(({ n, depth }) => (
              <div key={n.id} className={depth === 0 ? "border-b border-white/5" : ""}>
                <div className="grid items-center gap-2 py-2 text-[13px] hover:bg-white/[0.02]" style={{ gridTemplateColumns: GRID_COLS }}>
                  <button onClick={() => clickRow(n)} className="flex min-w-0 items-center gap-2 text-left" style={{ paddingLeft: depth * 16 }}>
                    {n.children?.length ? chevron(isOpen(n.id)) : n.thumbnail ? <img src={n.thumbnail} alt="" className="h-7 w-7 shrink-0 rounded object-cover" /> : <span className="inline-block w-[10px] text-center text-zinc-700">·</span>}
                    <span className="min-w-0">
                      <span className={`flex items-center gap-1.5 ${depth === 0 ? "font-semibold text-zinc-50" : "text-zinc-200"}`}>
                        {n.status && <span title={n.status === "active" ? "Ativo" : "Pausado"} className={`h-1.5 w-1.5 shrink-0 rounded-full ${n.status === "active" ? "bg-emerald-400" : "bg-zinc-600"}`} />}
                        <span className="truncate" title={n.name}>{n.name}</span>
                      </span>
                      {n.subtitle && <span className="block truncate text-[10px] text-sky-300/70">{n.subtitle}</span>}
                    </span>
                  </button>
                  {TREE_COLS.map((c) => <span key={c.key} className={`text-right tabular-nums ${c.tone ?? "text-zinc-300"}`}>{c.fmt(n)}</span>)}
                </div>
                {depth === 0 && (
                  <div className="mb-1 ml-4 flex items-center gap-2"><div className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-[#FF8F50]/60" style={{ width: `${Math.max(1, (n.spend / total) * 100)}%` }} /></div><span className="shrink-0 text-[9px] text-zinc-600">{Math.round((n.spend / total) * 100)}%</span></div>
                )}
                {detail === n.id && (
                  <div className="mb-2 flex gap-3 rounded-lg bg-black/40 p-3" style={{ marginLeft: depth * 16 + 16 }}>
                    {n.thumbnail && <img src={n.thumbnail} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-zinc-100">{n.name}</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
                        <span className="text-zinc-500">Gasto <span className="text-zinc-200">{brl(n.spend)}</span></span>
                        <span className="text-zinc-500">Impr. <span className="text-zinc-200">{n.impressions.toLocaleString("pt-BR")}</span></span>
                        <span className="text-zinc-500">Cliques <span className="text-zinc-200">{n.clicks.toLocaleString("pt-BR")}</span></span>
                        <span className="text-zinc-500">CTR <span className="text-zinc-200">{n.ctr != null ? `${n.ctr.toFixed(2)}%` : "—"}</span></span>
                        <span className="text-zinc-500">CPC <span className="text-zinc-200">{brl(cpcOf(n))}</span></span>
                        <span className="text-zinc-500">CPM <span className="text-zinc-200">{brl(cpmOf(n))}</span></span>
                        <span className="text-zinc-500">Result. <span className="text-sky-300">{n.results}</span></span>
                        <span className="text-zinc-500">CPA <span className="text-emerald-300">{brl(n.cpa)}</span></span>
                        {n.hookRate != null && <span className="text-zinc-500">Hook <span className="text-zinc-200">{n.hookRate.toFixed(0)}%</span></span>}
                        {n.convRate != null && <span className="text-zinc-500">Conv <span className="text-zinc-200">{n.convRate.toFixed(0)}%</span></span>}
                        {n.matchType && <span className="text-zinc-500">Correspond. <span className="text-zinc-200">{n.matchType}</span></span>}
                      </div>
                      {n.permalink && <a href={n.permalink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] text-[#FFB185] hover:underline">ver anúncio ↗</a>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Explorer({ clientId, since, until }: { clientId: string; since: string; until: string }) {
  const [campaigns, setCampaigns] = useState<CampaignNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setCampaigns(null)
    const { ok, data } = await cachedJson(`/api/clients/${clientId}/performance/explore?since=${since}&until=${until}`)
    setLoading(false)
    if (!ok) { setErr(data.error ?? "Falha ao explorar."); return }
    setCampaigns((data.campaigns as CampaignNode[]) ?? [])
  }, [clientId, since, until])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>

  return <MetricTree nodes={metaToNodes(campaigns ?? [])} title="Explorador (Meta)" levels={["Campanha", "Conjunto", "Anúncio"]} />
}

// Converte a árvore Meta da API em TNode[] (reutilizado no explorador e nos funis).
const metaToNodes = (campaigns: CampaignNode[]): TNode[] => campaigns.map((c) => ({
  id: c.id, name: c.name, status: c.status, spend: c.spend, impressions: c.impressions, clicks: c.clicks, results: c.results, cpa: c.cpa, ctr: c.ctr,
  children: c.adsets.map((s) => ({
    id: s.id, name: s.name, status: s.status, spend: s.spend, impressions: s.impressions, clicks: s.clicks, results: s.results, cpa: s.cpa, ctr: s.ctr,
    subtitle: s.audience ? `👥 ${s.audience}` : null,
    children: s.ads.map((ad) => ({
      id: ad.id, name: ad.name, status: ad.status, spend: ad.spend, impressions: ad.impressions, clicks: ad.clicks, results: ad.results, cpa: ad.cpa, ctr: ad.ctr,
      thumbnail: ad.thumbnail, permalink: ad.permalink, hookRate: ad.hookRate, convRate: ad.convRate,
    })),
  })),
}))

// Agrupa nós de campanha em funis por regra de nome (campanha entra no 1º funil cujo termo bate).
function groupByFunnel(nodes: TNode[], funnels: { id?: string; name: string; terms: string[] }[]): TNode[] {
  const groups = funnels.map((f) => ({ funnel: f, terms: f.terms.map((t) => t.toLowerCase()), kids: [] as TNode[] }))
  const none: TNode[] = []
  for (const n of nodes) {
    const nl = n.name.toLowerCase()
    const g = groups.find((g) => g.terms.some((t) => nl.includes(t)))
    if (g) g.kids.push(n); else none.push(n)
  }
  const agg = (id: string, name: string, kids: TNode[]): TNode => {
    const t = kids.reduce((a, c) => ({ spend: a.spend + c.spend, impressions: a.impressions + c.impressions, clicks: a.clicks + c.clicks, results: a.results + c.results }), { spend: 0, impressions: 0, clicks: 0, results: 0 })
    return { id, name, ...t, cpa: t.results > 0 ? t.spend / t.results : null, ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null, children: kids }
  }
  const out = groups.filter((g) => g.kids.length).map((g) => agg(g.funnel.id ?? `f-${g.funnel.name}`, g.funnel.name, g.kids))
  if (none.length) out.push(agg("f-none", "Sem funil", none))
  return out.sort((a, b) => b.spend - a.spend)
}

// Criativos (Meta): todos os anúncios achatados, ordenados por gasto, com preview grande.
function CreativesGrid({ clientId, since, until }: { clientId: string; since: string; until: string }) {
  const [ads, setAds] = useState<AdNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setAds(null)
    const { ok, data } = await cachedJson(`/api/clients/${clientId}/performance/explore?since=${since}&until=${until}`)
    setLoading(false)
    if (!ok) { setErr(data.error ?? "Falha ao carregar criativos."); return }
    const flat: AdNode[] = ((data.campaigns as CampaignNode[]) ?? []).flatMap((c) => c.adsets.flatMap((s) => s.ads))
    flat.sort((a, b) => b.spend - a.spend)
    setAds(flat)
  }, [clientId, since, until])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>
  if (!ads?.length) return <p className="rounded-2xl border border-white/8 bg-black/20 p-5 text-xs text-zinc-600">Sem criativos com veiculação no período.</p>

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {ads.map((ad) => (
        <div key={ad.id} className="overflow-hidden rounded-xl border border-white/8 bg-black/20">
          {ad.thumbnail
            ? <img src={ad.thumbnail} alt="" className="aspect-square w-full object-cover" />
            : <div className="flex aspect-square w-full items-center justify-center bg-white/5 text-[10px] text-zinc-600">sem preview</div>}
          <div className="p-3">
            <p className="truncate text-[12px] font-medium text-zinc-100" title={ad.name}>{ad.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <div><p className="text-[9px] uppercase tracking-wide text-zinc-600">Gasto</p><p className="text-[13px] font-semibold text-zinc-100">{brl(ad.spend)}</p></div>
              <div className="text-right"><p className="text-[9px] uppercase tracking-wide text-zinc-600">Result.</p><p className="text-[13px] font-semibold text-sky-300">{ad.results}</p></div>
              <div className="text-right"><p className="text-[9px] uppercase tracking-wide text-zinc-600">CPA</p><p className="text-[13px] font-semibold text-emerald-300">{brl(ad.cpa)}</p></div>
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">CTR {ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : "—"} · Hook {ad.hookRate != null ? `${ad.hookRate.toFixed(0)}%` : "—"} · Conv {ad.convRate != null ? `${ad.convRate.toFixed(0)}%` : "—"}</p>
            {ad.permalink && <a href={ad.permalink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-[#FFB185] hover:underline">ver no Instagram ↗</a>}
          </div>
        </div>
      ))}
    </div>
  )
}

// Explorador Google: Campanha → Grupo de anúncios → Palavra-chave.
type GKeyword = { text: string; matchType: string; status: AdStatus; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }
type GAdGroup = { id: string; name: string; status: AdStatus; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; keywords: GKeyword[] }
type GCampaign = { id: string; name: string; status: AdStatus; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; adGroups: GAdGroup[] }
const MATCH_LABEL: Record<string, string> = { EXACT: "exata", PHRASE: "frase", BROAD: "ampla" }

function GoogleExplorer({ clientId, since, until }: { clientId: string; since: string; until: string }) {
  const [campaigns, setCampaigns] = useState<GCampaign[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setCampaigns(null)
    const { ok, data } = await cachedJson(`/api/clients/${clientId}/performance/explore?provider=GOOGLE&since=${since}&until=${until}`)
    setLoading(false)
    if (!ok) { setErr(data.error ?? "Falha ao explorar."); return }
    setCampaigns((data.campaigns as GCampaign[]) ?? [])
  }, [clientId, since, until])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>

  return <MetricTree nodes={googleToNodes(campaigns ?? [])} title="Explorador (Google)" levels={["Campanha", "Grupo", "Palavra-chave"]} />
}

// Converte a árvore Google da API em TNode[] (reutilizado no explorador e nos funis).
let _gkw = 0
const googleToNodes = (campaigns: GCampaign[]): TNode[] => campaigns.map((c) => ({
  id: c.id, name: c.name, status: c.status, spend: c.spend, impressions: c.impressions, clicks: c.clicks, results: c.results, cpa: c.cpa, ctr: c.ctr,
  children: c.adGroups.map((g) => ({
    id: g.id, name: g.name, status: g.status, spend: g.spend, impressions: g.impressions, clicks: g.clicks, results: g.results, cpa: g.cpa, ctr: g.ctr,
    children: g.keywords.map((k) => ({
      id: `kw-${_gkw++}`, name: k.text, status: k.status, spend: k.spend, impressions: k.impressions, clicks: k.clicks, results: k.results, cpa: k.cpa, ctr: k.ctr,
      matchType: MATCH_LABEL[k.matchType] ?? k.matchType.toLowerCase(),
    })),
  })),
}))

// Termos de busca reais do Google (o que o usuário digitou) — tabela ordenável.
type GTerm = { term: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }
function GoogleSearchTerms({ clientId, since, until }: { clientId: string; since: string; until: string }) {
  const [terms, setTerms] = useState<GTerm[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setTerms(null)
    const { ok, data } = await cachedJson(`/api/clients/${clientId}/performance/explore?provider=GOOGLE&view=terms&since=${since}&until=${until}`)
    setLoading(false)
    if (!ok) { setErr(data.error ?? "Falha ao carregar termos."); return }
    setTerms((data.terms as GTerm[]) ?? [])
  }, [clientId, since, until])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>

  const nodes: TNode[] = (terms ?? []).map((t, i) => ({
    id: `t-${i}`, name: t.term, spend: t.spend, impressions: t.impressions, clicks: t.clicks, results: t.results, cpa: t.cpa, ctr: t.ctr,
  }))
  return <MetricTree nodes={nodes} title="Termos de busca (Google)" levels={["o que as pessoas pesquisaram"]} />
}

// === Funis: agrupa campanhas por regra de nome (1 funil → N campanhas) ===
type FunnelDef = { name: string; terms: string[] }
function FunnelEditor({ clientId, initial, onSaved }: { clientId: string; initial: FunnelDef[]; onSaved: (f: FunnelDef[]) => void }) {
  const [rows, setRows] = useState<{ name: string; terms: string }[]>(initial.length ? initial.map((f) => ({ name: f.name, terms: f.terms.join(", ") })) : [{ name: "", terms: "" }])
  const [saving, setSaving] = useState(false)
  const set = (i: number, k: "name" | "terms", v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))

  async function save() {
    setSaving(true)
    const funnels = rows.map((r) => ({ name: r.name.trim(), terms: r.terms.split(",").map((t) => t.trim()).filter(Boolean) })).filter((f) => f.name)
    const res = await fetch(`/api/clients/${clientId}/funnels`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funnels }) })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) { clearPerfCache(); onSaved(d.funnels ?? funnels) }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="mb-2 text-xs font-semibold text-zinc-300">Configurar funis — campanha entra no funil cujo termo aparece no nome</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input value={r.name} onChange={(e) => set(i, "name", e.target.value)} placeholder="Nome do funil (ex: Vistos Temporários)" className="min-h-9 flex-1" />
            <Input value={r.terms} onChange={(e) => set(i, "terms", e.target.value)} placeholder="termos no nome, separados por vírgula (ex: VISTOS TEMP, L1)" className="min-h-9 flex-[2]" />
            <button onClick={() => setRows((rr) => rr.filter((_, j) => j !== i))} className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:text-red-300">remover</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => setRows((r) => [...r, { name: "", terms: "" }])}>+ funil</Button>
        <Button className="min-h-8 px-3 py-1 text-xs" disabled={saving} onClick={save}>{saving ? <Loader2 size={13} className="animate-spin" /> : "Salvar funis"}</Button>
      </div>
    </div>
  )
}

function FunnelView({ clientId, provider, since, until, plans, month }: { clientId: string; provider: string; since: string; until: string; plans: Plan[]; month?: string | null }) {
  const [funnels, setFunnels] = useState<FunnelDef[] | null>(null)
  const [nodes, setNodes] = useState<TNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [editing, setEditing] = useState(false)

  const loadFunnels = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/funnels`)
    const d = await res.json().catch(() => ({}))
    if (res.ok) setFunnels(d.funnels ?? [])
  }, [clientId])

  const loadCampaigns = useCallback(async () => {
    setLoading(true); setErr("")
    const url = provider === "GOOGLE"
      ? `/api/clients/${clientId}/performance/explore?provider=GOOGLE&since=${since}&until=${until}`
      : `/api/clients/${clientId}/performance/explore?since=${since}&until=${until}`
    const { ok, data } = await cachedJson(url)
    setLoading(false)
    if (!ok) { setErr(data.error ?? "Falha ao carregar campanhas."); return }
    setNodes(provider === "GOOGLE" ? googleToNodes((data.campaigns as GCampaign[]) ?? []) : metaToNodes((data.campaigns as CampaignNode[]) ?? []))
  }, [clientId, provider, since, until])

  useEffect(() => { void loadFunnels(); void loadCampaigns() }, [loadFunnels, loadCampaigns])

  if (loading || !nodes) return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>

  const grouped = groupByFunnel(nodes, funnels ?? [])
  const leaf = provider === "GOOGLE" ? "Grupo ▸ Palavra" : "Conjunto ▸ Anúncio"
  // Casa cada funil de campanha (id) com o sub-funil atrelado (em qualquer plano do mês).
  const subFunnelFor = (funnelId: string): PlanFunnel | undefined => {
    if (!month) return undefined
    for (const p of plans) {
      if (p.month !== month) continue
      const sf = p.funnels.find((x) => x.campaignFunnelId === funnelId && (!x.platform || x.platform === provider))
      if (sf) return sf
    }
    return undefined
  }
  const compares = grouped.map((n) => ({ node: n, sf: subFunnelFor(n.id) })).filter((c) => c.sf)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">Funis agrupam campanhas por regra de nome. 1 funil → várias campanhas.</p>
        <button onClick={() => setEditing((v) => !v)} className="text-[11px] text-[#FFB185] hover:underline">{editing ? "fechar" : "Configurar funis"}</button>
      </div>
      {editing && <FunnelEditor clientId={clientId} initial={funnels ?? []} onSaved={(f) => { setFunnels(f); setEditing(false) }} />}
      {!funnels?.length && !editing && <p className="rounded-xl border border-white/8 bg-black/20 p-4 text-xs text-zinc-500">Nenhum funil definido ainda. Clique em <span className="text-[#FFB185]">Configurar funis</span> pra criar (ex.: &quot;Consultoria&quot; = termos CONSULTORIA, SEGUIMENTAÇÃO).</p>}
      {compares.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-zinc-400">🎯 Meta × realizado por funil</p>
          {compares.map((c) => <FunnelPlanCompare key={c.node.id} node={c.node} sf={c.sf!} />)}
        </div>
      )}
      <MetricTree nodes={grouped} title={`Funis (${provider === "GOOGLE" ? "Google" : "Meta"})`} levels={["Funil", "Campanha", leaf]} />
    </div>
  )
}

// Meta × realizado de um funil de campanha vs seu sub-funil no plano.
function FunnelPlanCompare({ node, sf }: { node: TNode; sf: PlanFunnel }) {
  const proj = projectPlanFunnel(sf)
  const leadsTarget = Math.round(proj.rows[0]?.value ?? 0) || null
  const rows: { label: string; cur: string; target: string; pct: number; good: boolean }[] = []
  if (sf.budget) rows.push({ label: "Gasto", cur: brl(node.spend), target: brl(sf.budget), pct: Math.round((node.spend / sf.budget) * 100), good: node.spend <= sf.budget * 1.05 })
  if (leadsTarget) { const p = Math.round((node.results / leadsTarget) * 100); rows.push({ label: OBJ_LABEL[sf.objective] ?? "Resultados", cur: String(node.results), target: String(leadsTarget), pct: p, good: p >= 100 }) }
  if (sf.cpl && node.cpa != null) rows.push({ label: "Custo/result.", cur: brl(node.cpa), target: `≤ ${brl(sf.cpl)}`, pct: Math.round((node.cpa / sf.cpl) * 100), good: node.cpa <= sf.cpl })
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-300">{node.name} <span className="rounded bg-[#FF8F50]/15 px-1.5 py-0.5 text-[10px] text-[#FFB185]">{OBJ_LABEL[sf.objective] ?? sf.objective}</span></p>
      <div className="grid gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">{r.label}</span>
              <span className={r.good ? "text-emerald-300" : "text-amber-300"}>{r.cur} <span className="text-zinc-600">/ {r.target}</span></span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full ${r.good ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.min(100, Math.max(3, r.pct))}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// === Análises profundas Meta (posicionamentos, demografia, alcance, vídeo) ===
type MetaBdRow = { key: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }
type MetaDeepT = { placements: MetaBdRow[]; byAge: MetaBdRow[]; byGender: MetaBdRow[]; reach: number; frequency: number; video: { plays: number; p25: number; p50: number; p75: number; p100: number; thruplay: number } }

// Lista de breakdown: nome + barra de share (gasto) + métricas.
function BreakdownList({ title, rows }: { title: string; rows: MetaBdRow[] }) {
  const max = Math.max(...rows.map((r) => r.spend), 1)
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="mb-3 text-[11px] text-zinc-500">{title}</p>
      <div className="space-y-2.5">
        {rows.slice(0, 8).map((r) => (
          <div key={r.key}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-zinc-300">{r.key}</span>
              <span className="shrink-0 text-[11px] text-zinc-400">{brl(r.spend)} · <span className="text-sky-300">{r.results}</span> · CPA {brl(r.cpa)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FF8F50] to-[#FFB185]" style={{ width: `${Math.max(2, (r.spend / max) * 100)}%` }} />
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-[11px] text-zinc-600">Sem dados no período.</p>}
      </div>
    </div>
  )
}

function MetaDeepPanel({ clientId, since, until }: { clientId: string; since: string; until: string }) {
  const [deep, setDeep] = useState<MetaDeepT | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setDeep(null)
    const { ok, data } = await cachedJson(`/api/clients/${clientId}/performance/meta-insights?since=${since}&until=${until}`)
    setLoading(false)
    if (!ok) { setErr(data.error ?? "Falha ao ler análises Meta."); return }
    setDeep(data.deep as MetaDeepT)
  }, [clientId, since, until])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>
  if (!deep) return null
  const v = deep.video
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Alcance" value={deep.reach.toLocaleString("pt-BR")} />
        <KpiCard label="Frequência" value={deep.frequency ? deep.frequency.toFixed(2) : "—"} />
        <KpiCard label="ThruPlay" value={v.thruplay.toLocaleString("pt-BR")} />
        <KpiCard label="Reproduções de vídeo" value={v.plays.toLocaleString("pt-BR")} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownList title="Posicionamentos (por gasto)" rows={deep.placements} />
        {v.plays > 0 ? (
          <VisualFunnel title="Retenção de vídeo" steps={[
            { label: "Reproduções", value: v.plays, display: v.plays.toLocaleString("pt-BR") },
            { label: "25%", value: v.p25, display: v.p25.toLocaleString("pt-BR") },
            { label: "50%", value: v.p50, display: v.p50.toLocaleString("pt-BR") },
            { label: "75%", value: v.p75, display: v.p75.toLocaleString("pt-BR") },
            { label: "100%", value: v.p100, display: v.p100.toLocaleString("pt-BR") },
          ]} />
        ) : (
          <div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-[11px] text-zinc-500">Retenção de vídeo</p><p className="mt-3 text-xs text-zinc-600">Sem vídeo veiculado no período.</p></div>
        )}
        <BreakdownList title="Por idade" rows={deep.byAge} />
        <BreakdownList title="Por gênero" rows={deep.byGender} />
      </div>
    </div>
  )
}

// === Revisão de conversões: o que está sendo contado vs o que existe na conta ===
type ConvEvent = { actionType: string; count: number; role?: string }
type ConvReview = {
  meta?: { accountId?: string; counting?: string[]; secondary?: string[]; byObjective?: { objective: string; secondary: boolean; events: string[] }[] | null; custom?: boolean; objectives?: string[]; available?: ConvEvent[]; error?: string } | null
  google?: { actions?: { name: string; conversions: number }[]; error?: string } | null
}
function ConversionsReview({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ConvReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/performance/conversions`)
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    const review: ConvReview = res.ok ? d : { meta: { error: d.error ?? "Falha." } }
    setData(review)
    // pré-marca os eventos que já estão sendo contados
    setSel(new Set(review.meta?.counting ?? []))
  }, [clientId])
  const onToggle = () => { setOpen((v) => !v); if (!open && !data) void load() }
  const toggleEvent = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  async function saveMeta() {
    if (!data?.meta?.accountId) return
    setSaving(true); setSaved("")
    const res = await fetch(`/api/clients/${clientId}/ad-accounts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "META", accountId: data.meta.accountId, resultActions: [...sel] }),
    })
    setSaving(false)
    if (res.ok) { clearPerfCache(); setSaved("Salvo. Clique em Atualizar no painel pra recalcular."); await load() }
    else setSaved("Falha ao salvar.")
  }

  const baseline = new Set(data?.meta?.counting ?? [])
  const dirty = data?.meta && (sel.size !== baseline.size || [...sel].some((k) => !baseline.has(k)))
  return (
    <Panel className="p-5">
      <button onClick={onToggle} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Target size={15} className="text-[#FF8F50]" /> Revisão de conversões</span>
        <span className="text-xs text-zinc-500">{open ? "ocultar" : "o que estamos contando?"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          {loading && <div className="flex min-h-16 items-center justify-center"><Loader2 size={16} className="animate-spin text-[#FF8F50]" /></div>}
          {/* META — com checkboxes pra escolher os eventos corretos */}
          {data?.meta && (
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <p className="mb-2 text-xs font-semibold text-zinc-300">Meta — marque os eventos que contam como resultado</p>
              {data.meta.error ? <p className="text-xs text-red-300">{data.meta.error}</p> : (
                <>
                  {/* Como estamos contando (mapa por objetivo) */}
                  {data.meta.custom ? (
                    <p className="text-[11px] text-zinc-500">Eventos <b className="text-[#FFB185]">fixados na mão</b> (todos contam como resultado primário): {(data.meta.counting ?? []).join(", ") || "—"}.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[11px] text-zinc-500">Contando pelo padrão dos objetivos da conta:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(data.meta.byObjective ?? []).map((o) => (
                          <span key={o.objective} className={`rounded px-2 py-1 text-[10px] ${o.secondary ? "bg-violet-500/15 text-violet-300" : "bg-emerald-500/15 text-emerald-300"}`} title={o.events.join(", ")}>
                            {OBJ_LABEL[o.objective] ?? o.objective}{o.secondary ? " · secundário" : ""} ({o.events.length} evento{o.events.length !== 1 ? "s" : ""})
                          </span>
                        ))}
                        {!(data.meta.byObjective ?? []).length && <span className="text-[10px] text-zinc-600">Nenhum objetivo configurado.</span>}
                      </div>
                      <p className="text-[10px] text-zinc-600"><b className="text-emerald-300/80">Primário</b> soma em Resultados/CPA. <b className="text-violet-300/80">Secundário</b> (seguidores) conta à parte, fora do total. Marque abaixo pra fixar eventos na mão.</p>
                    </div>
                  )}
                  {/* Teste: cada evento REAL da conta e o veredito */}
                  <div className="mt-2 max-h-60 space-y-0.5 overflow-y-auto">
                    {(data.meta.available ?? []).map((a) => {
                      // Prévia ao vivo: com seleção manual, marcado = conta (primário); sem seleção, usa o papel do servidor.
                      const role = sel.size > 0 ? (sel.has(a.actionType) ? "primary" : "none") : (a.role ?? "none")
                      const badge = role === "primary" ? { t: "conta", c: "bg-emerald-500/15 text-emerald-300" } : role === "secondary" ? { t: "seguidor", c: "bg-violet-500/15 text-violet-300" } : { t: "não conta", c: "bg-white/5 text-zinc-600" }
                      return (
                        <label key={a.actionType} className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-[11px] hover:bg-white/5 ${sel.has(a.actionType) ? "text-[#FFB185]" : "text-zinc-400"}`}>
                          <span className="flex min-w-0 items-center gap-2">
                            <input type="checkbox" checked={sel.has(a.actionType)} onChange={() => toggleEvent(a.actionType)} className="accent-[#FF8F50]" />
                            <span className="truncate">{a.actionType}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] ${badge.c}`}>{badge.t}</span>
                            <span className="tabular-nums text-zinc-500">{a.count.toLocaleString("pt-BR")}</span>
                          </span>
                        </label>
                      )
                    })}
                    {!data.meta.available?.length && <p className="text-[11px] text-zinc-600">Nenhum evento nos últimos 90 dias.</p>}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" disabled={saving || !dirty} onClick={saveMeta}>{saving ? <Loader2 size={13} className="animate-spin" /> : "Salvar eventos"}</Button>
                    {sel.size === 0 && <span className="text-[11px] text-zinc-600">vazio = volta ao padrão dos funis</span>}
                    {saved && <span className="text-[11px] text-emerald-300">{saved}</span>}
                  </div>
                </>
              )}
            </div>
          )}
          {/* GOOGLE — leitura (config fica no Google Ads) */}
          {data?.google && (
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <p className="mb-2 text-xs font-semibold text-zinc-300">Google — ações de conversão contadas (período atual)</p>
              {data.google.error ? <p className="text-xs text-red-300">{data.google.error}</p> : (
                <>
                  <p className="text-[11px] text-zinc-500">Tudo abaixo soma em &quot;Result.&quot; (metrics.conversions). Se algo não deveria contar (ligação, page view…), ajuste em Conversões no Google Ads.</p>
                  <div className="mt-1.5 space-y-1">
                    {(data.google.actions ?? []).map((a) => (
                      <div key={a.name} className="flex items-center justify-between rounded px-2 py-1 text-[11px] text-zinc-300">
                        <span className="truncate">{a.name}</span>
                        <span className="shrink-0 tabular-nums text-sky-300">{a.conversions.toLocaleString("pt-BR")}</span>
                      </div>
                    ))}
                    {!data.google.actions?.length && <p className="text-[11px] text-zinc-600">Nenhuma conversão no período.</p>}
                  </div>
                </>
              )}
            </div>
          )}
          {data && !data.meta && !data.google && <p className="text-xs text-zinc-600">Nenhuma conta de Ads configurada.</p>}
        </div>
      )}
    </Panel>
  )
}

// === Integrações de Ads + conversão por cliente (multi-objetivo + IA sugere) ===
type AdAccount = { provider: "META" | "GOOGLE"; accountId: string; lastFour: string | null; objectives: string[]; resultActions: string[]; trackRevenue: boolean }
const OBJECTIVES = [
  { v: "LEAD", label: "Leads" },
  { v: "WHATSAPP", label: "Conversas" },
  { v: "ECOMMERCE", label: "Compras" },
  { v: "SEGUIDORES", label: "Seguidores" },
]
function AdIntegrations({ clientId, onError }: { clientId: string; onError: (m: string) => void }) {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [open, setOpen] = useState(false)
  const [meta, setMeta] = useState({ accountId: "", token: "", objectives: [] as string[], trackRevenue: false, resultActions: [] as string[] })
  const [google, setGoogle] = useState({ accountId: "", objectives: [] as string[], trackRevenue: false })
  const [busy, setBusy] = useState(false)
  const [aiNote, setAiNote] = useState("")

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/ad-accounts`)
    if (res.ok) {
      const data = await res.json()
      setAccounts(data.accounts)
      const m = data.accounts.find((a: AdAccount) => a.provider === "META")
      const g = data.accounts.find((a: AdAccount) => a.provider === "GOOGLE")
      if (m) setMeta((s) => ({ ...s, accountId: m.accountId, objectives: m.objectives ?? [], trackRevenue: m.trackRevenue, resultActions: m.resultActions }))
      if (g) setGoogle({ accountId: g.accountId, objectives: g.objectives ?? [], trackRevenue: g.trackRevenue })
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

  async function suggest(provider: "META" | "GOOGLE") {
    setBusy(true); onError(""); setAiNote("Lendo o contexto do cliente…")
    const res = await fetch(`/api/clients/${clientId}/ad-accounts/suggest?provider=${provider}`, { method: "POST" })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setAiNote(""); onError(data.error ?? "Falha na sugestão da IA."); return }
    const s = data.suggestion
    if (provider === "META") setMeta((m) => ({ ...m, objectives: s.objectives, resultActions: s.resultActions, trackRevenue: s.trackRevenue }))
    else setGoogle((g) => ({ ...g, objectives: s.objectives, trackRevenue: s.trackRevenue }))
    setAiNote(`IA sugeriu: ${s.objectives.join(", ")}${s.trackRevenue ? " + ROAS" : ""}. ${s.reasoning ?? ""} — confira e Salve.`)
  }

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const metaAcc = accounts.find((a) => a.provider === "META")
  const googleAcc = accounts.find((a) => a.provider === "GOOGLE")

  const ObjChecks = ({ selected, onToggle }: { selected: string[]; onToggle: (v: string) => void }) => (
    <div className="flex flex-wrap gap-2">
      {OBJECTIVES.map((o) => (
        <button key={o.v} type="button" onClick={() => onToggle(o.v)}
          className={`rounded-lg border px-2.5 py-1 text-xs ${selected.includes(o.v) ? "border-[#FF8F50]/50 bg-[#FF8F50]/15 text-[#FFB185]" : "border-white/10 text-zinc-400"}`}>
          {selected.includes(o.v) ? "✓ " : ""}{o.label}
        </button>
      ))}
    </div>
  )

  return (
    <Panel className="p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Plug size={15} className="text-[#FF8F50]" /> Integrações de Ads & conversão</span>
        <span className="text-xs text-zinc-500">{metaAcc ? "Meta ✓" : "Meta —"} · {googleAcc ? "Google ✓" : "Google —"}</span>
      </button>
      {open && (
        <>
          {aiNote && <p className="mt-3 rounded-lg border border-[#FF8F50]/20 bg-[#FF8F50]/[0.06] px-3 py-2 text-[11px] text-[#FFB185]">{aiNote}</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Meta */}
            <div className="rounded-lg border border-white/8 bg-black/20 p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Meta Ads (token por cliente)</p>
              <Input value={meta.accountId} onChange={(e) => setMeta({ ...meta, accountId: e.target.value })} placeholder="act_XXXXXXXX" />
              <Input type="password" value={meta.token} onChange={(e) => setMeta({ ...meta, token: e.target.value })} placeholder={metaAcc?.lastFour ? `token salvo ••••${metaAcc.lastFour} — trocar` : "access token"} />
              <p className="text-[11px] text-zinc-500">Funis (pode marcar vários):</p>
              <ObjChecks selected={meta.objectives} onToggle={(v) => setMeta({ ...meta, objectives: toggle(meta.objectives, v), trackRevenue: meta.trackRevenue || (v === "ECOMMERCE" && !meta.objectives.includes(v)) })} />
              <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={meta.trackRevenue} onChange={(e) => setMeta({ ...meta, trackRevenue: e.target.checked })} /> Receita / ROAS</label>
              <div className="flex gap-2">
                <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" disabled={busy || !meta.accountId} onClick={() => save("META", meta)}>Salvar</Button>
                <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" disabled={busy || !metaAcc} onClick={() => suggest("META")}>✨ Sugerir com IA</Button>
              </div>
            </div>
            {/* Google */}
            <div className="rounded-lg border border-white/8 bg-black/20 p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Google Ads (MCC central)</p>
              <Input value={google.accountId} onChange={(e) => setGoogle({ ...google, accountId: e.target.value })} placeholder="customer id (ex: 1284541690)" />
              <p className="text-[11px] text-zinc-500">Funis (pode marcar vários):</p>
              <ObjChecks selected={google.objectives} onToggle={(v) => setGoogle({ ...google, objectives: toggle(google.objectives, v), trackRevenue: google.trackRevenue || (v === "ECOMMERCE" && !google.objectives.includes(v)) })} />
              <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={google.trackRevenue} onChange={(e) => setGoogle({ ...google, trackRevenue: e.target.checked })} /> Receita / ROAS</label>
              <p className="text-[11px] text-zinc-600">Sem token aqui — usa o MCC do ambiente.</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" disabled={busy || !google.accountId} onClick={() => save("GOOGLE", google)}>Salvar</Button>
                <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" disabled={busy || !googleAcc} onClick={() => suggest("GOOGLE")}>✨ Sugerir com IA</Button>
              </div>
            </div>
          </div>
        </>
      )}
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
