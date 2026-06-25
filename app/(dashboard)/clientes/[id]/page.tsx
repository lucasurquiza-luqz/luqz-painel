import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  HeartPulse,
  MessageSquare,
  MessagesSquare,
  Video,
  ArrowUpRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { sessionOptions, type SessionData, isEquipe } from "@/lib/auth"
import { PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

const TZ = "America/Sao_Paulo"

type Level = "healthy" | "attention" | "critical" | "unknown"

const PERCEPTION: Record<string, { label: string; level: Level; rank: number }> = {
  GREAT: { label: "Ótimo", level: "healthy", rank: 4 },
  GOOD: { label: "Bom", level: "healthy", rank: 3 },
  NEUTRAL: { label: "Neutro", level: "attention", rank: 2 },
  CONCERN: { label: "Preocupante", level: "attention", rank: 1 },
  CRITICAL: { label: "Crítico", level: "critical", rank: 0 },
}

const LEVEL_LABEL: Record<Level, string> = {
  healthy: "Saudável",
  attention: "Atenção",
  critical: "Crítico",
  unknown: "Sem leitura",
}

function fmt(date: Date | null | undefined) {
  if (!date) return "—"
  return formatInTimeZone(date, TZ, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

function fmtDay(date: Date | null | undefined) {
  if (!date) return "—"
  return formatInTimeZone(date, TZ, "dd/MM/yyyy", { locale: ptBR })
}

function daysAgo(date: Date | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function ClienteVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const internal = isEquipe(session.role ?? "")

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, description: true, active: true, statusReason: true, statusChangedAt: true },
  })
  if (!client) notFound()

  // Visão do cliente (CLIENTE): simplificada, sem bastidores.
  if (!internal) {
    return <ClientView name={client.name} description={client.description} active={client.active} />
  }

  const [
    checkins,
    activeContext,
    pendingContext,
    lastSnapshot,
    lastSummary,
    pendingSummaryItems,
    openGroupRisks,
    lastMeeting,
    pendingMeetingItems,
    openMeetingRisks,
    lastConversation,
    pendingSchedules,
  ] = await Promise.all([
    prisma.teamCheckin.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 2,
      include: { author: { select: { name: true } } },
    }),
    prisma.contextItem.count({ where: { clientId, status: "ACTIVE" } }),
    prisma.contextItem.count({ where: { clientId, status: "PROPOSED" } }),
    prisma.contextSnapshot.findFirst({ where: { clientId }, orderBy: { version: "desc" }, select: { version: true, compiledAt: true } }),
    prisma.groupDailySummary.findFirst({
      where: { clientId },
      orderBy: { date: "desc" },
      select: { date: true, conversation: { select: { group: { select: { name: true } } } } },
    }),
    prisma.groupDailySummaryItem.count({ where: { status: "PROPOSED", summary: { clientId } } }),
    prisma.groupDailySummaryItem.count({ where: { status: "PROPOSED", kind: { in: ["RISK", "PENDING"] }, summary: { clientId } } }),
    prisma.meeting.findFirst({ where: { clientId }, orderBy: { date: "desc" }, select: { title: true, date: true } }),
    prisma.meetingSummaryItem.count({ where: { status: "PROPOSED", summary: { clientId } } }),
    prisma.meetingSummaryItem.count({ where: { status: "PROPOSED", kind: { in: ["RISK", "OBJECTION"] }, summary: { clientId } } }),
    prisma.waConversation.findFirst({ where: { clientId }, orderBy: { lastMessageAt: "desc" }, select: { lastMessageAt: true } }),
    prisma.scheduledMessage.count({ where: { clientId, status: "PENDING" } }),
  ])

  const openRisks = openGroupRisks + openMeetingRisks
  const pendingApprovals = pendingContext + pendingSummaryItems + pendingMeetingItems

  // === Leitura de relacionamento (derivada, explicável) ===
  const latest = checkins[0]
  const previous = checkins[1]
  const reading = buildReading({ latest, previous, openRisks })

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Visão 360"
        title={client.name}
        description={client.description ?? "Leitura consolidada do relacionamento, evidências e próximas ações."}
        actions={
          <StatusBadge status={client.active ? "healthy" : "unknown"}>
            {client.active ? "Cliente ativo" : "Inativo"}
          </StatusBadge>
        }
      />

      {!client.active && client.statusReason && (
        <Panel className="border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200">
          Inativo desde {fmtDay(client.statusChangedAt)} — {client.statusReason}
        </Panel>
      )}

      {/* Leitura de relacionamento */}
      <Panel className="p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <HeartPulse size={18} className="text-[#FF8F50]" />
            <div>
              <p className="dash-eyebrow text-[10px] text-zinc-600">Saúde de relacionamento</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={reading.level}>{LEVEL_LABEL[reading.level]}</StatusBadge>
                <TrendChip trend={reading.trend} />
                <span className="text-xs text-zinc-600">confiança {reading.confidence}</span>
              </div>
            </div>
          </div>
          <Link href={`/clientes/${clientId}/checkin`} className="text-xs font-medium text-[#FFB185] hover:text-[#FFD482]">
            Registrar check-in →
          </Link>
        </div>

        <p className="mt-4 text-sm leading-6 text-zinc-300">{reading.summary}</p>

        {reading.evidence && (
          <div className="mt-3 rounded-lg border-l border-[#FF8F50]/30 bg-black/20 px-3 py-2 text-xs leading-5 text-zinc-500">
            <span className="font-medium text-zinc-400">Evidência · {reading.evidenceMeta}</span>
            <p className="mt-1">{reading.evidence}</p>
          </div>
        )}
      </Panel>

      {/* Sinais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SignalCard
          icon={HeartPulse}
          label="Check-in do time"
          value={latest ? PERCEPTION[latest.perception]?.label ?? latest.perception : "Sem registro"}
          hint={latest ? `há ${daysAgo(latest.createdAt)}d · ${latest.author.name}` : "registre uma percepção"}
          tone={latest ? PERCEPTION[latest.perception]?.level : "unknown"}
          href={`/clientes/${clientId}/checkin`}
        />
        <SignalCard
          icon={AlertTriangle}
          label="Riscos abertos"
          value={String(openRisks)}
          hint="riscos/pendências sem revisão"
          tone={openRisks > 0 ? "attention" : "healthy"}
          href={`/clientes/${clientId}/grupo/resumo-diario`}
        />
        <SignalCard
          icon={MessageSquare}
          label="Atividade WhatsApp"
          value={lastConversation?.lastMessageAt ? `há ${daysAgo(lastConversation.lastMessageAt)}d` : "Sem mensagens"}
          hint={lastConversation?.lastMessageAt ? fmt(lastConversation.lastMessageAt) : "nenhuma conversa"}
          tone={lastConversation?.lastMessageAt && daysAgo(lastConversation.lastMessageAt)! <= 3 ? "healthy" : "attention"}
          href={`/clientes/${clientId}/chat`}
        />
        <SignalCard
          icon={BrainCircuit}
          label="Contexto"
          value={`${activeContext} ativos`}
          hint={lastSnapshot ? `snapshot v${lastSnapshot.version}` : "sem snapshot ainda"}
          tone={activeContext > 0 ? "healthy" : "unknown"}
          href={`/clientes/${clientId}/contexto`}
        />
      </div>

      {/* Aprovações pendentes */}
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Aguardando sua revisão</h2>
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", pendingApprovals > 0 ? "bg-[#FFD482]/15 text-[#FFD482]" : "bg-white/5 text-zinc-500")}>
            {pendingApprovals} item(ns)
          </span>
        </div>
        {pendingApprovals === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">Nada pendente. Nenhuma proposta de contexto, resumo ou reunião aguardando revisão.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <PendingLink label="Propostas de contexto" count={pendingContext} href={`/clientes/${clientId}/contexto`} icon={BrainCircuit} />
            <PendingLink label="Itens de resumo diário" count={pendingSummaryItems} href={`/clientes/${clientId}/grupo/resumo-diario`} icon={MessagesSquare} />
            <PendingLink label="Itens de reunião" count={pendingMeetingItems} href={`/clientes/${clientId}/reunioes`} icon={Video} />
          </div>
        )}
      </Panel>

      {/* Atividade recente */}
      <Panel className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Atividade recente</h2>
        <div className="space-y-3">
          <ActivityRow
            icon={MessagesSquare}
            label="Último resumo diário"
            value={lastSummary ? `${lastSummary.conversation.group.name} · ${fmtDay(lastSummary.date)}` : "Nenhum resumo gerado"}
            href={`/clientes/${clientId}/grupo/resumo-diario`}
          />
          <ActivityRow
            icon={Video}
            label="Última reunião"
            value={lastMeeting ? `${lastMeeting.title} · ${fmtDay(lastMeeting.date)}` : "Nenhuma reunião registrada"}
            href={`/clientes/${clientId}/reunioes`}
          />
          <ActivityRow
            icon={Activity}
            label="Status do cliente"
            value={client.active ? `Ativo${client.statusChangedAt ? ` desde ${fmtDay(client.statusChangedAt)}` : ""}` : "Inativo"}
            href={`/clientes/${clientId}/status`}
          />
          <ActivityRow
            icon={CalendarClock}
            label="Agendamentos pendentes"
            value={`${pendingSchedules} pendente(s)`}
            href={`/clientes/${clientId}/agendamentos`}
          />
        </div>
      </Panel>
    </main>
  )
}

