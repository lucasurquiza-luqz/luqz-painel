"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react"
import { PageHeader, Panel } from "@/components/ui/primitives"
import { Markdown } from "@/components/Markdown"
import { projectFunnel, type FunnelProjection, type PlanFunnel } from "@/lib/media-plan"

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }))
const brl2 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
const int = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"))
const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`)
const roasFmt = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`)
const OBJ_LABEL: Record<string, string> = { LEAD: "Leads", WHATSAPP: "Conversas", ECOMMERCE: "Compras", SEGUIDORES: "Seguidores", CUSTOM: "Resultados" }

type Plan = { id: string; month: string; narrative: string | null; funnels: PlanFunnel[] }
type Proj = { f: PlanFunnel; proj: FunnelProjection }

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function daysInMonth(m: string) {
  const [y, mo] = m.split("-").map(Number)
  return new Date(y, mo, 0).getDate()
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

  const funnels = useMemo(() => (plans ?? []).flatMap((p) => p.funnels ?? []), [plans])
  const narratives = useMemo(() => (plans ?? []).map((p) => p.narrative?.trim()).filter(Boolean) as string[], [plans])
  const projections: Proj[] = useMemo(() => funnels.map((f) => ({ f, proj: projectFunnel({ budget: f.budget, cpl: f.cpl, targetLeads: null, stages: f.stages, ticket: f.ticket }) })), [funnels])

  const totals = useMemo(() => {
    let budget = 0, topLeads = 0, revenue = 0, hasRevenue = false
    const finals = new Map<string, number>()
    for (const { proj, f } of projections) {
      budget += f.budget ?? 0
      topLeads += proj.rows[0]?.value ?? 0
      if (proj.revenue != null) { revenue += proj.revenue; hasRevenue = true }
      const last = proj.rows[proj.rows.length - 1]
      if (last && proj.rows.length > 1) finals.set(last.label, (finals.get(last.label) ?? 0) + last.value)
    }
    return { budget, topLeads, revenue: hasRevenue ? revenue : null, roas: hasRevenue && budget > 0 ? revenue / budget : null, finals }
  }, [projections])

  const channels = useMemo(() => {
    const set = new Set(funnels.map((f) => f.platform).filter(Boolean) as string[])
    return [...set].map((p) => (p === "META" ? "Meta" : p === "GOOGLE" ? "Google" : p))
  }, [funnels])

  const monthName = MONTHS[Number(month.slice(5)) - 1]
  const year = month.slice(0, 4)
  const perDay = totals.budget > 0 ? totals.budget / daysInMonth(month) : null
  // Meta principal: resultado final consolidado (ex.: "~6 vendas") quando os funis fecham no mesmo estágio.
  const metaLine = [...totals.finals.entries()].map(([label, v]) => `~${int(v)} ${label.toLowerCase()}`).join(" · ")

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
          {/* ===== CAPA DO DOCUMENTO ===== */}
          <Panel className="relative overflow-hidden p-6 lg:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#FF8F50]/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FF8F50]">{clientName || "Cliente"} · {monthName} {year}</p>
              {metaLine && <p className="dash-display mt-2 text-2xl leading-tight text-white">Meta: {metaLine}{totals.revenue != null ? ` · ${brl(totals.revenue)}` : ""}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Investimento" value={brl(totals.budget)} sub={perDay != null ? `${brl(perDay)}/dia` : undefined} />
                <Stat label="Leads previstos" value={int(totals.topLeads)} />
                <Stat label="Receita prevista" value={totals.revenue != null ? brl(totals.revenue) : "—"} />
                <Stat label="ROAS previsto" value={roasFmt(totals.roas)} />
              </div>
              {channels.length > 0 && <p className="mt-3 text-[11px] text-zinc-500">Canais: {channels.join(" · ")}</p>}
            </div>
          </Panel>

          {/* ===== FUNIL PROJETADO POR CANAL ===== */}
          <Section title="Funil projetado por canal">
            {projections.map(({ f, proj }) => {
              const top = proj.rows[0]?.value ?? 0
              return (
                <div key={f.id} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{f.name}</span>
                    {f.platform && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[9px] text-zinc-300">{f.platform === "META" ? "Meta" : "Google"}</span>}
                    <span className="rounded bg-[#FF8F50]/15 px-1.5 py-0.5 text-[9px] text-[#FFB185]">{OBJ_LABEL[f.objective] ?? f.objective}</span>
                    <span className="ml-auto text-[11px] text-zinc-500">{brl(f.budget)}{f.cpl ? ` · CPL alvo ${brl2(f.cpl)}` : ""}</span>
                  </div>
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
                </div>
              )
            })}
          </Section>

          {/* ===== PREMISSAS & BENCHMARKS (auto) ===== */}
          <Section title="Premissas & benchmarks" hint="As taxas e custos que sustentam a projeção. Recalibramos com o realizado a cada 30 dias.">
            <div className="grid gap-3 sm:grid-cols-2">
              {projections.map(({ f }) => (
                <div key={f.id} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <p className="mb-2 text-[13px] font-semibold text-zinc-100">{f.name}</p>
                  <dl className="space-y-1 text-[12px]">
                    <Row k="CPL alvo" v={f.cpl ? brl2(f.cpl) : "—"} />
                    {f.ticket ? <Row k="Ticket médio" v={brl(f.ticket)} /> : null}
                    {f.stages.slice(1).map((s, i) => (
                      <Row key={i} k={`${f.stages[i].label} → ${s.label}`} v={pct(s.rate)} />
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Section>

          {/* ===== RESULTADO FINANCEIRO (auto) ===== */}
          {totals.revenue != null && (
            <Section title="Resultado financeiro">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Investimento" value={brl(totals.budget)} />
                <Stat label="Receita prevista" value={brl(totals.revenue)} />
                <Stat label="ROAS" value={roasFmt(totals.roas)} />
                <Stat label="Retorno líquido" value={brl(totals.revenue - totals.budget)} />
              </div>
              <div className="mt-3 space-y-1.5">
                {projections.filter(({ proj }) => proj.revenue != null).map(({ f, proj }) => (
                  <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[12px]">
                    <span className="text-zinc-200">{f.name}</span>
                    <span className="flex gap-x-4 text-zinc-500">
                      <span>Receita <b className="text-emerald-300">{brl(proj.revenue)}</b></span>
                      <span>ROAS <b className="text-zinc-200">{roasFmt(proj.roas)}</b></span>
                      {proj.cac != null && <span>Custo/{(proj.finalLabel ?? "result.").toLowerCase()} <b className="text-zinc-200">{brl2(proj.cac)}</b></span>}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ===== ESTRATÉGIA / CENÁRIOS / CONTROLE (narrativa em markdown) ===== */}
          {narratives.length > 0 && (
            <Section title="Estratégia, cenários e controle">
              {narratives.map((n, i) => <Markdown key={i}>{n}</Markdown>)}
            </Section>
          )}

          <p className="text-center text-[10px] text-zinc-600">Plano de mídia · {clientName} · {monthName} {year} · projeção baseada nas metas definidas</p>
        </div>
      )}
    </main>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Panel className="p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mb-3 mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
      <div className={hint ? "space-y-3" : "mt-3 space-y-3"}>{children}</div>
    </Panel>
  )
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="min-w-0 truncate text-zinc-500">{k}</dt>
      <dd className="shrink-0 font-medium text-zinc-200">{v}</dd>
    </div>
  )
}
