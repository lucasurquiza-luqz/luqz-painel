"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Send, Paperclip, X, Users, MessageSquare, CalendarClock, Plus, Clock, CheckCircle2, XCircle, Ban, Mic, MicOff, ArrowLeftRight, History, UserRound, Loader2, Building2 } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { EmojiPicker } from "@/components/EmojiPicker"
import { dateSuggestions } from "@/lib/date-suggestions"

type Tab = "mensagens" | "agendamentos"

const STATUS_CONFIG = {
  PENDING:   { label: "Pendente",  color: "bg-yellow-500/15 text-yellow-400", icon: Clock },
  SENDING:   { label: "Enviando",  color: "bg-orange-500/15 text-orange-400", icon: CalendarClock },
  SENT:      { label: "Enviado",   color: "bg-green-500/15 text-green-400",   icon: CheckCircle2 },
  FAILED:    { label: "Falhou",    color: "bg-red-500/15 text-red-400",       icon: XCircle },
  CANCELLED: { label: "Cancelado", color: "bg-zinc-500/15 text-zinc-400",     icon: Ban },
}

interface ScheduledMsg {
  id: string
  text: string
  scheduledAt: string
  status: keyof typeof STATUS_CONFIG
  mediaName: string | null
  groups: { group: { name: string } }[]
}

const TZ = "America/Sao_Paulo"

interface Message {
  id: string
  fromName: string | null
  fromJid: string
  text: string | null
  mediaUrl: string | null
  mediaType: string | null
  mediaName: string | null
  isFromMe: boolean
  timestamp: string
}

interface Conversation {
  id: string
  unreadCount: number
  lastMessageAt: string | null
  name: string
  isGroup: boolean
  groupId: string | null
  group: { participants: number } | null
  client: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  messages: Message[]
}

type AssigneeFilter = "all" | "me" | "none"
type TeamMember = { id: string; name: string }
type Transfer = {
  id: string
  note: string | null
  createdAt: string
  fromUser: { name: string } | null
  toUser: { name: string } | null
  byUser: { name: string }
}

