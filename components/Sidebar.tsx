"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  BrainCircuit,
  Building2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react"
import { DashBrandMark } from "@/components/DashBrandMark"
import { cn } from "@/lib/utils"

const clientNav = [
  { href: "", label: "Visão geral", icon: LayoutDashboard },
  { href: "/contexto", label: "Contexto", icon: BrainCircuit, internalOnly: true },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/credenciais", label: "Credenciais", icon: KeyRound, soon: true },
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
        <Link href="/clientes" className="block rounded-lg focus-visible:outline-offset-4">
          <DashBrandMark />
        </Link>

        {clientId && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="dash-eyebrow text-[10px] text-zinc-600">Cliente ativo</p>
            <p className="mt-2 truncate text-sm font-semibold text-zinc-100" title={clientName ?? undefined}>
              {clientName ?? "Carregando..."}
            </p>
            <Link href="/clientes" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#FFB185] hover:text-[#FFD482]">
              <ArrowLeft size={12} />
              Trocar cliente
            </Link>
          </div>
        )}
      </div>

      <nav className="dash-scrollbar flex-1 overflow-y-auto p-3">
        {clientId ? (
          <NavSection label="Workspace do cliente">
            {clientNav.filter((item) => !item.internalOnly || role !== "CLIENTE").map((item) => {
              const fullHref = `/clientes/${clientId}${item.href}`
              const active = item.href === ""
                ? pathname === fullHref
                : pathname === fullHref || pathname.startsWith(`${fullHref}/`)

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

              return <NavItem key={item.href} href={fullHref} label={item.label} icon={item.icon} active={active} />
            })}
          </NavSection>
        ) : (
          <>
            <NavSection label="Operação">
              <NavItem
                href="/clientes"
                label="Clientes"
                icon={Building2}
                active={pathname.startsWith("/clientes")}
              />
            </NavSection>

            {role === "ADMIN" && (
              <NavSection label="Administração">
                <NavItem href="/usuarios" label="Usuários" icon={Users} active={pathname.startsWith("/usuarios")} />
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
