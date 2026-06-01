"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { Send, Paperclip, X, Users, MessageSquare } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

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
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
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

  // Polling a cada 5 segundos
  useEffect(() => {
    if (!activeConvId) return
    loadMessages(activeConvId)

    pollRef.current = setInterval(() => {
      loadMessages(activeConvId)
      loadConversations()
    }, 5000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeConvId, loadMessages, loadConversations])

  // Scroll para o fim ao receber novas mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!activeConvId || (!text.trim() && !file)) return
    setSending(true)

    try {
      let mediaPath: string | undefined
      let mediaType: string | undefined
      let mediaName: string | undefined

      if (file) {
        const form = new FormData()
        form.append("file", file)
        const up = await fetch("/api/uploads", { method: "POST", body: form })
        const upData = await up.json()
        mediaPath = upData.path
        mediaType = upData.type
        mediaName = file.name
        setFile(null)
      }

      await fetch(`/api/chat/${activeConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() || null, mediaPath, mediaType, mediaName }),
      })

      setText("")
      await loadMessages(activeConvId)
    } finally {
      setSending(false)
    }
  }

  function formatTime(ts: string) {
    return formatInTimeZone(new Date(ts), TZ, "HH:mm", { locale: ptBR })
  }

  function formatDay(ts: string) {
    return formatInTimeZone(new Date(ts), TZ, "dd/MM/yyyy", { locale: ptBR })
  }

  return (
    <div className="flex h-full bg-[#0D0D0D]">
      {/* Lista de conversas */}
      <div className="w-72 flex-shrink-0 border-r border-white/8 flex flex-col bg-zinc-900">
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
            <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3 bg-zinc-900/50">
              <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center">
                <Users size={15} className="text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">{activeConv?.group.name}</p>
                <p className="text-xs text-zinc-500">{activeConv?.group.participants} membros</p>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
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
                                    <img src={msg.mediaUrl} alt={msg.mediaName ?? "imagem"} className="max-w-full rounded-lg max-h-48 object-cover" />
                                  ) : (
                                    <a
                                      href={msg.mediaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-xs text-orange-400 hover:underline"
                                    >
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
            <form onSubmit={handleSend} className="px-4 py-3 border-t border-white/8 bg-zinc-900/50">
              {file && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-zinc-800 rounded-xl border border-white/8">
                  <Paperclip size={13} className="text-zinc-400" />
                  <span className="text-xs text-zinc-300 flex-1 truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-zinc-500 hover:text-red-400 cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="p-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors flex-shrink-0">
                  <Paperclip size={18} />
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e as unknown as React.FormEvent)
                    }
                  }}
                  placeholder="Escreva uma mensagem..."
                  rows={1}
                  className="flex-1 bg-zinc-800 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none min-h-[42px] max-h-32"
                  style={{ overflowY: "auto" }}
                />
                <button
                  type="submit"
                  disabled={sending || (!text.trim() && !file)}
                  className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white transition-colors flex-shrink-0 cursor-pointer"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
