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
type Totals = { spend: number; impressions: number; clicks: number; pageViews: number; results: number; cpa: number | null; revenue: number | null; roas: number | null; ctr: number | null; cpc: number | null; cpm: number | null }
type Bd = { objective: string; count: number }[]
type DlyPoint = { date: string; spend: number; results: number; impressions: number; clicks: number; pageViews: number; revenue: number }
type Dly = DlyPoint[]
type ProviderMetrics = { provider: string; error?: string; spend?: number; impressions?: number; clicks?: number; pageViews?: number; results?: number; cpa?: number | null; revenue?: number | null; roas?: number | null; breakdown?: Bd; daily?: Dly }
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
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", CUSTOM: "Resultados" }

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
  const [reading, setReading] = useState("")
  const [readingBusy, setReadingBusy] = useState(false)
  const [source, setSource] = useState<string>("all") // "all" | "META" | "GOOGLE"
  const [tab, setTab] = useState<string>("overview") // overview | campaigns | creatives | insights
  const selectSource = (s: string) => { setSource(s); setTab("overview") }

  const qs = range.month ? `month=${range.month}` : `since=${range.since}&until=${range.until}`

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setReading("")
    const res = await fetch(`/api/clients/${clientId}/performance?${qs}`)
    const payload = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(payload.error ?? "Falha ao carregar performance."); setPerf(null); return }
    setPerf(payload.performance); setHistory(payload.history ?? []); setFetchedAt(payload.fetchedAt ?? null)
  }, [clientId, qs])
  useEffect(() => { void load() }, [load])

  async function refresh() {
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
    setReadingBusy(true)
    const res = await fetch(`/api/clients/${clientId}/performance/insight`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: range.month }),
    })
    const data = await res.json()
    setReadingBusy(false)
    setReading(res.ok ? data.reading : (data.error ?? "Falha na leitura."))
  }

  const plan = range.month ? (plans.find((p) => p.month === range.month && p.platform === "TOTAL") ?? plans.find((p) => p.month === range.month)) : undefined
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
          spend, impressions, clicks, pageViews: provider.pageViews ?? 0, results: provider.results ?? 0,
          cpa: provider.cpa ?? null, revenue: provider.revenue ?? null, roas: provider.roas ?? null,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
          cpc: clicks > 0 ? spend / clicks : null,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
          breakdown: provider.breakdown ?? [], daily: provider.daily ?? [],
        }
      })() : null
  const resultLabel = view && view.breakdown.length === 1 ? OBJ_LABEL[view.breakdown[0].objective] ?? "Resultados" : "Resultados"

  // Status de saúde de resultado (consolidado, simples, explicável).
  let status: { label: string; tone: string; why: string } | null = null
  if (t) {
    if (plan?.targetCpa && t.cpa && t.cpa > plan.targetCpa * 1.1) status = { label: "Atenção", tone: "text-amber-300", why: `CPA acima da meta (${brl(t.cpa)} vs ${brl(plan.targetCpa)})` }
    else if (plan?.targetRoas && t.roas != null && t.roas < plan.targetRoas) status = { label: "Atenção", tone: "text-amber-300", why: `ROAS abaixo da meta (${t.roas.toFixed(2)}x vs ${plan.targetRoas}x)` }
    else if (plan?.targetCpa || plan?.targetRoas) status = { label: "Saudável", tone: "text-emerald-300", why: "Dentro das metas" }
  }
  const SOURCE_LABEL: Record<string, string> = { all: "Consolidado", META: "Meta", GOOGLE: "Google" }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Target size={15} className="text-[#FF8F50]" /> Painel de performance</h2>
        <div className="flex items-center gap-2">
          {fetchedAt && <span className="text-[10px] text-zinc-600">atualizado {new Date(fetchedAt).toLocaleString("pt-BR")}</span>}
          <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={refresh} disabled={refreshing || loading}>{refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Atualizar</Button>
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
                ? [["overview", "Visão Geral"], ["campaigns", "Campanhas"], ["creatives", "Criativos"], ["insights", "Análises"]]
                : [["overview", "Visão Geral"], ["campaigns", "Campanhas"], ["insights", "Termos & análises"]]
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
          {/* KPIs principais com mini-tendência. Metas/trend só no consolidado. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Investimento" value={brl(view.spend)} pct={isAll ? pct(view.spend, plan?.budget) : null} trend={isAll ? <Trend cur={view.spend} prev={perf.previous.spend} /> : undefined} spark={view.daily.map((d) => d.spend ?? 0)} sparkColor="#FF8F50" />
            <KpiCard label={resultLabel} value={String(view.results)} pct={isAll ? pct(view.results, plan?.targetLeads) : null} trend={isAll ? <Trend cur={view.results} prev={perf.previous.results} /> : undefined} spark={view.daily.map((d) => d.results ?? 0)} sparkColor="#38bdf8" />
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
                <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={genReading} disabled={readingBusy}>{readingBusy ? <Loader2 size={13} className="animate-spin" /> : "Gerar leitura"}</Button>
              </div>
              {reading && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{reading}</p>}
            </div>
          )}
          </>
          ))}

          {/* === CAMPANHAS === */}
          {!isAll && tab === "campaigns" && source === "META" && <Explorer clientId={clientId} since={range.since} until={range.until} />}
          {!isAll && tab === "campaigns" && source === "GOOGLE" && <GoogleExplorer clientId={clientId} since={range.since} until={range.until} />}

          {/* === CRIATIVOS (Meta) === */}
          {!isAll && tab === "creatives" && source === "META" && <CreativesGrid clientId={clientId} since={range.since} until={range.until} />}

          {/* === ANÁLISES === */}
          {!isAll && tab === "insights" && source === "META" && <MetaDeepPanel clientId={clientId} since={range.since} until={range.until} />}
          {!isAll && tab === "insights" && source === "GOOGLE" && <GoogleExplorer clientId={clientId} since={range.since} until={range.until} />}
        </div>
      )}
    </Panel>
  )
}