// === Leitura derivada (sem inventar: "Sem leitura" quando não há check-in) ===
function buildReading(input: {
  latest?: { perception: string; justification: string; createdAt: Date; author: { name: string } }
  previous?: { perception: string }
  openRisks: number
}): { level: Level; trend: "up" | "down" | "flat" | "none"; confidence: string; summary: string; evidence?: string; evidenceMeta?: string } {
  const { latest, previous, openRisks } = input

  if (!latest) {
    return {
      level: "unknown",
      trend: "none",
      confidence: "baixa",
      summary:
        openRisks > 0
          ? `Sem check-in do time registrado. Há ${openRisks} risco(s)/pendência(s) aberto(s) que ainda não foram revisados — registre um check-in para uma leitura confiável.`
          : "Sem check-in do time registrado. Registre a primeira percepção da equipe para gerar uma leitura de relacionamento.",
    }
  }

  const p = PERCEPTION[latest.perception]
  // Escala para atenção/crítico quando há riscos abertos, mesmo com percepção boa.
  let level = p?.level ?? "unknown"
  if (level === "healthy" && openRisks >= 2) level = "attention"

  const ageDays = daysAgo(latest.createdAt) ?? 999
  const confidence = ageDays <= 14 ? "alta" : ageDays <= 30 ? "média" : "baixa"

  let trend: "up" | "down" | "flat" | "none" = "none"
  if (previous && p && PERCEPTION[previous.perception]) {
    const delta = p.rank - PERCEPTION[previous.perception].rank
    trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  }

  const riskPart = openRisks > 0 ? ` ${openRisks} risco(s)/pendência(s) aberto(s) aguardam revisão.` : ""
  const agePart = ageDays > 30 ? " A leitura tem baixa confiança: o último check-in é antigo." : ""
  const summary = `Percepção mais recente do time: ${p?.label ?? latest.perception}.${riskPart}${agePart}`

  return {
    level,
    trend,
    confidence,
    summary,
    evidence: latest.justification,
    evidenceMeta: `${latest.author.name} · ${fmtDay(latest.createdAt)}`,
  }
}

