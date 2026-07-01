"use client"

import { useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, X, ImagePlus } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { dateSuggestions } from "@/lib/date-suggestions"
import { INSTAGRAM_PILLARS } from "@/lib/instagram-pillars"

// Converte um arquivo de imagem para JPEG base64 (a Graph API do Instagram exige JPEG).
// Feito no navegador via canvas — mantém as dimensões originais (ex: 1080x1350).
async function fileToJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas indisponível.")
  ctx.drawImage(bitmap, 0, 0)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
  return dataUrl.split(",")[1]
}

type Slide = { file: File; preview: string }

export default function NovoInstagramPostPage() {
  const router = useRouter()
  const { id: clientId } = useParams<{ id: string }>()
  const dateParam = useSearchParams().get("date")

  const [slides, setSlides] = useState<Slide[]>([])
  const [caption, setCaption] = useState("")
  const [pillar, setPillar] = useState("")
  // Se veio do calendário (?date=YYYY-MM-DD), pré-preenche o dia às 09:00.
  const [scheduledAt, setScheduledAt] = useState(dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? `${dateParam}T09:00` : "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function addFiles(files: FileList | null) {
    if (!files) return
    const incoming = Array.from(files).map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setSlides((prev) => [...prev, ...incoming].slice(0, 10))
  }

  function removeSlide(i: number) {
    setSlides((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (slides.length < 1) {
      setError("Adicione ao menos 1 imagem.")
      return
    }
    if (slides.length > 10) {
      setError("Máximo de 10 imagens por post.")
      return
    }

    setLoading(true)
    try {
      const images = await Promise.all(slides.map((s) => fileToJpegBase64(s.file)))

      const res = await fetch("/api/instagram/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          caption,
          scheduledAt: new Date(scheduledAt).toISOString(),
          images,
          pillar: pillar || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Erro ao agendar post.")
      }

      router.push(`/clientes/${clientId}/instagram`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setLoading(false)
    }
  }

  const isCarousel = slides.length > 1

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/clientes/${clientId}/instagram`}
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Novo post</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Agende uma publicação no Instagram</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Imagens */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Imagens ({slides.length}/10) {isCarousel ? "· carrossel" : slides.length === 1 ? "· imagem única" : ""}
          </label>

          {slides.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {slides.map((s, i) => (
                <div key={s.preview} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.preview} alt="" className="w-20 h-[100px] object-cover rounded-lg border border-white/8" />
                  <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white rounded px-1">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeSlide(i)}
                    className="absolute -top-2 -right-2 bg-zinc-800 border border-white/15 rounded-full p-0.5 text-zinc-400 hover:text-red-400 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {slides.length < 10 && (
            <label className="flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-white/25 transition-colors">
              <ImagePlus size={16} className="text-zinc-500" />
              <span className="text-sm text-zinc-500">Adicionar imagens (1 = post único, 2-10 = carrossel)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
          )}
          <p className="text-xs text-zinc-600 mt-2">A ordem de cima pra baixo é a ordem do carrossel. Convertidas para JPEG automaticamente.</p>
        </div>

        {/* Legenda */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Legenda ({caption.length}/2200)
          </label>
          <textarea
            required
            value={caption}
            maxLength={2200}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            placeholder="Escreva a legenda, com hashtags no fim..."
            className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
          />
        </div>

        {/* Pilar */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Pilar de conteúdo (opcional)
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPillar("")}
              className={cn("rounded-lg border px-3 py-1.5 text-xs transition-colors", pillar === "" ? "border-white/25 bg-white/10 text-zinc-200" : "border-white/10 text-zinc-500 hover:text-zinc-300")}>
              Nenhum
            </button>
            {INSTAGRAM_PILLARS.map((p) => (
              <button key={p.key} type="button" onClick={() => setPillar(p.key)}
                className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors", pillar === p.key ? "border-orange-500/40 bg-orange-500/15 text-orange-100" : "border-white/10 text-zinc-400 hover:text-zinc-200")}>
                <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data/hora */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Data e hora da publicação
          </label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {dateSuggestions().map((s) => (
              <button key={s.label} type="button" onClick={() => setScheduledAt(s.value)}
                className={cn("rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer", scheduledAt === s.value ? "border-orange-500/40 bg-orange-500/20 text-orange-200" : "border-white/10 text-zinc-400 hover:text-zinc-200")}>
                {s.label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 [color-scheme:dark]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 px-4 py-3 rounded-xl border border-red-800/30">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href={`/clientes/${clientId}/instagram`}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors text-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {loading ? "Agendando..." : "Agendar post"}
          </button>
        </div>
      </form>
    </div>
  )
}
