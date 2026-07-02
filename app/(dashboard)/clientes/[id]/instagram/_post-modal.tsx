"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Send, RotateCcw, Ban, Loader2, ExternalLink, Save, Film, Images, Image as ImageIcon } from "lucide-react"

export type CalPost = {
  id: string
  kind: "scheduled" | "published"
  status: string
  dateKey: string // yyyy-MM-dd (SP)
  time: string // HH:mm (SP)
  caption: string
  imageUrls: string[]
  videoUrl: string | null
  thumb: string | null
  type: "image" | "carousel" | "reel"
  permalink: string | null
  pillarId: string | null
}

type Pillar = { id: string; label: string; color: string }
const STATUS_LABEL: Record<string, string> = { PENDING: "Agendado", PUBLISHING: "Publicando", FAILED: "Falhou", PUBLISHED: "Publicado", CANCELLED: "Cancelado" }
const STATUS_COLOR: Record<string, string> = { PENDING: "#eab308", PUBLISHING: "#f97316", FAILED: "#ef4444", PUBLISHED: "#22c55e", CANCELLED: "#71717a" }

export function PostModal({ post, pillars, onClose }: { post: CalPost; pillars: Pillar[]; onClose: () => void }) {
  const router = useRouter()
  const editable = post.kind === "scheduled" && post.status === "PENDING"
  const [caption, setCaption] = useState(post.caption)
  const [date, setDate] = useState(post.dateKey)
  const [time, setTime] = useState(post.time)
  const [pillar, setPillar] = useState(post.pillarId ?? "")
  const [busy, setBusy] = useState<"" | "save" | "publish" | "cancel">("")
  const [error, setError] = useState("")

  const TypeIcon = post.type === "reel" ? Film : post.type === "carousel" ? Images : ImageIcon
  const previews = post.imageUrls.length ? post.imageUrls : post.thumb ? [post.thumb] : []

  async function save() {
    setBusy("save"); setError("")
    try {
      const res = await fetch(`/api/instagram/schedules/${post.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, scheduledAt: new Date(`${date}T${time}`).toISOString(), pillar: pillar || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao salvar.")
      router.refresh(); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : "Erro."); setBusy("") }
  }
  async function publishNow() {
    if (!confirm("Publicar agora, mesmo antes do horário?")) return
    setBusy("publish"); setError("")
    try {
      const res = await fetch(`/api/instagram/schedules/${post.id}/publish-now`, { method: "POST" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao publicar.")
      router.refresh(); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : "Erro."); setBusy("") }
  }
  async function cancel() {
    if (!confirm("Cancelar este post agendado?")) return
    setBusy("cancel"); setError("")
    try {
      const res = await fetch(`/api/instagram/schedules/${post.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao cancelar.")
      router.refresh(); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : "Erro."); setBusy("") }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full" style={{ color: STATUS_COLOR[post.status], background: `${STATUS_COLOR[post.status]}1a` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[post.status] }} /> {STATUS_LABEL[post.status] ?? post.status}
            </span>
            <span className="text-xs text-zinc-500 flex items-center gap-1"><TypeIcon size={13} /> {post.type === "reel" ? "Reel" : post.type === "carousel" ? "Carrossel" : "Imagem"}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 cursor-pointer"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          {previews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {previews.slice(0, 10).map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" className="w-24 h-30 object-cover rounded-lg border border-white/8 flex-shrink-0" style={{ height: "7.5rem" }} />
              ))}
            </div>
          )}

          {editable ? (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Legenda ({caption.length}/2200)</label>
                <textarea value={caption} maxLength={2200} onChange={(e) => setCaption(e.target.value)} rows={5}
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Data</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2 text-sm text-zinc-100 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Hora</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2 text-sm text-zinc-100 [color-scheme:dark]" />
                </div>
              </div>
              {pillars.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Pilar</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setPillar("")} className={`text-xs px-2.5 py-1 rounded-lg border ${pillar === "" ? "border-white/25 bg-white/10 text-zinc-200" : "border-white/10 text-zinc-500"}`}>Nenhum</button>
                    {pillars.map((p) => (
                      <button key={p.id} type="button" onClick={() => setPillar(p.id)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${pillar === p.id ? "border-orange-500/40 bg-orange-500/15 text-orange-100" : "border-white/10 text-zinc-400"}`}>
                        <span className="w-2 h-2 rounded-full" style={{ background: p.color }} /> {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-300 whitespace-pre-line">{post.caption || "(sem legenda)"}</p>
          )}

          {error && <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg border border-red-800/30">{error}</p>}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 p-4 border-t border-white/8 flex-wrap">
          {editable && (
            <button onClick={save} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer">
              {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
            </button>
          )}
          {(post.status === "PENDING" || post.status === "FAILED") && (
            <button onClick={publishNow} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-sm rounded-xl cursor-pointer">
              {busy === "publish" ? <Loader2 size={15} className="animate-spin" /> : post.status === "FAILED" ? <RotateCcw size={15} /> : <Send size={15} />}
              {post.status === "FAILED" ? "Tentar de novo" : "Publicar agora"}
            </button>
          )}
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-xl"><ExternalLink size={15} /> Ver no Instagram</a>
          )}
          {(post.status === "PENDING" || post.status === "FAILED" || post.status === "PUBLISHING") && (
            <button onClick={cancel} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 text-red-300 hover:bg-red-900/20 disabled:opacity-50 text-sm rounded-xl cursor-pointer ml-auto">
              {busy === "cancel" ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Envolve um visual de post; ao clicar, abre o modal de edição.
export function PostTrigger({ post, pillars, children, className }: { post: CalPost; pillars: Pillar[]; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "block w-full text-left cursor-pointer"}>
        {children}
      </button>
      {open && <PostModal post={post} pillars={pillars} onClose={() => setOpen(false)} />}
    </>
  )
}
