"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plug, Plus, RefreshCw, Target, Trash2, X } from "lucide-react"
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
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
        <PageHeader eyebrow="Saúde de resultado" title="Performance" description="Metas + realizado dos Ads por funil (lead, conversa, compra), vs meta. Multi-fonte: Meta + Google (+ vendas em breve)." />
      </div>

      <AdIntegrations clientId={clientId} onError={setError} />

      <PerformanceDashboard clientId={clientId} plans={plans} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Metas por mês</h2>
        <Button onClick={() => setAdding((v) => !v)}><Plus size={16} /> Nova meta</Button>
      </div>

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

// === Painel Performance (visual + leitura de IA) ===
type Perf = {
  month: string
  current: {
    total: { spend: number; impressions: number; clicks: number; pageViews: number; results: number; cpa: number | null; revenue: number | null; roas: number | null; ctr: number | null; cpc: number | null; cpm: number | null }
    breakdown: { objective: string; count: number }[]
    daily: { date: string; spend: number; results: number }[]
    byProvider: { provider: string; spend?: number; results?: number; error?: string }[]
    trackRevenue: boolean
    configured: boolean
  }
  previous: { spend: number; results: number; cpa: number | null; roas: number | null }
}
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", CUSTOM: "Resultados" }

function Trend({ cur, prev, goodWhenUp = true }: { cur: number | null; prev: number | null; goodWhenUp?: boolean }) {
  if (cur == null || prev == null || prev === 0) return null
  const delta = Math.round(((cur - prev) / prev) * 100)
  if (delta === 0) return <span className="text-[10px] text-zinc-600">estável</span>
  const up = delta > 0
  const good = up === goodWhenUp
  return <span className={`text-[10px] ${good ? "text-emerald-400" : "text-red-400"}`}>{up ? "▲" : "▼"} {Math.abs(delta)}% vs mês ant.</span>
}

function KpiCard({ label, value, pct, trend }: { label: string; value: string; pct?: number | null; trend?: React.ReactNode }) {
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
      <div className="mt-1">{trend}</div>
    </div>
  )
}

const tooltipStyle = { background: "#161616", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }

