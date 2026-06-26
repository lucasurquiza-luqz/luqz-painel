"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bot, KeyRound, Loader2, MessageCircle, Plug, Power, QrCode, RefreshCw, Save, Smartphone, Trash2 } from "lucide-react"
import { Button, Input, PageHeader, Panel } from "@/components/ui/primitives"

type AiProvider = "OPENAI" | "ANTHROPIC"
type Credential = {
  provider: AiProvider
  label: string
  lastFour: string
  updatedAt: string
  updatedBy: { name: string }
}

const PROVIDER_LABEL: Record<AiProvider, string> = {
  OPENAI: "OpenAI (GPT)",
  ANTHROPIC: "Anthropic (Claude)",
}
const KEY_PLACEHOLDER: Record<AiProvider, string> = {
  OPENAI: "sk-...",
  ANTHROPIC: "sk-ant-...",
}
const FUNCTION_LABEL: Record<string, string> = {
  ASSISTANT: "Assistente (chat de contexto)",
  GROUP_SUMMARY: "Resumo diário do grupo",
  MEETING_SUMMARY: "Resumo de reunião",
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
  const [keyProvider, setKeyProvider] = useState<AiProvider>("OPENAI")

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
      body: JSON.stringify({ provider: keyProvider, label: PROVIDER_LABEL[keyProvider], apiKey }),
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
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">Provedor</span>
              <select value={keyProvider} onChange={(e) => setKeyProvider(e.target.value as AiProvider)} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm">
                <option value="OPENAI">OpenAI (GPT)</option>
                <option value="ANTHROPIC">Anthropic (Claude)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">
                {credentials.some((c) => c.provider === keyProvider) ? `Substituir chave ${PROVIDER_LABEL[keyProvider]}` : `Chave ${PROVIDER_LABEL[keyProvider]}`}
              </span>
              <Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={KEY_PLACEHOLDER[keyProvider]} required minLength={10} />
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar chave
            </Button>
          </div>
        </form>
      </Panel>

      <AiModelsPanel onError={setError} onNotice={setNotice} />

      <WhatsAppPanel onError={setError} onNotice={setNotice} />
    </main>
  )
}

type ModelConfig = { function: string; provider: AiProvider; model: string; isDefault: boolean }

