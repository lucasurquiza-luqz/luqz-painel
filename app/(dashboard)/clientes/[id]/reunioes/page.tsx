"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { formatInTimeZone } from "date-fns-tz"
import { ChevronRight, Loader2, Plus, Video } from "lucide-react"
import { Button, Input, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import Link from "next/link"

const TZ = "America/Sao_Paulo"

type MeetingSummaryPreview = {
  id: string
  status: "DRAFT" | "REVIEWED"
  _count: { items: number }
} | null

type Meeting = {
  id: string
  title: string
  kind: "CALL" | "IN_PERSON" | "ASYNC"
  date: string
  participants: string[]
  createdBy: { name: string }
  summary: MeetingSummaryPreview
}

const KIND_LABEL: Record<Meeting["kind"], string> = {
  CALL: "Chamada",
  IN_PERSON: "Presencial",
  ASYNC: "Assincrona",
}

export default function ReunioesPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")

  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<Meeting["kind"]>("CALL")
  const [date, setDate] = useState(() => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd"))
  const [participants, setParticipants] = useState("")
  const [rawContent, setRawContent] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/meetings`)
    const data = await res.json()
    if (res.ok) setMeetings(data.meetings)
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const participantList = participants.split("\n").map((p) => p.trim()).filter(Boolean)
    const res = await fetch(`/api/clients/${clientId}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, kind, date, participants: participantList, rawContent }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? "Nao foi possivel registrar a reuniao.")
      return
    }
    setTitle("")
    setKind("CALL")
    setDate(formatInTimeZone(new Date(), TZ, "yyyy-MM-dd"))
    setParticipants("")
    setRawContent("")
    setShowForm(false)
    router.push(`/clientes/${clientId}/reunioes/${data.meeting.id}`)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Inteligencia de relacionamento"
        title="Reunioes"
        description="Registre transcricoes, atas ou anotacoes. A IA extrai decisoes, compromissos, riscos e proximos passos para revisao humana."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Nova reuniao
          </Button>
        }
      />

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {showForm && (
        <Panel className="p-5 lg:p-6">
          <h2 className="mb-5 text-base font-semibold text-white">Registrar reuniao</h2>
          <div className="mb-4 rounded-xl border border-sky-400/15 bg-sky-500/[0.06] px-4 py-3 text-sm leading-6 text-sky-100/80">
            O conteudo desta reuniao sera enviado ao provedor de IA ao gerar o resumo. Nao inclua senhas ou dados sensiveis.
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-zinc-400">Titulo *</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Alinhamento mensal" required />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-zinc-400">Tipo *</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Meeting["kind"])}
                  className="dash-input w-full min-h-11 rounded-lg px-3.5 py-2.5 text-sm"
                >
                  <option value="CALL">Chamada / Videochamada</option>
                  <option value="IN_PERSON">Presencial</option>
                  <option value="ASYNC">Assincrona</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-zinc-400">Data *</span>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="min-h-11" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-zinc-400">Participantes (um por linha)</span>
                <textarea
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  placeholder={"Lucas\nCliente Joao"}
                  rows={3}
                  className="dash-input w-full resize-none rounded-lg px-3.5 py-2.5 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">Transcricao / Ata / Anotacoes *</span>
              <textarea
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder="Cole aqui a transcricao, ata ou anotacoes da reuniao..."
                rows={10}
                required
                minLength={10}
                className="dash-input w-full resize-y rounded-lg px-3.5 py-2.5 text-xs font-mono leading-6"
              />
            </label>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Registrar e ir para detalhes
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {loading ? (
        <Panel className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : meetings.length === 0 && !showForm ? (
        <Panel className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
          <Video size={30} className="text-zinc-700" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-300">Nenhuma reuniao registrada</h3>
          <p className="mt-2 max-w-sm text-sm text-zinc-600">Registre transcricoes ou atas para extrair decisoes e compromissos com IA.</p>
          <Button className="mt-5" onClick={() => setShowForm(true)}><Plus size={16} /> Nova reuniao</Button>
        </Panel>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <Link key={meeting.id} href={`/clientes/${clientId}/reunioes/${meeting.id}`}>
              <Panel className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:border-white/20">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-200 truncate">{meeting.title}</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                      {KIND_LABEL[meeting.kind]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {formatInTimeZone(new Date(meeting.date), TZ, "dd/MM/yyyy")} · por {meeting.createdBy.name}
                    {meeting.summary && ` · ${meeting.summary._count.items} item(s)`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {meeting.summary ? (
                    <StatusBadge status={meeting.summary.status === "REVIEWED" ? "healthy" : "attention"}>
                      {meeting.summary.status === "REVIEWED" ? "Revisado" : "Em revisao"}
                    </StatusBadge>
                  ) : (
                    <StatusBadge status="unknown">Sem resumo</StatusBadge>
                  )}
                  <ChevronRight size={16} className="text-zinc-600" />
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}