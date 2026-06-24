"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, KeyRound, Loader2, MessageCircle, Plug, RefreshCw, Save, Trash2 } from "lucide-react"
import { Button, Input, PageHeader, Panel } from "@/components/ui/primitives"

type Credential = {
  provider: "OPENAI"
  label: string
  lastFour: string
  updatedAt: string
  updatedBy: { name: string }
}

const PROVIDER_LABEL: Record<Credential["provider"], string> = {
  OPENAI: "OpenAI (GPT)",
}

type WhatsAppDiagnostics = {
  connectionState: string | null
  runtime: { lastWebhookAt: string | null; lastMessageAt: string | null; connectionState: string | null } | null
  webhook: { enabled: unknown; url: unknown; events: unknown } | null
  totals: { messages: number; groups: number; groupsLinkedToClient: number }
  conversations: { id: string; group: string; client: string; lastMessageAt: string | null; messageCount: number }[]
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("pt-BR")
}

export default function ConfiguracoesAgenciaPage() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [apiKey, setApiKey] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch("/api/settings/ai-credentials")
    const payload = await response.json()
    if (response.ok) setCredentials(payload.credentials)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")
    const response = await fetch("/api/settings/ai-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "OPENAI", label: "OpenAI (GPT)", apiKey }),
    })
    const payload = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível salvar a chave.")
      return
    }
    setApiKey("")
    setNotice("Chave salva e criptografada.")
    await load()
  }

  async function remove(provider: string) {
    if (!window.confirm("Remover esta chave? Os recursos que dependem dela deixarão de funcionar.")) return
    setError("")
    const response = await fetch(`/api/settings/ai-credentials/${provider}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Não foi possível remover a chave.")
      return
    }
    await load()
  }

  const openaiCredential = credentials.find((credential) => credential.provider === "OPENAI")

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Administração"
        title="Configurações da agência"
        description="Chaves de IA usadas pelos recursos do Dash (resumo diário, futuras integrações). Armazenadas criptografadas, nunca exibidas por completo."
      />

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      <Panel className="p-5 lg:p-6">
        <div className="flex items-center gap-3">
          <Bot size={18} className="text-[#FF8F50]" />
          <h2 className="text-base font-semibold text-white">Provedores de IA</h2>
        </div>

        {loading ? (
          <div className="mt-5 flex min-h-20 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
        ) : (
          <div className="mt-5 space-y-3">
            {credentials.length === 0 ? (
              <p className="text-sm text-zinc-600">Nenhuma chave cadastrada ainda.</p>
            ) : (
              credentials.map((credential) => (
                <div key={credential.provider} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center gap-3">
                    <KeyRound size={15} className="text-zinc-600" />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{PROVIDER_LABEL[credential.provider]}</p>
                      <p className="text-xs text-zinc-600">
                        Termina em •••• {credential.lastFour} · atualizada por {credential.updatedBy.name} em{" "}
                        {new Date(credential.updatedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Button variant="danger" className="min-h-8 px-3 py-1 text-xs" onClick={() => remove(credential.provider)}>
                    <Trash2 size={13} /> Remover
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <form onSubmit={save} className="mt-6 space-y-4 border-t border-white/8 pt-5">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-zinc-400">
              {openaiCredential ? "Substituir chave da OpenAI" : "Chave da OpenAI"}
            </span>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              required
              minLength={10}
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar chave
            </Button>
          </div>
        </form>
      </Panel>

      <WhatsAppPanel onError={setError} onNotice={setNotice} />
    </main>
  )
}

function WhatsAppPanel({ onError, onNotice }: { onError: (value: string) => void; onNotice: (value: string) => void }) {
  const [diagnostics, setDiagnostics] = useState<WhatsAppDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch("/api/diagnostics/whatsapp")
    const payload = await response.json()
    if (response.ok) setDiagnostics(payload)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function reconfigureWebhook() {
    setWorking(true)
    onError("")
    onNotice("")
    const response = await fetch("/api/settings/whatsapp/webhook", { method: "POST" })
    const payload = await response.json()
    setWorking(false)
    if (!response.ok) {
      onError(payload.error ?? "Não foi possível reconfigurar o webhook.")
      return
    }
    onNotice(payload.message ?? "Webhook reconfigurado.")
    await load()
  }

  const connectionState = diagnostics?.connectionState ?? diagnostics?.runtime?.connectionState ?? null
  const isConnected = connectionState === "open"

  return (
    <Panel className="p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MessageCircle size={18} className="text-[#FF8F50]" />
          <h2 className="text-base font-semibold text-white">WhatsApp · ingestão de grupos</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
          </Button>
          <Button className="min-h-8 px-3 py-1 text-xs" onClick={() => void reconfigureWebhook()} disabled={working}>
            {working ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Reconfigurar webhook
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex min-h-20 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : !diagnostics ? (
        <p className="mt-5 text-sm text-zinc-600">Não foi possível carregar o diagnóstico.</p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Conexão" value={connectionState ?? "desconhecida"} tone={isConnected ? "good" : "warn"} />
            <Metric label="Último webhook" value={formatDateTime(diagnostics.runtime?.lastWebhookAt)} />
            <Metric label="Grupos vinculados" value={`${diagnostics.totals.groupsLinkedToClient}/${diagnostics.totals.groups}`} />
            <Metric label="Mensagens armazenadas" value={String(diagnostics.totals.messages)} />
          </div>

          {!isConnected && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              A instância não está conectada (estado: {connectionState ?? "desconhecido"}). Sem conexão, nenhuma mensagem é recebida.
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-zinc-400">Mensagens por grupo</p>
            {diagnostics.conversations.length === 0 ? (
              <p className="text-sm text-zinc-600">Nenhuma conversa de grupo registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {diagnostics.conversations.map((conversation) => (
                  <div key={conversation.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-200">{conversation.group}</p>
                      <p className="text-xs text-zinc-600">{conversation.client} · última: {formatDateTime(conversation.lastMessageAt)}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs text-zinc-300">{conversation.messageCount} msgs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const valueColor = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-zinc-100"
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-3">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  )
}