// Evolução diária: gasto (área) + resultados (linha), eixos duplos.
function DailyChart({ daily, resultLabel }: { daily: { date: string; spend: number; results: number }[]; resultLabel: string }) {
  if (!daily.length) return null
  const data = daily.map((d) => ({ dia: d.date.slice(8, 10), Gasto: Math.round(d.spend), [resultLabel]: d.results }))
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="mb-2 text-[11px] text-zinc-500">Evolução diária</p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8F50" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#FF8F50" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="dia" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
          <YAxis yAxisId="r" orientation="right" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
          <Area yAxisId="l" type="monotone" dataKey="Gasto" stroke="#FF8F50" strokeWidth={2} fill="url(#gSpend)" />
          <Line yAxisId="r" type="monotone" dataKey={resultLabel} stroke="#38bdf8" strokeWidth={2} dot={false} />
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

// Funil visual: barras decrescentes com taxa de conversão entre etapas.
function VisualFunnel({ steps }: { steps: { label: string; value: number; display: string }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="mb-3 text-[11px] text-zinc-500">Funil</p>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const conv = i > 0 && steps[i - 1].value > 0 ? ((s.value / steps[i - 1].value) * 100) : null
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">{s.label}</span>
                <span className="font-semibold text-zinc-100">{s.display}{conv != null && <span className="ml-2 text-[10px] text-zinc-600">{conv < 1 ? conv.toFixed(2) : conv.toFixed(0)}%</span>}</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-[#FF8F50] to-[#FFB185]" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type History = { month: string; spend: number; results: number; cpa: number | null }[]
function PerformanceDashboard({ clientId, plans }: { clientId: string; plans: Plan[] }) {
  const [month, setMonth] = useState(currentMonth())
  const [perf, setPerf] = useState<Perf | null>(null)
  const [history, setHistory] = useState<History>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState("")
  const [reading, setReading] = useState("")
  const [readingBusy, setReadingBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setReading("")
    const res = await fetch(`/api/clients/${clientId}/performance?month=${month}`)
    const payload = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(payload.error ?? "Falha ao carregar performance."); setPerf(null); return }
    setPerf(payload.performance); setHistory(payload.history ?? []); setFetchedAt(payload.fetchedAt ?? null)
  }, [clientId, month])
  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true); setErr("")
    const res = await fetch(`/api/clients/${clientId}/performance`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month }),
    })
    const data = await res.json()
    setRefreshing(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao atualizar."); return }
    setPerf(data.performance); setFetchedAt(data.fetchedAt)
  }

  async function genReading() {
    setReadingBusy(true)
    const res = await fetch(`/api/clients/${clientId}/performance/insight`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month }),
    })
    const data = await res.json()
    setReadingBusy(false)
    setReading(res.ok ? data.reading : (data.error ?? "Falha na leitura."))
  }

  const plan = plans.find((p) => p.month === month && p.platform === "TOTAL") ?? plans.find((p) => p.month === month)
  const t = perf?.current.total
  const pct = (real: number, target: number | null | undefined) => (target && target > 0 ? Math.round((real / target) * 100) : null)
  const resultLabel = perf && perf.current.breakdown.length === 1 ? OBJ_LABEL[perf.current.breakdown[0].objective] ?? "Resultados" : "Resultados"

  // Status de saúde de resultado (simples, explicável).
  let status: { label: string; tone: string; why: string } | null = null
  if (t) {
    if (plan?.targetCpa && t.cpa && t.cpa > plan.targetCpa * 1.1) status = { label: "Atenção", tone: "text-amber-300", why: `CPA acima da meta (${brl(t.cpa)} vs ${brl(plan.targetCpa)})` }
    else if (plan?.targetRoas && t.roas != null && t.roas < plan.targetRoas) status = { label: "Atenção", tone: "text-amber-300", why: `ROAS abaixo da meta (${t.roas.toFixed(2)}x vs ${plan.targetRoas}x)` }
    else if (plan?.targetCpa || plan?.targetRoas) status = { label: "Saudável", tone: "text-emerald-300", why: "Dentro das metas" }
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Target size={15} className="text-[#FF8F50]" /> Painel de performance</h2>
        <div className="flex items-center gap-2">
          {fetchedAt && <span className="text-[10px] text-zinc-600">atualizado {new Date(fetchedAt).toLocaleString("pt-BR")}</span>}
          <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={refresh} disabled={refreshing || loading}>{refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Atualizar</Button>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-9 w-40 [color-scheme:dark]" />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : err ? (
        <p className="mt-4 text-sm text-red-300">{err}</p>
      ) : !perf || !t ? null : !perf.current.configured ? (
        <p className="mt-4 text-sm text-zinc-500">Configure uma conta de Ads acima para ver a performance.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {status && <p className="text-sm"><span className="text-zinc-500">Saúde de resultado: </span><span className={`font-semibold ${status.tone}`}>{status.label}</span> <span className="text-zinc-600">· {status.why}</span></p>}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Investimento" value={brl(t.spend)} pct={pct(t.spend, plan?.budget)} trend={<Trend cur={t.spend} prev={perf.previous.spend} />} />
            <KpiCard label={resultLabel} value={String(t.results)} pct={pct(t.results, plan?.targetLeads)} trend={<Trend cur={t.results} prev={perf.previous.results} />} />
            <KpiCard label="CPA" value={brl(t.cpa)} trend={<Trend cur={t.cpa} prev={perf.previous.cpa} goodWhenUp={false} />} />
            {perf.current.trackRevenue
              ? <KpiCard label="ROAS" value={t.roas != null ? `${t.roas.toFixed(2)}x` : "—"} trend={<Trend cur={t.roas} prev={perf.previous.roas} />} />
              : <KpiCard label="Cliques" value={t.clicks.toLocaleString("pt-BR")} />}
          </div>

          {/* Métricas de mídia */}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="CTR" value={t.ctr != null ? `${t.ctr.toFixed(2)}%` : "—"} />
            <KpiCard label="CPC" value={brl(t.cpc)} />
            <KpiCard label="CPM" value={brl(t.cpm)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DailyChart daily={perf.current.daily} resultLabel={resultLabel} />
            <VisualFunnel steps={[
              { label: "Impressões", value: t.impressions, display: t.impressions.toLocaleString("pt-BR") },
              { label: "Cliques", value: t.clicks, display: t.clicks.toLocaleString("pt-BR") },
              ...(t.pageViews > 0 ? [{ label: "Visualizações de página", value: t.pageViews, display: t.pageViews.toLocaleString("pt-BR") }] : []),
              { label: resultLabel, value: t.results, display: String(t.results) },
              ...(perf.current.trackRevenue && t.revenue != null ? [{ label: "Receita", value: t.revenue, display: brl(t.revenue) }] : []),
            ]} />
          </div>

          <HistoryChart history={history} resultLabel={resultLabel} />

          {/* Fontes */}
          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
            {perf.current.byProvider.map((p) => (
              <span key={p.provider} className="rounded bg-white/5 px-2 py-1">{p.provider}: {p.error ? `erro` : `${brl(p.spend ?? 0)} · ${p.results} ${resultLabel.toLowerCase()}`}</span>
            ))}
          </div>

          <Explorer clientId={clientId} month={month} />

          {/* Leitura de IA */}
          <div className="rounded-xl border border-[#FF8F50]/20 bg-[#FF8F50]/[0.05] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#FFB185]">🤖 Leitura de performance</span>
              <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={genReading} disabled={readingBusy}>{readingBusy ? <Loader2 size={13} className="animate-spin" /> : "Gerar leitura"}</Button>
            </div>
            {reading && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{reading}</p>}
          </div>
        </div>
      )}
    </Panel>
  )
}

