import { prisma } from "@/lib/db"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react"
import {
  getClientsHealth,
  LEVEL_LABEL,
  LEVEL_ORDER,
  daysAgo,
  type ClientHealth,
  type Level,
  type Trend,
} from "@/lib/client-health"
import { PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import { getClientsMonthTotals, type MonthTotal } from "@/lib/ads/snapshot"
import { computeAlerts, type Alert } from "@/lib/alerts"
import { formatInTimeZone } from "date-fns-tz"
import { cn } from "@/lib/utils"

const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }))
const TZ = "America/Sao_Paulo"

export default async function TorrePage() {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, active: true },
    orderBy: { name: "asc" },
  })
  const health = await getClientsHealth(clients)
  const month = formatInTimeZone(new Date(), TZ, "yyyy-MM")
  const results = await getClientsMonthTotals(clients.map((c) => c.id), month)

  // Metas do mês (plano TOTAL por cliente) + contexto de data → alertas proativos.
  const plans = await prisma.mediaPlan.findMany({ where: { month }, select: { clientId: true, platform: true, budget: true, targetCpa: true, targetRoas: true } })
  const planByClient = new Map<string, (typeof plans)[number]>()
  for (const p of plans) { if (!planByClient.has(p.clientId) || p.platform === "TOTAL") planByClient.set(p.clientId, p) }
  const dayOfMonth = Number(formatInTimeZone(new Date(), TZ, "d"))
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const alertsByClient = new Map<string, Alert[]>()
  for (const c of clients) {
    const r = results.get(c.id)
    if (!r || !c.active) continue
    const p = planByClient.get(c.id)
    alertsByClient.set(c.id, computeAlerts({
      configured: r.configured, spend: r.spend, cpa: r.cpa, roas: r.roas,
      targetCpa: p?.targetCpa != null ? Number(p.targetCpa) : null,
      targetRoas: p?.targetRoas != null ? Number(p.targetRoas) : null,
      budget: p?.budget != null ? Number(p.budget) : null,
      dayOfMonth, daysInMonth,
    }))
  }
  const totalAlerts = [...alertsByClient.values()].reduce((s, a) => s + a.length, 0)

  // Ativos primeiro, depois por atenção (crítico → saudável), depois por pendências.
  health.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    const lv = LEVEL_ORDER[a.reading.level] - LEVEL_ORDER[b.reading.level]
    if (lv !== 0) return lv
    return b.pendingApprovals - a.pendingApprovals
  })

  const activeHealth = health.filter((h) => h.active)
  const counts = {
    critical: activeHealth.filter((h) => h.reading.level === "critical").length,
    attention: activeHealth.filter((h) => h.reading.level === "attention").length,
    healthy: activeHealth.filter((h) => h.reading.level === "healthy").length,
    unknown: activeHealth.filter((h) => h.reading.level === "unknown").length,
  }
  const totalPending = activeHealth.reduce((sum, h) => sum + h.pendingApprovals, 0)

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Torre de controle"
        title="Saúde da carteira"
        description="Todos os clientes ordenados por atenção: a mesma leitura de relacionamento da visão individual, multiplicada."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountCard label="Críticos" value={counts.critical} tone="critical" />
        <CountCard label="Em atenção" value={counts.attention} tone="attention" />
        <CountCard label="Saudáveis" value={counts.healthy} tone="healthy" />
        <CountCard label="Sem leitura" value={counts.unknown} tone="unknown" />
      </div>

      {totalAlerts > 0 && (
        <Panel className="border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200">
          ⚠ {totalAlerts} alerta(s) de performance na carteira (CPA acima da meta, verba ociosa ou sem veiculação).
        </Panel>
      )}

      {totalPending > 0 && (
        <Panel className="border-[#FFD482]/20 bg-[#FFD482]/[0.06] p-4 text-sm text-[#FFD482]">
          {totalPending} item(ns) aguardando revisão em toda a carteira.
        </Panel>
      )}

      <div className="space-y-2">
        {health.map((h) => (
          <ClientRow key={h.id} health={h} result={results.get(h.id)} alerts={alertsByClient.get(h.id) ?? []} />
        ))}
        {health.length === 0 && (
          <Panel className="p-8 text-center text-sm text-zinc-600">Nenhum cliente na carteira ainda.</Panel>
        )}
      </div>
    </main>
  )
}

