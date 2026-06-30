"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, AtSign, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string; actorName: string | null }

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return "agora"
  if (m < 60) return `há ${m}min`
  if (h < 24) return `há ${h}h`
  if (d < 7) return `há ${d}d`
  return new Date(iso).toLocaleDateString("pt-BR")
}

export function NotificationsBell() {
  const router = useRouter()
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const d = await (await fetch("/api/notifications")).json()
      setItems(d.notifications ?? []); setUnread(d.unread ?? 0)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t) }, [load])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [open])

  async function markAll() { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); load() }
  async function openItem(n: Notif) {
    setOpen(false)
    if (!n.read) { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) }); load() }
    if (n.link) router.push(n.link)
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen((o) => !o); if (!open) load() }} className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-100" title="Notificações">
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF8F50] px-1 text-[9px] font-bold text-black">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#161616] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
            <span className="text-sm font-semibold text-white">Notificações</span>
            {unread > 0 && <button onClick={markAll} className="flex items-center gap-1 text-[11px] text-[#FFB185] hover:text-[#FFD482]"><Check size={12} /> marcar todas</button>}
          </div>
          <div className="dash-scrollbar max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-zinc-600">Nada por aqui ainda.</p>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)} className={cn("flex w-full items-start gap-2.5 border-b border-white/5 px-3 py-2.5 text-left hover:bg-white/[0.03]", !n.read && "bg-[#FF8F50]/[0.06]")}>
                <span className={cn("mt-0.5 shrink-0 rounded-md p-1.5", n.type === "MENTION" ? "bg-violet-500/15 text-violet-300" : "bg-sky-500/15 text-sky-300")}>
                  {n.type === "MENTION" ? <AtSign size={13} /> : <UserPlus size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-zinc-200">{n.title}</span>
                  {n.body && <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{n.body}</span>}
                  <span className="mt-0.5 block text-[10px] text-zinc-600">{relTime(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FF8F50]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
