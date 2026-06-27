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

// === Painel Performance (visual + leitura de IA) ===
type Perf = {
  month: string
  current: {
    total: { spend: number; impressions: number; clicks: number; results: number; cpa: number | null; revenue: number | null; roas: number | null; ctr: number | null; cpc: number | null; cpm: number | null }
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

function DailyChart({ daily }: { daily: { date: string; spend: number; results: number }[] }) {
  if (!daily.length) return null
  const max = Math.max(...daily.map((d) => d.spend), 1)
  const W = 600, H = 80, gap = 2
  const bw = (W - gap * (daily.length - 1)) / daily.length
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] text-zinc-500">Evolução do gasto (diário)</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" preserveAspectRatio="none" style={{ height: 80 }}>
        {daily.map((d, i) => {
          const h = (d.spend / max) * (H - 4)
          return <rect key={d.date} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={1} fill="#FF8F50" opacity={0.85} />
        })}
      </svg>
    </div>
  )
}

function PerformanceDashboard({ clientId, plans }: { clientId: string; plans: Plan[] }) {
  const [month, setMonth] = useState(currentMonth())
  const [perf, setPerf] = useState<Perf | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [reading, setReading] = useState("")
  const [readingBusy, setReadingBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setReading("")
    const res = await fetch(`/api/clients/${clientId}/performance?month=${month}`)
    const payload = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(payload.error ?? "Falha ao carregar performance."); setPerf(null); return }
    setPerf(payload.performance)
  }, [clientId, month])
  useEffect(() => { void load() }, [load])

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

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Target size={15} className="text-[#FF8F50]" /> Painel de performance</h2>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-9 w-40 [color-scheme:dark]" />
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : err ? (
        <p className="mt-4 text-sm text-red-300">{err}</p>
      ) : !perf || !t ? null : !perf.current.configured ? (
        <p className="mt-4 text-sm text-zinc-500">Configure uma conta de Ads acima para ver a performance.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Investimento" value={brl(t.spend)} pct={pct(t.spend, plan?.budget)} trend={<Trend cur={t.spend} prev={perf.previous.spend} />} />
            <KpiCard label={perf.current.breakdown.length === 1 ? OBJ_LABEL[perf.current.breakdown[0].objective] ?? "Resultados" : "Resultados"} value={String(t.results)} pct={pct(t.results, plan?.targetLeads)} trend={<Trend cur={t.results} prev={perf.previous.results} />} />
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

          {/* Funil */}
          <div className="rounded-xl border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] text-zinc-500">Funil</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <FunnelStep label="Impressões" value={t.impressions.toLocaleString("pt-BR")} />
              <span className="text-zinc-600">▸</span>
              <FunnelStep label="Cliques" value={t.clicks.toLocaleString("pt-BR")} />
              <span className="text-zinc-600">▸</span>
              <FunnelStep label="Resultados" value={String(t.results)} />
              {perf.current.trackRevenue && <><span className="text-zinc-600">▸</span><FunnelStep label="Receita" value={brl(t.revenue)} /></>}
            </div>
            {perf.current.breakdown.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                {perf.current.breakdown.map((b) => <span key={b.objective} className="rounded bg-[#FF8F50]/10 px-2 py-0.5 text-[#FFB185]">{OBJ_LABEL[b.objective] ?? b.objective}: {b.count}</span>)}
              </div>
            )}
          </div>

          <DailyChart daily={perf.current.daily} />

          {/* Fontes */}
          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
            {perf.current.byProvider.map((p) => (
              <span key={p.provider} className="rounded bg-white/5 px-2 py-1">{p.provider}: {p.error ? `erro` : `${brl(p.spend ?? 0)} · ${p.results} result.`}</span>
            ))}
          </div>

          {/* Destaques: melhores campanhas / públicos / criativos (Meta) */}
          <Destaques clientId={clientId} month={month} />

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

// Melhores campanhas / públicos / criativos (Meta) — sob demanda por aba.
type BdRow = { name: string; spend: number; impressions: number; clicks: number; results: number; cpa: number | null; ctr: number | null }
const DEST_TABS: { level: string; label: string }[] = [
  { level: "campaign", label: "Campanhas" },
  { level: "adset", label: "Públicos" },
  { level: "ad", label: "Criativos" },
]
function Destaques({ clientId, month }: { clientId: string; month: string }) {
  const [level, setLevel] = useState("campaign")
  const [rows, setRows] = useState<BdRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const load = useCallback(async (lv: string) => {
    setLoading(true); setErr(""); setRows(null)
    const res = await fetch(`/api/clients/${clientId}/performance/breakdown?month=${month}&level=${lv}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setErr(data.error ?? "Falha ao carregar."); return }
    setRows(data.rows)
  }, [clientId, month])

  useEffect(() => { void load(level) }, [load, level])

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-500">Destaques (Meta)</p>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
          {DEST_TABS.map((t) => (
            <button key={t.level} onClick={() => setLevel(t.level)} className={`rounded-md px-2.5 py-1 text-[11px] ${level === t.level ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex min-h-20 items-center justify-center"><Loader2 size={16} className="animate-spin text-[#FF8F50]" /></div>
      ) : err ? (
        <p className="mt-3 text-xs text-red-300">{err}</p>
      ) : !rows?.length ? (
        <p className="mt-3 text-xs text-zinc-600">Sem dados neste nível para o mês.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-zinc-600">
              <tr><th className="pb-1 pr-2">Nome</th><th className="pb-1 px-2 text-right">Gasto</th><th className="pb-1 px-2 text-right">Result.</th><th className="pb-1 px-2 text-right">CPA</th><th className="pb-1 pl-2 text-right">CTR</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="max-w-[200px] truncate py-1.5 pr-2 text-zinc-200" title={r.name}>{r.name}</td>
                  <td className="px-2 py-1.5 text-right text-zinc-400">{brl(r.spend)}</td>
                  <td className="px-2 py-1.5 text-right font-medium text-zinc-100">{r.results}</td>
                  <td className="px-2 py-1.5 text-right text-zinc-400">{brl(r.cpa)}</td>
                  <td className="pl-2 py-1.5 text-right text-zinc-400">{r.ctr != null ? `${r.ctr.toFixed(2)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FunnelStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-1.5">
      <span className="text-zinc-500">{label}: </span><span className="font-semibold text-zinc-100">{value}</span>
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

// === Realizado vs meta — funil (gasto → cliques → resultado → ROAS) ===
type ProviderRow = { provider: string; spend?: number; results?: number; cpa?: number | null; revenue?: number | null; roas?: number | null; error?: string }
type Realizado = {
  byProvider: ProviderRow[]
  total: { spend: number; impressions: number; clicks: number; results: number; cpa: number | null; revenue: number | null; roas: number | null }
  breakdown: { objective: string; count: number }[]
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
  const resultLabel = data && data.breakdown.length === 1 ? OBJ_RESULT_LABEL[data.breakdown[0].objective] ?? "Resultados" : "Resultados"

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
          {data.breakdown.length > 1 && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {data.breakdown.map((b) => (
                <span key={b.objective} className="rounded bg-[#FF8F50]/10 px-2 py-0.5 text-[#FFB185]">
                  {OBJ_RESULT_LABEL[b.objective] ?? b.objective}: {b.count}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600">
            {data.byProvider.map((p) => (
              <span key={p.provider} className="rounded bg-white/5 px-2 py-0.5">
                {p.provider}: {p.error ? `erro (${p.error})` : `${brl(p.spend ?? 0)} · ${p.results} result.`}
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
