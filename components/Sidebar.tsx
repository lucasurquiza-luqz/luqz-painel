"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Activity,
  BrainCircuit,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  FileBarChart,
  FileText,
  FolderKanban,
  Gauge,
  KeyRound,
  LayoutTemplate,
  ListTodo,
  Map,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Users,
  Video,
  HeartPulse,
  Instagram,
} from "lucide-react"
import { DashBrandMark } from "@/components/DashBrandMark"
import { NotificationsBell } from "@/components/NotificationsBell"
import { cn } from "@/lib/utils"

type IconType = React.ComponentType<{ size?: number; className?: string }>
type NavLink = { href: string; label: string; icon: IconType; internalOnly?: boolean; soon?: boolean }
type NavGroup = { label?: string; internalOnly?: boolean; items: NavLink[] }

// Menu agrupado e colapsável. Concentra por categoria para o menu não inchar
// conforme novas dimensões (Resultado, NPS) entram.
const clientNav: NavGroup[] = [
  { items: [
    { href: "", label: "Visão geral", icon: LayoutDashboard },
    { href: "/assistente", label: "Assistente IA", icon: Sparkles, internalOnly: true },
  ] },
  {
    label: "Cadastro",
    internalOnly: true,
    items: [
      { href: "/cadastro", label: "Cadastro", icon: ClipboardList },
      { href: "/documentos", label: "Documentos", icon: FileText },
    ],
  },
  {
    label: "Relacionamento",
    internalOnly: true,
    items: [
      { href: "/status", label: "Status", icon: Activity },
      { href: "/contexto", label: "Contexto", icon: BrainCircuit },
      { href: "/grupo/resumo-diario", label: "Resumo do grupo", icon: MessagesSquare },
      { href: "/reunioes", label: "Reuniões", icon: Video },
      { href: "/checkin", label: "Check-in", icon: HeartPulse },
    ],
  },
  {
    label: "Performance",
    items: [
      { href: "/metas", label: "Painel de performance", icon: Target, internalOnly: true },
      { href: "/desempenho", label: "Dashboard de performance", icon: Gauge },
      { href: "/plano-de-midia", label: "Plano de mídia", icon: Map },
      { href: "/relatorio", label: "Relatório mensal", icon: FileBarChart },
      { href: "/relatorio-semanal", label: "Report semanal", icon: CalendarClock },
    ],
  },
  {
    label: "Execução",
    internalOnly: true,
    items: [
      { href: "/tarefas", label: "Tarefas", icon: ListTodo },
      { href: "/projetos", label: "Projetos", icon: FolderKanban },
    ],
  },
  {
    label: "Conteúdo",
    internalOnly: true,
    items: [
      { href: "/instagram", label: "Instagram", icon: Instagram },
    ],
  },
  {
    label: "Mensageria",
    items: [
      { href: "/chat", label: "Chat", icon: MessageSquare },
      { href: "/agendamentos", label: "Agendamentos", icon: CalendarClock, internalOnly: true },
    ],
  },
  {
    label: "Configurações",
    internalOnly: true,
    items: [
      { href: "/configuracoes", label: "Geral", icon: Settings },
      { href: "/credenciais", label: "Credenciais", icon: KeyRound, soon: true },
    ],
  },
]

interface SidebarProps {
  role: string
  name: string
}

