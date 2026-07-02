"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Film, Images, Image as ImageIcon } from "lucide-react"
import { PostModal, type CalPost } from "./_post-modal"

const HOUR_H = 54
const STATUS_COLOR: Record<string, string> = { PENDING: "#eab308", PUBLISHING: "#f97316", FAILED: "#ef4444", PUBLISHED: "#22c55e", CANCELLED: "#71717a" }
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }

type Day = { key: string; weekdayShort: string; dayNum: string; isToday: boolean }
type Pillar = { id: string; label: string; color: string }

export function WeekGrid({ clientId, pillars, days, posts }: { clientId: string; pillars: Pillar[]; days: Day[]; posts: CalPost[] }) {
  const router = useRouter()
  const [modal, setModal] = useState<CalPost | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const byDay = new Map<string, CalPost[]>()
  for (const p of posts) byDay.set(p.dateKey, [...(byDay.get(p.dateKey) ?? []), p])

  let minH = 24, maxH = 0
  for (const p of posts) { const h = Math.floor(toMin(p.time) / 60); if (h < minH) minH = h; if (h > maxH) maxH = h }
  if (minH > maxH) { minH = 7; maxH = 18 }
  minH = Math.max(0, minH - 1); maxH = Math.min(23, maxH + 1)
  const hours: number[] = []; for (let h = minH; h <= maxH; h++) hours.push(h)
  const gridH = hours.length * HOUR_H

  async function onDrop(e: React.DragEvent, dateKey: string) {
    e.preventDefault()
    const id = dragId; setDragId(null)
    if (!id) return
    const post = posts.find((p) => p.id === id)
    if (!post) return
    const rect = e.currentTarget.getBoundingClientRect()
    let mins = Math.round((((e.clientY - rect.top) / HOUR_H) * 60 + minH * 60) / 15) * 15
    mins = Math.max(minH * 60, Math.min(maxH * 60 + 45, mins))
    const hh = String(Math.floor(mins / 60)).padStart(2, "0"), mm = String(mins % 60).padStart(2, "0")
    if (dateKey === post.dateKey && `${hh}:${mm}` === post.time) return
    setSaving(true)
    try {
      const res = await fetch(`/api/instagram/schedules/${post.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(`${dateKey}T${hh}:${mm}`).toISOString() }),
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
            <div className="flex-1 grid grid-cols-7">
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
                  <div key={d.key} className="relative border-l border-white/5" style={{ height: gridH }}
                    onDragOver={(e) => { if (dragId) e.preventDefault() }} onDrop={(e) => onDrop(e, d.key)}>
                    {hours.map((h) => <div key={h} className="border-t border-white/5" style={{ height: HOUR_H }} />)}
                    {placed.map(({ it, s, lane }) => {
                      const w = 100 / lanes
                      const canDrag = it.status === "PENDING"
                      const Icon = it.type === "reel" ? Film : it.type === "carousel" ? Images : ImageIcon
                      return (
                        <button key={it.id} type="button" draggable={canDrag}
                          onDragStart={() => setDragId(it.id)} onDragEnd={() => setDragId(null)}
                          onClick={() => setModal(it)}
                          style={{ top: ((s - minH * 60) / 60) * HOUR_H, height: HOUR_H - 5, left: `${lane * w}%`, width: `calc(${w}% - 3px)`, background: `${STATUS_COLOR[it.status]}22`, borderColor: STATUS_COLOR[it.status] }}
                          className={`absolute rounded-md border-l-[3px] px-1.5 py-0.5 overflow-hidden text-left hover:brightness-150 transition ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}>
                          <p className="text-[11px] font-semibold tabular-nums leading-tight flex items-center gap-1" style={{ color: STATUS_COLOR[it.status] }}><Icon size={9} /> {it.time}</p>
                          <p className="text-[10px] text-zinc-300 leading-tight line-clamp-1">{it.caption || it.type}</p>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-600 mt-3">{saving ? "Salvando…" : "Clique num post pra editar. Arraste os agendados (amarelos) pra remarcar horário/dia."}</p>
      {modal && <PostModal post={modal} pillars={pillars} onClose={() => setModal(null)} />}
    </>
  )
}
