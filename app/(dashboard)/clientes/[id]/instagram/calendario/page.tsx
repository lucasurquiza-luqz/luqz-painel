import Link from "next/link"
import { prisma } from "@/lib/db"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Instagram, Play } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, format, isSameMonth,
} from "date-fns"

const TZ = "America/Sao_Paulo"
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-500/80",
  PUBLISHING: "bg-orange-500/80",
  FAILED: "bg-red-500/80",
}

export default async function InstagramCalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ m?: string }>
}) {
  const { id: clientId } = await params
  const { m } = await searchParams

  const account = await prisma.instagramAccount.findUnique({ where: { clientId }, select: { id: true } })
  if (!account) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <CalendarDays size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Conecte a conta em Configurações para usar o calendário.</p>
      </div>
    )
  }

  // Mês de referência (a partir de ?m=YYYY-MM, senão o atual)
  const base = m && /^\d{4}-\d{2}$/.test(m) ? new Date(`${m}-01T12:00:00`) : new Date()
  const monthStart = startOfMonth(base)
  const monthEnd = endOfMonth(base)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const prevM = format(addMonths(base, -1), "yyyy-MM")
  const nextM = format(addMonths(base, 1), "yyyy-MM")
  const todayKey = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")

  // Dados do intervalo visível
  const [scheduled, media] = await Promise.all([
    prisma.instagramScheduledPost.findMany({
      where: { clientId, status: { in: ["PENDING", "PUBLISHING", "FAILED"] }, scheduledAt: { gte: gridStart, lte: gridEnd } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.instagramMedia.findMany({
      where: { accountId: account.id, timestamp: { gte: gridStart, lte: gridEnd } },
      orderBy: { timestamp: "asc" },
    }),
  ])

  // Buckets por dia (data em SP)
  type Item = { kind: "scheduled" | "published"; thumb: string | null; status?: string; time: string; href: string; isVideo: boolean }
  const byDay = new Map<string, Item[]>()
  const push = (key: string, item: Item) => byDay.set(key, [...(byDay.get(key) ?? []), item])

  for (const s of scheduled) {
    const key = formatInTimeZone(s.scheduledAt, TZ, "yyyy-MM-dd")
    push(key, { kind: "scheduled", thumb: s.imageUrls[0] ?? null, status: s.status, time: formatInTimeZone(s.scheduledAt, TZ, "HH:mm"), href: `/clientes/${clientId}/instagram/programados`, isVideo: false })
  }
  for (const p of media) {
    if (!p.timestamp) continue
    const key = formatInTimeZone(p.timestamp, TZ, "yyyy-MM-dd")
    push(key, { kind: "published", thumb: p.thumb, time: formatInTimeZone(p.timestamp, TZ, "HH:mm"), href: p.permalink ?? "#", isVideo: p.mediaType === "VIDEO" })
  }

  return (
    <div>
      {/* Header do mês */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link href={`?m=${prevM}`} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5"><ChevronLeft size={18} /></Link>
          <h2 className="text-sm font-medium text-zinc-100 capitalize min-w-40 text-center">
            {formatInTimeZone(monthStart, TZ, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <Link href={`?m=${nextM}`} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5"><ChevronRight size={18} /></Link>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500/80" /> agendado</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500/80" /> publicado</span>
        </div>
      </div>

      {/* Grade */}
      <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-zinc-950 py-2 text-center text-[11px] font-medium text-zinc-500">{w}</div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const items = byDay.get(key) ?? []
          const inMonth = isSameMonth(day, base)
          const isToday = key === todayKey
          return (
            <div key={key} className={`bg-zinc-900 min-h-24 p-1.5 group relative ${inMonth ? "" : "opacity-40"}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] ${isToday ? "bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold" : "text-zinc-500"}`}>
                  {format(day, "d")}
                </span>
                <Link href={`/clientes/${clientId}/instagram/novo?date=${key}`} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-orange-400" title="Agendar neste dia">
                  <Plus size={14} />
                </Link>
              </div>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((it, i) => (
                  <a key={i} href={it.href} target={it.kind === "published" ? "_blank" : undefined} rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] rounded px-1 py-0.5 bg-white/5 hover:bg-white/10">
                    {it.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.thumb} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                    ) : (
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${it.kind === "published" ? "bg-green-500/80" : STATUS_COLOR[it.status ?? ""] ?? "bg-zinc-500"}`} />
                    )}
                    <span className="text-zinc-400 truncate">{it.time}</span>
                    {it.isVideo && <Play size={9} className="text-zinc-500 flex-shrink-0" />}
                  </a>
                ))}
                {items.length > 3 && <p className="text-[10px] text-zinc-600 px-1">+{items.length - 3}</p>}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-zinc-600 mt-3 flex items-center gap-1">
        <Instagram size={12} /> Passe o mouse num dia e clique no + para agendar.
      </p>
    </div>
  )
}