export function Sidebar({ role, name }: SidebarProps) {
  const pathname = usePathname()
  const [clientName, setClientName] = useState<string | null>(null)
  const clientId = pathname.match(/^\/clientes\/([^/]+)/)?.[1]

  useEffect(() => {
    if (!clientId) {
      setClientName(null)
      return
    }

    const controller = new AbortController()

    fetch(`/api/clients/${clientId}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setClientName(data.client?.name ?? null))
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") setClientName(null)
      })

    return () => controller.abort()
  }, [clientId])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-white/10 bg-[#111111]">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center justify-between gap-2">
          <Link href="/clientes" className="block rounded-lg focus-visible:outline-offset-4">
            <DashBrandMark />
          </Link>
          <NotificationsBell />
        </div>

        {clientId && <ClientSwitcher clientId={clientId} clientName={clientName} />}
      </div>

      <nav className="dash-scrollbar flex-1 overflow-y-auto p-3">
        {clientId ? (
          <ClientNav clientId={clientId} role={role} pathname={pathname} />
        ) : (
          <>
            <NavSection label="Operação">
              <NavItem
                href="/resumo"
                label="Resumo diário"
                icon={Sun}
                active={pathname.startsWith("/resumo")}
              />
              <NavItem
                href="/torre"
                label="Torre de controle"
                icon={Gauge}
                active={pathname.startsWith("/torre")}
              />
              <NavItem
                href="/tarefas"
                label="Minhas tarefas"
                icon={ListTodo}
                active={pathname.startsWith("/tarefas")}
              />
              <NavItem
                href="/assistente"
                label="Assistente IA"
                icon={Sparkles}
                active={pathname.startsWith("/assistente")}
              />
              <NavItem
                href="/conversas"
                label="Conversas"
                icon={MessageSquare}
                active={pathname.startsWith("/conversas")}
              />
              <NavItem
                href="/clientes"
                label="Clientes"
                icon={Building2}
                active={pathname.startsWith("/clientes")}
              />
              <NavItem
                href="/templates"
                label="Modelos"
                icon={LayoutTemplate}
                active={pathname.startsWith("/templates")}
              />
            </NavSection>

            {role === "ADMIN" && (
              <NavSection label="Administração">
                <NavItem href="/usuarios" label="Usuários" icon={Users} active={pathname.startsWith("/usuarios")} />
                <NavItem href="/configuracoes" label="Configurações" icon={Settings} active={pathname.startsWith("/configuracoes")} />
              </NavSection>
            )}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 rounded-lg bg-white/[0.03] px-3 py-3">
          <p className="truncate text-xs font-semibold text-zinc-200">{name}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">{role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}

function ClientSwitcher({ clientId, clientName }: { clientId: string; clientName: string | null }) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string; active: boolean }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState("")

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      try {
        const res = await fetch("/api/clients")
        const data = await res.json()
        if (res.ok) setClients(data.clients ?? [])
      } catch {
        /* ignore */
      }
      setLoaded(true)
    }
  }

  const term = search.trim().toLowerCase()
  const filtered = clients
    .filter((c) => c.active && c.id !== clientId && (!term || c.name.toLowerCase().includes(term)))
    .slice(0, 40)

  return (
    <div className="mt-4">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:border-white/20"
      >
        <div className="min-w-0 flex-1">
          <p className="dash-eyebrow text-[10px] text-zinc-600">Cliente ativo</p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-100" title={clientName ?? undefined}>
            {clientName ?? "Carregando..."}
          </p>
        </div>
        <ChevronsUpDown size={15} className="shrink-0 text-zinc-600" />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-white/10 bg-[#161616] p-2 shadow-xl">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-700" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="dash-input w-full rounded-lg py-2 pl-8 pr-2 text-xs"
            />
          </div>
          <div className="dash-scrollbar max-h-64 space-y-0.5 overflow-y-auto">
            {!loaded ? (
              <p className="px-2 py-3 text-xs text-zinc-600">Carregando…</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-zinc-600">Nenhum cliente.</p>
            ) : (
              filtered.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  onClick={() => setOpen(false)}
                  className="block truncate rounded-lg px-2.5 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  {c.name}
                </Link>
              ))
            )}
          </div>
          <Link
            href="/clientes"
            onClick={() => setOpen(false)}
            className="mt-1 block border-t border-white/8 px-2.5 pt-2 text-[11px] font-medium text-[#FFB185] hover:text-[#FFD482]"
          >
            Ver carteira completa →
          </Link>
        </div>
      )}
    </div>
  )
}

function ClientNav({ clientId, role, pathname }: { clientId: string; role: string; pathname: string }) {
  const isActive = (href: string) => {
    const full = `/clientes/${clientId}${href}`
    return href === "" ? pathname === full : pathname === full || pathname.startsWith(`${full}/`)
  }

  const groups = clientNav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (!group.internalOnly && !item.internalOnly) || role !== "CLIENTE"),
    }))
    .filter((group) => group.items.length > 0)

  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  // Abertos por padrão (mais convidativo); recolher é opcional para economizar espaço.
  const isOpen = (label: string) => overrides[label] ?? true

  const renderItem = (item: NavLink) => {
    if (item.soon) {
      return (
        <div key={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700">
          <item.icon size={16} />
          <span>{item.label}</span>
          <span className="ml-auto rounded-full border border-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700">
            Em breve
          </span>
        </div>
      )
    }
    return <NavItem key={item.href} href={`/clientes/${clientId}${item.href}`} label={item.label} icon={item.icon} active={isActive(item.href)} />
  }

  return (
    <div>
      {groups.map((group, index) => {
        if (!group.label) {
          return <div key={`top-${index}`} className="mb-3 space-y-1">{group.items.map(renderItem)}</div>
        }
        const open = isOpen(group.label)
        const label = group.label
        return (
          <section key={label} className="mb-2">
            <button
              onClick={() => setOverrides((o) => ({ ...o, [label]: !isOpen(label) }))}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600 hover:text-zinc-400"
            >
              <ChevronDown size={12} className={cn("transition-transform", open ? "" : "-rotate-90")} />
              {label}
            </button>
            {open && <div className="mt-1 space-y-1">{group.items.map(renderItem)}</div>}
          </section>
        )
      })}
    </div>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-700">{label}</p>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium",
        active
          ? "border-[#FF8F50]/20 bg-[#FF8F50]/10 text-[#FFB185]"
          : "border-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-100",
      )}
    >
      <Icon size={16} className={active ? "text-[#FF8F50]" : undefined} />
      {label}
    </Link>
  )
}
