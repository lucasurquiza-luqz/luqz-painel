"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Printer } from "lucide-react"
import { PageHeader, Panel } from "@/components/ui/primitives"

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }))
const brl2 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"))
const ddmm = (d: string) => { const [, m, day] = d.split("-"); return `${day}/${m}` }
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", SEGUIDORES: "Seguidores", CUSTOM: "Resultados" }
const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  on: { label: "no ritmo", cls: "text-emerald-300", dot: "bg-emerald-400" },
  warn: { label: "atenção", cls: "text-amber-300", dot: "bg-amber-400" },
  off: { label: "atrasado", cls: "text-red-300", dot: "bg-red-400" },
}

type Seg = { spend: number; results: number; cpa: number | null }
type Row = { funnelId: string; name: string; objective: string | null; platform: string | null; week: Seg; mtd: Seg; meta: { budget: number | null; results: number | null }; expected: number | null; projection: number | null; status: string | null }
type Data = {
  week: { since: string; until: string }; mtd: { since: string; until: string }; month: string; daysElapsed: number; daysTotal: number
  overall: { week: { spend: number; results: number }; mtd: { spend: number; results: number }; meta: { budget: number | null; results: number | null }; expected: number | null; projection: number | null }
  funnels: Row[]; actions: { id: string; title: string; project: string | null }[]
}

