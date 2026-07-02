"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Film, Images, Image as ImageIcon } from "lucide-react"
import { PostModal, type CalPost } from "./_post-modal"

const HOUR_H = 54
const SNAP = 15 // minutos
const STATUS_COLOR: Record<string, string> = { PENDING: "#eab308", PUBLISHING: "#f97316", FAILED: "#ef4444", PUBLISHED: "#22c55e", CANCELLED: "#71717a" }
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

type Day = { key: string; weekdayShort: string; dayNum: string; isToday: boolean }
type Pillar = { id: string; label: string; color: string }

export function WeekGrid({ clientId, pillars, days, posts }: { clientId: string; pillars: Pillar[]; days: Day[]; posts: CalPost[] }) {
  const router = useRouter()
  const [modal, setModal] = useState<CalPost | null>(null)
  const [drag, setDrag] = useState<CalPost | null>(null)
  const [preview, setPreview] = useState<{ colIndex: number; minutes: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<CalPost | null>(null)
  const grabOffset = useRef(0)
  const startPos = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)

  const byDay = new Map<string, CalPost[]>()
  for (const p of posts) byDay.set(p.dateKey, [...(byDay.get(p.dateKey) ?? []), p])

  let minH = 24, maxH = 0
  for (const p of posts) { const h = Math.floor(toMin(p.time) / 60); if (h < minH) minH = h; if (h > maxH) maxH = h }
  if (minH > maxH) { minH = 7; maxH = 18 }
  minH = Math.max(0, minH - 1); maxH = Math.min(23, maxH + 1)
  const hours: number[] = []; for (let h = minH; h <= maxH; h++) hours.push(h)
  const gridH = hours.length * HOUR_H

  function computeTarget(clientX: number, clientY: number) {
    const grid = gridRef.current
    if (!grid) return null
    const r = grid.getBoundingClientRect()
    const colW = r.width / 7
    const colIndex = Math.max(0, Math.min(6, Math.floor((clientX - r.left) / colW)))
    const top = clientY - r.top - grabOffset.current
    let mins = Math.round(((top / HOUR_H) * 60 + minH * 60) / SNAP) * SNAP
    mins = Math.max(minH * 60, Math.min(maxH * 60 + (60 - SNAP), mins))
    return { colIndex, minutes: mins }
  }

  function onDown(e: React.PointerEvent, it: CalPost) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    grabOffset.current = e.clientY - rect.top
    startPos.current = { x: e.clientX, y: e.clientY }
    movedRef.current = false
    dragRef.current = it
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag(it)
    setPreview(computeTarget(e.clientX, e.clientY))
  }
  function onMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    if (Math.hypot(e.clientX - startPos.current.x, e.clientY - startPos.current.y) > 4) movedRef.current = true
    setPreview(computeTarget(e.clientX, e.clientY))
  }
  async function onUp(e: React.PointerEvent) {
    const post = dragRef.current
    dragRef.current = null
    if (!post) return
    const target = computeTarget(e.clientX, e.clientY)
    setDrag(null); setPreview(null)
    if (!movedRef.current) { setModal(post); return } // foi clique
    if (!target) return
    const newDay = days[target.colIndex].key
    const newTime = fmtMin(target.minutes)
    if (newDay === post.dateKey && newTime === post.time) return
    setSaving(true)
    try {
      const res = await fetch(`/api/instagram/schedules/${post.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(`${newDay}T${newTime}`).toISOString() }),
      })
      if (res.ok) router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[860px]">
          <div className="flex mb-1">
            <div className="w-12 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-7">
              {days.map((d) => (
                <Link key={d.key} href={`?v=dia&a=${d.key}`} className="text-center py-1.5 hover:bg-white/[0.03] rounded-lg">
                  <p className="text-[11px] text-zinc-500 uppercase">{d.weekdayShort}</p>
                  <p className={d.isToday ? "text-sm font-semibold bg-orange-500 text-white rounded-full w-6 h-6 mx-auto flex items-center justify-center" : "text-sm font-semibold text-zinc-300"}>{d.dayNum}</p>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex border border-white/8 rounded-xl overflow-hidden">
            <div className="w-12 flex-shrink-0">
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_H }} className="relative">
                  <span className="absolute -top-1.5 right-1.5 text-[10px] text-zinc-600 tabular-nums">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {/* colunas (container relativo p/ o preview) */}
            <div ref={gridRef} className="flex-1 grid grid-cols-7 relative">
              {days.map((d) => {
                const items = byDay.get(d.key) ?? []
                const sorted = [...items].sort((a, b) => toMin(a.time) - toMin(b.time))
                const laneEnd: number[] = []
                const placed = sorted.map((it) => {
                  const s = toMin(it.time)
                  let lane = laneEnd.findIndex((end) => end <= s)
                  if (lane === -1) { lane = laneEnd.length; laneEnd.push(0) }
                  laneEnd[lane] = s + 50
                  return { it, s, lane }
                })
                const lanes = Math.max(1, laneEnd.length)
                return (
                  <div key={d.key} className="relative border-l border-white/5" style={{ height: gridH }}>
                    {hours.map((h) => <div key={h} className="border-t border-white/5" style={{ height: HOUR_H }} />)}
                    {placed.map(({ it, s, lane }) => {
                      const w = 100 / lanes
                      const canDrag = it.status === "PENDING"
                      const Icon = it.type === "reel" ? Film : it.type === "carousel" ? Images : ImageIcon
                      const isDragging = drag?.id === it.id
                      return (
                        <button key={it.id} type="button"
                          onPointerDown={canDrag ? (e) => onDown(e, it) : undefined}
                          onPointerMove={canDrag ? onMove : undefined}
                          onPointerUp={canDrag ? onUp : undefined}
                          onClick={canDrag ? undefined : () => setModal(it)}
                          style={{ top: ((s - minH * 60) / 60) * HOUR_H, height: HOUR_H - 5, left: `${lane * w}%`, width: `calc(${w}% - 3px)`, background: `${STATUS_COLOR[it.status]}22`, borderColor: STATUS_COLOR[it.status], touchAction: canDrag ? "none" : "auto", opacity: isDragging ? 0.3 : 1 }}
                          className={`absolute rounded-md border-l-[3px] px-1.5 py-0.5 overflow-hidden text-left hover:brightness-150 transition-[filter] ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}>
                          <p className="text-[11px] font-semibold tabular-nums leading-tight flex items-center gap-1" style={{ color: STATUS_COLOR[it.status] }}><Icon size={9} /> {it.time}</p>
                          <p className="text-[10px] text-zinc-300 leading-tight line-clamp-1">{it.caption || it.type}</p>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              {/* preview imantado enquanto arrasta */}
              {drag && preview && (
                <div className="absolute pointer-events-none rounded-md border-2 z-20 px-1.5 py-0.5 shadow-lg"
                  style={{ left: `${preview.colIndex * (100 / 7)}%`, width: `calc(${100 / 7}% - 3px)`, top: ((preview.minutes - minH * 60) / 60) * HOUR_H, height: HOUR_H - 5, borderColor: STATUS_COLOR[drag.status], background: `${STATUS_COLOR[drag.status]}33` }}>
                  <p className="text-[11px] font-semibold tabular-nums" style={{ color: STATUS_COLOR[drag.status] }}>{fmtMin(preview.minutes)}</p>
                  <p className="text-[10px] text-zinc-200 leading-tight line-clamp-1">{drag.caption || drag.type}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-600 mt-3">{saving ? "Salvando…" : "Clique num post pra editar. Arraste os agendados (amarelos) — ele imanta nos horários de 15 em 15 min."}</p>
      {modal && <PostModal post={modal} pillars={pillars} onClose={() => setModal(null)} />}
    </>
  )
}
