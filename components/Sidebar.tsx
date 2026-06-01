"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarClock, Users, Smartphone, LogOut, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/clientes",      label: "Clientes",      icon: Building2 },
  { href: "/agendamentos",  label: "Agendamentos",  icon: CalendarClock },
  { href: "/grupos",        label: "Grupos",        icon: Smartphone },
  { href: "/usuarios",      label: "Usuarios",      icon: Users, adminOnly: true },
]

interface SidebarProps {
  role: string
  name: string
}

export function Sidebar({ role, name }: SidebarProps) {
  const pathname = usePathname()

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  const links = nav.filter((item) => !item.adminOnly || role === "ADMIN")

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-zinc-900 border-r border-white/8 h-full">
      <div className="px-5 py-5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span className="font-semibold text-zinc-100 text-sm">Painel LUQZ</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

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