// Explorador: Campanha → Conjunto (público) → Anúncio (preview). Drill-down.
type AdNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; hookRate: number | null; convRate: number | null; thumbnail: string | null; permalink: string | null }
type AdsetNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; audience: string | null; ads: AdNode[] }
type CampaignNode = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; adsets: AdsetNode[] }
const chevron = (on: boolean) => <span className={`inline-block text-zinc-500 transition-transform ${on ? "rotate-90" : ""}`}>▸</span>

// === Tabela de métricas em árvore (campanha ▸ filho ▸ neto), ordenável, com detalhes ao clicar ===
type TNode = {
  id: string; name: string
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
  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: "spend", dir: -1 })
  const isOpen = (id: string) => open[id] ?? expandAll

  const sortTree = (arr: TNode[]): TNode[] =>
    [...arr].sort((a, b) => (colValue(a, sort.key) - colValue(b, sort.key)) * sort.dir)
      .map((n) => (n.children?.length ? { ...n, children: sortTree(n.children) } : n))
  const rows: { n: TNode; depth: number }[] = []
  const walk = (arr: TNode[], depth: number) => { for (const n of arr) { rows.push({ n, depth }); if (n.children?.length && isOpen(n.id)) walk(n.children, depth + 1) } }
  walk(sortTree(nodes), 0)
  const total = nodes.reduce((s, n) => s + n.spend, 0) || 1

  const clickRow = (n: TNode) => { if (n.children?.length) setOpen((o) => ({ ...o, [n.id]: !(o[n.id] ?? expandAll) })); else setDetail((d) => (d === n.id ? null : n.id)) }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-400">{title} <span className="text-zinc-600">· {levels.join(" ▸ ")}</span></p>
        {!!nodes.length && <button onClick={() => { setExpandAll((v) => !v); setOpen({}) }} className="text-[11px] text-zinc-500 hover:text-zinc-300">{expandAll ? "Recolher tudo" : "Expandir tudo"}</button>}
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
                      <span className={`block truncate ${depth === 0 ? "font-semibold text-zinc-50" : "text-zinc-200"}`} title={n.name}>{n.name}</span>
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
    const res = await fetch(`/api/clients/${clientId}/performance/explore?since=${since}&until=${until}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao explorar."); return }
    setCampaigns(data.campaigns)
  }, [clientId, since, until])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>

  const nodes: TNode[] = (campaigns ?? []).map((c) => ({
    id: c.id, name: c.name, spend: c.spend, impressions: c.impressions, clicks: c.clicks, results: c.results, cpa: c.cpa, ctr: c.ctr,
    children: c.adsets.map((s) => ({
      id: s.id, name: s.name, spend: s.spend, impressions: s.impressions, clicks: s.clicks, results: s.results, cpa: s.cpa, ctr: s.ctr,
      subtitle: s.audience ? `👥 ${s.audience}` : null,
      children: s.ads.map((ad) => ({
        id: ad.id, name: ad.name, spend: ad.spend, impressions: ad.impressions, clicks: ad.clicks, results: ad.results, cpa: ad.cpa, ctr: ad.ctr,
        thumbnail: ad.thumbnail, permalink: ad.permalink, hookRate: ad.hookRate, convRate: ad.convRate,
      })),
    })),
  }))
  return <MetricTree nodes={nodes} title="Explorador (Meta)" levels={["Campanha", "Conjunto", "Anúncio"]} />
}

// Criativos (Meta): todos os anúncios achatados, ordenados por gasto, com preview grande.
function CreativesGrid({ clientId, since, until }: { clientId: string; since: string; until: string }) {
  const [ads, setAds] = useState<AdNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setAds(null)
    const res = await fetch(`/api/clients/${clientId}/performance/explore?since=${since}&until=${until}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao carregar criativos."); return }
    const flat: AdNode[] = (data.campaigns ?? []).flatMap((c: CampaignNode) => c.adsets.flatMap((s) => s.ads))
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
type GKeyword = { text: string; matchType: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }
type GAdGroup = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; keywords: GKeyword[] }
type GCampaign = { id: string; name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null; adGroups: GAdGroup[] }
const MATCH_LABEL: Record<string, string> = { EXACT: "exata", PHRASE: "frase", BROAD: "ampla" }

