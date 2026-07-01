"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react"
import { PageHeader, Panel } from "@/components/ui/primitives"
import { projectFunnel, type PlanFunnel } from "@/lib/media-plan"

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }))
const brl2 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"))
const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`)
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", SEGUIDORES: "Seguidores", CUSTOM: "Resultados" }

type Plan = { id: string; month: string; narrative: string | null; funnels: PlanFunnel[] }

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function PlanoDeMidiaPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [clientName, setClientName] = useState("")
  const [month, setMonth] = useState(thisMonth())
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch(`/api/clients/${clientId}`).then((r) => r.json()).then((d) => setClientName(d.client?.name ?? "")).catch(() => {}) }, [clientId])
  const load = useCallback(async () => {
    setLoading(true)
    const d = await fetch(`/api/clients/${clientId}/media-plans?month=${month}`).then((r) => r.json()).catch(() => null)
    setPlans(d && Array.isArray(d.plans) ? d.plans : []); setLoading(false)
  }, [clientId, month])
  useEffect(() => { void load() }, [load])

  // Todos os funis do mês (achatados) + narrativas dos planos.
  const funnels = useMemo(() => (plans ?? []).flatMap((p) => p.funnels ?? []), [plans])
  const narratives = useMemo(() => (plans ?? []).map((p) => p.narrative?.trim()).filter(Boolean) as string[], [plans])

  const projections = useMemo(() => funnels.map((f) => ({ f, proj: projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket }) })), [funnels])
  const totals = useMemo(() => {
    let budget = 0, topLeads = 0, revenue = 0, hasRevenue = false
    for (const { f, proj } of projections) {
      budget += f.budget ?? 0
      topLeads += proj.rows[0]?.value ?? 0
      if (proj.revenue != null) { revenue += proj.revenue; hasRevenue = true }
    }
    return { budget, topLeads, revenue: hasRevenue ? revenue : null, roas: hasRevenue && budget > 0 ? revenue / budget : null }
  }, [projections])

  const monthName = MONTHS[Number(month.slice(5)) - 1]
  const year = month.slice(0, 4)

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/clientes/${clientId}`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><ArrowLeft size={18} /></Link>
        <PageHeader eyebrow="Performance" title="Plano de mídia" description="Para onde vai a verba e o que ela deve gerar no mês." />
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"><ChevronLeft size={16} /></button>
          <span className="min-w-28 text-center text-xs font-medium capitalize text-zinc-200">{monthName} {year}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, +1))} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><Printer size={14} /> PDF</button>
      </div>

      {loading ? (
        <Panel className="flex min-h-60 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : funnels.length === 0 ? (
        <Panel className="p-10 text-center text-sm text-zinc-600">Nenhum plano de mídia definido para {monthName} de {year}.</Panel>
      ) : (
        <div className="space-y-5">
          {/* ===== RESUMO DO MÊS ===== */}
          <Panel className="relative overflow-hidden p-6 lg:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#FF8F50]/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FF8F50]">{clientName || "Cliente"} · {monthName} {year}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Investimento" value={brl(totals.budget)} />
                <Stat label="Leads previstos" value={int(totals.topLeads)} />
                <Stat label="Receita prevista" value={totals.revenue != null ? brl(totals.revenue) : "—"} />
                <Stat label="ROAS previsto" value={totals.roas != null ? `${totals.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"} />
              </div>
            </div>
          </Panel>

          {/* ===== ESTRATÉGIA (narrativa) ===== */}
          {narratives.length > 0 && (
            <Panel className="p-5">
              <p className="mb-2 text-sm font-semibold text-white">🎯 Estratégia do mês</p>
              {narratives.map((n, i) => (
                <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">{n}</p>
              ))}
            </Panel>
          )}

          {/* ===== FUNIS ===== */}
          {projections.map(({ f, proj }) => {
            const top = proj.rows[0]?.value ?? 0
            return (
              <Panel key={f.id} className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">{f.name}</span>
                  {f.platform && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9px] text-zinc-300">{f.platform === "META" ? "Meta" : "Google"}</span>}
                  <span className="rounded bg-[#FF8F50]/15 px-1.5 py-0.5 text-[9px] text-[#FFB185]">{OBJ_LABEL[f.objective] ?? f.objective}</span>
                  <span className="ml-auto text-[11px] text-zinc-500">{brl(f.budget)}{f.cpl ? ` · CPL alvo ${brl2(f.cpl)}` : ""}</span>
                </div>

                {/* Etapas do funil */}
                <div className="space-y-1.5">
                  {proj.rows.map((r, i) => (
                    <div key={i} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[13px] text-zinc-200">{r.label}</span>
                          {i > 0 && r.rate != null && <span className="shrink-0 text-[10px] text-zinc-600">taxa {pct(r.rate)}</span>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-[12px]">
                          {r.revenue != null && <span className="text-emerald-300/80">{brl(r.revenue)}</span>}
                          {r.cost != null && <span className="text-zinc-600">{brl2(r.cost)}/un</span>}
                          <b className="w-12 text-right text-zinc-100">{int(r.value)}</b>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-[#FF8F50]/70" style={{ width: `${top > 0 ? Math.max(2, Math.round((r.value / top) * 100)) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rodapé: receita / ROAS / CAC */}
                {(proj.revenue != null || proj.cac != null) && (
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/8 pt-3 text-[12px]">
                    {proj.revenue != null && <span className="text-zinc-400">Receita prevista <b className="text-emerald-300">{brl(proj.revenue)}</b></span>}
                    {proj.roas != null && <span className="text-zinc-400">ROAS <b className="text-zinc-100">{proj.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x</b></span>}
                    {proj.cac != null && <span className="text-zinc-400">Custo por {(proj.finalLabel ?? "resultado").toLowerCase()} <b className="text-zinc-100">{brl2(proj.cac)}</b></span>}
                  </div>
                )}
              </Panel>
            )
          })}

          <p className="text-center text-[10px] text-zinc-600">Plano de mídia · {clientName} · {monthName} {year} · projeção baseada nas metas definidas</p>
        </div>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="dash-display mt-1 text-2xl text-white">{value}</p>
    </div>
  )
}
