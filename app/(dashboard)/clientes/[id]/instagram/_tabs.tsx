"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, CalendarDays, BarChart3, ListChecks, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export function InstagramTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/clientes/${clientId}/instagram`

  const tabs = [
    { href: base, label: "Visão geral", icon: LayoutDashboard, exact: true },
    { href: `${base}/calendario`, label: "Calendário", icon: CalendarDays },
    { href: `${base}/analise`, label: "Análise", icon: BarChart3 },
    { href: `${base}/programados`, label: "Programados", icon: ListChecks },
    { href: `${base}/configuracoes`, label: "Configurações", icon: Settings },
  ]

  return (
    <div className="flex items-center gap-1 border-b border-white/8 mb-6 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              active
                ? "border-orange-500 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Icon size={15} />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
