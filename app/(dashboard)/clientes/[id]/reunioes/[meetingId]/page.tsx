"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { formatInTimeZone } from "date-fns-tz"
import { ArrowLeft, Check, Loader2, Sparkles, Trash2, Video, X } from "lucide-react"
import { Button, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import Link from "next/link"

const TZ = "America/Sao_Paulo"

type ItemStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "DISCARDED"
type ItemKind = "DECISION" | "COMMITMENT" | "OBJECTION" | "RISK" | "NEXT_STEP"

type SummaryItem = {
  id: string
  kind: ItemKind
  text: string
  responsible: string | null
  deadline: string | null
  status: ItemStatus
  reviewedBy: { name: string } | null
}

type Meeting = {
  id: string
  title: string
  kind: "CALL" | "IN_PERSON" | "ASYNC"
  date: string
  participants: string[]
  createdBy: { name: string }
  summary: {
    id: string
    status: "DRAFT" | "REVIEWED"
    rawSummary: string
    generatedBy: { name: string }
    generatedAt: string
    items: SummaryItem[]
  } | null
}

const KIND_LABEL: Record<ItemKind, string> = {
  DECISION: "Decisao",
  COMMITMENT: "Compromisso",
  OBJECTION: "Objecao",
  RISK: "Risco",
  NEXT_STEP: "Proximo passo",
}

const MEETING_KIND_LABEL: Record<Meeting["kind"], string> = {
  CALL: "Chamada / Videochamada",
  IN_PERSON: "Presencial",
  ASYNC: "Assincrona",
}

const STATUS_TONE: Record<ItemStatus, "attention" | "healthy" | "critical" | "unknown"> = {
  PROPOSED: "attention",
  APPROVED: "healthy",
  REJECTED: "critical",
  DISCARDED: "unknown",
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  PROPOSED: "Aguardando revisao",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  DISCARDED: "Descartado",
}

export default function MeetingDetailPage() {
  const { id: clientId, meetingId } = useParams<{ id: string; meetingId: string }>()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/meetings/${meetingId}`)
    const data = await res.json()
    if (res.ok) setMeeting(data.meeting)
    else setError(data.error ?? "Nao foi possivel carregar a reuniao.")
    setLoading(false)
  }, [clientId, meetingId])

  useEffect(() => { void load() }, [load])

  async function generateSummary() {
    setGenerating(true)
    setError("")
    const res = await fetch(`/api/clients/${clientId}/meetings/${meetingId}/summary`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Nao foi possivel gerar o resumo.")
      setGenerating(false)
      return
    }
    setGenerating(false)
    await load()
  }

  async function review(itemId: string, action: "APPROVE" | "REJECT" | "DISCARD") {
    setReviewingId(itemId)
    setError("")
    const res = await fetch(`/api/meetings/summary/items/${itemId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    setReviewingId(null)
    if (!res.ok) {
      setError(data.error ?? "Nao foi possivel revisar o item.")
      return
    }
    await load()
  }

  const pendingTotal = useMemo(
    () => meeting?.summary?.items.filter((i) => i.status === "PROPOSED").length ?? 0,
    [meeting]
  )

  if (loading) return (
    <main className="flex min-h-screen items-center justify-center">
      <Loader2 className="animate-spin text-[#FF8F50]" size={24} />
    </main>
  )

  if (!meeting) return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error || "Reuniao nao encontrada."}</div>
    </main>
  )

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link href={`/clientes/${clientId}/reunioes`} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={15} /> Reunioes
        </Link>
      </div>

      <PageHeader
        eyebrow={MEETING_KIND_LABEL[meeting.kind]}
        title={meeting.title}
        description={`${formatInTimeZone(new Date(meeting.date), TZ, "dd/MM/yyyy")} · registrado por ${meeting.createdBy.name}`}
        actions={
          !meeting.summary ? (
            <Button onClick={generateSummary} disabled={generating}>
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Gerar resumo com IA
            </Button>
          ) : undefined
        }
      />

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {meeting.participants.length > 0 && (
        <Panel className="flex flex-wrap items-center gap-2 p-4">
          <Video size={15} className="text-zinc-600 shrink-0" />
          <span className="text-xs text-zinc-500">Participantes:</span>
          {meeting.participants.map((p) => (
            <span key={p} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-xs text-zinc-300">{p}</span>
          ))}
        </Panel>
      )}

      {!meeting.summary && !generating && (
        <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.06] px-4 py-3 text-sm leading-6 text-sky-100/80">
          Esta reuniao ainda nao tem resumo. Ao gerar, o conteudo sera enviado ao provedor de IA configurado pela agencia.
        </div>
      )}

      {meeting.summary && (
        <>
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-600">Resumo gerado por {meeting.summary.generatedBy.name}</p>
              <StatusBadge status={meeting.summary.status === "REVIEWED" ? "healthy" : "attention"}>
                {meeting.summary.status === "REVIEWED" ? "Revisado" : "Em revisao"}
              </StatusBadge>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{meeting.summary.rawSummary}</p>
          </Panel>

          {pendingTotal > 0 && (
            <div className="rounded-xl border border-[#FFD482]/20 bg-[#FFD482]/[0.06] px-4 py-3 text-sm text-[#FFD482]">
              {pendingTotal} item(ns) aguardando revisao.
            </div>
          )}

          <div className="space-y-3">
            {meeting.summary.items.length === 0 ? (
              <p className="text-sm text-zinc-600">Nenhum item candidato identificado nesta reuniao.</p>
            ) : (
              meeting.summary.items.map((item) => (
                <Panel key={item.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusBadge>
                        <span className="text-xs font-medium text-[#FFD482]">{KIND_LABEL[item.kind]}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{item.text}</p>
                      <div className="mt-1 flex flex-wrap gap-4">
                        {item.responsible && <p className="text-xs text-zinc-600">Responsavel: {item.responsible}</p>}
                        {item.deadline && <p className="text-xs text-zinc-600">Prazo: {item.deadline}</p>}
                      </div>
                      {item.reviewedBy && (
                        <p className="mt-1 text-xs text-zinc-700">Revisado por {item.reviewedBy.name}</p>
                      )}
                    </div>
                    {item.status === "PROPOSED" && (
                      <div className="flex gap-2">
                        <Button variant="danger" className="min-h-8 px-3 py-1 text-xs" disabled={reviewingId === item.id} onClick={() => review(item.id, "REJECT")}>
                          <X size={13} /> Rejeitar
                        </Button>
                        <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" disabled={reviewingId === item.id} onClick={() => review(item.id, "DISCARD")}>
                          <Trash2 size={13} /> Descartar
                        </Button>
                        <Button className="min-h-8 px-3 py-1 text-xs" disabled={reviewingId === item.id} onClick={() => review(item.id, "APPROVE")}>
                          <Check size={13} /> Aprovar
                        </Button>
                      </div>
                    )}
                  </div>
                </Panel>
              ))
            )}
          </div>
        </>
      )}
    </main>
  )
}