import { prisma } from "@/lib/db"
import Link from "next/link"
import { AlertTriangle, TrendingUp, ListChecks, ListTodo, HeartPulse, ArrowUpRight } from "lucide-react"
import { getClientsHealth, LEVEL_LABEL, LEVEL_ORDER } from "@/lib/client-health"
import { getPortfolioPerformance } from "@/lib/portfolio"
import { PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions, type SessionData } from "@/lib/auth"

const TZ = "America/Sao_Paulo"
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }))

export default async function ResumoDiarioPage() {
  const clients = await prisma.client.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } })
  const nameById = new Map(clients.map((c) => [c.id, c.name]))
  const [health, portfolio] = await Promise.all([getClientsHealth(clients), getPortfolioPerformance(clients)])
  const { alertsByClient, totals } = portfolio

  const today = formatInTimeZone(new Date(), TZ, "EEEE, dd/MM", { locale: ptBR })

  // Minhas tarefas: atrasadas (prazo < hoje) e pra hoje (prazo = hoje), não concluídas.
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const startOfToday = new Date(new Date().toDateString())
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000)
  const myTasks = session.userId
    ? await prisma.task.findMany({
        where: { assigneeId: session.userId, status: { not: "DONE" }, dueDate: { not: null, lt: endOfToday } },
        orderBy: { dueDate: "asc" },
        select: { id: true, title: true, dueDate: true, client: { select: { name: true } } },
        take: 50,
      })
    : []
  const myOverdue = myTasks.filter((t) => t.dueDate! < startOfToday)
  const myToday = myTasks.filter((t) => t.dueDate! >= startOfToday)

  // Alertas de performance (ordena críticos primeiro)
  const alertRows = [...alertsByClient.entries()]
    .map(([id, alerts]) => ({ id, name: nameById.get(id) ?? id, alerts }))
    .sort((a, b) => (b.alerts.some((x) => x.level === "critical") ? 1 : 0) - (a.alerts.some((x) => x.level === "critical") ? 1 : 0))

  // Ações vencendo/atrasadas + aprovações pendentes
  const activeHealth = health.filter((h) => h.active)
  const actions = activeHealth.filter((h) => h.nextAction && (h.nextAction.overdue || isDueSoon(h.nextAction.dueAt)))
  const pendingApprovals = activeHealth.filter((h) => h.pendingApprovals > 0)
  const totalPending = pendingApprovals.reduce((s, h) => s + h.pendingApprovals, 0)

  // Clientes em atenção/crítico
  const attention = activeHealth
    .filter((h) => h.reading.level === "critical" || h.reading.level === "attention")
    .sort((a, b) => LEVEL_ORDER[a.reading.level] - LEVEL_ORDER[b.reading.level])

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader eyebrow={`Hoje · ${today}`} title="Resumo diário" description="O que precisa da sua atenção hoje, em uma tela. Tudo lido do que já está no sistema." />

      {/* Bloco 1 — Resumo da carteira */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Investido no mês" value={brl(totals.spend)} icon={TrendingUp} />
        <Kpi label="Resultados" value={totals.results.toLocaleString("pt-BR")} />
        <Kpi label="CPA médio" value={brl(totals.cpaAvg)} />
        <Kpi label="Contas em alerta" value={String(totals.accountsInAlert)} tone={totals.accountsInAlert > 0 ? "warn" : "good"} />
      </div>

      {/* Bloco — Suas tarefas (atrasadas + pra hoje), do usuário logado */}
      <Section icon={ListTodo} title="Suas tarefas" count={myOverdue.length + myToday.length}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/8 bg-black/20 p-4">
            <p className="mb-2 text-[11px] font-medium text-red-300">Atrasadas ({myOverdue.length})</p>
            {myOverdue.length ? <TaskMiniList tasks={myOverdue} /> : <p className="text-xs text-zinc-600">Nada atrasado. 👏</p>}
          </div>
          <div className="rounded-lg border border-white/8 bg-black/20 p-4">
            <p className="mb-2 text-[11px] font-medium text-[#FFB185]">Pra hoje ({myToday.length})</p>
            {myToday.length ? <TaskMiniList tasks={myToday} /> : <p className="text-xs text-zinc-600">Nada pra hoje.</p>}
          </div>
        </div>
      </Section>

      {/* Bloco 2 — Alertas de performance */}
      <Section icon={AlertTriangle} title="Alertas de performance" count={alertRows.length} tone="warn">
        {alertRows.length === 0 ? (
          <Empty>Nenhum alerta de performance. Carteira saudável. 🎉</Empty>
        ) : (
          <div className="space-y-1.5">
            {alertRows.map((r) => (
              <Row key={r.id} href={`/clientes/${r.id}/metas`} name={r.name}>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {r.alerts.map((a) => (
                    <span key={a.code} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${a.level === "critical" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}>{a.label}</span>
                  ))}
                </div>
              </Row>
            ))}
          </div>
        )}
      </Section>

      {/* Bloco 3 — Pendências & ações */}
      <Section icon={ListChecks} title="Pendências & ações" count={actions.length + (totalPending > 0 ? 1 : 0)}>
        {actions.length === 0 && totalPending === 0 ? (
          <Empty>Nada vencendo e nenhuma aprovação pendente.</Empty>
        ) : (
          <div className="space-y-1.5">
            {actions.map((h) => (
              <Row key={h.id} href={`/clientes/${h.id}`} name={h.name}>
                <span className="truncate text-right text-[11px]">
                  <span className="text-zinc-400">→ {h.nextAction!.description}</span>
                  {h.nextAction!.dueAt && <span className={h.nextAction!.overdue ? "text-red-300" : "text-zinc-600"}> · {new Date(h.nextAction!.dueAt).toLocaleDateString("pt-BR")}{h.nextAction!.overdue ? " (atrasada)" : ""}</span>}
                </span>
              </Row>
            ))}
            {totalPending > 0 && (
              <p className="px-1 pt-1 text-[11px] text-[#FFD482]">{totalPending} item(ns) de contexto aguardando revisão em {pendingApprovals.length} cliente(s).</p>
            )}
          </div>
        )}
      </Section>

      {/* Bloco 4 — Clientes em atenção */}
      <Section icon={HeartPulse} title="Clientes em atenção" count={attention.length}>
        {attention.length === 0 ? (
          <Empty>Nenhum cliente crítico ou em atenção pela saúde de relacionamento.</Empty>
        ) : (
          <div className="space-y-1.5">
            {attention.map((h) => (
              <Row key={h.id} href={`/clientes/${h.id}`} name={h.name}>
                <span className="flex items-center gap-2">
                  <span className="hidden max-w-[280px] truncate text-[11px] text-zinc-600 sm:inline">{h.reading.summary}</span>
                  <StatusBadge status={h.reading.level}>{LEVEL_LABEL[h.reading.level]}</StatusBadge>
                </span>
              </Row>
            ))}
          </div>
        )}
      </Section>
    </main>
  )
}