function TrendChip({ trend }: { trend: "up" | "down" | "flat" | "none" }) {
  if (trend === "none") return null
  const map = {
    up: { icon: TrendingUp, label: "melhorando", color: "text-emerald-300" },
    down: { icon: TrendingDown, label: "piorando", color: "text-red-300" },
    flat: { icon: Minus, label: "estável", color: "text-zinc-400" },
  } as const
  const { icon: Icon, label, color } = map[trend]
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", color)}>
      <Icon size={12} /> {label}
    </span>
  )
}

function SignalCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  href,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  hint: string
  tone?: Level
  href: string
}) {
  const toneColor =
    tone === "healthy" ? "text-emerald-300" : tone === "attention" ? "text-amber-300" : tone === "critical" ? "text-red-300" : "text-zinc-200"
  return (
    <Link href={href} className="group rounded-2xl border border-white/8 bg-zinc-900 p-4 transition-colors hover:border-white/15">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-zinc-600" />
        <span className="text-xs font-medium text-zinc-400">{label}</span>
      </div>
      <p className={cn("mt-2 truncate text-lg font-semibold", toneColor)}>{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-zinc-600">{hint}</p>
    </Link>
  )
}

function PendingLink({
  label,
  count,
  href,
  icon: Icon,
}: {
  label: string
  count: number
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors",
        count > 0 ? "border-[#FFD482]/20 bg-[#FFD482]/[0.06] hover:bg-[#FFD482]/[0.12]" : "border-white/8 bg-black/20"
      )}
    >
      <span className="flex items-center gap-2 text-xs text-zinc-300">
        <Icon size={14} className="text-zinc-500" />
        {label}
      </span>
      <span className={cn("text-sm font-semibold", count > 0 ? "text-[#FFD482]" : "text-zinc-600")}>{count}</span>
    </Link>
  )
}

function ActivityRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  href: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-white/5 py-2 last:border-0 hover:opacity-80">
      <Icon size={15} className="shrink-0 text-zinc-600" />
      <span className="w-44 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{value}</span>
      <ArrowUpRight size={13} className="shrink-0 text-zinc-700" />
    </Link>
  )
}

// Visão simplificada para o papel CLIENTE (sem bastidores).
function ClientView({ name, description, active }: { name: string; description: string | null; active: boolean }) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Seu projeto"
        title={name}
        description={description ?? "Acompanhe seu projeto com a LUQZ."}
        actions={<StatusBadge status={active ? "healthy" : "unknown"}>{active ? "Em andamento" : "Pausado"}</StatusBadge>}
      />
      <Panel className="p-6 text-sm leading-6 text-zinc-400">
        Em breve você acompanha aqui campanhas, calendário e relatórios. Por enquanto, fale com o time pelo Chat.
      </Panel>
    </main>
  )
}
