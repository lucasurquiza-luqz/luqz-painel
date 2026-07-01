"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Printer, TrendingDown, TrendingUp } from "lucide-react"
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PageHeader, Panel } from "@/components/ui/primitives"

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }))
const brl2 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"))
const roasFmt = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`)
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", SEGUIDORES: "Seguidores", CUSTOM: "Resultados" }

type Totals = { spend: number; results: number; followers: number; cpa: number | null; roas: number | null; revenue: number | null; impressions: number; clicks: number }
type Provider = { provider: "META" | "GOOGLE"; error?: string; spend?: number; results?: number; followers?: number }
type Daily = { date: string; spend: number; results: number }
type Perf = {
  month: string
  current: { total: Totals; byProvider: Provider[]; breakdown: { objective: string; count: number }[]; daily: Daily[]; trackRevenue: boolean; configured: boolean }
  previous: Totals
}
type History = { month: string; spend: number; results: number; cpa: number | null }[]

function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` }
function shiftMonth(m: string, delta: number) { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` }
const provLabel = (p: string) => (p === "META" ? "Meta Ads" : p === "GOOGLE" ? "Google Ads" : p)

export default function DesempenhoPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [clientName, setClientName] = useState("")
  const [month, setMonth] = useState(thisMonth())
  const [perf, setPerf] = useState<Perf | null>(null)
  const [history, setHistory] = useState<History>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch(`/api/clients/${clientId}`).then((r) => r.json()).then((d) => setClientName(d.client?.name ?? "")).catch(() => {}) }, [clientId])
  const load = useCallback(async () => {
    setLoading(true)
    const d = await fetch(`/api/clients/${clientId}/performance?month=${month}`).then((r) => r.json()).catch(() => null)
    setPerf(d?.performance ?? null); setHistory(d?.history ?? []); setLoading(false)
  }, [clientId, month])
  useEffect(() => { void load() }, [load])

  const monthName = MONTHS[Number(month.slice(5)) - 1]
  const year = month.slice(0, 4)
  const t = perf?.current.total
  const prev = perf?.previous
  const track = perf?.current.trackRevenue

  const chart = useMemo(() => (perf?.current.daily ?? []).map((d) => ({ day: d.date.slice(8), spend: d.spend, results: d.results })), [perf])
  const objLabel = useMemo(() => {
    const objs = (perf?.current.breakdown ?? []).map((b) => b.objective).filter((o) => o !== "SEGUIDORES")
    return objs.length === 1 ? OBJ_LABEL[objs[0]] ?? "Resultados" : "Resultados"
  }, [perf])

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/clientes/${clientId}`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><ArrowLeft size={18} /></Link>
        <PageHeader eyebrow="Performance" title="Dashboard de performance" description="O que a mídia investiu e gerou no mês." />
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"><ChevronLeft size={16} /></button>
          <span className="min-w-28 text-center text-xs font-medium capitalize text-zinc-200">{monthName} {year}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, +1))} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><Printer size={14} /> PDF</button>
      </div>

      {loading ? (
        <Panel className="flex min-h-60 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : !perf || !t || !perf.current.configured ? (
        <Panel className="p-10 text-center text-sm text-zinc-600">Sem dados de performance para {monthName} de {year}.</Panel>
      ) : (
        <div className="space-y-5">
          {/* ===== KPIs ===== */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Investido" value={brl(t.spend)} delta={delta(t.spend, prev?.spend)} deltaGood="neutral" />
            <Kpi label={objLabel} value={int(t.results)} delta={delta(t.results, prev?.results)} deltaGood="up" />
            <Kpi label="Custo por resultado" value={brl2(t.cpa)} delta={delta(t.cpa, prev?.cpa)} deltaGood="down" />
            {track ? <Kpi label="ROAS" value={roasFmt(t.roas)} delta={delta(t.roas, prev?.roas)} deltaGood="up" /> : <Kpi label="Cliques" value={int(t.clicks)} />}
          </div>

          {/* ===== SEGUIDORES (métrica secundária, fora do total) ===== */}
          {t.followers > 0 && (
            <Panel className="flex items-center gap-3 p-4">
              <span className="rounded-lg bg-[#FF8F50]/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#FFB185]">Secundário</span>
              <p className="text-sm text-zinc-300"><b className="dash-display text-lg text-white">{int(t.followers)}</b> novos seguidores no mês <span className="text-zinc-600">· não entra no custo por resultado nem no ROAS</span></p>
            </Panel>
          )}

          {/* ===== EVOLUÇÃO DIÁRIA ===== */}
          <Panel className="p-5">
            <p className="mb-3 text-sm font-semibold text-white">Evolução diária</p>
            {chart.length < 2 ? (
              <p className="py-8 text-center text-xs text-zinc-600">Ainda sem dias suficientes no mês pra desenhar a curva.</p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF8F50" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#FF8F50" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => brl(v)} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#a1a1aa" }} formatter={(v, n) => [n === "spend" ? brl(Number(v)) : int(Number(v)), n === "spend" ? "Investido" : objLabel]} labelFormatter={(l) => `Dia ${l}`} />
                    <Area yAxisId="l" type="monotone" dataKey="spend" stroke="#FF8F50" strokeWidth={2} fill="url(#spendFill)" />
                    <Line yAxisId="r" type="monotone" dataKey="results" stroke="#34d399" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ===== POR FONTE ===== */}
            <Panel className="p-5">
              <p className="mb-3 text-sm font-semibold text-white">Por fonte</p>
              <div className="space-y-2">
                {(perf.current.byProvider ?? []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[13px]">
                    <span className="text-zinc-200">{provLabel(p.provider)}</span>
                    {p.error ? (
                      <span className="text-[11px] text-amber-300/80">indisponível</span>
                    ) : (
                      <span className="text-zinc-400">{brl(p.spend)} · <b className="text-zinc-100">{int(p.results)}</b> {objLabel.toLowerCase()}</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            {/* ===== POR OBJETIVO ===== */}
            <Panel className="p-5">
              <p className="mb-3 text-sm font-semibold text-white">Por objetivo</p>
              {(perf.current.breakdown ?? []).length === 0 ? (
                <p className="text-xs text-zinc-600">Sem resultados no período.</p>
              ) : (
                <div className="space-y-2">
                  {(perf.current.breakdown ?? []).map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[13px]">
                      <span className="text-zinc-200">{OBJ_LABEL[b.objective] ?? b.objective}{b.objective === "SEGUIDORES" && <span className="ml-1.5 text-[10px] text-zinc-600">(secundário)</span>}</span>
                      <b className="text-zinc-100">{int(b.count)}</b>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* ===== HISTÓRICO ===== */}
          {history.length > 1 && (
            <Panel className="p-5">
              <p className="mb-3 text-sm font-semibold text-white">Últimos meses</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-zinc-500">
                    <tr><th className="pb-2 font-medium">Mês</th><th className="pb-2 text-right font-medium">Investido</th><th className="pb-2 text-right font-medium">{objLabel}</th><th className="pb-2 text-right font-medium">Custo/result.</th></tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.month} className="border-t border-white/6">
                        <td className="py-1.5 capitalize text-zinc-300">{MONTHS[Number(h.month.slice(5)) - 1]?.slice(0, 3)}/{h.month.slice(2, 4)}</td>
                        <td className="py-1.5 text-right text-zinc-300">{brl(h.spend)}</td>
                        <td className="py-1.5 text-right text-zinc-100">{int(h.results)}</td>
                        <td className="py-1.5 text-right text-zinc-400">{brl2(h.cpa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <p className="text-center text-[10px] text-zinc-600">Dashboard de performance · {clientName} · {monthName} {year}</p>
        </div>
      )}
    </main>
  )
}

// Delta percentual vs mês anterior. Retorna null quando não dá pra comparar.
function delta(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || prev === 0) return null
  return (cur - prev) / prev
}

function Kpi({ label, value, delta, deltaGood }: { label: string; value: string; delta?: number | null; deltaGood?: "up" | "down" | "neutral" }) {
  const up = delta != null && delta > 0
  const good = delta == null || deltaGood === "neutral" ? null : deltaGood === "up" ? up : !up
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="dash-display mt-1 text-2xl text-white">{value}</p>
      {delta != null && Math.abs(delta) >= 0.005 && (
        <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${good == null ? "text-zinc-500" : good ? "text-emerald-400" : "text-red-400"}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% vs mês anterior
        </p>
      )}
    </div>
  )
}
