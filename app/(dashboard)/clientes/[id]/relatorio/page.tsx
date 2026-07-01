"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react"
import { PageHeader, Panel } from "@/components/ui/primitives"
import { projectFunnel, type PlanFunnel } from "@/lib/media-plan"

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"))
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", SEGUIDORES: "Seguidores", CUSTOM: "Resultados" }
function curMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` }
function fmtMonth(m: string) { const [y, mm] = m.split("-"); return `${MONTHS[Number(mm) - 1] ?? mm}/${y}` }
function shiftMonth(m: string, delta: number) { const [y, mm] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mm - 1 + delta, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` }

type Totals = { spend: number; impressions: number; clicks: number; results: number; followers: number; cpa: number | null; revenue: number | null; roas: number | null }
type Bd = { objective: string; count: number }[]
type Provider = { provider: string; error?: string; spend?: number; results?: number; followers?: number }
type Perf = { current: { total: Totals; breakdown: Bd; byProvider: Provider[]; trackRevenue: boolean; configured: boolean }; previous: Totals }
type Plan = { id: string; month: string; funnels: PlanFunnel[] }
type Insight = { id: string; text: string; createdByName: string | null; createdAt: string }
type History = { month: string; spend: number; results: number; cpa: number | null }[]

export default function RelatorioPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [month, setMonth] = useState(curMonth())
  const [clientName, setClientName] = useState("")
  const [perf, setPerf] = useState<Perf | null>(null)
  const [history, setHistory] = useState<History>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [insight, setInsight] = useState<Insight | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch(`/api/clients/${clientId}`).then((r) => r.json()).then((d) => setClientName(d.client?.name ?? "")).catch(() => {}) }, [clientId])

  const load = useCallback(async () => {
    setLoading(true)
    const [p, pl, ins] = await Promise.all([
      fetch(`/api/clients/${clientId}/performance?month=${month}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/clients/${clientId}/media-plans?month=${month}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/clients/${clientId}/performance/insight?month=${month}`).then((r) => r.json()).catch(() => ({})),
    ])
    setPerf(p.performance ?? null); setHistory(p.history ?? [])
    setPlans(pl.plans ?? [])
    setInsight((ins.insights ?? [])[0] ?? null)
    setLoading(false)
  }, [clientId, month])
  useEffect(() => { void load() }, [load])

  const t = perf?.current.total
  // Metas agregadas dos funis do plano do mês.
  const allFunnels = plans.flatMap((p) => p.funnels ?? [])
  const budgetTarget = allFunnels.reduce((s, f) => s + (f.budget ?? 0), 0)
  const projTop = allFunnels.reduce((s, f) => { const pr = projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket }); return s + (pr.rows[0]?.value ?? 0) }, 0)
  const leadsTarget = Math.round(projTop)
  // Rótulo do resultado primário (ignora seguidores).
  const primaryBd = (perf?.current.breakdown ?? []).filter((b) => b.objective !== "SEGUIDORES")
  const resultLabel = primaryBd.length === 1 ? OBJ_LABEL[primaryBd[0].objective] ?? "Resultados" : "Resultados"
  const trackRevenue = !!perf?.current.trackRevenue

  const pct = (real: number, target: number) => (target > 0 ? Math.round((real / target) * 100) : null)

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/clientes/${clientId}/metas`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><ArrowLeft size={18} /></Link>
        <PageHeader eyebrow="Resultado" title="Relatório mensal" description="Resumo executivo de performance do mês — pronto pra compartilhar." />
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><Printer size={14} /> Imprimir / PDF</button>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center justify-center gap-3 print:hidden">
        <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"><ChevronLeft size={18} /></button>
        <span className="min-w-32 text-center text-sm font-semibold text-white">{fmtMonth(month)}</span>
        <button onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= curMonth()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <Panel className="flex min-h-60 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : !perf || !t || !perf.current.configured ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Sem dados de performance para {fmtMonth(month)}. Configure a conta de Ads e atualize o mês.</Panel>
      ) : (
        <div className="space-y-5">
          {/* === MANCHETE === */}
          <Panel className="p-6 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#FF8F50]">{clientName || "Cliente"} · {fmtMonth(month)}</p>
            <h1 className="mt-2 text-2xl font-semibold leading-snug text-white lg:text-3xl">
              {trackRevenue && t.revenue != null ? <>Gerou <span className="text-[#FF8F50]">{brl(t.revenue)}</span> em receita{t.roas != null ? <> a <span className="text-[#FF8F50]">{t.roas.toFixed(2)}x</span> de ROAS</> : ""}.</>
                : <><span className="text-[#FF8F50]">{int(t.results)}</span> {resultLabel.toLowerCase()} {t.cpa != null ? <>a <span className="text-[#FF8F50]">{brl(t.cpa)}</span> de CPA</> : ""}.</>}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Investimento de <b className="text-zinc-200">{brl(t.spend)}</b>
              {perf.current.byProvider.filter((p) => !p.error).length > 1 ? ` em ${perf.current.byProvider.filter((p) => !p.error).map((p) => p.provider === "META" ? "Meta" : "Google").join(" + ")}` : ""}
              {budgetTarget > 0 ? ` · ${pct(t.spend, budgetTarget)}% da verba planejada (${brl(budgetTarget)})` : ""}.
              {t.followers > 0 ? ` +${int(t.followers)} seguidores.` : ""}
            </p>
          </Panel>

          {/* === KPIs === */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Investimento" value={brl(t.spend)} sub={budgetTarget > 0 ? `meta ${brl(budgetTarget)}` : undefined} prev={perf.previous.spend} cur={t.spend} />
            <Kpi label={resultLabel} value={int(t.results)} sub={leadsTarget > 0 ? `meta ${int(leadsTarget)}` : undefined} prev={perf.previous.results} cur={t.results} />
            <Kpi label="CPA" value={brl(t.cpa)} prev={perf.previous.cpa} cur={t.cpa} lowerBetter />
            {trackRevenue ? <Kpi label="ROAS" value={t.roas != null ? `${t.roas.toFixed(2)}x` : "—"} prev={perf.previous.roas} cur={t.roas} /> : <Kpi label="Cliques" value={int(t.clicks)} prev={perf.previous.clicks} cur={t.clicks} />}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* === ESQUERDA: composição + evolução === */}
            <Panel className="p-5">
              <p className="mb-3 text-xs font-semibold text-zinc-300">📊 Composição do mês</p>
              {perf.current.byProvider.filter((p) => !p.error).length > 0 ? (
                <div className="space-y-2">
                  {perf.current.byProvider.filter((p) => !p.error).map((p) => {
                    const share = t.spend > 0 ? Math.round(((p.spend ?? 0) / t.spend) * 100) : 0
                    return (
                      <div key={p.provider}>
                        <div className="mb-1 flex items-center justify-between text-[12px]"><span className="text-zinc-300">{p.provider === "META" ? "Meta Ads" : "Google Ads"}</span><span className="text-zinc-500">{brl(p.spend ?? 0)} · {int(p.results ?? 0)} result.</span></div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-[#FF8F50]" style={{ width: `${share}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-xs text-zinc-600">Sem composição por fonte.</p>}

              {history.length >= 2 && (
                <>
                  <p className="mb-2 mt-5 text-xs font-semibold text-zinc-300">📈 Evolução ({resultLabel})</p>
                  <div className="flex items-end gap-1.5" style={{ height: 90 }}>
                    {history.map((h) => {
                      const max = Math.max(...history.map((x) => x.results), 1)
                      const isCur = h.month === month
                      return (
                        <div key={h.month} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex w-full items-end justify-center" style={{ height: 66 }}>
                            <div className={`w-full max-w-8 rounded-t ${isCur ? "bg-[#FF8F50]" : "bg-white/15"}`} style={{ height: `${Math.max(4, (h.results / max) * 66)}px` }} title={`${int(h.results)} ${resultLabel}`} />
                          </div>
                          <span className={`text-[9px] ${isCur ? "text-[#FFB185]" : "text-zinc-600"}`}>{MONTHS[Number(h.month.slice(5)) - 1]}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </Panel>

            {/* === DIREITA: leitura de IA === */}
            <Panel className="p-5">
              <p className="mb-2 text-xs font-semibold text-zinc-300">🤖 Leitura de performance</p>
              {insight ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{insight.text}</p>
                  <p className="mt-2 text-[10px] text-zinc-600">{insight.createdByName ?? "IA"} · {new Date(insight.createdAt).toLocaleDateString("pt-BR")}</p>
                </>
              ) : (
                <p className="text-xs text-zinc-500">Sem leitura salva deste mês. Gere uma no <Link href={`/clientes/${clientId}/metas`} className="text-[#FFB185] hover:underline">painel de performance</Link> (botão &quot;Gerar leitura&quot;).</p>
              )}
            </Panel>
          </div>

          {/* === FUNIS DO PLANO (metas × realizado por funil, se houver) === */}
          {allFunnels.length > 0 && (
            <Panel className="p-5">
              <p className="mb-3 text-xs font-semibold text-zinc-300">🎯 Plano do mês</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {allFunnels.map((f) => {
                  const pr = projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket })
                  return (
                    <div key={f.id} className="rounded-lg border border-white/8 bg-black/20 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-zinc-100">{f.name}</span>
                        <span className="rounded bg-[#FF8F50]/15 px-1.5 py-0.5 text-[10px] text-[#FFB185]">{OBJ_LABEL[f.objective] ?? f.objective}</span>
                        {f.platform && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-zinc-300">{f.platform === "META" ? "Meta" : "Google"}</span>}
                      </div>
                      <p className="text-[11px] text-zinc-500">Verba {brl(f.budget)}{f.cpl ? ` · CPL ${brl(f.cpl)}` : ""} · meta {int(pr.rows[0]?.value ?? 0)} {(OBJ_LABEL[f.objective] ?? "").toLowerCase()}{pr.roas != null ? ` · ROAS proj. ${pr.roas.toFixed(2)}x` : ""}</p>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          <p className="text-center text-[10px] text-zinc-600">Relatório gerado pelo LUQZ Dash · {clientName} · {fmtMonth(month)}</p>
        </div>
      )}
    </main>
  )
}

function Kpi({ label, value, sub, prev, cur, lowerBetter }: { label: string; value: string; sub?: string; prev?: number | null; cur?: number | null; lowerBetter?: boolean }) {
  let trend: { txt: string; good: boolean } | null = null
  if (prev != null && cur != null && prev > 0) {
    const delta = Math.round(((cur - prev) / prev) * 100)
    if (delta !== 0) trend = { txt: `${delta > 0 ? "+" : ""}${delta}%`, good: lowerBetter ? delta < 0 : delta > 0 }
  }
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="dash-display mt-1 text-2xl text-white">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {sub && <span className="text-[10px] text-zinc-600">{sub}</span>}
        {trend && <span className={`text-[10px] ${trend.good ? "text-emerald-300" : "text-amber-300"}`}>{trend.txt} vs mês ant.</span>}
      </div>
    </div>
  )
}
