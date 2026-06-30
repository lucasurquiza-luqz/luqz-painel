"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, TrendingUp, ArrowRight } from "lucide-react"

const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

type Total = { spend: number; results: number; cpa: number | null; roas: number | null; clicks: number }
type Daily = { date: string; spend: number }[]
type Perf = { current: { total: Total; daily: Daily; trackRevenue: boolean; configured: boolean }; previous: { spend: number; results: number } }

// Mini-sparkline SVG (gasto diário).
function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const w = 120, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full">
      <polyline points={pts} fill="none" stroke="#FF8F50" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function PerformanceSummaryCard({ clientId }: { clientId: string }) {
  const [perf, setPerf] = useState<Perf | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch(`/api/clients/${clientId}/performance?month=${currentMonth()}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setPerf(d.performance ?? null) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [clientId])

  if (loading) return (
    <div className="flex min-h-24 items-center justify-center rounded-2xl border border-white/8 bg-black/20"><Loader2 size={16} className="animate-spin text-[#FF8F50]" /></div>
  )
  if (!perf?.current.configured) return (
    <Link href={`/clientes/${clientId}/metas`} className="block rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-xs text-zinc-500 hover:text-zinc-300">
      Conecte uma conta de Ads pra ver o resultado aqui →
    </Link>
  )

  const t = perf.current.total
  const noDelivery = t.spend === 0
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp size={15} className="text-[#FF8F50]" /> Resultado do mês</span>
        <Link href={`/clientes/${clientId}/metas`} className="flex items-center gap-1 text-[11px] text-[#FFB185] hover:underline">ver performance <ArrowRight size={12} /></Link>
      </div>
      {noDelivery ? (
        <p className="mt-3 text-xs text-amber-300">Sem veiculação neste mês — verifique se há campanha ativa.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Investimento" value={brl(t.spend)} />
            <Kpi label="Resultados" value={String(t.results)} tone="text-sky-300" />
            <Kpi label="CPA" value={brl(t.cpa)} tone="text-emerald-300" />
            {perf.current.trackRevenue
              ? <Kpi label="ROAS" value={t.roas != null ? `${t.roas.toFixed(2)}x` : "—"} />
              : <Kpi label="Cliques" value={t.clicks.toLocaleString("pt-BR")} />}
          </div>
          <div className="mt-3"><Spark data={perf.current.daily.map((d) => d.spend ?? 0)} /></div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${tone ?? "text-zinc-100"}`}>{value}</p>
    </div>
  )
}
