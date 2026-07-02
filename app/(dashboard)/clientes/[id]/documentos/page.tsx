"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"
import { ArrowLeft, Check, ExternalLink, FileText, Link2, Loader2, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react"
import { Button, Input, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

const TZ = "America/Sao_Paulo"

type Doc = {
  id: string
  title: string
  category: string
  status: "DRAFT" | "APPROVED"
  visibility: "INTERNAL" | "CLIENT"
  fileUrl: string | null
  fileName: string | null
  externalUrl: string | null
  notes: string | null
  createdAt: string
  uploadedBy: { name: string }
  approvedBy: { name: string } | null
}

const CATEGORY_LABEL: Record<string, string> = {
  PROPOSTA: "Proposta",
  CONTRATO: "Contrato",
  BRIEFING: "Briefing",
  RELATORIO: "Relatório",
  CRIATIVO: "Criativo",
  ESTRATEGIA: "Estratégia",
  APRESENTACAO: "Apresentação",
  OUTRO: "Outro",
}
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL)

export default function DocumentosPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<string>("ALL")
  // CLIENTE vê só documentos aprovados + visíveis (a API já filtra), em modo download.
  const [canEdit, setCanEdit] = useState(false)
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then((d) => setCanEdit(d.role === "ADMIN" || d.role === "OPERADOR")).catch(() => {}) }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/documents`)
    const payload = await res.json()
    if (res.ok) setDocs(payload.documents)
    else setError(payload.error ?? "Não foi possível carregar os documentos.")
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(
    () => (filter === "ALL" ? docs : docs.filter((d) => d.category === filter)),
    [docs, filter]
  )

  async function approve(doc: Doc, approve: boolean) {
    setError("")
    const res = await fetch(`/api/clients/${clientId}/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: approve ? "APPROVE" : "UNAPPROVE" }),
    })
    if (!res.ok) { setError((await res.json()).error ?? "Erro ao atualizar."); return }
    await load()
  }

  async function setVisibility(doc: Doc, visibility: "INTERNAL" | "CLIENT") {
    setError("")
    const res = await fetch(`/api/clients/${clientId}/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    })
    if (!res.ok) { setError((await res.json()).error ?? "Erro ao atualizar."); return }
    await load()
  }

  async function remove(doc: Doc) {
    setError("")
    const res = await fetch(`/api/clients/${clientId}/documents/${doc.id}`, { method: "DELETE" })
    if (!res.ok) { setError((await res.json()).error ?? "Erro ao remover."); return }
    await load()
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link href={`/clientes/${clientId}`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100">
          <ArrowLeft size={18} />
        </Link>
        <PageHeader eyebrow="Documentos" title="Documentos do cliente" description={canEdit ? "Propostas, contratos, briefings, relatórios e criativos — arquivo ou link, com aprovação." : "Documentos disponíveis para download."} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>Todos</FilterChip>
          {CATEGORY_ORDER.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>{CATEGORY_LABEL[c]}</FilterChip>
          ))}
        </div>
        {canEdit && <Button onClick={() => setAdding((v) => !v)}><Plus size={16} /> Novo documento</Button>}
      </div>

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {canEdit && adding && <AddDocument clientId={clientId} onAdded={() => { setAdding(false); void load() }} onCancel={() => setAdding(false)} onError={setError} />}

      {loading ? (
        <Panel className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : filtered.length === 0 ? (
        <Panel className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
          <FileText size={30} className="text-zinc-700" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-300">Nenhum documento</h3>
          <p className="mt-2 max-w-sm text-sm text-zinc-600">{canEdit ? "Adicione propostas, contratos, briefings ou links de relatórios." : "Ainda não há documentos disponíveis para você."}</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <Panel key={doc.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-black/20">
                  {doc.externalUrl ? <Link2 size={16} className="text-sky-300" /> : <FileText size={16} className="text-[#FF8F50]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={doc.fileUrl ?? doc.externalUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-zinc-100 hover:text-[#FFB185]">
                      {doc.title}
                    </a>
                    <ExternalLink size={12} className="shrink-0 text-zinc-600" />
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-400">{CATEGORY_LABEL[doc.category]}</span>
                    <StatusBadge status={doc.status === "APPROVED" ? "healthy" : "attention"}>{doc.status === "APPROVED" ? "Aprovado" : "Rascunho"}</StatusBadge>
                    {doc.visibility === "CLIENT" && <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-300">Visível ao cliente</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {doc.fileName ? `${doc.fileName} · ` : ""}por {doc.uploadedBy.name} · {formatInTimeZone(new Date(doc.createdAt), TZ, "dd/MM/yyyy")}
                    {doc.approvedBy ? ` · aprovado por ${doc.approvedBy.name}` : ""}
                  </p>
                </div>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="secondary" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => setVisibility(doc, doc.visibility === "CLIENT" ? "INTERNAL" : "CLIENT")}>
                    {doc.visibility === "CLIENT" ? "Tornar interno" : "Mostrar ao cliente"}
                  </Button>
                  {doc.status === "APPROVED" ? (
                    <Button variant="secondary" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => approve(doc, false)}><RotateCcw size={13} /> Reabrir</Button>
                  ) : (
                    <Button className="min-h-8 px-2.5 py-1 text-xs" onClick={() => approve(doc, true)}><Check size={13} /> Aprovar</Button>
                  )}
                  <Button variant="danger" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => remove(doc)}><Trash2 size={13} /></Button>
                </div>
              ) : (
                <a href={doc.fileUrl ?? doc.externalUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10">
                  <ExternalLink size={13} /> Abrir
                </a>
              )}
            </Panel>
          ))}
        </div>
      )}
    </main>
  )
}

function AddDocument({ clientId, onAdded, onCancel, onError }: { clientId: string; onAdded: () => void; onCancel: () => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"file" | "link">("file")
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("PROPOSTA")
  const [visibility, setVisibility] = useState<"INTERNAL" | "CLIENT">("INTERNAL")
  const [file, setFile] = useState<File | null>(null)
  const [externalUrl, setExternalUrl] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!title.trim()) { onError("Informe o título."); return }
    if (mode === "file" && !file) { onError("Selecione um arquivo."); return }
    if (mode === "link" && !externalUrl.trim()) { onError("Informe o link."); return }
    setBusy(true)
    onError("")
    try {
      let fileUrl: string | undefined
      let fileName: string | undefined
      let fileType: string | undefined
      if (mode === "file" && file) {
        const form = new FormData()
        form.append("file", file)
        const up = await fetch("/api/uploads", { method: "POST", body: form })
        if (!up.ok) throw new Error((await up.json()).error ?? "Falha no upload.")
        const upData = await up.json()
        fileUrl = upData.url
        fileName = upData.name
        fileType = upData.type
      }
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, category, visibility,
          ...(mode === "file" ? { fileUrl, fileName, fileType } : { externalUrl }),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao salvar documento.")
      onAdded()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao adicionar documento.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="space-y-4 border-[#FF8F50]/20 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Novo documento</h2>
        <button onClick={onCancel} className="text-zinc-600 hover:text-white"><X size={18} /></button>
      </div>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
        <ModeTab active={mode === "file"} onClick={() => setMode("file")}><Upload size={14} /> Arquivo</ModeTab>
        <ModeTab active={mode === "link"} onClick={() => setMode("link")}><Link2 size={14} /> Link externo</ModeTab>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">Título</span><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do documento" /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm">
            {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
      </div>

      {mode === "file" ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 py-3 hover:border-white/25">
          <Upload size={16} className="text-zinc-500" />
          <span className="text-sm text-zinc-400">{file ? file.name : "Clique para anexar (PDF, imagem, doc…)"}</span>
          <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">Link (Google Drive, etc.)</span><Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://" /></label>
      )}

      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={visibility === "CLIENT"} onChange={(e) => setVisibility(e.target.checked ? "CLIENT" : "INTERNAL")} />
        Visível ao cliente (quando o portal externo existir)
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar</Button>
      </div>
    </Panel>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("rounded-lg border px-2.5 py-1 text-xs transition-colors", active ? "border-[#FF8F50]/40 bg-[#FF8F50]/15 text-[#FFB185]" : "border-white/10 text-zinc-400 hover:text-zinc-200")}>
      {children}
    </button>
  )
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium", active ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}>
      {children}
    </button>
  )
}
