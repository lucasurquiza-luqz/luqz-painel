"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { Send, Paperclip, X, Users, MessageSquare, CalendarClock, Plus, Clock, CheckCircle2, XCircle, Ban, Mic, MicOff } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { EmojiPicker } from "@/components/EmojiPicker"

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
  group: { id: string; name: string; participants: number }
  messages: Message[]
}

export default function ChatPage() {
  const { id: clientId } = useParams<{ id: string }>()
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const activeConv = conversations.find((c) => c.id === activeConvId)

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/chat?clientId=${clientId}`)
    const data = await res.json()
    setConversations(data.conversations ?? [])
    setLoading(false)
  }, [clientId])

  const loadMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/chat/${convId}`)
    const data = await res.json()
    setMessages(data.messages ?? [])
  }, [])

  // Carrega conversas inicialmente
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Polling a cada 5 segundos — pausa quando aba esta em segundo plano
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

  // Carrega agendamentos quando aba muda
  useEffect(() => {
    if (tab !== "agendamentos") return
    fetch(`/api/schedules?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => setScheduledMsgs(d.messages ?? []))
  }, [tab, clientId])

  // Scroll para o fim ao receber novas mensagens
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
      let mediaType: string | undefined
      let mediaName: string | undefined

      if (file) {
        const form = new FormData()
        form.append("file", file)
        const up = await fetch("/api/uploads", { method: "POST", body: form })
        const upData = await up.json()
        if (!up.ok) throw new Error(upData.error ?? "Erro ao enviar arquivo.")
        mediaUrl = upData.url
        mediaType = upData.type
        mediaName = upData.name ?? file.name
        setFile(null)
        setFilePreview(null)
      }

      const res = await fetch(`/api/chat/${activeConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() || null, mediaUrl, mediaType, mediaName }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Erro ao enviar mensagem.")
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

  function formatTime(ts: string) {
    return formatInTimeZone(new Date(ts), TZ, "HH:mm", { locale: ptBR })
  }

  function formatDay(ts: string) {
    return formatInTimeZone(new Date(ts), TZ, "dd/MM/yyyy", { locale: ptBR })
  }

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      {/* Abas no topo — sempre visiveis */}
      <div className="flex items-center gap-1 px-5 py-3 border-b border-white/8 bg-zinc-900/60 flex-shrink-0">
        {(["mensagens", "agendamentos"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
              tab === t
                ? "bg-orange-500/15 text-orange-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            {t === "mensagens" ? <MessageSquare size={14} /> : <CalendarClock size={14} />}
            {t === "mensagens" ? "Mensagens" : "Agendamentos"}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
      {/* Lista de conversas — so visivel na aba mensagens */}
      <div className={cn("w-72 flex-shrink-0 border-r border-white/8 flex flex-col bg-zinc-900", tab !== "mensagens" && "hidden")}>
        <div className="px-4 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-zinc-100">Conversas</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{conversations.length} grupo{conversations.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-zinc-600">Carregando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare size={28} className="mx-auto mb-2 text-zinc-700" />
              <p className="text-xs text-zinc-600">Nenhuma conversa ainda.</p>
              <p className="text-xs text-zinc-700 mt-1">Vincule um grupo ao cliente e aguarde mensagens.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const lastMsg = conv.messages[0]
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3.5 border-b border-white/5 text-left transition-colors cursor-pointer",
                    activeConvId === conv.id
                      ? "bg-orange-500/8 border-l-2 border-l-orange-500"
                      : "hover:bg-white/3"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users size={15} className="text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-100 truncate">{conv.group.name}</span>
                      {lastMsg && (
                        <span className="text-xs text-zinc-600 flex-shrink-0">
                          {formatTime(lastMsg.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-zinc-500 truncate">
                        {lastMsg
                          ? lastMsg.isFromMe
                            ? `Voce: ${lastMsg.text ?? lastMsg.mediaName ?? "Arquivo"}`
                            : lastMsg.text ?? lastMsg.mediaName ?? "Arquivo"
                          : "Sem mensagens ainda"
                        }
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-1">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
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
            {/* Header do chat */}
            <div className="px-5 py-3 border-b border-white/8 bg-zinc-900/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Users size={14} className="text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{activeConv?.group.name}</p>
                  <p className="text-xs text-zinc-500">{activeConv?.group.participants} membros</p>
                </div>
              </div>
            </div>

            {/* Mensagens — so aparece na aba mensagens */}
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
                            {!msg.isFromMe && (
                              <span className="text-xs text-orange-400 font-medium mb-1 px-1">
                                {msg.fromName ?? msg.fromJid.split("@")[0]}
                              </span>
                            )}
                            <div
                              className={cn(
                                "px-4 py-2.5 rounded-2xl text-sm break-words",
                                msg.isFromMe
                                  ? "bg-orange-500/20 text-zinc-100 rounded-tr-sm"
                                  : "bg-zinc-800 text-zinc-100 rounded-tl-sm"
                              )}
                            >
                              {msg.mediaUrl && (
                                <div className="mb-1.5">
                                  {msg.mediaType === "image" ? (
                                    <img src={msg.mediaUrl} alt={msg.mediaName ?? "imagem"} className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.mediaUrl!, "_blank")} />
                                  ) : msg.mediaType === "audio" ? (
                                    <audio controls src={msg.mediaUrl} className="max-w-full h-10" style={{ minWidth: 200 }} />
                                  ) : msg.mediaType === "video" ? (
                                    <video controls src={msg.mediaUrl} className="max-w-full rounded-lg max-h-48" />
                                  ) : (
                                    <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-xs text-orange-400 hover:underline">
                                      <Paperclip size={12} />
                                      {msg.mediaName ?? "Arquivo"}
                                    </a>
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

            {/* Input de envio */}
            {tab === "agendamentos" && <div className="h-px" />}
            <form onSubmit={handleSend} className={cn("px-3 py-3 border-t border-white/8 bg-zinc-900/50", tab !== "mensagens" && "hidden")}>
              {sendError && (
                <div className="mb-2 mx-1 px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {sendError}
                </div>
              )}
              {file && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-zinc-800 rounded-xl border border-white/8 mx-1">
                  {filePreview ? (
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
                  <span className="text-xs text-red-400">Gravando audio...</span>
                </div>
              )}
              <div className="flex items-end gap-1">
                {/* Emoji */}
                <EmojiPicker onSelect={(emoji) => setText((t) => t + emoji)} />

                {/* Anexo */}
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

                {/* Audio */}
                <button type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className={cn("p-2.5 cursor-pointer transition-colors flex-shrink-0",
                    recording ? "text-red-400 hover:text-red-300" : "text-zinc-500 hover:text-zinc-300")}>
                  {recording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* Texto */}
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

                {/* Enviar */}
                <button type="submit" disabled={sending || (!text.trim() && !file)}
                  className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white transition-colors flex-shrink-0 cursor-pointer">
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Aba Agendamentos — ocupa o espaco todo */}
      {tab === "agendamentos" && (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold text-zinc-100">Agendamentos do cliente</p>
            <Link
              href={`/agendamentos/novo?clientId=${clientId}`}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl transition-colors font-medium"
            >
              <Plus size={13} />
              Novo agendamento
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
                        <span className="text-xs text-zinc-500">
                          {formatInTimeZone(new Date(msg.scheduledAt), TZ, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {msg.groups.map((g) => g.group.name).join(", ")}
                        </span>
                      </div>
                    </div>
                    <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0", cfg.color)}>
                      <Icon size={11} />
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