// Explorador: Campanha → Conjunto (público) → Anúncio (preview). Drill-down.
type AdNode = { id: string; name: string; spend: number; results: number; cpa: number | null; ctr: number | null; hookRate: number | null; convRate: number | null; thumbnail: string | null; permalink: string | null }
type AdsetNode = { id: string; name: string; spend: number; results: number; cpa: number | null; ctr: number | null; audience: string | null; ads: AdNode[] }
type CampaignNode = { id: string; name: string; spend: number; results: number; cpa: number | null; ctr: number | null; adsets: AdsetNode[] }
const mini = (spend: number, results: number, cpa: number | null) => `${brl(spend)} · ${results} result. · CPA ${brl(cpa)}`

function Explorer({ clientId, month }: { clientId: string; month: string }) {
  const [campaigns, setCampaigns] = useState<CampaignNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }))

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setCampaigns(null)
    const res = await fetch(`/api/clients/${clientId}/performance/explore?month=${month}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao explorar."); return }
    setCampaigns(data.campaigns)
  }, [clientId, month])
  useEffect(() => { void load() }, [load])

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="mb-2 text-[11px] text-zinc-500">Explorador — Campanha ▸ Conjunto (público) ▸ Anúncio (Meta)</p>
      {loading ? (
        <div className="flex min-h-20 items-center justify-center"><Loader2 size={16} className="animate-spin text-[#FF8F50]" /></div>
      ) : err ? (
        <p className="text-xs text-red-300">{err}</p>
      ) : !campaigns?.length ? (
        <p className="text-xs text-zinc-600">Sem campanhas com veiculação no mês.</p>
      ) : (
        <div className="space-y-1.5">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/8 bg-black/20">
              <button onClick={() => toggle(c.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="text-zinc-600">{open[c.id] ? "▾" : "▸"}</span>
                  <span className="truncate font-medium text-zinc-100">{c.name}</span>
                </span>
                <span className="shrink-0 text-[11px] text-zinc-500">{mini(c.spend, c.results, c.cpa)}</span>
              </button>
              {open[c.id] && (
                <div className="space-y-1 border-t border-white/5 px-2 py-2">
                  {c.adsets.map((s) => (
                    <div key={s.id} className="rounded-lg bg-white/[0.02]">
                      <button onClick={() => toggle(s.id)} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left">
                        <span className="flex min-w-0 items-center gap-2 text-xs">
                          <span className="text-zinc-600">{open[s.id] ? "▾" : "▸"}</span>
                          <span className="truncate text-zinc-300">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-500">{mini(s.spend, s.results, s.cpa)}</span>
                      </button>
                      {s.audience && <p className="px-3 pb-1 text-[10px] text-sky-300/70">👥 {s.audience}</p>}
                      {open[s.id] && (
                        <div className="space-y-1 px-2 pb-2">
                          {s.ads.map((ad) => (
                            <div key={ad.id} className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1.5">
                              {ad.thumbnail ? <img src={ad.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : <span className="h-9 w-9 shrink-0 rounded bg-white/5" />}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] text-zinc-200" title={ad.name}>{ad.name}</p>
                                <p className="text-[10px] text-zinc-500">{brl(ad.spend)} · {ad.results} result. · CTR {ad.ctr != null ? `${ad.ctr.toFixed(1)}%` : "—"} · Hook {ad.hookRate != null ? `${ad.hookRate.toFixed(0)}%` : "—"} · Conv {ad.convRate != null ? `${ad.convRate.toFixed(0)}%` : "—"}</p>
                              </div>
                              {ad.permalink && <a href={ad.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] text-[#FFB185] hover:underline">abrir ↗</a>}
                            </div>
                          ))}
                          {!s.ads.length && <p className="px-2 text-[10px] text-zinc-600">Sem anúncios com veiculação.</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// === Integrações de Ads + conversão por cliente (multi-objetivo + IA sugere) ===
type AdAccount = { provider: "META" | "GOOGLE"; accountId: string; lastFour: string | null; objectives: string[]; resultActions: string[]; trackRevenue: boolean }
const OBJECTIVES = [
  { v: "LEAD", label: "Leads" },
  { v: "WHATSAPP", label: "Conversas" },
  { v: "ECOMMERCE", label: "Compras" },
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