function TaskMiniList({ tasks }: { tasks: { id: string; title: string; dueDate: Date | null; client: { name: string } | null }[] }) {
  return (
    <div className="space-y-1.5">
      {tasks.slice(0, 6).map((t) => (
        <Link key={t.id} href="/tarefas" className="flex items-center justify-between gap-2 rounded-md bg-black/20 px-2 py-1.5 text-[12px] hover:bg-white/5">
          <span className="min-w-0 truncate text-zinc-200">{t.title}{t.client && <span className="text-zinc-600"> · {t.client.name}</span>}</span>
          {t.dueDate && <span className="shrink-0 text-[10px] text-zinc-500">{new Date(t.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
        </Link>
      ))}
      {tasks.length > 6 && <Link href="/tarefas" className="block px-2 text-[11px] text-[#FFB185] hover:underline">+{tasks.length - 6} mais →</Link>}
    </div>
  )
}

function isDueSoon(d: Date | null): boolean {
  if (!d) return false
  const diff = new Date(d).getTime() - Date.now()
  return diff >= 0 && diff <= 3 * 86_400_000
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon?: React.ComponentType<{ size?: number; className?: string }>; tone?: "good" | "warn" }) {
  return (
    <Panel className="p-4">
      <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">{Icon && <Icon size={12} className="text-[#FF8F50]" />}{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-300" : tone === "good" ? "text-emerald-300" : "text-white"}`}>{value}</p>
    </Panel>
  )
}

function Section({ icon: Icon, title, count, tone, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; count: number; tone?: "warn"; children: React.ReactNode }) {
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className={tone === "warn" ? "text-amber-300" : "text-[#FF8F50]"} />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {count > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">{count}</span>}
      </div>
      {children}
    </Panel>
  )
}

function Row({ href, name, children }: { href: string; name: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 hover:border-white/15">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-zinc-100">{name}</span>
        <ArrowUpRight size={13} className="shrink-0 text-zinc-700 group-hover:text-zinc-400" />
      </span>
      {children}
    </Link>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-white/8 bg-black/20 px-3 py-3 text-xs text-zinc-600">{children}</p>
}
