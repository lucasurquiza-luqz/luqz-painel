"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, KeyRound, Loader2, Save, Trash2 } from "lucide-react"
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
    </main>
  )
}
