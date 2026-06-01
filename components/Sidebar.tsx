"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import Image from "next/image"
import {
  LogOut, Building2, Users, ArrowLeft,
  LayoutDashboard, CalendarClock, Smartphone,
  Settings, KeyRound
} from "lucide-react"
import { cn } from "@/lib/utils"

const clientNav = [
  { href: "",              label: "Visao Geral",   icon: LayoutDashboard },
  { href: "/agendamentos", label: "Agendamentos",  icon: CalendarClock },
  { href: "/grupos",       label: "Grupos",        icon: Smartphone },
  { href: "/configuracoes",label: "Configuracoes", icon: Settings,  soon: true },
  { href: "/credenciais",  label: "Credenciais",   icon: KeyRound,  soon: true },
]

interface SidebarProps {
  role: string
  name: string
}

export function Sidebar({ role, name }: SidebarProps) {
  const pathname = usePathname()
  const [clientName, setClientName] = useState<string | null>(null)

  // Detecta se estamos dentro de /clientes/[id]
  const clientMatch = pathname.match(/^\/clientes\/([^/]+)/)
  const clientId = clientMatch?.[1]

  useEffect(() => {
    if (clientId) {
      fetch(`/api/clients/${clientId}`)
        .then((r) => r.json())
        .then((d) => setClientName(d.client?.name ?? null))
    } else {
      setClientName(null)
    }
  }, [clientId])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  const inClientContext = !!clientId

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-zinc-900 border-r border-white/8 h-full">
      {/* Header */}
      <div className="px-5 py-5 border-b border-white/8">
        <Image src="/logo-clara.png" alt="LUQZ" width={100} height={30} className="opacity-80" />
      </div>

      {inClientContext ? (
        /* Sidebar de contexto do cliente */
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link
            href="/clientes"
            className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
          >
            <ArrowLeft size={13} />
            Todos os clientes
          </Link>

          {clientName && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-semibold text-zinc-100 truncate">{clientName}</p>
            </div>
          )}

          <div className="h-px bg-white/5 mx-3 mb-2" />

          {clientNav.map(({ href, label, icon: Icon, soon }) => {
            const fullHref = `/clientes/${clientId}${href}`
            const active = href === ""
              ? pathname === fullHref
              : pathname === fullHref || pathname.startsWith(fullHref + "/")

            return (
              <div key={href} className="relative">
                {soon ? (
                  <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 cursor-not-allowed select-none">
                    <Icon size={16} />
                    {label}
                    <span className="ml-auto text-xs bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded-md">em breve</span>
                  </span>
                ) : (
                  <Link
                    href={fullHref}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-orange-500/10 text-orange-400"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>
      ) : (
        /* Sidebar padrao */
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link
            href="/clientes"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              pathname.startsWith("/clientes")
                ? "bg-orange-500/10 text-orange-400"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
            )}
          >
            <Building2 size={16} />
            Clientes
          </Link>

          {role === "ADMIN" && (
            <Link
              href="/usuarios"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                pathname.startsWith("/usuarios")
                  ? "bg-orange-500/10 text-orange-400"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
              )}
            >
              <Users size={16} />
              Usuarios
            </Link>
          )}
        </nav>
      )}

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/8">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-zinc-100 truncate">{name}</p>
          <p className="text-xs text-zinc-500 capitalize">{role.toLowerCase()}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-900/10 transition-colors w-full cursor-pointer"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
