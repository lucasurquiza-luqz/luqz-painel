import Link from "next/link"
import { prisma } from "@/lib/db"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Instagram, Film, Images, Image as ImageIcon, ExternalLink } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, addDays, format, isSameMonth,
} from "date-fns"
import { PostActions } from "../_post-actions"

const TZ = "America/Sao_Paulo"
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#eab308", PUBLISHING: "#f97316", FAILED: "#ef4444", PUBLISHED: "#22c55e", CANCELLED: "#71717a",
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Agendado", PUBLISHING: "Publicando", FAILED: "Falhou", PUBLISHED: "Publicado",
}
const TYPE_LABEL = { image: "Imagem", carousel: "Carrossel", reel: "Reel" }

type Item = {
  key: string; kind: "scheduled" | "published"; id: string; status: string
  time: string; caption: string; thumb: string | null; type: "image" | "carousel" | "reel"; permalink: string | null
}
const typeIcon = (t: Item["type"]) => (t === "reel" ? Film : t === "carousel" ? Images : ImageIcon)

const VIEWS = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
]

export default async function InstagramCalendarioPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ v?: string; a?: string }>
}) {
  const { id: clientId } = await params
  const { v, a } = await searchParams
  const view = v === "dia" || v === "mes" ? v : "semana"

  const account = await prisma.instagramAccount.findUnique({ where: { clientId }, select: { id: true } })
  if (!account) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <CalendarDays size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Conecte a conta em Configurações para usar o calendário.</p>
      </div>
    )
  }

  const anchor = a && /^\d{4}-\d{2}-\d{2}$/.test(a) ? new Date(`${a}T12:00:00`) : new Date()

  // Intervalo de consulta conforme a visão (com folga de 1 dia p/ fuso).
  let rangeStart: Date, rangeEnd: Date
  if (view === "dia") { rangeStart = addDays(anchor, -1); rangeEnd = addDays(anchor, 1) }
  else if (view === "mes") { rangeStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 }); rangeEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }) }
  else { rangeStart = startOfWeek(anchor, { weekStartsOn: 1 }); rangeEnd = endOfWeek(anchor, { weekStartsOn: 1 }) }

  const todayKey = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")

  const [scheduled, media] = await Promise.all([
    prisma.instagramScheduledPost.findMany({
      where: { clientId, status: { in: ["PENDING", "PUBLISHING", "FAILED"] }, scheduledAt: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.instagramMedia.findMany({
      where: { accountId: account.id, timestamp: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { timestamp: "asc" },
    }),
  ])

  const byDay = new Map<string, Item[]>()
  const add = (it: Item) => byDay.set(it.key, [...(byDay.get(it.key) ?? []), it])
  for (const s of scheduled) add({
    key: formatInTimeZone(s.scheduledAt, TZ, "yyyy-MM-dd"), kind: "scheduled", id: s.id, status: s.status,
    time: formatInTimeZone(s.scheduledAt, TZ, "HH:mm"), caption: s.caption, thumb: s.imageUrls[0] ?? null,
    type: s.videoUrl ? "reel" : s.imageUrls.length > 1 ? "carousel" : "image", permalink: null,
  })
  for (const p of media) { if (!p.timestamp) continue; add({
    key: formatInTimeZone(p.timestamp, TZ, "yyyy-MM-dd"), kind: "published", id: p.id, status: "PUBLISHED",
    time: formatInTimeZone(p.timestamp, TZ, "HH:mm"), caption: p.caption ?? "", thumb: p.thumb,
    type: p.mediaType === "VIDEO" ? "reel" : p.mediaType === "CAROUSEL_ALBUM" ? "carousel" : "image", permalink: p.permalink,
  }) }
  for (const arr of byDay.values()) arr.sort((x, y) => x.time.localeCompare(y.time))

  // Navegação e título
  const step = view === "dia" ? 1 : view === "semana" ? 7 : 0
  const prevA = view === "mes" ? format(addMonths(anchor, -1), "yyyy-MM-dd") : format(addDays(anchor, -step), "yyyy-MM-dd")
  const nextA = view === "mes" ? format(addMonths(anchor, 1), "yyyy-MM-dd") : format(addDays(anchor, step), "yyyy-MM-dd")
  const title = view === "dia" ? formatInTimeZone(anchor, TZ, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : view === "mes" ? formatInTimeZone(startOfMonth(anchor), TZ, "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "dd/MM")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "dd/MM")}`

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={`?v=${view}&a=${prevA}`} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5"><ChevronLeft size={18} /></Link>
          <h2 className="text-sm font-medium text-zinc-100 capitalize min-w-44 text-center">{title}</h2>
          <Link href={`?v=${view}&a=${nextA}`} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5"><ChevronRight size={18} /></Link>
          <Link href={`?v=${view}`} className="text-xs text-zinc-500 hover:text-orange-400 ml-1">hoje</Link>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 border border-white/8 rounded-xl p-1">
          {VIEWS.map((vw) => (
            <Link key={vw.key} href={`?v=${vw.key}`} className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === vw.key ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>{vw.label}</Link>
          ))}
        </div>
      </div>

      {view === "dia" && <DayView clientId={clientId} dayKey={format(anchor, "yyyy-MM-dd")} anchorKey={formatInTimeZone(anchor, TZ, "yyyy-MM-dd")} items={byDay.get(formatInTimeZone(anchor, TZ, "yyyy-MM-dd")) ?? []} />}

      {view === "semana" && <WeekView clientId={clientId} days={eachDayOfInterval({ start: rangeStart, end: rangeEnd })} byDay={byDay} todayKey={todayKey} />}

      {view === "mes" && <MonthView clientId={clientId} days={eachDayOfInterval({ start: rangeStart, end: rangeEnd })} anchor={anchor} byDay={byDay} todayKey={todayKey} />}
    </div>
  )
}

// ── DIA ──────────────────────────────────────────────────────────
function DayView({ clientId, anchorKey, items }: { clientId: string; dayKey: string; anchorKey: string; items: Item[] }) {
  if (items.length === 0) {
    return (
      <Link href={`/clientes/${clientId}/instagram/novo?date=${anchorKey}`} className="block text-center py-16 text-zinc-600 border border-dashed border-white/10 rounded-2xl hover:border-white/20 hover:text-zinc-400">
        <Plus size={28} className="mx-auto mb-2" />
        <p className="text-sm">Nenhum post neste dia · agendar</p>
      </Link>
    )
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {items.map((it) => {
        const Icon = typeIcon(it.type)
        return (
          <div key={it.kind + it.id} className="flex gap-4 bg-zinc-900 border border-white/8 rounded-2xl p-3">
            <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0 pt-1">
              <span className="text-lg font-semibold text-zinc-100 tabular-nums">{it.time}</span>
              <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Icon size={12} /> {TYPE_LABEL[it.type]}</span>
            </div>
            <div className="w-20 h-24 rounded-xl overflow-hidden bg-zinc-800 border border-white/8 flex-shrink-0">
              {it.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.thumb} alt="" className="w-full h-full object-cover" />
              ) : <div className="w-full h-full flex items-center justify-center text-zinc-600"><Icon size={22} /></div>}
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: STATUS_COLOR[it.status] }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[it.status] }} /> {STATUS_LABEL[it.status] ?? it.status}
                </span>
                {it.kind === "scheduled" ? <PostActions clientId={clientId} postId={it.id} status={it.status} />
                  : it.permalink ? <a href={it.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-orange-400"><ExternalLink size={12} /> Ver post</a> : null}
              </div>
              <p className="text-sm text-zinc-300 mt-2 line-clamp-3 whitespace-pre-line">{it.caption || "(sem legenda)"}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── SEMANA ───────────────────────────────────────────────────────
function WeekView({ clientId, days, byDay, todayKey }: { clientId: string; days: Date[]; byDay: Map<string, Item[]>; todayKey: string }) {
  return (
    <div className="space-y-4">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd")
        const items = byDay.get(key) ?? []
        const isToday = key === todayKey
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <Link href={`?v=dia&a=${key}`} className={`text-sm font-medium capitalize hover:underline ${isToday ? "text-orange-400" : "text-zinc-300"}`}>
                {format(day, "EEEE", { locale: ptBR })} · {format(day, "dd/MM")}
              </Link>
              {items.length > 0 && <span className="text-xs text-zinc-600">{items.length} post{items.length !== 1 ? "s" : ""}</span>}
              <Link href={`/clientes/${clientId}/instagram/novo?date=${key}`} className="text-zinc-600 hover:text-orange-400 ml-auto"><Plus size={16} /></Link>
            </div>
            {items.length === 0 ? (
              <Link href={`/clientes/${clientId}/instagram/novo?date=${key}`} className="block text-xs text-zinc-600 hover:text-zinc-400 border border-dashed border-white/8 rounded-xl px-4 py-2.5">+ Agendar</Link>
            ) : (
              <div className="space-y-2">
                {items.map((it) => {
                  const Icon = typeIcon(it.type)
                  return (
                    <div key={it.kind + it.id} className="flex items-center gap-3 bg-zinc-900 border border-white/8 rounded-xl p-2.5">
                      <div className="w-11 h-14 rounded-lg overflow-hidden bg-zinc-800 border border-white/8 flex-shrink-0">
                        {it.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.thumb} alt="" className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full flex items-center justify-center text-zinc-600"><Icon size={16} /></div>}
                      </div>
                      <div className="w-16 flex-shrink-0">
                        <p className="text-sm font-medium text-zinc-100 tabular-nums">{it.time}</p>
                        <p className="text-[11px] text-zinc-500 flex items-center gap-1"><Icon size={11} /> {TYPE_LABEL[it.type]}</p>
                      </div>
                      <p className="flex-1 min-w-0 text-xs text-zinc-400 line-clamp-2">{it.caption || "(sem legenda)"}</p>
                      <span className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: STATUS_COLOR[it.status] }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[it.status] }} /> {STATUS_LABEL[it.status] ?? it.status}
                      </span>
                      <div className="flex-shrink-0">
                        {it.kind === "scheduled" ? <PostActions clientId={clientId} postId={it.id} status={it.status} />
                          : it.permalink ? <a href={it.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-orange-400 px-2 py-1"><ExternalLink size={12} /> Ver</a> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── MÊS (miniaturas) ─────────────────────────────────────────────
function MonthView({ clientId, days, anchor, byDay, todayKey }: { clientId: string; days: Date[]; anchor: Date; byDay: Map<string, Item[]>; todayKey: string }) {
  return (
    <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
      {WEEKDAYS.map((wd) => (
        <div key={wd} className="bg-zinc-950 py-2 text-center text-[11px] font-medium text-zinc-500">{wd}</div>
      ))}
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd")
        const items = byDay.get(key) ?? []
        const inMonth = isSameMonth(day, anchor)
        const isToday = key === todayKey
        return (
          <Link key={key} href={`?v=dia&a=${key}`} className={`bg-zinc-900 min-h-28 p-1.5 flex flex-col gap-1.5 hover:bg-zinc-800/60 transition-colors ${inMonth ? "" : "opacity-40"}`}>
            <span className={isToday ? "bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-semibold" : "text-[11px] text-zinc-500 px-0.5"}>{format(day, "d")}</span>
            <div className="grid grid-cols-3 gap-1 content-start">
              {items.slice(0, 6).map((it, i) => {
                const Icon = typeIcon(it.type)
                return (
                  <div key={i} className="aspect-square rounded overflow-hidden bg-zinc-800 border-2" style={{ borderColor: STATUS_COLOR[it.status] }} title={`${it.time} · ${STATUS_LABEL[it.status] ?? ""}`}>
                    {it.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.thumb} alt="" className="w-full h-full object-cover" />
                    ) : <div className="w-full h-full flex items-center justify-center text-zinc-600"><Icon size={10} /></div>}
                  </div>
                )
              })}
              {items.length > 6 && <div className="aspect-square rounded bg-white/5 flex items-center justify-center text-[10px] text-zinc-400">+{items.length - 6}</div>}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
