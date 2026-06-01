import Link from "next/link"
import { Plus, CalendarClock, Clock, CheckCircle2, XCircle, Ban, Pencil } from "lucide-react"
import { prisma } from "@/lib/db"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

const TZ = "America/Sao_Paulo"

const STATUS_CONFIG = {
  PENDING:   { label: "Pendente",  color: "bg-yellow-500/15 text-yellow-400",  icon: Clock },
  SENDING:   { label: "Enviando",  color: "bg-blue-500/15 text-blue-400",      icon: CalendarClock },
  SENT:      { label: "Enviado",   color: "bg-green-500/15 text-green-400",     icon: CheckCircle2 },
  FAILED:    { label: "Falhou",    color: "bg-red-500/15 text-red-400",         icon: XCircle },
  CANCELLED: { label: "Cancelado", color: "bg-zinc-500/15 text-zinc-400",       icon: Ban },
}

export default async function AgendamentosPage() {
  const messages = await prisma.scheduledMessage.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      client: { select: { id: true, name: true } },
      groups: { include: { group: { select: { name: true } } } },
    },
    take: 100,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Agendamentos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Mensagens agendadas para grupos WhatsApp</p>
        </div>
        <Link
          href="/agendamentos/novo"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} />
          Novo agendamento
        </Link>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <CalendarClock size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum agendamento ainda.</p>
          <Link href="/agendamentos/novo" className="text-blue-400 text-sm mt-1 inline-block hover:underline">
            Criar primeiro agendamento
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const cfg = STATUS_CONFIG[msg.status]
            const Icon = cfg.icon
            const groupNames = msg.groups.map((gm) => gm.group.name).join(", ")

            return (
              <div
                key={msg.id}
                className="bg-zinc-900 border border-white/8 rounded-2xl px-5 py-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-100 line-clamp-2">{msg.text}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    {msg.client && (
                      <Link href={`/clientes/${msg.client.id}`} className="text-xs text-blue-400 hover:underline font-medium">
                        {msg.client.name}
                      </Link>
                    )}
                    <span className="text-xs text-zinc-500">
                      {groupNames || "Sem grupos"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatInTimeZone(msg.scheduledAt, TZ, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {msg.mediaName && (
                      <span className="text-xs text-zinc-600">
                        Arquivo: {msg.mediaName}
                      </span>
                    )}
                    <span className="text-xs text-zinc-600">por {msg.createdBy.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium", cfg.color)}>
                    <Icon size={12} />
                    {cfg.label}
                  </span>

                  {msg.status === "PENDING" && (
                    <>
                      <Link
                        href={`/agendamentos/${msg.id}/editar`}
                        className="text-xs text-zinc-500 hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-blue-900/10 flex items-center gap-1"
                      >
                        <Pencil size={12} />
                        Editar
                      </Link>
                      <CancelButton id={msg.id} />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CancelButton({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server"
        await prisma.scheduledMessage.update({
          where: { id },
          data: { status: "CANCELLED" },
        })
      }}
    >
      <button
        type="submit"
        className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/10 cursor-pointer"
      >
        Cancelar
      </button>
    </form>
  )
}
