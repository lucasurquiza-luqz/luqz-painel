"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { formatInTimeZone } from "date-fns-tz"
import { Check, DownloadCloud, Loader2, MessagesSquare, Sparkles, Trash2, X } from "lucide-react"
import { Button, Input, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"

const TZ = "America/Sao_Paulo"

type ItemStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "DISCARDED"
type ItemKind = "DECISION" | "COMMITMENT" | "RISK" | "PRAISE" | "PENDING"
type SummaryItem = {
  id: string
  kind: ItemKind
  text: string
  responsible: string | null
  status: ItemStatus
  reviewedBy: { name: string } | null
  evidence: Array<{
    id: string
    fromName: string | null
    isFromMe: boolean
    text: string | null
    timestamp: string
  }>
}
type Conversation = { id: string; group: { id: string; name: string; active: boolean } }
type Summary = {
  id: string
  date: string
  status: "DRAFT" | "REVIEWED"
  messageCount: number
  rawSummary: string
  generatedBy: { name: string }
  generatedAt: string
  conversation: { id: string; group: { id: string; name: string } }
  items: SummaryItem[]
}

const KIND_LABEL: Record<ItemKind, string> = {
  DECISION: "Decisão",
  COMMITMENT: "Compromisso",
  RISK: "Risco",
  PRAISE: "Elogio",
  PENDING: "Pendência",
}
const STATUS_TONE: Record<ItemStatus, "attention" | "healthy" | "critical" | "unknown"> = {
  PROPOSED: "attention",
  APPROVED: "healthy",
  REJECTED: "critical",
  DISCARDED: "unknown",
}
const STATUS_LABEL: Record<ItemStatus, string> = {
  PROPOSED: "Aguardando revisão",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  DISCARDED: "Descartado",
}

function todayInTz(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")
}

export default function ResumoDiarioGrupoPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [date, setDate] = useState(todayInTz())
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`/api/clients/${clientId}/groups/daily-summary`)
    const payload = await response.json()
    if (response.ok) {
      setSummaries(payload.summaries)
      setConversations(payload.availableConversations)
      setConversationId((current) =>
        payload.availableConversations.some((conversation: Conversation) => conversation.id === current)
          ? current
          : payload.availableConversations[0]?.id ?? ""
      )
    } else {
      setError(payload.error ?? "Não foi possível carregar os resumos.")
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  async function generate() {
    setGenerating(true)
    setError("")
    const response = await fetch(`/api/clients/${clientId}/groups/daily-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, conversationId }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível gerar o resumo.")
      setGenerating(false)
      return
    }
    setGenerating(false)
    await load()
  }

  async function syncMessages() {
    setSyncing(true)
    setError("")
    setNotice("")
    const response = await fetch(`/api/clients/${clientId}/groups/sync-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 7, conversationId: conversationId || undefined }),
    })
    const payload = await response.json()
    setSyncing(false)
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível sincronizar as mensagens.")
      return
    }
    setNotice(`Sincronização concluída: ${payload.totalStored} mensagem(ns) nova(s) importada(s) dos últimos ${payload.days} dias.`)
    await load()
  }

  async function review(itemId: string, action: "APPROVE" | "REJECT" | "DISCARD") {
    setReviewingId(itemId)
    setError("")
    const response = await fetch(`/api/groups/daily-summary/items/${itemId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const payload = await response.json()
    setReviewingId(null)
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível revisar o item.")
      return
    }
    await load()
  }

  const pendingTotal = useMemo(
    () => summaries.reduce((total, summary) => total + summary.items.filter((item) => item.status === "PROPOSED").length, 0),
    [summaries]
  )

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Inteligência de relacionamento"
        title="Resumo diário do grupo"
        description="A IA lê as mensagens do dia e propõe decisões, compromissos, riscos, elogios e pendências. Nada entra no Contexto Vivo sem revisão humana."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={conversationId}
              onChange={(event) => setConversationId(event.target.value)}
              className="dash-input min-h-11 min-w-52 rounded-lg px-3.5 py-2.5 text-sm"
              aria-label="Grupo do WhatsApp"
              disabled={conversations.length === 0}
            >
              {conversations.length === 0 && <option value="">Nenhum grupo vinculado</option>}
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.group.name}{conversation.group.active ? "" : " · inativo"}
                </option>
              ))}
            </select>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11" />
            <Button variant="secondary" onClick={syncMessages} disabled={syncing} title="Importa o histórico recente dos grupos direto da Evolution">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />} Sincronizar mensagens
            </Button>
            <Button onClick={generate} disabled={generating || !conversationId}>
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Gerar resumo do dia
            </Button>
          </div>
        }
      />

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.06] px-4 py-3 text-sm leading-6 text-sky-100/80">
        Ao gerar o resumo, o texto das mensagens do grupo selecionado é enviado ao provedor de IA configurado pela agência. Anexos e credenciais não são enviados.
      </div>
      {pendingTotal > 0 && (
        <div className="rounded-xl border border-[#FFD482]/20 bg-[#FFD482]/[0.06] px-4 py-3 text-sm text-[#FFD482]">
          {pendingTotal} item(ns) aguardando revisão.
        </div>
      )}

      {loading ? (
        <Panel className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : summaries.length === 0 ? (
        <Panel className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
          <MessagesSquare size={30} className="text-zinc-700" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-300">Nenhum resumo gerado ainda</h3>
          <p className="mt-2 max-w-sm text-sm text-zinc-600">Escolha uma data com mensagens registradas e gere o primeiro resumo.</p>
        </Panel>
      ) : (
        summaries.map((summary) => (
          <Panel key={summary.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="dash-eyebrow">{formatInTimeZone(new Date(summary.date), TZ, "dd/MM/yyyy")}</p>
                <p className="mt-1 text-xs text-zinc-600">{summary.conversation.group.name} · {summary.messageCount} mensagens · gerado por {summary.generatedBy.name}</p>
              </div>
              <StatusBadge status={summary.status === "REVIEWED" ? "healthy" : "attention"}>
                {summary.status === "REVIEWED" ? "Revisado" : "Em revisão"}
              </StatusBadge>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{summary.rawSummary}</p>

            <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
              {summary.items.length === 0 ? (
                <p className="text-xs text-zinc-700">Nenhum item candidato identificado neste dia.</p>
              ) : (
                summary.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/8 bg-black/20 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusBadge>
                          <span className="text-xs font-medium text-[#FFD482]">{KIND_LABEL[item.kind]}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{item.text}</p>
                        {item.responsible && <p className="mt-1 text-xs text-zinc-600">Responsável: {item.responsible}</p>}
                        <details className="mt-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-medium text-zinc-500">
                            {item.evidence.length} evidência(s) de origem
                          </summary>
                          <div className="mt-2 space-y-2">
                            {item.evidence.map((message) => (
                              <div key={message.id} className="border-l border-[#FF8F50]/30 pl-3 text-xs leading-5 text-zinc-500">
                                <span className="font-medium text-zinc-400">
                                  {message.isFromMe ? "Equipe LUQZ" : message.fromName ?? "Cliente"} · {formatInTimeZone(new Date(message.timestamp), TZ, "HH:mm")}
                                </span>
                                <p>{message.text ?? "Mídia sem texto"}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                      {item.status === "PROPOSED" && (
                        <div className="flex gap-2">
                          <Button variant="danger" className="min-h-8 px-3 py-1 text-xs" disabled={reviewingId === item.id} onClick={() => review(item.id, "REJECT")}>
                            <X size={13} /> Rejeitar
                          </Button>
                          <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" disabled={reviewingId === item.id} onClick={() => review(item.id, "DISCARD")}>
                            <Trash2 size={13} /> Descartar
                          </Button>
                          <Button className="min-h-8 px-3 py-1 text-xs" disabled={reviewingId === item.id || item.evidence.length === 0} onClick={() => review(item.id, "APPROVE")} title={item.evidence.length === 0 ? "Item sem evidência válida" : undefined}>
                            <Check size={13} /> Aprovar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        ))
      )}
    </main>
  )
}