export default function RelatorioSemanalPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [clientName, setClientName] = useState("")
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch(`/api/clients/${clientId}`).then((r) => r.json()).then((d) => setClientName(d.client?.name ?? "")).catch(() => {}) }, [clientId])
  const load = useCallback(async () => {
    setLoading(true)
    const d = await fetch(`/api/clients/${clientId}/report/weekly`).then((r) => r.json()).catch(() => null)
    setData(d && !d.error ? d : null); setLoading(false)
  }, [clientId])
  useEffect(() => { void load() }, [load])

  const monthName = data ? MONTHS[Number(data.month.slice(5)) - 1] : ""
  const o = data?.overall
  const overallStatus = o && o.meta.results && o.projection != null ? (o.projection >= o.meta.results ? "on" : o.projection >= o.meta.results * 0.9 ? "warn" : "off") : null

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/clientes/${clientId}/relatorio`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><ArrowLeft size={18} /></Link>
        <PageHeader eyebrow="Resultado" title="Report semanal" description="Checkpoint: como estamos pra bater a meta do mês." />
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><Printer size={14} /> PDF</button>
      </div>

      {loading ? (
        <Panel className="flex min-h-60 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : !data || !o ? (
        <Panel className="p-10 text-center text-sm text-zinc-600">Sem dados de Ads para o período. Configure a conta e tente de novo.</Panel>
      ) : (
        <div className="space-y-5">
          {/* ===== STATUS GERAL (pacing) ===== */}
          <Panel className="relative overflow-hidden p-6 lg:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#FF8F50]/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FF8F50]">{clientName || "Cliente"} · Semana {ddmm(data.week.since)}–{ddmm(data.week.until)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Checkpoint de {monthName} · dia {data.daysElapsed}/{data.daysTotal}</p>
              {o.meta.results ? (
                <div className="mt-3">
                  <p className="text-lg font-semibold leading-snug text-white">
                    No ritmo atual: <span className={overallStatus ? STATUS[overallStatus].cls : "text-white"}>~{int(o.projection)}</span> {resultWord(data)} até o fim do mês <span className="text-zinc-500">(meta {int(o.meta.results)})</span>.
                  </p>
                  {overallStatus && <p className={`mt-1 flex items-center gap-1.5 text-sm ${STATUS[overallStatus].cls}`}><span className={`h-2 w-2 rounded-full ${STATUS[overallStatus].dot}`} /> {STATUS[overallStatus].label === "no ritmo" ? "No caminho pra bater a meta." : STATUS[overallStatus].label === "atenção" ? "Perto, mas precisa manter o ritmo." : "Atrás do necessário — precisa acelerar."}</p>}
                  {o.expected != null && (
                    <div className="mt-3 max-w-md">
                      <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-zinc-500">Mês até aqui</span><span className="text-zinc-300">{int(o.mtd.results)} <span className="text-zinc-600">/ esperado {int(o.expected)} · meta {int(o.meta.results)}</span></span></div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/8">
                        <div className="absolute inset-y-0 w-px bg-white/40" style={{ left: `${Math.min(100, Math.round((o.expected / (o.meta.results || 1)) * 100))}%` }} title="esperado até agora" />
                        <div className={`h-full rounded-full ${overallStatus === "off" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, Math.round((o.mtd.results / (o.meta.results || 1)) * 100))}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">Sem meta definida no plano do mês. Defina o plano de mídia pra ver o pacing.</p>
              )}
            </div>
          </Panel>

          {/* ===== NÚMEROS (semana × mês até aqui) ===== */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Investido na semana" value={brl(o.week.spend)} />
            <Stat label="Resultados na semana" value={int(o.week.results)} />
            <Stat label="Investido no mês" value={brl(o.mtd.spend)} sub={o.meta.budget ? `de ${brl(o.meta.budget)}` : undefined} />
            <Stat label="Resultados no mês" value={int(o.mtd.results)} sub={o.meta.results ? `de ${int(o.meta.results)}` : undefined} />
          </div>

          {/* ===== POR FUNIL ===== */}
          <Panel className="p-5">
            <p className="mb-3 text-sm font-semibold text-white">📊 Por funil</p>
            {data.funnels.length === 0 ? (
              <p className="text-xs text-zinc-600">Nenhum funil com movimento no período. Configure os funis na aba Funis do painel.</p>
            ) : (
              <div className="space-y-3">
                {data.funnels.map((f) => (
                  <div key={f.funnelId} className="rounded-lg border border-white/8 bg-black/20 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-zinc-100">{f.name}</span>
                      {f.platform && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9px] text-zinc-300">{f.platform === "META" ? "Meta" : "Google"}</span>}
                      {f.objective && <span className="rounded bg-[#FF8F50]/15 px-1.5 py-0.5 text-[9px] text-[#FFB185]">{OBJ_LABEL[f.objective] ?? f.objective}</span>}
                      {f.status && <span className={`ml-auto flex items-center gap-1 text-[10px] ${STATUS[f.status].cls}`}><span className={`h-1.5 w-1.5 rounded-full ${STATUS[f.status].dot}`} /> {STATUS[f.status].label}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div>
                        <p className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-600">Semana</p>
                        <p className="text-zinc-300">{brl(f.week.spend)} · <b className="text-zinc-100">{int(f.week.results)}</b> {f.objective ? (OBJ_LABEL[f.objective] ?? "").toLowerCase() : "result."}{f.week.cpa != null ? ` · ${brl2(f.week.cpa)}` : ""}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-600">Mês até aqui</p>
                        <p className="text-zinc-300">{brl(f.mtd.spend)} · <b className="text-zinc-100">{int(f.mtd.results)}</b>{f.meta.results != null ? <span className="text-zinc-600"> / {int(f.meta.results)}</span> : ""}{f.projection != null && f.meta.results != null ? <span className="text-zinc-500"> · proj. ~{int(f.projection)}</span> : ""}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ===== O QUE FIZEMOS ===== */}
          <Panel className="p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">✅ O que fizemos na semana {data.actions.length > 0 && <span className="text-xs font-normal text-zinc-500">{data.actions.length}</span>}</p>
            {data.actions.length === 0 ? (
              <p className="text-xs text-zinc-600">Nenhuma tarefa concluída registrada nesta semana.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.actions.map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5 text-[13px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="min-w-0 flex-1 text-zinc-200">{a.title}</span>
                    {a.project && <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">{a.project}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="text-center text-[10px] text-zinc-600">Report semanal · {clientName} · semana {ddmm(data.week.since)}–{ddmm(data.week.until)}</p>
        </div>
      )}
    </main>
  )
}

function resultWord(data: Data): string {
  const objs = new Set(data.funnels.map((f) => f.objective).filter(Boolean))
  if (objs.size === 1) return (OBJ_LABEL[[...objs][0] as string] ?? "resultados").toLowerCase()
  return "resultados"
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="dash-display mt-1 text-2xl text-white">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  )
}
