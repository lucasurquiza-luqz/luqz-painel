"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { formatInTimeZone } from "date-fns-tz"
import { Loader2, Save } from "lucide-react"
import { Button, Input, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"

const TZ = "America/Sao_Paulo"

type Perception = "GREAT" | "GOOD" | "NEUTRAL" | "CONCERN" | "CRITICAL"

const PERCEPTION_LABEL: Record<Perception, string> = {
  GREAT: "Excelente",
  GOOD: "Bom",
  NEUTRAL: "Neutro",
  CONCERN: "Preocupante",
  CRITICAL: "Critico",
}

const PERCEPTION_TONE: Record<Perception, "healthy" | "unknown" | "attention" | "critical"> = {
  GREAT: "healthy",
  GOOD: "healthy",
  NEUTRAL: "unknown",
  CONCERN: "attention",
  CRITICAL: "critical",
}

type Checkin = {
  id: string
  perception: Perception
  justification: string
  validUntil: string | null
  createdAt: string
  author: { name: string }
}

export default function CheckinPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [perception, setPerception] = useState<Perception>("GOOD")
  const [justification, setJustification] = useState("")
  const [validUntil, setValidUntil] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/checkin`)
    const data = await res.json()
    if (res.ok) setCheckins(data.checkins)
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")
    const res = await fetch(`/api/clients/${clientId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perception, justification, validUntil: validUntil || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? "Nao foi possivel salvar o check-in.")
      return
    }
    setJustification("")
    setValidUntil("")
    setNotice("Check-in registrado.")
    await load()
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Inteligencia de relacionamento"
        title="Check-in do time"
        description="Registre a percepcao do time sobre o relacionamento com este cliente apos interacoes relevantes."
      />

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      <Panel className="p-5 lg:p-6">
        <h2 className="mb-5 text-base font-semibold text-white">Novo check-in</h2>
        <form onSubmit={submit} className="space-y-5">
          <fieldset>
            <legend className="mb-3 block text-xs font-medium text-zinc-400">Percepcao geral *</legend>
            <div className="flex flex-wrap gap-2">
              {(["GREAT", "GOOD", "NEUTRAL", "CONCERN", "CRITICAL"] as Perception[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPerception(p)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    perception === p
                      ? "border-[#FF8F50]/40 bg-[#FF8F50]/15 text-[#FFB185]"
                      : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  {PERCEPTION_LABEL[p]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-400">Justificativa *</span>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="O que motivou esta avaliacao? Cite interacoes, feedbacks ou sinais concretos."
              rows={4}
              required
              minLength={10}
              className="dash-input w-full resize-none rounded-lg px-3.5 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-400">Valido ate (opcional)</span>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="min-h-11 max-w-48"
            />
          </label>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Registrar check-in
            </Button>
          </div>
        </form>
      </Panel>

      <div className="space-y-3">
        {loading ? (
          <Panel className="flex min-h-32 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
        ) : checkins.length === 0 ? (
          <Panel className="flex min-h-32 items-center justify-center p-6 text-center">
            <p className="text-sm text-zinc-600">Nenhum check-in registrado ainda.</p>
          </Panel>
        ) : (
          checkins.map((checkin) => (
            <Panel key={checkin.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={PERCEPTION_TONE[checkin.perception]}>{PERCEPTION_LABEL[checkin.perception]}</StatusBadge>
                    {checkin.validUntil && (
                      <span className="text-xs text-zinc-600">Valido ate {formatInTimeZone(new Date(checkin.validUntil), TZ, "dd/MM/yyyy")}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{checkin.justification}</p>
                  <p className="mt-2 text-xs text-zinc-700">
                    {checkin.author.name} · {formatInTimeZone(new Date(checkin.createdAt), TZ, "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              </div>
            </Panel>
          ))
        )}
      </div>
    </main>
  )
}