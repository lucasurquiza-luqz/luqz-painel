"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Printer, TrendingUp, TrendingDown } from "lucide-react"
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PageHeader, Panel } from "@/components/ui/primitives"
import { projectFunnel, type PlanFunnel } from "@/lib/media-plan"

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }))
const brl2 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"))
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", SEGUIDORES: "Seguidores", CUSTOM: "Resultados" }
function curMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` }
function fmtMonthLong(m: string) { const [y, mm] = m.split("-"); const full = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]; return `${full[Number(mm) - 1] ?? mm} de ${y}` }
function shiftMonth(m: string, delta: number) { const [y, mm] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mm - 1 + delta, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` }

type Totals = { spend: number; impressions: number; clicks: number; pageViews: number; results: number; followers: number; cpa: number | null; revenue: number | null; roas: number | null; ctr: number | null; cpc: number | null; cpm: number | null }
type Daily = { date: string; spend: number; results: number; impressions: number; clicks: number; pageViews: number; revenue: number }[]
type Bd = { objective: string; count: number }[]
type Provider = { provider: string; error?: string; spend?: number; results?: number; followers?: number }
type Perf = { current: { total: Totals; breakdown: Bd; byProvider: Provider[]; daily: Daily; trackRevenue: boolean; configured: boolean }; previous: Totals }
type Plan = { id: string; month: string; funnels: PlanFunnel[] }
type Insight = { id: string; text: string; createdByName: string | null; createdAt: string }
type History = { month: string; spend: number; results: number; cpa: number | null }[]
type Action = { id: string; title: string; project: string | null; completedAt: string; result: string | null }
type Upcoming = { id: string; title: string; dueDate: string | null; status: string; project: string | null }

const tooltipStyle = { background: "#161616", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }

