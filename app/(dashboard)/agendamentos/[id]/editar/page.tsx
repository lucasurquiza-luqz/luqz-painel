"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Paperclip, X } from "lucide-react"
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

const TZ = "America/Sao_Paulo"

interface Group {
  id: string
  name: string
  participants: number
}

interface Message {
  id: string
  text: string
  scheduledAt: string
  mediaName: string | null
  groups: { group: { id: string; name: string } }[]
}

export default function EditarAgendamentoPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [currentMedia, setCurrentMedia] = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.json()),
      fetch(`/api/schedules/${id}`).then((r) => r.json()),
    ]).then(([groupsData, msgData]) => {
      setGroups(groupsData.groups ?? [])
      const msg: Message = msgData.message
      if (msg) {
        setText(msg.text)
        setCurrentMedia(msg.mediaName)
        setSelectedGroups(msg.groups.map((gm) => gm.group.id))
        // Converte UTC para horario local no formato do input datetime-local
        const local = formatInTimeZone(new Date(msg.scheduledAt), TZ, "yyyy-MM-dd'T'HH:mm")
        setScheduledAt(local)
      }
      setLoading(false)
    })
  }, [id])

  function toggleGroup(gid: string) {
    setSelectedGroups((prev) =>
      prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (selectedGroups.length === 0) {
      setError("Selecione ao menos um grupo.")
      return
    }

    setSaving(true)

    try {
      let mediaPath: string | undefined
      let mediaType: string | undefined
      let mediaName: string | undefined

      if (file) {
        const form = new FormData()
        form.append("file", file)
        const up = await fetch("/api/uploads", { method: "POST", body: form })
        if (!up.ok) throw new Error("Erro ao enviar arquivo.")
        const upData = await up.json()
        mediaPath = upData.path
        mediaType = upData.type
        mediaName = file.name
      }

      // Converte horario local BRT para UTC antes de enviar
      const localDate = new Date(scheduledAt)
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          scheduledAt: localDate.toISOString(),
          groupIds: selectedGroups,
          ...(mediaPath && { mediaPath, mediaType, mediaName }),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Erro ao salvar.")
      }

      router.push("/agendamentos")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-zinc-600 text-sm">Carregando...</div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/agendamentos"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Editar agendamento</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Apenas mensagens pendentes podem ser editadas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Grupos */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Grupos ({selectedGroups.length} selecionado{selectedGroups.length !== 1 ? "s" : ""})
          </label>
          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  selectedGroups.includes(g.id)
                    ? "border-blue-500/50 bg-blue-600/10 text-zinc-100"
                    : "border-white/8 bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 hover:border-white/15"
                }`}
              >
                <span className="text-sm font-medium">{g.name}</span>
                <span className="text-xs text-zinc-500">{g.participants} membros</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mensagem */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Mensagem
          </label>
          <textarea
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Arquivo */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Arquivo
          </label>
          {file ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-xl border border-white/8">
              <Paperclip size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-300 flex-1 truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-zinc-500 hover:text-red-400 cursor-pointer">
                <X size={16} />
              </button>
            </div>
          ) : currentMedia ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-xl border border-white/8">
              <Paperclip size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-400 flex-1 truncate">Atual: {currentMedia}</span>
              <label className="text-xs text-blue-400 hover:underline cursor-pointer">
                Trocar
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          ) : (
            <label className="flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-white/25 transition-colors">
              <Paperclip size={16} className="text-zinc-500" />
              <span className="text-sm text-zinc-500">Clique para anexar imagem ou PDF</span>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>

        {/* Data/hora */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Data e hora de envio
          </label>
          <input
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 px-4 py-3 rounded-xl border border-red-800/30">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href="/agendamentos"
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors text-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </button>
        </div>
      </form>
    </div>
  )
}
