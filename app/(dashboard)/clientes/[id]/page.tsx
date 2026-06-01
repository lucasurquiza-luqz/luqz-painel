import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { CalendarClock, Smartphone, Settings, KeyRound, BarChart2, Clock, CheckCircle2, XCircle, Ban } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

const TZ = "America/Sao_Paulo"

const STATUS_CONFIG = {
  PENDING:   { label: "Pendente",  color: "text-yellow-400", icon: Clock },
  SENDING:   { label: "Enviando",  color: "text-blue-400",   icon: CalendarClock },
  SENT:      { label: "Enviado",   color: "text-green-400",  icon: CheckCircle2 },
  FAILED:    { label: "Falhou",    color: "text-red-400",    icon: XCircle },
  CANCELLED: { label: "Cancelado", color: "text-zinc-500",   icon: Ban },
}

export default async function ClienteVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      groups: true,
      messages: {
        orderBy: { scheduledAt: "desc" },
        take: 3,
        include: {
          groups: { include: { group: { select: { name: true } } } },
        },
      },
    },
  })

  if (!client) notFound()

  const pending = client.messages.filter((m) => m.status === "PENDING").length
  const sent = client.messages.filter((m) => m.status === "SENT").length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">{client.name}</h1>
        {client.description && <p className="text-sm text-zinc-500 mt-0.5">{client.description}</p>}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link href={`/clientes/${clientId}/grupos`} className="bg-zinc-900 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center">
              <Smartphone size={17} className="text-blue-400" />
            </div>
            <span className="text-sm font-medium text-zinc-200">Grupos</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-100">{client.groups.length}</p>
          <p className="text-xs text-zinc-500 mt-0.5">grupo{client.groups.length !== 1 ? "s" : ""} vinculado{client.groups.length !== 1 ? "s" : ""}</p>
        </Link>

        <Link href={`/clientes/${clientId}/agendamentos`} className="bg-zinc-900 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center">
              <CalendarClock size={17} className="text-blue-400" />
            </div>
            <span className="text-sm font-medium text-zinc-200">Agendamentos</span>
          </div>
          <p className="text-2xl font-semibold text-zinc-100">{pending}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            pendente{pending !== 1 ? "s" : ""} · {sent} enviado{sent !== 1 ? "s" : ""}
          </p>
        </Link>
      </div>

      {/* Ultimas mensagens */}
      {client.messages.length > 0 && (
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-100">Ultimos agendamentos</h2>
            <Link href={`/clientes/${clientId}/agendamentos`} className="text-xs text-blue-400 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="space-y-3">
            {client.messages.map((msg) => {
              const cfg = STATUS_CONFIG[msg.status as keyof typeof STATUS_CONFIG]
              const Icon = cfg.icon
              return (
                <div key={msg.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{msg.text}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatInTimeZone(msg.scheduledAt, TZ, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      {msg.groups.length > 0 && ` · ${msg.groups.map((gm) => gm.group.name).join(", ")}`}
                    </p>
                  </div>
                  <span className={cn("flex items-center gap-1 text-xs font-medium flex-shrink-0", cfg.color)}>
                    <Icon size={12} />
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modulos em breve */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: BarChart2, label: "Dashboard de Metricas" },
          { icon: Settings,  label: "Configuracoes" },
          { icon: KeyRound,  label: "Credenciais" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 opacity-50">
            <div className="flex items-center gap-3 mb-2">
              <Icon size={16} className="text-zinc-600" />
              <span className="text-sm font-medium text-zinc-500">{label}</span>
              <span className="ml-auto text-xs bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded-md">em breve</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
