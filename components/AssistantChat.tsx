"use client"

import { useRef, useState } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"

type Msg = { role: "user" | "assistant"; content: string }

export function AssistantChat({
  endpoint,
  title,
  description,
  suggestions = [],
}: {
  endpoint: string
  title: string
  description: string
  suggestions?: string[]
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [meta, setMeta] = useState<string>("")
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return
    setError("")
    const next = [...messages, { role: "user" as const, content }]
    setMessages(next)
    setInput("")
    setLoading(true)
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }))

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next }),
    })
    const payload = await res.json()
    setLoading(false)
    if (!res.ok) { setError(payload.error ?? "Falha no assistente."); return }
    setMessages([...next, { role: "assistant", content: payload.answer }])
    if (typeof payload.itemCount === "number") {
      setMeta(payload.clientCount != null
        ? `Base: ${payload.itemCount} item(ns) de contexto aprovado em ${payload.clientCount} clientes`
        : `Base: ${payload.itemCount} item(ns) de contexto aprovado`)
    }
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/8 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#FF8F50]" />
          <h1 className="text-base font-semibold text-zinc-100">{title}</h1>
          {meta && <span className="ml-auto text-xs text-zinc-600">{meta}</span>}
        </div>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div ref={scrollRef} className="dash-scrollbar flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl pt-8 text-center">
            <Sparkles size={28} className="mx-auto text-zinc-700" />
            <p className="mt-4 text-sm text-zinc-500">Pergunte ou peça algo — respondo só com base no contexto <span className="text-zinc-300">aprovado</span>.</p>
            {suggestions.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:border-[#FF8F50]/40 hover:text-zinc-200">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  m.role === "user" ? "bg-[#FF8F50]/15 text-zinc-100" : "border border-white/8 bg-white/[0.03] text-zinc-200"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5"><Loader2 size={16} className="animate-spin text-[#FF8F50]" /></div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="mx-6 mb-2 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>}

      <div className="border-t border-white/8 p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input) } }}
            rows={1}
            placeholder="Pergunte sobre o contexto aprovado…"
            className="dash-input max-h-32 flex-1 resize-none rounded-xl px-4 py-3 text-sm"
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} className="dash-button-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-40">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
