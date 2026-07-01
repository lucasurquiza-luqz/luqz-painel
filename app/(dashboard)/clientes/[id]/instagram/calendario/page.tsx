import Link from "next/link"
import { prisma } from "@/lib/db"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Instagram, Film, Images, Image as ImageIcon, ExternalLink, List, LayoutGrid } from "lucide-react"
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

type Item = {
  key: string // dia YYYY-MM-DD (SP)
  kind: "scheduled" | "published"
  id: string
  status: string
  time: string
  ts: Date
  caption: string
  thumb: string | null
  type: "image" | "carousel" | "reel"
  permalink: string | null
}

function typeIcon(t: Item["type"]) {
  if (t === "reel") return Film
  if (t === "carousel") return Images
  return ImageIcon
}

export default async function InstagramCalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ v?: string; w?: string; m?: string }>
}) {
  const { id: clientId } = await params
  const { v, w, m } = await searchParams
  const view = v === "mes" ? "mes" : "agenda"

  const account = await prisma.instagramAccount.findUnique({ where: { clientId }, select: { id: true } })
  if (!account) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <CalendarDays size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Conecte a conta em Configurações para usar o calendário.</p>
      </div>
    )
  }

  // Intervalo visível: semana (agenda) ou mês (grid).
  const anchor = view === "mes"
    ? (m && /^\d{4}-\d{2}$/.test(m) ? new Date(`${m}-01T12:00:00`) : new Date())
    : (w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? new Date(`${w}T12:00:00`) : new Date())

  const rangeStart = view === "mes" ? startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 }) : startOfWeek(anchor, { weekStartsOn: 1 })
  const rangeEnd = view === "mes" ? endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }) : endOfWeek(anchor, { weekStartsOn: 1 })
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

  for (const s of scheduled) {
    add({
      key: formatInTimeZone(s.scheduledAt, TZ, "yyyy-MM-dd"), kind: "scheduled", id: s.id, status: s.status,
      time: formatInTimeZone(s.scheduledAt, TZ, "HH:mm"), ts: s.scheduledAt, caption: s.caption,
      thumb: s.imageUrls[0] ?? null, type: s.videoUrl ? "reel" : s.imageUrls.length > 1 ? "carousel" : "image", permalink: null,
    })
  }
  for (const p of media) {
    if (!p.timestamp) continue
    add({
      key: formatInTimeZone(p.timestamp, TZ, "yyyy-MM-dd"), kind: "published", id: p.id, status: "PUBLISHED",
      time: formatInTimeZone(p.timestamp, TZ, "HH:mm"), ts: p.timestamp, caption: p.caption ?? "",
      thumb: p.thumb, type: p.mediaType === "VIDEO" ? "reel" : p.mediaType === "CAROUSEL_ALBUM" ? "carousel" : "image", permalink: p.permalink,
    })
  }
  for (const arr of byDay.values()) arr.sort((a, b) => a.time.localeCompare(b.time))

  // Navegação
  const prevHref = view === "mes" ? `?v=mes&m=${format(addMonths(anchor, -1), "yyyy-MM")}` : `?w=${format(addDays(startOfWeek(anchor, { weekStartsOn: 1 }), -7), "yyyy-MM-dd")}`
  const nextHref = view === "mes" ? `?v=mes&m=${format(addMonths(anchor, 1), "yyyy-MM")}` : `?w=${format(addDays(startOfWeek(anchor, { weekStartsOn: 1 }), 7), "yyyy-MM-dd")}`
  const title = view === "mes"
    ? formatInTimeZone(startOfMonth(anchor), TZ, "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "dd/MM")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "dd/MM")}`

  const weekDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd })

  return (
    <div>
      {/* Header: navegação + toggle de visão */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={prevHref} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5"><ChevronLeft size={18} /></Link>
          <h2 className="text-sm font-medium text-zinc-100 capitalize min-w-36 text-center">{title}</h2>
          <Link href={nextHref} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5"><ChevronRight size={18} /></Link>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 border border-white/8 rounded-xl p-1">
          <Link href="?v=agenda" className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${view === "agenda" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}><List size={14} /> Agenda</Link>
          <Link href="?v=mes" className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${view === "mes" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}><LayoutGrid size={14} /> Mês</Link>
        </div>
      </div>

      {view === "agenda" ? (
        /* ===== AGENDA (semana em lista por dia) ===== */
        <div className="space-y-4">
          {weekDays.map((day) => {
            const key = format(day, "yyyy-MM-dd")
            const items = byDay.get(key) ?? []
            const isToday = key === todayKey
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-medium capitalize ${isToday ? "text-orange-400" : "text-zinc-300"}`}>
                    {format(day, "EEEE", { locale: ptBR })} · {format(day, "dd/MM")}
                  </span>
                  {items.length > 0 && <span className="text-xs text-zinc-600">{items.length} post{items.length !== 1 ? "s" : ""}</span>}
                  <Link href={`/clientes/${clientId}/instagram/novo?date=${key}`} className="text-zinc-600 hover:text-orange-400 ml-auto" title="Agendar neste dia"><Plus size={16} /></Link>
                </div>
                {items.length === 0 ? (
                  <Link href={`/clientes/${clientId}/instagram/novo?date=${key}`} className="block text-xs text-zinc-600 hover:text-zinc-400 border border-dashed border-white/8 rounded-xl px-4 py-2.5">
                    + Agendar
                  </Link>
                ) : (
                  <div className="space-y-2">
                    {items.map((it) => {
                      const Icon = typeIcon(it.type)
                      return (
                        <div key={it.kind + it.id} className="flex items-center gap-3 bg-zinc-900 border border-white/8 rounded-xl p-2.5">
                          <div className="w-11 h-14 rounded-lg overflow-hidden bg-zinc-800 border border-white/8 flex-shrink-0 relative">
                            {it.thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.thumb} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600"><Icon size={16} /></div>
                            )}
                          </div>
                          <div className="w-14 flex-shrink-0">
                            <p className="text-sm font-medium text-zinc-100 tabular-nums">{it.time}</p>
                            <p className="text-[11px] text-zinc-500 flex items-center gap-1"><Icon size={11} /> {it.type === "reel" ? "Reel" : it.type === "carousel" ? "Carrossel" : "Imagem"}</p>
                          </div>
                          <p className="flex-1 min-w-0 text-xs text-zinc-400 line-clamp-2">{it.caption || "(sem legenda)"}</p>
                          <span className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: STATUS_COLOR[it.status] }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[it.status] }} />
                            {STATUS_LABEL[it.status] ?? it.status}
                          </span>
                          <div className="flex-shrink-0">
                            {it.kind === "scheduled" ? (
                              <PostActions clientId={clientId} postId={it.id} status={it.status} />
                            ) : it.permalink ? (
                              <a href={it.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-orange-400 px-2 py-1"><ExternalLink size={12} /> Ver</a>
                            ) : null}
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
      ) : (
        /* ===== MÊS (grid compacto de overview) ===== */
        <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="bg-zinc-950 py-2 text-center text-[11px] font-medium text-zinc-500">{wd}</div>
          ))}
          {weekDays.map((day) => {
            const key = format(day, "yyyy-MM-dd")
            const items = byDay.get(key) ?? []
            const inMonth = isSameMonth(day, anchor)
            const isToday = key === todayKey
            return (
              <Link key={key} href={`?v=agenda&w=${key}`} className={`bg-zinc-900 min-h-24 p-2 flex flex-col hover:bg-zinc-800/60 transition-colors ${inMonth ? "" : "opacity-40"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={isToday ? "bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-semibold" : "text-[11px] text-zinc-500"}>{format(day, "d")}</span>
                  {items.length > 0 && <span className="text-[10px] text-zinc-500 font-medium">{items.length}</span>}
                </div>
                <div className="flex flex-wrap gap-1 content-start">
                  {items.slice(0, 8).map((it, i) => (
                    <span key={i} className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[it.status] }} title={`${it.time} · ${STATUS_LABEL[it.status] ?? ""}`} />
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-4 flex items-center gap-1">
        <Instagram size={12} /> {view === "agenda" ? "Cada dia lista seus posts. Clique no + para agendar num dia." : "Clique num dia para abrir a agenda daquele dia."}
      </p>
    </div>
  )
}