function AiModelsPanel({ onError, onNotice }: { onError: (value: string) => void; onNotice: (value: string) => void }) {
  const [configs, setConfigs] = useState<ModelConfig[]>([])
  const [options, setOptions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [savingFn, setSavingFn] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/ai-models")
    const payload = await res.json()
    if (res.ok) { setConfigs(payload.configs); setOptions(payload.modelOptions) }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  function update(fn: string, patch: Partial<ModelConfig>) {
    setConfigs((cs) => cs.map((c) => (c.function === fn ? { ...c, ...patch } : c)))
  }

  async function save(cfg: ModelConfig) {
    setSavingFn(cfg.function)
    onError(""); onNotice("")
    const res = await fetch("/api/settings/ai-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: cfg.function, provider: cfg.provider, model: cfg.model }),
    })
    setSavingFn(null)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao salvar modelo."); return }
    onNotice(`Modelo de "${FUNCTION_LABEL[cfg.function] ?? cfg.function}" salvo.`)
    await load()
  }

  return (
    <Panel className="p-5 lg:p-6">
      <div className="flex items-center gap-3">
        <Bot size={18} className="text-[#FF8F50]" />
        <h2 className="text-base font-semibold text-white">Modelos por função</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Escolha o provedor e o modelo de cada recurso de IA. Cada função precisa da chave do provedor escolhido acima.</p>

      {loading ? (
        <div className="mt-5 flex min-h-20 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : (
        <div className="mt-5 space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.function} className="rounded-lg border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-200">{FUNCTION_LABEL[cfg.function] ?? cfg.function}</p>
                {cfg.isDefault && <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-500">padrão</span>}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                <select value={cfg.provider} onChange={(e) => update(cfg.function, { provider: e.target.value as AiProvider })} className="dash-input min-h-10 rounded-lg px-3 py-2 text-sm">
                  <option value="OPENAI">OpenAI</option>
                  <option value="ANTHROPIC">Anthropic</option>
                </select>
                <input list={`models-${cfg.function}`} value={cfg.model} onChange={(e) => update(cfg.function, { model: e.target.value })} placeholder="modelo" className="dash-input min-h-10 rounded-lg px-3 py-2 text-sm" />
                <datalist id={`models-${cfg.function}`}>
                  {(options[cfg.provider] ?? []).map((m) => <option key={m} value={m} />)}
                </datalist>
                <Button variant="secondary" className="min-h-10 px-3 text-xs" onClick={() => save(cfg)} disabled={savingFn === cfg.function}>
                  {savingFn === cfg.function ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function WhatsAppPanel({ onError, onNotice }: { onError: (value: string) => void; onNotice: (value: string) => void }) {
  const [diagnostics, setDiagnostics] = useState<WhatsAppDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [baseUrl, setBaseUrl] = useState("")

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
    const response = await fetch("/api/settings/whatsapp/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
    })
    const payload = await response.json()
    setWorking(false)
    if (!response.ok) {
      onError(payload.error ?? "Não foi possível reconfigurar o webhook.")
      return
    }
    onNotice(`${payload.message ?? "Webhook reconfigurado."}${payload.registeredUrl ? ` (${payload.registeredUrl})` : ""}`)
    await load()
  }

  const connectionState = diagnostics?.connectionState ?? diagnostics?.runtime?.connectionState ?? null
  const isConnected = connectionState === "open"

  return (
    <Panel className="p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MessageCircle size={18} className="text-[#FF8F50]" />
          <h2 className="text-base font-semibold text-white">Integração WhatsApp</h2>
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

      <WhatsAppConnection onStateChange={() => void load()} />

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

          {isConnected && !diagnostics.runtime?.lastWebhookAt && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Conectado, mas nenhum webhook chegou ao Dash ainda. Clique em “Reconfigurar webhook”. Se mesmo assim
              “Último webhook” não mudar ao receber uma mensagem, a Evolution não está alcançando esta URL —
              informe a URL interna do container abaixo e reconfigure.
            </p>
          )}

          <div className="rounded-lg border border-white/8 bg-black/20 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-400">Webhook registrado na Evolution</p>
            <dl className="space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-zinc-600">Estado</dt>
                <dd className={diagnostics.webhook?.enabled ? "text-emerald-300" : "text-amber-300"}>
                  {diagnostics.webhook ? (diagnostics.webhook.enabled ? "ativo" : "inativo") : "não configurado"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-zinc-600">URL</dt>
                <dd className="min-w-0 break-all font-mono text-zinc-400">{String(diagnostics.webhook?.url ?? "—")}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-zinc-600">Eventos</dt>
                <dd className="min-w-0 break-all text-zinc-400">
                  {Array.isArray(diagnostics.webhook?.events) ? (diagnostics.webhook!.events as string[]).join(", ") : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="URL alternativa do webhook (ex: http://painel:3000) — opcional"
                className="min-h-9 text-xs"
              />
              <Button className="min-h-9 shrink-0 px-3 text-xs" onClick={() => void reconfigureWebhook()} disabled={working}>
                {working ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Reconfigurar
              </Button>
            </div>
          </div>

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

type ConnectionInfo = { state: string | null; qr: string | null; pairingCode: string | null; error?: string }

function WhatsAppConnection({ onStateChange }: { onStateChange: () => void }) {
  const [info, setInfo] = useState<ConnectionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const wasOpen = useRef<boolean | null>(null)

  const load = useCallback(async () => {
    const response = await fetch("/api/settings/whatsapp/connection")
    const payload = await response.json()
    setInfo(payload)
    setLoading(false)
    const open = payload.state === "open"
    if (wasOpen.current !== null && wasOpen.current !== open) onStateChange()
    wasOpen.current = open
  }, [onStateChange])

  useEffect(() => {
    void load()
  }, [load])

  // Enquanto nao conectado, atualiza o QR/estado periodicamente.
  useEffect(() => {
    if (info?.state === "open") return
    const timer = setInterval(() => { void load() }, 5000)
    return () => clearInterval(timer)
  }, [info?.state, load])

  async function disconnect() {
    if (!window.confirm("Desconectar o WhatsApp? Será necessário parear novamente com o QR.")) return
    setDisconnecting(true)
    await fetch("/api/settings/whatsapp/connection", { method: "DELETE" })
    setDisconnecting(false)
    await load()
  }

  const isOpen = info?.state === "open"

  return (
    <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Smartphone size={15} className={isOpen ? "text-emerald-400" : "text-amber-400"} />
          <span className="text-sm font-medium text-zinc-200">Conexão da instância</span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${isOpen ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
            {loading ? "verificando…" : isOpen ? "conectado" : (info?.state ?? "desconectado")}
          </span>
        </div>
        {isOpen && (
          <Button variant="danger" className="min-h-8 px-3 py-1 text-xs" onClick={() => void disconnect()} disabled={disconnecting}>
            {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />} Desconectar
          </Button>
        )}
      </div>

      {!isOpen && !loading && (
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {info?.qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.qr} alt="QR Code de conexão do WhatsApp" className="h-48 w-48 shrink-0 rounded-lg bg-white p-2" />
          ) : (
            <div className="flex h-48 w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 text-zinc-600">
              <QrCode size={28} />
              <span className="text-xs">Gerando QR…</span>
            </div>
          )}
          <div className="space-y-2 text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Parear o WhatsApp</p>
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-5 text-zinc-500">
              <li>Abra o WhatsApp no celular da operação.</li>
              <li>Toque em Configurações → Aparelhos conectados.</li>
              <li>Toque em Conectar um aparelho e escaneie o QR ao lado.</li>
            </ol>
            {info?.pairingCode && (
              <p className="text-xs text-zinc-400">
                Ou use o código de pareamento: <span className="font-mono text-[#FFD482]">{info.pairingCode}</span>
              </p>
            )}
            {info?.error && <p className="text-xs text-red-300">{info.error}</p>}
            <p className="text-[11px] text-zinc-600">O QR expira em poucos segundos e é atualizado automaticamente.</p>
          </div>
        </div>
      )}
    </div>
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
