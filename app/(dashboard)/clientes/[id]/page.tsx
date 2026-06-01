"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, CalendarClock, Smartphone, BarChart2,
  Settings, KeyRound, LayoutDashboard, Plus, Clock,
  CheckCircle2, XCircle, Ban, RefreshCw
} from "lucide-react"
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

interface Group {
  id: string
  name: string
  participants: number
  clientId: string | null
}

interface Message {
  id: string
  text: string
  scheduledAt: string
  status: keyof typeof STATUS_CONFIG
  mediaName: string | null
  createdBy: { name: string }
  groups: { group: { name: string } }[]
}

interface Client {
  id: string
  name: string
  description: string | null
  active: boolean
  groups: Group[]
  messages: Message[]
}

export default function ClientePage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [linkingGroup, setLinkingGroup] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [clientRes, groupsRes] = await Promise.all([
      fetch(`/api/clients/${id}`),
      fetch("/api/groups/all"),
    ])
    const clientData = await clientRes.json()
    const groupsData = await groupsRes.json()
    setClient(clientData.client)
    setAllGroups(groupsData.groups ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function toggleGroup(groupId: string, currentlyLinked: boolean) {
    setLinkingGroup(groupId)
    await fetch(`/api/clients/${id}/groups`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, linked: !currentlyLinked }),
    })
    await load()
    setLinkingGroup(null)
  }

  if (loading) return <div className="p-6 text-center text-zinc-600 text-sm">Carregando...</div>
  if (!client) return <div className="p-6 text-center text-zinc-600 text-sm">Cliente nao encontrado.</div>

  const linkedGroupIds = new Set(client.groups.map((g) => g.id))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/clientes" className="p-2 rounded-xl text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-zinc-100">{client.name}</h1>
          {client.description && <p className="text-sm text-zinc-500 mt-0.5">{client.description}</p>}
        </div>
      </div>

      {/* Grid de modulos */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Visao Geral */}
        <ModuleCard icon={LayoutDashboard} title="Visao Geral" badge="Em breve" muted>
          <p className="text-xs text-zinc-600">Resumo do cliente sera exibido aqui.</p>
        </ModuleCard>

        {/* Dashboard de Metricas */}
        <ModuleCard icon={BarChart2} title="Dashboard de Metricas" badge="Em breve" muted>
          <p className="text-xs text-zinc-600">Metricas e resultados serao exibidos aqui.</p>
        </ModuleCard>
      </div>

      {/* Grupo do Cliente */}
      <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-4">
          <Smartphone size={16} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Grupo do Cliente</h2>
          <span className="text-xs text-zinc-600 ml-1">{client.groups.length} vinculado{client.groups.length !== 1 ? "s" : ""}</span>
        </div>

        {allGroups.length === 0 ? (
          <p className="text-xs text-zinc-600">
            Nenhum grupo sincronizado.{" "}
            <Link href="/grupos" className="text-blue-400 hover:underline">Sincronizar grupos</Link>
          </p>
        ) : (
          <div className="space-y-2">
            {allGroups.map((g) => {
              const isLinked = linkedGroupIds.has(g.id)
              const isOtherClient = !isLinked && g.clientId !== null
              return (
                <div
                  key={g.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors",
                    isLinked
                      ? "border-blue-500/30 bg-blue-600/8"
                      : isOtherClient
                      ? "border-white/5 bg-zinc-800/30 opacity-40"
                      : "border-white/8 bg-zinc-800/50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{g.name}</p>
                    <p className="text-xs text-zinc-500">{g.participants} membros</p>
                  </div>
                  {!isOtherClient && (
                    <button
                      onClick={() => toggleGroup(g.id, isLinked)}
                      disabled={linkingGroup === g.id}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5",
                        isLinked
                          ? "bg-blue-600/20 text-blue-400 hover:bg-red-900/20 hover:text-red-400"
                          : "bg-zinc-700 text-zinc-400 hover:bg-blue-600/20 hover:text-blue-400"
                      )}
                    >
                      {linkingGroup === g.id
                        ? <RefreshCw size={12} className="animate-spin" />
                        : isLinked ? "Desvincular" : "Vincular"
                      }
                    </button>
                  )}
                  {isOtherClient && (
                    <span className="text-xs text-zinc-600 px-2">Outro cliente</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Agendamentos */}
      <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <CalendarClock size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Agendamentos</h2>
          </div>
          <Link
            href={`/agendamentos/novo?clientId=${client.id}`}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus size={12} />
            Novo
          </Link>
        </div>

        {client.messages.length === 0 ? (
          <p className="text-xs text-zinc-600">Nenhuma mensagem agendada para este cliente.</p>
        ) : (
          <div className="space-y-2">
            {client.messages.map((msg) => {
              const cfg = STATUS_CONFIG[msg.status]
              const Icon = cfg.icon
              return (
                <div key={msg.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{msg.text}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {formatInTimeZone(new Date(msg.scheduledAt), TZ, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      {" · "}{msg.groups.map((gm) => gm.group.name).join(", ")}
                    </p>
                  </div>
                  <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", cfg.color)}>
                    <Icon size={10} />
                    {cfg.label}
                  </span>
                </div>
              )
            })}
            <Link
              href={`/agendamentos?clientId=${client.id}`}
              className="block text-xs text-blue-400 hover:underline mt-2 pt-2"
            >
              Ver todos os agendamentos
            </Link>
          </div>
        )}
      </div>

      {/* Configuracoes + Credenciais */}
      <div className="grid grid-cols-2 gap-4">
        <ModuleCard icon={Settings} title="Configuracoes" badge="Em breve" muted>
          <p className="text-xs text-zinc-600">Configuracoes do cliente serao exibidas aqui.</p>
        </ModuleCard>
        <ModuleCard icon={KeyRound} title="Credenciais" badge="Em breve" muted>
          <p className="text-xs text-zinc-600">Acesso e credenciais do cliente serao gerenciados aqui.</p>
        </ModuleCard>
      </div>
    </div>
  )
}

function ModuleCard({
  icon: Icon,
  title,
  badge,
  muted,
  children,
}: {
  icon: React.ElementType
  title: string
  badge?: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("bg-zinc-900 border rounded-2xl p-5", muted ? "border-white/5 opacity-60" : "border-white/8")}>
      <div className="flex items-center gap-2.5 mb-3">
        <Icon size={16} className={muted ? "text-zinc-600" : "text-blue-400"} />
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 ml-auto">{badge}</span>
        )}
      </div>
      {children}
    </div>
  )
}