export default function RelatorioPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [month, setMonth] = useState(curMonth())
  const [clientName, setClientName] = useState("")
  const [perf, setPerf] = useState<Perf | null>(null)
  const [history, setHistory] = useState<History>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [insight, setInsight] = useState<Insight | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [upcoming, setUpcoming] = useState<Upcoming[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch(`/api/clients/${clientId}`).then((r) => r.json()).then((d) => setClientName(d.client?.name ?? "")).catch(() => {}) }, [clientId])

  const load = useCallback(async () => {
    setLoading(true)
    const [p, pl, ins, rep] = await Promise.all([
      fetch(`/api/clients/${clientId}/performance?month=${month}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/clients/${clientId}/media-plans?month=${month}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/clients/${clientId}/performance/insight?month=${month}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/clients/${clientId}/report?month=${month}`).then((r) => r.json()).catch(() => ({})),
    ])
    setPerf(p.performance ?? null); setHistory(p.history ?? [])
    setPlans(pl.plans ?? [])
    setInsight((ins.insights ?? [])[0] ?? null)
    setActions(rep.actions ?? []); setUpcoming(rep.upcoming ?? [])
    setLoading(false)
  }, [clientId, month])
  useEffect(() => { void load() }, [load])

  const t = perf?.current.total
  const prev = perf?.previous
  const trackRevenue = !!perf?.current.trackRevenue
  const allFunnels = plans.flatMap((p) => p.funnels ?? [])
  const budgetTarget = allFunnels.reduce((s, f) => s + (f.budget ?? 0), 0)
  const leadsTarget = Math.round(allFunnels.reduce((s, f) => { const pr = projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket }); return s + (pr.rows[0]?.value ?? 0) }, 0))
  const revTarget = allFunnels.reduce((s, f) => { const pr = projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket }); return s + (pr.revenue ?? 0) }, 0)
  const roasTarget = budgetTarget > 0 && revTarget > 0 ? revTarget / budgetTarget : 0
  const primaryBd = (perf?.current.breakdown ?? []).filter((b) => b.objective !== "SEGUIDORES")
  const resultLabel = primaryBd.length === 1 ? OBJ_LABEL[primaryBd[0].objective] ?? "Resultados" : "Resultados"

  // Pacing (mês em curso).
  const [y, m] = month.split("-").map(Number)
  const daysTotal = new Date(y, m, 0).getDate()
  const daysElapsed = month === curMonth() ? Math.min(new Date().getDate(), daysTotal) : daysTotal
  const inMonth = daysElapsed > 0 && daysElapsed < daysTotal
  const project = (v: number) => (inMonth ? Math.round((v / daysElapsed) * daysTotal) : null)

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/clientes/${clientId}`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><ArrowLeft size={18} /></Link>
        <PageHeader eyebrow="Resultado" title="Relatório mensal" description="Resumo executivo de performance — pronto pra compartilhar." />
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5">
          <button onClick={() => setMonth((mm) => shiftMonth(mm, -1))} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5"><ChevronLeft size={16} /></button>
          <span className="min-w-28 text-center text-xs font-semibold text-white">{fmtMonthLong(month)}</span>
          <button onClick={() => setMonth((mm) => shiftMonth(mm, 1))} disabled={month >= curMonth()} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><Printer size={14} /> PDF</button>
      </div>

      {loading ? (
        <Panel className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : !perf || !t || !perf.current.configured ? (
        <Panel className="p-10 text-center text-sm text-zinc-600">Sem dados de performance para {fmtMonthLong(month)}. Configure a conta de Ads e atualize o mês.</Panel>
      ) : (() => {
        const okProviders = perf.current.byProvider.filter((p) => !p.error)
        const primary = trackRevenue && t.revenue != null ? { big: brl(t.revenue), label: "de receita" } : { big: int(t.results), label: resultLabel.toLowerCase() }
        return (
        <div className="space-y-6">
          {/* ===== HERO ===== */}
          <Panel className="relative overflow-hidden p-7 lg:p-9">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#FF8F50]/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FF8F50]">{clientName || "Cliente"} · {fmtMonthLong(month)}</p>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                <span className="dash-display text-5xl leading-none text-white lg:text-6xl">{primary.big}</span>
                <span className="pb-1 text-lg text-zinc-400">{primary.label}</span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Investimento de <b className="text-zinc-200">{brl(t.spend)}</b>
                {okProviders.length > 1 ? ` distribuído em ${okProviders.map((p) => p.provider === "META" ? "Meta" : "Google").join(" + ")}` : ""}
                {t.cpa != null ? `, gerando ${int(t.results)} ${resultLabel.toLowerCase()} a ${brl2(t.cpa)} de CPA` : ""}
                {trackRevenue && t.roas != null ? ` e ROAS de ${t.roas.toFixed(2)}x` : ""}
                {t.followers > 0 ? `. Ganho de +${int(t.followers)} seguidores` : ""}.
              </p>
              {budgetTarget > 0 && (
                <div className="mt-4 max-w-md">
                  <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-zinc-500">Verba executada</span><span className="text-zinc-300">{brl(t.spend)} <span className="text-zinc-600">/ {brl(budgetTarget)}</span></span></div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-[#FF8F50]" style={{ width: `${Math.min(100, Math.round((t.spend / budgetTarget) * 100))}%` }} /></div>
                </div>
              )}
            </div>
          </Panel>

          {/* ===== RESUMO EXECUTIVO ===== */}
          {insight && (
            <Panel className="border-[#FF8F50]/20 bg-[#FF8F50]/[0.04] p-5">
              <p className="mb-2 text-xs font-semibold text-[#FFB185]">Resumo executivo</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">{insight.text}</p>
            </Panel>
          )}

          {/* ===== O QUE FIZEMOS ===== */}
          <Panel className="p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">✅ O que fizemos no mês {actions.length > 0 && <span className="text-xs font-normal text-zinc-500">{actions.length} entrega(s)</span>}</p>
            {actions.length === 0 ? (
              <p className="text-xs text-zinc-600">Nenhuma tarefa concluída registrada em {fmtMonthLong(month)}.</p>
            ) : (
              <ul className="space-y-2.5">
                {actions.map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-5 text-zinc-100">{a.title}{a.project && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">{a.project}</span>}</p>
                      {a.result && <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-5 text-zinc-400">{a.result}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ===== O QUE GERAMOS ===== */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm font-semibold text-white">📈 O que geramos</span>
            <span className="h-px flex-1 bg-white/8" />
          </div>

          {/* ===== KPIs principais ===== */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Investimento" value={brl(t.spend)} target={budgetTarget || undefined} cur={t.spend} prev={prev?.spend} proj={project(t.spend)} lowerBetter />
            <Kpi label={resultLabel} value={int(t.results)} target={leadsTarget || undefined} cur={t.results} prev={prev?.results} proj={project(t.results)} />
            <Kpi label="CPA" value={brl2(t.cpa)} cur={t.cpa} prev={prev?.cpa} lowerBetter />
            {trackRevenue ? <Kpi label="ROAS" value={t.roas != null ? `${t.roas.toFixed(2)}x` : "—"} cur={t.roas} prev={prev?.roas} target={roasTarget || undefined} targetIsRatio /> : <Kpi label="CTR" value={t.ctr != null ? `${t.ctr.toFixed(2)}%` : "—"} cur={t.ctr} prev={prev?.ctr} />}
          </div>

          {/* ===== Evolução diária ===== */}
          {perf.current.daily.length > 1 && (
            <Panel className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-300">Evolução diária</p>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#FF8F50]" /> Investimento</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> {resultLabel}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={perf.current.daily.map((d) => ({ dia: d.date.slice(8, 10), spend: Math.round(d.spend), results: d.results }))} margin={{ top: 5, right: 6, left: -6, bottom: 0 }}>
                  <defs><linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF8F50" stopOpacity={0.3} /><stop offset="100%" stopColor="#FF8F50" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="dia" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} formatter={(v, n) => [n === "Investimento" ? brl(Number(v)) : int(Number(v)), n as string]} />
                  <Area yAxisId="l" type="monotone" dataKey="spend" name="Investimento" stroke="#FF8F50" strokeWidth={2} fill="url(#gSpend)" />
                  <Line yAxisId="r" type="monotone" dataKey="results" name={resultLabel} stroke="#38bdf8" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ===== Funil ===== */}
            <Panel className="p-5">
              <p className="mb-3 text-xs font-semibold text-zinc-300">🔻 Funil do mês</p>
              <Funnel steps={[
                { label: "Impressões", value: t.impressions, display: int(t.impressions) },
                { label: "Cliques", value: t.clicks, display: int(t.clicks) },
                ...(t.pageViews > 0 ? [{ label: "Visitas à página", value: t.pageViews, display: int(t.pageViews) }] : []),
                { label: resultLabel, value: t.results, display: int(t.results) },
                ...(trackRevenue && t.revenue != null ? [{ label: "Receita", value: t.revenue, display: brl(t.revenue) }] : []),
              ]} />
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-center">
                <MiniStat label="CTR" value={t.ctr != null ? `${t.ctr.toFixed(2)}%` : "—"} />
                <MiniStat label="CPC" value={brl2(t.cpc)} />
                <MiniStat label="CPM" value={brl2(t.cpm)} />
              </div>
            </Panel>

            {/* ===== Metas × realizado ===== */}
            <Panel className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-300">🎯 Metas × realizado</p>
                {inMonth && <span className="text-[10px] text-zinc-600">dia {daysElapsed}/{daysTotal}</span>}
              </div>
              {budgetTarget > 0 || leadsTarget > 0 ? (
                <div className="space-y-3">
                  {budgetTarget > 0 && <MetaBar label="Investimento" cur={brl(t.spend)} target={brl(budgetTarget)} pct={Math.round((t.spend / budgetTarget) * 100)} good proj={project(t.spend) != null ? brl(project(t.spend)!) : undefined} />}
                  {leadsTarget > 0 && <MetaBar label={resultLabel} cur={int(t.results)} target={int(leadsTarget)} pct={Math.round((t.results / leadsTarget) * 100)} good={t.results >= leadsTarget} proj={project(t.results) != null ? int(project(t.results)!) : undefined} projGood={project(t.results) != null ? project(t.results)! >= leadsTarget : undefined} />}
                  {roasTarget > 0 && t.roas != null && <MetaBar label="ROAS" cur={`${t.roas.toFixed(2)}x`} target={`${roasTarget.toFixed(2)}x`} pct={Math.round((t.roas / roasTarget) * 100)} good={t.roas >= roasTarget} />}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Nenhum plano de mídia definido para {fmtMonthLong(month)}.</p>
              )}
              {okProviders.length > 0 && (
                <div className="mt-4 border-t border-white/8 pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Composição por fonte</p>
                  <div className="space-y-2">
                    {okProviders.map((p) => {
                      const share = t.spend > 0 ? Math.round(((p.spend ?? 0) / t.spend) * 100) : 0
                      return (
                        <div key={p.provider}>
                          <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-zinc-300">{p.provider === "META" ? "Meta Ads" : "Google Ads"} <span className="text-zinc-600">({share}%)</span></span><span className="text-zinc-500">{brl(p.spend ?? 0)} · {int(p.results ?? 0)} result.</span></div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-sky-400/70" style={{ width: `${share}%` }} /></div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* ===== Plano / funis ===== */}
          {allFunnels.length > 0 && (
            <Panel className="p-5">
              <p className="mb-3 text-xs font-semibold text-zinc-300">Plano de mídia do mês</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allFunnels.map((f) => {
                  const pr = projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket })
                  return (
                    <div key={f.id} className="rounded-lg border border-white/8 bg-black/20 p-3">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-zinc-100">{f.name}</span>
                        {f.platform && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9px] text-zinc-300">{f.platform === "META" ? "Meta" : "Google"}</span>}
                        <span className="rounded bg-[#FF8F50]/15 px-1.5 py-0.5 text-[9px] text-[#FFB185]">{OBJ_LABEL[f.objective] ?? f.objective}</span>
                      </div>
                      <p className="text-[11px] leading-5 text-zinc-500">Verba {brl(f.budget)}{f.cpl ? ` · CPL ${brl2(f.cpl)}` : ""}<br />Meta: {int(pr.rows[0]?.value ?? 0)} {(OBJ_LABEL[f.objective] ?? "").toLowerCase()}{pr.roas != null ? ` · ROAS ${pr.roas.toFixed(2)}x` : ""}</p>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* ===== PRÓXIMOS PASSOS ===== */}
          <Panel className="p-5">
            <p className="mb-3 text-sm font-semibold text-white">➡️ Próximos passos</p>
            {upcoming.length === 0 ? (
              <p className="text-xs text-zinc-600">Sem tarefas abertas no momento.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((u) => (
                  <li key={u.id} className="flex items-center gap-2.5 text-[13px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{u.title}{u.project && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">{u.project}</span>}</span>
                    {u.dueDate && <span className="shrink-0 text-[11px] text-zinc-500">{new Date(u.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ===== Histórico ===== */}
          {history.length >= 2 && (
            <Panel className="p-5">
              <p className="mb-3 text-xs font-semibold text-zinc-300">Histórico · {resultLabel} e CPA</p>
              <ResponsiveContainer width="100%" height={170}>
                <ComposedChart data={history.map((h) => ({ mes: MONTHS[Number(h.month.slice(5)) - 1], [resultLabel]: h.results, CPA: h.cpa ? Math.round(h.cpa) : 0 }))} margin={{ top: 5, right: 6, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mes" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
                  <Bar yAxisId="l" dataKey={resultLabel} fill="#FF8F50" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="CPA" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
          )}

          <p className="text-center text-[10px] text-zinc-600">Relatório gerado pelo LUQZ Dash · {clientName} · {fmtMonthLong(month)}</p>
        </div>
        )
      })()}
    </main>
  )
}

function Kpi({ label, value, target, targetIsRatio, cur, prev, proj, lowerBetter }: { label: string; value: string; target?: number; targetIsRatio?: boolean; cur?: number | null; prev?: number | null; proj?: number | null; lowerBetter?: boolean }) {
  let trend: { txt: string; up: boolean; good: boolean } | null = null
  if (prev != null && cur != null && prev > 0) { const d = Math.round(((cur - prev) / prev) * 100); if (d !== 0) trend = { txt: `${d > 0 ? "+" : ""}${d}%`, up: d > 0, good: lowerBetter ? d < 0 : d > 0 } }
  const pctTarget = target && cur != null && target > 0 ? Math.round((cur / target) * 100) : null
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="dash-display mt-1 text-2xl text-white">{value}</p>
      {pctTarget != null && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-[#FF8F50]" style={{ width: `${Math.min(100, pctTarget)}%` }} /></div>
          <p className="mt-1 text-[10px] text-zinc-600">meta {targetIsRatio ? `${target!.toFixed(2)}x` : (label === "Investimento" ? brl(target!) : int(target!))} · {pctTarget}%</p>
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {trend && <span className={`flex items-center gap-0.5 text-[10px] ${trend.good ? "text-emerald-300" : "text-amber-300"}`}>{trend.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{trend.txt}</span>}
        {proj != null && <span className="text-[10px] text-zinc-600">proj. ~{label === "Investimento" ? brl(proj) : int(proj)}</span>}
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-zinc-600">{label}</p><p className="mt-0.5 text-sm font-semibold text-zinc-200">{value}</p></div>
}

function MetaBar({ label, cur, target, pct, good, proj, projGood }: { label: string; cur: string; target: string; pct: number; good: boolean; proj?: string; projGood?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className={good ? "text-emerald-300" : "text-amber-300"}>{cur} <span className="text-zinc-600">/ {target} · {pct}%</span></span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full ${good ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.min(100, Math.max(3, pct))}%` }} /></div>
      {proj && <p className="mt-1 text-[10px] text-zinc-600">no ritmo: <b className={projGood ? "text-emerald-300" : "text-amber-300"}>~{proj}</b> até o fim do mês</p>}
    </div>
  )
}

// Funil visual com escala log (impressões não esmagam as etapas menores).
function Funnel({ steps }: { steps: { label: string; value: number; display: string }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  const logMax = Math.log(max + 1)
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const conv = i > 0 && steps[i - 1].value > 0 ? (s.value / steps[i - 1].value) * 100 : null
        const width = s.value > 0 ? Math.max(5, (Math.log(s.value + 1) / logMax) * 100) : 0
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{s.label}</span>
              <span className="font-semibold text-zinc-100">{s.display}{conv != null && <span className="ml-2 text-[10px] text-zinc-600">{conv < 1 ? conv.toFixed(2) : conv.toFixed(0)}%</span>}</span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-[#FF8F50] to-[#FFB185]" style={{ width: `${width}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}
