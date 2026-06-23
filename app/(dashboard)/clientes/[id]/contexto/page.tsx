"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { BrainCircuit, Check, Database, FileText, GitCompare, Loader2, Plus, ShieldCheck, X } from "lucide-react"
import { Button, Input, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

type ContextStatus = "PROPOSED" | "ACTIVE" | "SUPERSEDED" | "REJECTED"
type ContextItem = {
  id: string; domain: string; kind: string; status: ContextStatus; visibility: "INTERNAL" | "CLIENT"
  title: string; content: string; createdAt: string; reviewedAt: string | null
  source: { type: string; label: string; reference: string | null }
  createdBy: { name: string }; reviewedBy: { name: string } | null
  supersedes: { id: string; title: string; status: ContextStatus } | null
}
type Snapshot = {
  id: string; version: number; checksum: string; compiledAt: string
  compiledBy: { name: string }; _count: { items: number }
}
type ContextResponse = {
  client: { id: string; name: string; clickupFolderId: string | null }
  items: ContextItem[]
  snapshots: Snapshot[]
  currentUser: { role: string }
}

const DOMAINS = [
  ["DIRETRIZES", "Diretrizes"], ["OFERTA", "Oferta"], ["PERSONA", "Persona"],
  ["TOM_DE_VOZ", "Tom de voz"], ["CLIENTE", "Cliente"], ["MEMORIA", "Memória"],
  ["OPERACIONAL", "Operacional"],
] as const
const KINDS = [
  ["RULE", "Regra"], ["FACT", "Fato"], ["DECISION", "Decisão"],
  ["GOAL", "Meta"], ["HYPOTHESIS", "Hipótese"], ["PERCEPTION", "Percepção"],
] as const
const SOURCE_TYPES = [
  ["MANUAL", "Registro manual"], ["FILE", "Arquivo canônico"], ["GROUP", "Grupo"],
  ["MEETING", "Reunião"], ["INTEGRATION", "Integração"],
] as const
const EMPTY_FORM = {
  domain: "CLIENTE", kind: "FACT", visibility: "INTERNAL", title: "", content: "",
  sourceType: "MANUAL", sourceLabel: "Registro da equipe", sourceReference: "", supersedesId: "",
}
const statusLabel: Record<ContextStatus, string> = {
  PROPOSED: "Proposta", ACTIVE: "Ativo", SUPERSEDED: "Substituído", REJECTED: "Rejeitado",
}
const statusTone: Record<ContextStatus, "attention" | "healthy" | "unknown" | "critical"> = {
  PROPOSED: "attention", ACTIVE: "healthy", SUPERSEDED: "unknown", REJECTED: "critical",
}

function labelOf(options: ReadonlyArray<readonly [string, string]>, value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value
}

export default function ContextoClientePage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [data, setData] = useState<ContextResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState<"ALL" | ContextStatus>("ALL")
  const [form, setForm] = useState(EMPTY_FORM)

  const loadContext = useCallback(async () => {
    setLoading(true)
    setError("")
    const response = await fetch(`/api/clients/${clientId}/context`)
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível carregar o contexto.")
      setLoading(false)
      return
    }
    setData(payload)
    setLoading(false)
  }, [clientId])

  useEffect(() => { void loadContext() }, [loadContext])

  const counts = useMemo(() => ({
    active: data?.items.filter((item) => item.status === "ACTIVE").length ?? 0,
    proposed: data?.items.filter((item) => item.status === "PROPOSED").length ?? 0,
    sources: new Set(data?.items.map((item) => item.source.label)).size,
  }), [data])
  const filteredItems = useMemo(() => {
    if (!data) return []
    return filter === "ALL" ? data.items : data.items.filter((item) => item.status === filter)
  }, [data, filter])

  function openCorrection(item: ContextItem) {
    setForm({
      domain: item.domain, kind: item.kind, visibility: item.visibility, title: item.title,
      content: item.content, sourceType: "MANUAL", sourceLabel: "Correção da equipe",
      sourceReference: "", supersedesId: item.id,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function createProposal(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const response = await fetch(`/api/clients/${clientId}/context`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: form.domain, kind: form.kind, visibility: form.visibility,
        title: form.title, content: form.content, supersedesId: form.supersedesId || null,
        source: { type: form.sourceType, label: form.sourceLabel, reference: form.sourceReference || null },
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível criar a proposta.")
      setSaving(false)
      return
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
    await loadContext()
  }

  async function review(itemId: string, action: "APPROVE" | "REJECT") {
    setError("")
    const response = await fetch(`/api/context/items/${itemId}/review`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    })
    const payload = await response.json()
    if (!response.ok) { setError(payload.error ?? "Não foi possível revisar o item."); return }
    await loadContext()
  }

  async function createSnapshot() {
    setSnapshotting(true)
    setError("")
    const response = await fetch(`/api/clients/${clientId}/context/snapshots`, { method: "POST" })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível gerar o snapshot.")
      setSnapshotting(false)
      return
    }
    setSnapshotting(false)
    await loadContext()
  }

  async function importPilot() {
    setImporting(true)
    setError("")
    const response = await fetch(`/api/clients/${clientId}/context/import-pilot`, { method: "POST" })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível importar o contexto piloto.")
      setImporting(false)
      return
    }
    setImporting(false)
    await loadContext()
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Memória estratégica"
        title={`Contexto${data?.client.name ? ` · ${data.client.name}` : ""}`}
        description="Conhecimento rastreável, versionado e aprovado antes de alimentar resumos, saúde e IA."
        actions={<>
          {data?.currentUser.role === "ADMIN" && data.client.clickupFolderId === "901317617481" && (
            <Button variant="secondary" onClick={importPilot} disabled={importing}>
              {importing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Importar piloto
            </Button>
          )}
          <Button variant="secondary" onClick={createSnapshot} disabled={snapshotting || counts.active === 0}>
            {snapshotting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />} Gerar snapshot
          </Button>
          <Button onClick={() => { setForm(EMPTY_FORM); setShowForm((current) => !current) }}><Plus size={16} /> Nova proposta</Button>
        </>}
      />

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {showForm && (
        <Panel className="border-[#FF8F50]/20 p-5 lg:p-6">
          <form onSubmit={createProposal} className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="dash-eyebrow">{form.supersedesId ? "Correção versionada" : "Novo conhecimento"}</p><h2 className="mt-2 text-lg font-semibold text-white">{form.supersedesId ? "Propor uma nova versão" : "Criar proposta para revisão"}</h2></div>
              <button type="button" onClick={() => setShowForm(false)} className="text-zinc-600 hover:text-white" aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Domínio"><Select value={form.domain} onChange={(value) => setForm({ ...form, domain: value })} options={DOMAINS} /></Field>
              <Field label="Tipo de conhecimento"><Select value={form.kind} onChange={(value) => setForm({ ...form, kind: value })} options={KINDS} /></Field>
              <Field label="Visibilidade"><Select value={form.visibility} onChange={(value) => setForm({ ...form, visibility: value })} options={[["INTERNAL", "Somente equipe"], ["CLIENT", "Publicável ao cliente"]]} /></Field>
            </div>
            <Field label="Título"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required placeholder="Ex.: Campanhas utilizam formulário nativo" /></Field>
            <Field label="Conteúdo"><textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required rows={5} className="dash-input w-full resize-y rounded-lg px-3.5 py-3 text-sm" placeholder="Registre o fato, decisão ou regra com contexto suficiente." /></Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Tipo da fonte"><Select value={form.sourceType} onChange={(value) => setForm({ ...form, sourceType: value })} options={SOURCE_TYPES} /></Field>
              <Field label="Nome da fonte"><Input value={form.sourceLabel} onChange={(event) => setForm({ ...form, sourceLabel: event.target.value })} required /></Field>
              <Field label="Referência opcional"><Input value={form.sourceReference} onChange={(event) => setForm({ ...form, sourceReference: event.target.value })} placeholder="Arquivo, URL ou identificador" /></Field>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Salvar como proposta</Button></div>
          </form>
        </Panel>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ShieldCheck} label="Conhecimento ativo" value={counts.active} detail="aprovado pela equipe" />
        <Metric icon={GitCompare} label="Aguardando revisão" value={counts.proposed} detail="propostas pendentes" tone="warm" />
        <Metric icon={FileText} label="Fontes registradas" value={counts.sources} detail="com rastreabilidade" />
        <Metric icon={Database} label="Snapshot atual" value={data?.snapshots[0] ? `v${data.snapshots[0].version}` : "—"} detail={data?.snapshots[0] ? `${data.snapshots[0]._count.items} itens compilados` : "ainda não compilado"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Itens de contexto</h2><p className="mt-1 text-sm text-zinc-600">Nenhum item ativo é alterado sem revisão explícita.</p></div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
              {(["ALL", "PROPOSED", "ACTIVE", "SUPERSEDED", "REJECTED"] as const).map((status) => <button key={status} onClick={() => setFilter(status)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium", filter === status ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-300")}>{status === "ALL" ? "Todos" : statusLabel[status]}</button>)}
            </div>
          </div>

          {loading ? <Panel className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
            : filteredItems.length === 0 ? <Panel className="flex min-h-52 flex-col items-center justify-center p-8 text-center"><BrainCircuit size={30} className="text-zinc-700" /><h3 className="mt-4 text-sm font-semibold text-zinc-300">Nenhum conhecimento neste estado</h3><p className="mt-2 max-w-sm text-sm text-zinc-600">Crie uma proposta com fonte identificada. Ela só fará parte do contexto após aprovação.</p></Panel>
            : filteredItems.map((item) => (
              <Panel key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={statusTone[item.status]}>{statusLabel[item.status]}</StatusBadge><span className="text-xs font-medium text-[#FFD482]">{labelOf(DOMAINS, item.domain)}</span><span className="text-xs text-zinc-600">· {labelOf(KINDS, item.kind)}</span>{item.visibility === "INTERNAL" && <span className="text-xs text-zinc-700">· Interno</span>}</div><h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{item.content}</p></div></div>
                {item.supersedes && <div className="mt-4 rounded-lg border border-[#FFD482]/15 bg-[#FFD482]/5 px-3 py-2 text-xs text-[#FFD482]">Substitui: {item.supersedes.title}</div>}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4"><div className="text-xs text-zinc-600"><span className="text-zinc-400">Fonte: {item.source.label}</span>{item.source.reference && <span> · {item.source.reference}</span>}<span> · criado por {item.createdBy.name}</span>{item.reviewedBy && <span> · revisado por {item.reviewedBy.name}</span>}</div><div className="flex gap-2">{item.status === "ACTIVE" && <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => openCorrection(item)}><GitCompare size={13} /> Propor correção</Button>}{item.status === "PROPOSED" && <><Button variant="danger" className="min-h-8 px-3 py-1 text-xs" onClick={() => review(item.id, "REJECT")}><X size={13} /> Rejeitar</Button><Button className="min-h-8 px-3 py-1 text-xs" onClick={() => review(item.id, "APPROVE")}><Check size={13} /> Aprovar</Button></>}</div></div>
              </Panel>
            ))}
        </section>

        <aside className="space-y-4">
          <Panel className="p-5"><p className="dash-eyebrow">Snapshots</p><h2 className="mt-2 text-base font-semibold text-white">Histórico compilado</h2><p className="mt-2 text-sm leading-5 text-zinc-600">Cada versão preserva exatamente os itens ativos usados pela operação e pela IA.</p><div className="mt-5 space-y-3">{data?.snapshots.length ? data.snapshots.map((snapshot) => <div key={snapshot.id} className="rounded-xl border border-white/8 bg-black/20 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">Versão {snapshot.version}</span><span className="font-mono text-[10px] text-zinc-700">{snapshot.checksum.slice(0, 8)}</span></div><p className="mt-2 text-xs text-zinc-600">{snapshot._count.items} itens · {snapshot.compiledBy.name}</p><p className="mt-1 text-xs text-zinc-700">{new Date(snapshot.compiledAt).toLocaleString("pt-BR")}</p></div>) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-zinc-700">Nenhuma versão compilada.</div>}</div></Panel>
          <Panel className="border-[#FF8F50]/15 bg-[#FF8F50]/[0.04] p-5"><ShieldCheck size={18} className="text-[#FF8F50]" /><h3 className="mt-3 text-sm font-semibold text-white">Regra de confiança</h3><p className="mt-2 text-sm leading-5 text-zinc-500">Propostas não alimentam IA, resumo ou saúde. Somente itens ativos presentes em um snapshot podem ser consumidos.</p></Panel>
        </aside>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-400">{label}</span>{children}</label>
}
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: ReadonlyArray<readonly [string, string]> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm">{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
}
function Metric({ icon: Icon, label, value, detail, tone = "default" }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: number | string; detail: string; tone?: "default" | "warm" }) {
  return <Panel className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-zinc-500">{label}</p><Icon size={16} className={tone === "warm" ? "text-[#FF8F50]" : "text-zinc-700"} /></div><p className="dash-display mt-4 text-2xl text-white">{value}</p><p className="mt-1 text-xs text-zinc-700">{detail}</p></Panel>
}