function GoogleExplorer({ clientId, since, until }: { clientId: string; since: string; until: string }) {
  const [campaigns, setCampaigns] = useState<GCampaign[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setCampaigns(null)
    const res = await fetch(`/api/clients/${clientId}/performance/explore?provider=GOOGLE&since=${since}&until=${until}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao explorar."); return }
    setCampaigns(data.campaigns)
  }, [clientId, since, until])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
  if (err) return <p className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-red-300">{err}</p>

  let kwIdx = 0
  const nodes: TNode[] = (campaigns ?? []).map((c) => ({
    id: c.id, name: c.name, spend: c.spend, impressions: c.impressions, clicks: c.clicks, results: c.results, cpa: c.cpa, ctr: c.ctr,
    children: c.adGroups.map((g) => ({
      id: g.id, name: g.name, spend: g.spend, impressions: g.impressions, clicks: g.clicks, results: g.results, cpa: g.cpa, ctr: g.ctr,
      children: g.keywords.map((k) => ({
        id: `kw-${kwIdx++}`, name: k.text, spend: k.spend, impressions: k.impressions, clicks: k.clicks, results: k.results, cpa: k.cpa, ctr: k.ctr,
        matchType: MATCH_LABEL[k.matchType] ?? k.matchType.toLowerCase(),
      })),
    })),
  }))
  return <MetricTree nodes={nodes} title="Explorador (Google)" levels={["Campanha", "Grupo", "Palavra-chave"]} />
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
    const res = await fetch(`/api/clients/${clientId}/performance/meta-insights?since=${since}&until=${until}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao ler análises Meta."); return }
    setDeep(data.deep)
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