// Chat reutilizável. Sem clientId => modo global (todas as conversas, com o
// nome do cliente em cada uma). Com clientId => workspace do cliente (+ aba de
// agendamentos).
export function ChatWorkspace({ clientId }: { clientId?: string }) {
  const isGlobal = !clientId
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [tab, setTab] = useState<Tab>("mensagens")
  const [scheduledMsgs, setScheduledMsgs] = useState<ScheduledMsg[]>([])
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [recording, setRecording] = useState(false)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Filtro de responsável
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all")

  // Transferência
  const [transferOpen, setTransferOpen] = useState(false)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transferTo, setTransferTo] = useState("")
  const [transferNote, setTransferNote] = useState("")
  const [transferring, setTransferring] = useState(false)

  // Agendar pelo chat
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState("")
  const [scheduling, setScheduling] = useState(false)

  // Vincular conversa a cliente
  const [linkOpen, setLinkOpen] = useState(false)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [linkTo, setLinkTo] = useState("")
  const [linking, setLinking] = useState(false)

  // Triagem: só conversas sem cliente (chat global)
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)

  // Busca + filtro de tipo (grupo / individual)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "group" | "individual">("all")

  // Iniciar nova conversa
  const [newOpen, setNewOpen] = useState(false)
  const [newPhone, setNewPhone] = useState("")
  const [newName, setNewName] = useState("")
  const [newText, setNewText] = useState("")
  const [starting, setStarting] = useState(false)

  const activeConv = conversations.find((c) => c.id === activeConvId)

  const q = search.trim().toLowerCase()
  const filteredConversations = conversations.filter((c) => {
    if (typeFilter === "group" && !c.isGroup) return false
    if (typeFilter === "individual" && c.isGroup) return false
    if (!q) return true
    return c.name.toLowerCase().includes(q)
      || (c.client?.name.toLowerCase().includes(q) ?? false)
      || (c.messages[0]?.text?.toLowerCase().includes(q) ?? false)
  })

  const loadConversations = useCallback(async () => {
    const params = new URLSearchParams()
    if (clientId) params.set("clientId", clientId)
    if (assigneeFilter !== "all") params.set("assignee", assigneeFilter)
    if (!clientId && unlinkedOnly) params.set("unlinked", "1")
    const qs = params.toString()
    const res = await fetch(`/api/chat${qs ? `?${qs}` : ""}`)
    const data = await res.json()
    setConversations(data.conversations ?? [])
    setLoading(false)
  }, [clientId, assigneeFilter, unlinkedOnly])

  async function startConversation() {
    setStarting(true); setSendError("")
    const res = await fetch(`/api/chat/start`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newPhone, name: newName, text: newText }),
    })
    const data = await res.json()
    setStarting(false)
    if (!res.ok) { setSendError(data.error ?? "Falha ao iniciar conversa."); return }
    setNewOpen(false); setNewPhone(""); setNewName(""); setNewText("")
    await loadConversations()
    setActiveConvId(data.conversation.id)
  }

  const loadMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/chat/${convId}`)
    const data = await res.json()
    setMessages(data.messages ?? [])
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Polling a cada 5s — pausa quando aba esta em segundo plano.
  useEffect(() => {
    if (!activeConvId) return
    loadMessages(activeConvId)

    function startPoll() {
      pollRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          loadMessages(activeConvId!)
          loadConversations()
        }
      }, 5000)
    }

    startPoll()
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") loadMessages(activeConvId!)
    })

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeConvId, loadMessages, loadConversations])

  // Agendamentos só existem no contexto de um cliente.
  useEffect(() => {
    if (!clientId || tab !== "agendamentos") return
    fetch(`/api/schedules?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => setScheduledMsgs(d.messages ?? []))
  }, [tab, clientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!activeConvId || (!text.trim() && !file)) return
    setSending(true)
    setSendError("")

    try {
      let mediaUrl: string | undefined
      let mediaBase64: string | undefined
      let mediaType: string | undefined
      let mediaName: string | undefined

      if (file) {
        const fd = new FormData()
        fd.append("file", file)
        const up = await fetch("/api/uploads", { method: "POST", body: fd })
        const upData = await up.json()
        if (!up.ok) throw new Error(upData.error ?? "Erro ao enviar arquivo.")
        mediaUrl = upData.url
        mediaBase64 = upData.base64
        mediaType = upData.type
        mediaName = upData.name ?? file.name
        setFile(null)
        setFilePreview(null)
        setAudioPreviewUrl(null)
      }

      const res = await fetch(`/api/chat/${activeConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() || null, mediaUrl, mediaBase64, mediaType, mediaName }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => null) // resposta pode ser HTML (gateway/deploy)
        throw new Error(d?.error ?? (res.status >= 502 ? "Servidor reiniciando, tente em instantes." : "Erro ao enviar mensagem."))
      }

      setText("")
      await loadMessages(activeConvId)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erro desconhecido.")
      setTimeout(() => setSendError(""), 5000)
    } finally {
      setSending(false)
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const audioFile = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" })
        setFile(audioFile)
        setAudioPreviewUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      alert("Permissao de microfone negada.")
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function openTransfer() {
    if (!activeConvId) return
    setTransferOpen(true)
    setTransferNote("")
    setTransferTo(activeConv?.assignedTo?.id ?? "")
    const res = await fetch(`/api/chat/${activeConvId}/assign`)
    if (res.ok) {
      const data = await res.json()
      setTeam(data.team ?? [])
      setTransfers(data.transfers ?? [])
    }
  }

  async function submitTransfer() {
    if (!activeConvId) return
    setTransferring(true)
    const res = await fetch(`/api/chat/${activeConvId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: transferTo || null, note: transferNote.trim() || null }),
    })
    setTransferring(false)
    if (res.ok) {
      setTransferOpen(false)
      await loadConversations()
    }
  }

  async function openLink() {
    if (!activeConvId) return
    setLinkOpen(true)
    setLinkTo(activeConv?.client?.id ?? "")
    const res = await fetch(`/api/chat/${activeConvId}/link`)
    if (res.ok) {
      const data = await res.json()
      setClients(data.clients ?? [])
    }
  }

  async function submitLink() {
    if (!activeConvId) return
    setLinking(true)
    const res = await fetch(`/api/chat/${activeConvId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: linkTo || null }),
    })
    setLinking(false)
    if (res.ok) {
      setLinkOpen(false)
      await loadConversations()
    }
  }

  async function submitSchedule() {
    if (!activeConv || !text.trim() || !scheduleAt) return
    if (!activeConv.isGroup || !activeConv.groupId) {
      setSendError("Agendamento disponível apenas para grupos.")
      setTimeout(() => setSendError(""), 5000)
      return
    }
    setScheduling(true)
    setSendError("")
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        scheduledAt: new Date(scheduleAt).toISOString(),
        groupIds: [activeConv.groupId],
        clientId: activeConv.client?.id ?? clientId,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setScheduling(false)
    if (!res.ok) {
      setSendError(data.error ?? "Não foi possível agendar.")
      setTimeout(() => setSendError(""), 5000)
      return
    }
    setText("")
    setScheduleAt("")
    setScheduleOpen(false)
  }

  function formatTime(ts: string) {
    return formatInTimeZone(new Date(ts), TZ, "HH:mm", { locale: ptBR })
  }

  function formatDay(ts: string) {
    return formatInTimeZone(new Date(ts), TZ, "dd/MM/yyyy", { locale: ptBR })
  }

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      {/* Abas — só no contexto de um cliente (agendamentos é por cliente) */}
      {!isGlobal && (
        <div className="flex items-center gap-1 px-5 py-3 border-b border-white/8 bg-zinc-900/60 flex-shrink-0">
          {(["mensagens", "agendamentos"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                tab === t ? "bg-orange-500/15 text-orange-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              {t === "mensagens" ? <MessageSquare size={14} /> : <CalendarClock size={14} />}
              {t === "mensagens" ? "Mensagens" : "Agendamentos"}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
      {/* Lista de conversas */}
      <div className={cn("w-72 flex-shrink-0 border-r border-white/8 flex flex-col bg-zinc-900", tab !== "mensagens" && "hidden")}>
        <div className="px-4 py-4 border-b border-white/8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">{isGlobal ? "Todas as conversas" : "Conversas"}</h2>
            <button onClick={() => setNewOpen((v) => !v)} className="flex items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[11px] font-medium text-orange-400 hover:bg-orange-500/25">
              <Plus size={13} /> Nova
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{filteredConversations.length} de {conversations.length} conversa{conversations.length !== 1 ? "s" : ""}</p>

          {/* Busca */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa, cliente, mensagem…"
            className="mt-3 w-full rounded-lg border border-white/8 bg-black/20 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500/30 focus:outline-none"
          />

          {/* Filtro responsável */}
          <div className="mt-2 flex gap-1 rounded-lg border border-white/8 bg-black/20 p-0.5">
            {([["all", "Todas"], ["me", "Minhas"], ["none", "Sem dono"]] as [AssigneeFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setAssigneeFilter(value)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  assigneeFilter === value ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Filtro tipo */}
          <div className="mt-1.5 flex gap-1 rounded-lg border border-white/8 bg-black/20 p-0.5">
            {([["all", "Tudo"], ["group", "Grupos"], ["individual", "Individuais"]] as ["all" | "group" | "individual", string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  typeFilter === value ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {isGlobal && (
            <button
              onClick={() => setUnlinkedOnly((v) => !v)}
              className={cn(
                "mt-2 w-full rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors",
                unlinkedOnly ? "border-orange-500/30 bg-orange-500/10 text-orange-300" : "border-white/8 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {unlinkedOnly ? "Mostrando só sem cliente" : "Triar: só sem cliente"}
            </button>
          )}

          {/* Form nova conversa */}
          {newOpen && (
            <div className="mt-3 space-y-2 rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-3">
              <p className="text-[11px] font-medium text-orange-300">Iniciar conversa</p>
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefone (ex: 5531999998888)" className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none" />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome (opcional)" className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none" />
              <textarea value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Primeira mensagem…" rows={2} className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none" />
              {sendError && <p className="text-[11px] text-red-400">{sendError}</p>}
              <button onClick={startConversation} disabled={starting} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-orange-500/80 px-2 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-50">
                {starting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar e abrir
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-zinc-600">Carregando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare size={28} className="mx-auto mb-2 text-zinc-700" />
              <p className="text-xs text-zinc-600">{conversations.length === 0 ? "Nenhuma conversa ainda." : "Nada encontrado com esse filtro."}</p>
              {conversations.length === 0 && <p className="text-xs text-zinc-700 mt-1">Vincule um grupo a um cliente ou inicie uma conversa.</p>}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const lastMsg = conv.messages[0]
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3.5 border-b border-white/5 text-left transition-colors cursor-pointer",
                    activeConvId === conv.id ? "bg-orange-500/8 border-l-2 border-l-orange-500" : "hover:bg-white/3"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {conv.isGroup ? <Users size={15} className="text-zinc-500" /> : <UserRound size={15} className="text-zinc-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-100 truncate">{conv.name}</span>
                      {lastMsg && <span className="text-xs text-zinc-600 flex-shrink-0">{formatTime(lastMsg.timestamp)}</span>}
                    </div>
                    {isGlobal && conv.client && (
                      <p className="text-[11px] text-orange-400/80 truncate">{conv.client.name}</p>
                    )}
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-zinc-500 truncate">
                        {lastMsg
                          ? lastMsg.isFromMe
                            ? `Voce: ${lastMsg.text ?? lastMsg.mediaName ?? "Arquivo"}`
                            : lastMsg.text ?? lastMsg.mediaName ?? "Arquivo"
                          : "Sem mensagens ainda"}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-1">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className={cn("mt-0.5 flex items-center gap-1 text-[10px]", conv.assignedTo ? "text-zinc-600" : "text-zinc-700")}>
                      <UserRound size={10} />
                      {conv.assignedTo ? conv.assignedTo.name : "sem responsável"}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Janela do chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center text-zinc-700">
            <div className="text-center">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-white/8 bg-zinc-900/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  {activeConv?.isGroup ? <Users size={14} className="text-zinc-500" /> : <UserRound size={14} className="text-zinc-500" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{activeConv?.name}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {activeConv?.client ? activeConv.client.name : "Sem cliente"}
                    {activeConv?.isGroup ? ` · ${activeConv.group?.participants ?? 0} membros` : " · individual"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={openLink}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-white/20 hover:text-white"
                >
                  <Building2 size={13} /> {activeConv?.client ? "Cliente" : "Vincular"}
                </button>
                <button
                  onClick={openTransfer}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-white/20 hover:text-white"
                >
                  <ArrowLeftRight size={13} /> Transferir
                </button>
              </div>
            </div>

            <div className={cn("flex-1 overflow-y-auto px-5 py-4 space-y-1", tab !== "mensagens" && "hidden")}>
              {messages.length === 0 ? (
                <div className="text-center text-zinc-700 text-xs py-10">Nenhuma mensagem ainda</div>
              ) : (
                (() => {
                  let lastDay = ""
                  return messages.map((msg) => {
                    const day = formatDay(msg.timestamp)
                    const showDay = day !== lastDay
                    lastDay = day

                    return (
                      <div key={msg.id}>
                        {showDay && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-white/5" />
                            <span className="text-xs text-zinc-600 px-2">{day}</span>
                            <div className="flex-1 h-px bg-white/5" />
                          </div>
                        )}
                        <div className={cn("flex mb-1", msg.isFromMe ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[70%]", msg.isFromMe ? "items-end" : "items-start", "flex flex-col")}>
                            <span className={cn("text-xs font-medium mb-1 px-1", msg.isFromMe ? "text-zinc-400" : "text-orange-400")}>
                              {msg.fromName ?? msg.fromJid.split("@")[0]}
                            </span>
                            <div
                              className={cn(
                                "px-4 py-2.5 rounded-2xl text-sm break-words",
                                msg.isFromMe ? "bg-orange-500/20 text-zinc-100 rounded-tr-sm" : "bg-zinc-800 text-zinc-100 rounded-tl-sm"
                              )}
                            >
                              {msg.mediaType && (
                                <div className="mb-1.5">
                                  {msg.mediaType === "image" && msg.mediaUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={msg.mediaUrl} alt={msg.mediaName ?? "imagem"} className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.mediaUrl!, "_blank")} />
                                  ) : msg.mediaType === "audio" && msg.mediaUrl ? (
                                    <audio controls src={msg.mediaUrl} className="max-w-full h-10" style={{ minWidth: 200 }} />
                                  ) : msg.mediaType === "video" && msg.mediaUrl ? (
                                    <video controls src={msg.mediaUrl} className="max-w-full rounded-lg max-h-48" />
                                  ) : msg.mediaUrl ? (
                                    <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-orange-400 hover:underline">
                                      <Paperclip size={12} />
                                      {msg.mediaName ?? "Arquivo"}
                                    </a>
                                  ) : (
                                    <span className="flex items-center gap-1.5 text-xs text-zinc-500 italic">
                                      <Paperclip size={11} />
                                      {msg.mediaType === "audio" ? "Audio" : msg.mediaType === "image" ? "Imagem" : msg.mediaType === "video" ? "Video" : "Arquivo"} recebido
                                    </span>
                                  )}
                                </div>
                              )}
                              {msg.text && <p>{msg.text}</p>}
                            </div>
                            <span className="text-xs text-zinc-600 mt-0.5 px-1">{formatTime(msg.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className={cn("px-3 py-3 border-t border-white/8 bg-zinc-900/50", tab !== "mensagens" && "hidden")}>
              {sendError && (
                <div className="mb-2 mx-1 px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-xl text-xs text-red-400">{sendError}</div>
              )}
              {file && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-zinc-800 rounded-xl border border-white/8 mx-1">
                  {filePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={filePreview} alt="preview" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <Paperclip size={13} className="text-zinc-400 flex-shrink-0" />
                  )}
                  <span className="text-xs text-zinc-300 flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-zinc-600 flex-shrink-0">{(file.size / 1024).toFixed(0)}KB</span>
                  <button type="button" onClick={() => { setFile(null); setFilePreview(null) }} className="text-zinc-500 hover:text-red-400 cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              )}
              {recording && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-xl mx-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400">Gravando audio... (clique no microfone para parar)</span>
                </div>
              )}
              {audioPreviewUrl && !recording && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-zinc-800 border border-white/8 rounded-xl mx-1">
                  <audio controls src={audioPreviewUrl} className="h-8 flex-1" style={{ minWidth: 160 }} />
                  <button type="button" onClick={() => { setFile(null); setAudioPreviewUrl(null) }} className="text-zinc-500 hover:text-red-400 cursor-pointer flex-shrink-0">
                    <X size={14} />
                  </button>
                </div>
              )}
              {scheduleOpen && (
                <div className="mb-2 mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/[0.05] p-3">
                  <span className="w-full text-xs text-orange-300">Agendar esta mensagem para:</span>
                  <div className="flex w-full flex-wrap gap-1.5">
                    {dateSuggestions().map((s) => (
                      <button key={s.label} type="button" onClick={() => setScheduleAt(s.value)}
                        className={cn("rounded-lg border px-2 py-1 text-[11px] transition-colors", scheduleAt === s.value ? "border-orange-500/40 bg-orange-500/20 text-orange-200" : "border-white/10 text-zinc-400 hover:text-zinc-200")}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="dash-input rounded-lg px-2 py-1.5 text-xs"
                  />
                  <button type="button" onClick={submitSchedule} disabled={scheduling || !text.trim() || !scheduleAt}
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-400 disabled:opacity-40">
                    {scheduling ? "Agendando..." : "Agendar"}
                  </button>
                  <button type="button" onClick={() => setScheduleOpen(false)} className="ml-auto text-zinc-500 hover:text-white">
                    <X size={14} />
                  </button>
                  <p className="w-full text-[11px] text-zinc-600">A mensagem agendada usa o texto digitado (sem anexo). Veja na aba Agendamentos.</p>
                </div>
              )}
              <div className="flex items-end gap-1">
                <EmojiPicker onSelect={(emoji) => setText((t) => t + emoji)} />
                <label className="p-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors flex-shrink-0">
                  <Paperclip size={18} />
                  <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,audio/*" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setFile(f)
                      if (f && f.type.startsWith("image/")) {
                        const reader = new FileReader()
                        reader.onload = (ev) => setFilePreview(ev.target?.result as string)
                        reader.readAsDataURL(f)
                      } else {
                        setFilePreview(null)
                      }
                    }} />
                </label>
                <button type="button" onClick={recording ? stopRecording : startRecording}
                  className={cn("p-2.5 cursor-pointer transition-colors flex-shrink-0", recording ? "text-red-400 hover:text-red-300" : "text-zinc-500 hover:text-zinc-300")}>
                  {recording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                {activeConv?.isGroup && (
                  <button type="button" onClick={() => setScheduleOpen((o) => !o)} title="Agendar mensagem (grupos)"
                    className={cn("p-2.5 cursor-pointer transition-colors flex-shrink-0", scheduleOpen ? "text-orange-400" : "text-zinc-500 hover:text-zinc-300")}>
                    <CalendarClock size={18} />
                  </button>
                )}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent) }
                  }}
                  placeholder="Escreva uma mensagem..."
                  rows={1}
                  className="flex-1 bg-zinc-800 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none min-h-[42px] max-h-32"
                  style={{ overflowY: "auto" }}
                />
                <button type="submit" disabled={sending || (!text.trim() && !file)}
                  className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white transition-colors flex-shrink-0 cursor-pointer">
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Aba Agendamentos (só por cliente) */}
      {!isGlobal && clientId && tab === "agendamentos" && (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold text-zinc-100">Agendamentos do cliente</p>
            <Link href={`/agendamentos/novo?clientId=${clientId}`} className="flex items-center gap-1.5 text-xs px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl transition-colors font-medium">
              <Plus size={13} /> Novo agendamento
            </Link>
          </div>
          {scheduledMsgs.length === 0 ? (
            <div className="text-center py-20 text-zinc-600">
              <CalendarClock size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum agendamento ainda.</p>
            </div>
          ) : (
            <div className="space-y-2 max-w-3xl">
              {scheduledMsgs.map((msg) => {
                const cfg = STATUS_CONFIG[msg.status]
                const Icon = cfg.icon
                return (
                  <div key={msg.id} className="bg-zinc-900 border border-white/8 rounded-2xl px-5 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 line-clamp-2">{msg.text}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-zinc-500">{formatInTimeZone(new Date(msg.scheduledAt), TZ, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        <span className="text-xs text-zinc-600">{msg.groups.map((g) => g.group.name).join(", ")}</span>
                      </div>
                    </div>
                    <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0", cfg.color)}>
                      <Icon size={11} /> {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Modal de transferência */}
      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setTransferOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161616] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><ArrowLeftRight size={15} /> Transferir conversa</h3>
              <button onClick={() => setTransferOpen(false)} className="text-zinc-600 hover:text-white"><X size={16} /></button>
            </div>
            <p className="mt-1 text-xs text-zinc-600 truncate">{activeConv?.name}{activeConv?.client ? ` · ${activeConv.client.name}` : ""}</p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-400">Responsável</span>
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="dash-input w-full rounded-lg px-3 py-2.5 text-sm">
                <option value="">Sem responsável</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-400">Nota (opcional)</span>
              <textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} rows={2} placeholder="Contexto da transferência..." className="dash-input w-full resize-none rounded-lg px-3 py-2.5 text-sm" />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setTransferOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-white/20">Cancelar</button>
              <button onClick={submitTransfer} disabled={transferring} className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-400 disabled:opacity-40">
                {transferring ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />} Transferir
              </button>
            </div>

            {transfers.length > 0 && (
              <div className="mt-5 border-t border-white/8 pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500"><History size={12} /> Histórico</p>
                <div className="dash-scrollbar max-h-40 space-y-2 overflow-y-auto">
                  {transfers.map((t) => (
                    <div key={t.id} className="text-xs leading-5 text-zinc-500">
                      <span className="text-zinc-400">{t.byUser.name}</span> transferiu de{" "}
                      <span className="text-zinc-400">{t.fromUser?.name ?? "ninguém"}</span> para{" "}
                      <span className="text-zinc-400">{t.toUser?.name ?? "ninguém"}</span>
                      <span className="text-zinc-700"> · {formatInTimeZone(new Date(t.createdAt), TZ, "dd/MM HH:mm", { locale: ptBR })}</span>
                      {t.note && <p className="text-zinc-600 italic">“{t.note}”</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de vínculo a cliente */}
      {linkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setLinkOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161616] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Building2 size={15} /> Vincular a cliente</h3>
              <button onClick={() => setLinkOpen(false)} className="text-zinc-600 hover:text-white"><X size={16} /></button>
            </div>
            <p className="mt-1 text-xs text-zinc-600 truncate">{activeConv?.name}</p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-400">Cliente</span>
              <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="dash-input w-full rounded-lg px-3 py-2.5 text-sm">
                <option value="">Sem cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <p className="mt-2 text-[11px] text-zinc-600">Vincular faz esta conversa aparecer na visão do cliente e contar como atividade dele.</p>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setLinkOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-white/20">Cancelar</button>
              <button onClick={submitLink} disabled={linking} className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-400 disabled:opacity-40">
                {linking ? <Loader2 size={13} className="animate-spin" /> : <Building2 size={13} />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
