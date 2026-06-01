"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Paperclip, X } from "lucide-react"
import Link from "next/link"

interface Group {
  id: string
  name: string
  participants: number
}

export default function NovoAgendamentoPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [scheduledAt, setScheduledAt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => setGroups(data.groups ?? []))
  }, [])

  function toggleGroup(id: string) {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (selectedGroups.length === 0) {
      setError("Selecione ao menos um grupo.")
      return
    }

    setLoading(true)

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

      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          scheduledAt: new Date(scheduledAt).toISOString(),
          groupIds: selectedGroups,
          mediaPath,
          mediaType,
          mediaName,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Erro ao criar agendamento.")
      }

      router.push("/agendamentos")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-xl font-semibold text-zinc-100">Novo agendamento</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Agende uma mensagem para grupos WhatsApp</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Grupos */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Grupos ({selectedGroups.length} selecionado{selectedGroups.length !== 1 ? "s" : ""})
          </label>
          {groups.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Nenhum grupo sincronizado.{" "}
              <Link href="/grupos" className="text-blue-400 hover:underline">
                Sincronizar grupos
              </Link>
            </p>
          ) : (
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
          )}
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
            placeholder="Digite a mensagem..."
            className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Arquivo */}
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Arquivo (opcional)
          </label>
          {file ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-xl border border-white/8">
              <Paperclip size={16} className="text-zinc-400" />
              <span className="text-sm text-zinc-300 flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-white/25 transition-colors">
              <Paperclip size={16} className="text-zinc-500" />
              <span className="text-sm text-zinc-500">Clique para anexar imagem ou PDF</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
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
            disabled={loading}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {loading ? "Agendando..." : "Agendar mensagem"}
          </button>
        </div>
      </form>
    </div>
  )
}