function ClientRow({ health, result, alerts = [] }: { health: ClientHealth; result?: MonthTotal; alerts?: Alert[] }) {
  const activityDays = daysAgo(health.lastActivityAt)
  return (
    <Link
      href={`/clientes/${health.id}`}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border bg-zinc-900 p-4 transition-colors hover:border-white/15",
        health.active ? "border-white/8" : "border-white/5 opacity-50"
      )}
    >
      <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: levelColor(health.reading.level) }} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">{health.name}</span>
          {!health.active && <span className="text-[10px] uppercase tracking-wide text-zinc-600">inativo</span>}
        </div>
        {health.nextAction ? (
          <p className="mt-0.5 truncate text-xs">
            <span className="text-zinc-400">→ {health.nextAction.description}</span>
            {health.nextAction.responsibleName && <span className="text-zinc-600"> · {health.nextAction.responsibleName}</span>}
            {health.nextAction.dueAt && (
              <span className={cn(health.nextAction.overdue ? "text-red-300" : "text-zinc-600")}>
                {" "}· {new Date(health.nextAction.dueAt).toLocaleDateString("pt-BR")}{health.nextAction.overdue ? " (atrasada)" : ""}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-0.5 truncate text-xs text-zinc-600">{health.reading.summary}</p>
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        {alerts.map((a) => (
          <span key={a.code} className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", a.level === "critical" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300")} title="Alerta de performance">
            {a.label}
          </span>
        ))}
        {result && result.spend > 0 && (
          <span className="text-right text-[11px] text-zinc-500" title="Gasto · CPA no mês">
            <span className="text-zinc-300">{brl(result.spend)}</span> · CPA {brl(result.cpa)}
            {result.roas != null && <> · {result.roas.toFixed(1)}x</>}
          </span>
        )}
        {health.openRisks > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-300" title="Riscos/pendências abertos">
            <AlertTriangle size={13} /> {health.openRisks}
          </span>
        )}
        {health.pendingApprovals > 0 && (
          <span className="rounded-md bg-[#FFD482]/15 px-2 py-0.5 text-xs font-medium text-[#FFD482]" title="Aguardando revisão">
            {health.pendingApprovals} revisar
          </span>
        )}
        <span className="w-20 text-right text-[11px] text-zinc-600">
          {activityDays != null ? `msg há ${activityDays}d` : "sem msg"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={health.reading.level}>{LEVEL_LABEL[health.reading.level]}</StatusBadge>
        <TrendIcon trend={health.reading.trend} />
        <ArrowUpRight size={14} className="text-zinc-700" />
      </div>
    </Link>
  )
}

function levelColor(level: Level): string {
  return level === "critical"
    ? "#f87171"
    : level === "attention"
      ? "#FFD482"
      : level === "healthy"
        ? "#34d399"
        : "#3f3f46"
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "none") return null
  if (trend === "up") return <TrendingUp size={13} className="text-emerald-300" />
  if (trend === "down") return <TrendingDown size={13} className="text-red-300" />
  return <Minus size={13} className="text-zinc-500" />
}

function CountCard({ label, value, tone }: { label: string; value: number; tone: Level }) {
  const color =
    tone === "critical" ? "text-red-300" : tone === "attention" ? "text-amber-300" : tone === "healthy" ? "text-emerald-300" : "text-zinc-400"
  return (
    <Panel className="p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", color)}>{value}</p>
    </Panel>
  )
}
