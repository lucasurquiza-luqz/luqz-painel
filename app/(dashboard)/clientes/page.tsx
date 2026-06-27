"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Building2,
  ChevronRight,
  CircleCheck,
  CirclePause,
  DownloadCloud,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { Button, Input, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

interface Client {
  id: string
  name: string
  description: string | null
  active: boolean
  clickupFolderId: string | null
  statusReason: string | null
  statusChangedAt: string | null
  _count: { groups: number; messages: number }
}

type ImportReport = {
  dryRun: boolean
  totalCards: number
  totalClients: number
  matched: Array<{ client: string; card: string; fieldsToFill: string[]; contacts: number; team: number }>
  unmatchedClients: string[]
}

const EMPTY_FORM = { name: "", description: "", active: true, statusReason: "" }

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [role, setRole] = useState("")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState("")
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE")
  const [editingStatus, setEditingStatus] = useState<Client | null>(null)
  const [statusForm, setStatusForm] = useState({ active: true, reason: "" })
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editForm, setEditForm] = useState({ name: "", description: "" })
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importDone, setImportDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch("/api/clients")
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível carregar a carteira.")
      setLoading(false)
      return
    }
    setClients(payload.clients ?? [])
    setRole(payload.currentUser?.role ?? "")
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => ({
    total: clients.length,
    active: clients.filter((client) => client.active).length,
    inactive: clients.filter((client) => !client.active).length,
  }), [clients])

  const filteredClients = useMemo(() => clients.filter((client) => {
    const matchesFilter = filter === "ALL" || (filter === "ACTIVE" ? client.active : !client.active)
    const term = search.trim().toLocaleLowerCase("pt-BR")
    return matchesFilter && (!term || client.name.toLocaleLowerCase("pt-BR").includes(term))
  }), [clients, filter, search])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível criar o cliente.")
    } else {
      setShowForm(false)
      setForm(EMPTY_FORM)
      await load()
    }
    setSaving(false)
  }

  async function runGoogleImport() {
    setImportBusy(true)
    setError("")
    setSyncMessage("")
    const response = await fetch("/api/admin/google-import", { method: "POST" })
    const payload = await response.json()
    setImportBusy(false)
    if (!response.ok) { setError(payload.error ?? "Falha no auto-import do Google."); return }
    setSyncMessage(`Google (MCC): ${payload.report.configured} conta(s) configurada(s).${payload.report.unmatched.length ? ` Sem cliente: ${payload.report.unmatched.join(", ")}` : ""}`)
  }

  async function approveAllContext() {
    if (!window.confirm("Aprovar (ativar) todo o contexto importado de toda a carteira? Itens versionados ficam de fora.")) return
    setImportBusy(true)
    setError("")
    setSyncMessage("")
    const response = await fetch("/api/admin/context/approve-all", { method: "POST" })
    const payload = await response.json()
    setImportBusy(false)
    if (!response.ok) { setError(payload.error ?? "Falha ao aprovar contexto."); return }
    setSyncMessage(`${payload.approved} item(ns) de contexto aprovado(s) e ativado(s) na carteira.`)
  }

  async function runImport(dryRun: boolean) {
    setImportBusy(true)
    setError("")
    const response = await fetch("/api/admin/clickup-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    })
    const payload = await response.json()
    setImportBusy(false)
    if (!response.ok) { setError(payload.error ?? "Falha na importação do ClickUp."); return }
    setImportReport(payload.report)
    if (!dryRun) { setImportDone(true); await load() }
  }

  async function syncRoster() {
    setSyncing(true)
    setError("")
    setSyncMessage("")
    const response = await fetch("/api/clients/import", { method: "POST" })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível sincronizar a carteira.")
      setSyncing(false)
      return
    }
    setSyncMessage(`${payload.created} criados · ${payload.updated} atualizados · ${payload.unchanged} sem alteração`)
    setSyncing(false)
    await load()
  }

  function openStatus(client: Client) {
    setEditingStatus(client)
    setStatusForm({ active: client.active, reason: client.statusReason ?? "" })
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    setEditForm({ name: client.name, description: client.description ?? "" })
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingClient) return
    if (!editForm.name.trim()) { setError("O nome não pode ficar vazio."); return }
    setSaving(true)
    setError("")
    const response = await fetch(`/api/clients/${editingClient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name.trim(), description: editForm.description.trim() || null }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível salvar o cliente.")
      setSaving(false)
      return
    }
    setEditingClient(null)
    setSaving(false)
    await load()
  }

  async function saveStatus(event: React.FormEvent) {
    event.preventDefault()
    if (!editingStatus) return
    setSaving(true)
    setError("")
    const response = await fetch(`/api/clients/${editingStatus.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: statusForm.active, statusReason: statusForm.reason }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? "Não foi possível alterar o status.")
      setSaving(false)
      return
    }
    setEditingStatus(null)
    setSaving(false)
    await load()
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Carteira LUQZ"
        title="Clientes"
        description="Uma visão única da carteira, com status operacional explícito e histórico preservado."
        actions={<>
          {role === "ADMIN" && (
            <Button variant="secondary" onClick={syncRoster} disabled={syncing}>
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sincronizar carteira
            </Button>
          )}
          {role === "ADMIN" && (
            <Button variant="secondary" onClick={() => { setImportDone(false); void runImport(true) }} disabled={importBusy}>
              {importBusy ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
              Importar do ClickUp
            </Button>
          )}
          {role === "ADMIN" && (
            <Button variant="secondary" onClick={runGoogleImport} disabled={importBusy}>
              {importBusy ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />} Importar Google (MCC)
            </Button>
          )}
          {role === "ADMIN" && (
            <Button variant="secondary" onClick={approveAllContext} disabled={importBusy}>
              <CircleCheck size={16} /> Aprovar contexto da carteira
            </Button>
          )}
          <Button onClick={() => setShowForm((current) => !current)}><Plus size={16} /> Novo cliente</Button>
        </>}
      />

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {syncMessage && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">Carteira sincronizada: {syncMessage}</div>}

      {showForm && (
        <Panel className="border-[#FF8F50]/20 p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="dash-eyebrow">Cadastro manual</p><h2 className="mt-2 text-lg font-semibold text-white">Novo cliente</h2></div><button type="button" onClick={() => setShowForm(false)} className="text-zinc-600 hover:text-white"><X size={18} /></button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome do cliente" /></Field>
              <Field label="Descrição opcional"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Escopo ou observação curta" /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Status inicial"><StatusSelect value={form.active} onChange={(active) => setForm({ ...form, active, statusReason: active ? "" : form.statusReason })} /></Field>
              {!form.active && <Field label="Motivo da inativação"><Input required value={form.statusReason} onChange={(event) => setForm({ ...form, statusReason: event.target.value })} placeholder="Por que este cliente está inativo?" /></Field>}
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Criar cliente</Button></div>
          </form>
        </Panel>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Carteira cadastrada" value={counts.total} icon={Building2} />
        <Metric label="Clientes ativos" value={counts.active} icon={CircleCheck} tone="active" />
        <Metric label="Clientes inativos" value={counts.inactive} icon={CirclePause} tone="inactive" />
      </section>

      <Panel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-700" /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente..." /></div>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
            {(["ACTIVE", "INACTIVE", "ALL"] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={cn("rounded-md px-3 py-2 text-xs font-medium", filter === value ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-300")}>{value === "ACTIVE" ? "Ativos" : value === "INACTIVE" ? "Inativos" : "Todos"}</button>)}
          </div>
        </div>
      </Panel>

      {loading ? (
        <Panel className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></Panel>
      ) : filteredClients.length === 0 ? (
        <Panel className="flex min-h-64 flex-col items-center justify-center text-center"><Building2 size={34} className="text-zinc-800" /><p className="mt-4 text-sm font-medium text-zinc-400">Nenhum cliente encontrado</p><p className="mt-1 text-sm text-zinc-700">Ajuste a busca ou sincronize o roster oficial.</p></Panel>
      ) : (
        <section className="space-y-2">
          {filteredClients.map((client) => (
            <Panel key={client.id} className={cn("flex flex-col gap-4 p-4 sm:flex-row sm:items-center", !client.active && "opacity-75")}>
              <Link href={`/clientes/${client.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-offset-4">
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", client.active ? "border-[#FF8F50]/20 bg-[#FF8F50]/10" : "border-white/8 bg-white/[0.03]")}><Building2 size={18} className={client.active ? "text-[#FF8F50]" : "text-zinc-700"} /></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-zinc-100">{client.name}</p><StatusBadge status={client.active ? "healthy" : "unknown"}>{client.active ? "Ativo" : "Inativo"}</StatusBadge></div><p className="mt-1 truncate text-xs text-zinc-600">{client._count.groups} grupos · {client._count.messages} mensagens{client.description ? ` · ${client.description}` : ""}</p>{!client.active && client.statusReason && <p className="mt-1 truncate text-xs text-zinc-700">{client.statusReason}</p>}</div>
                <ChevronRight size={16} className="shrink-0 text-zinc-700" />
              </Link>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => openEdit(client)}><Pencil size={13} /> Editar</Button>
                <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => openStatus(client)}>Status</Button>
              </div>
            </Panel>
          ))}
        </section>
      )}

      {editingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-lg border-white/15 p-6 shadow-2xl">
            <form onSubmit={saveStatus} className="space-y-5">
              <div className="flex items-start justify-between gap-4"><div><p className="dash-eyebrow">Status do cliente</p><h2 className="mt-2 text-xl font-semibold text-white">{editingStatus.name}</h2></div><button type="button" onClick={() => setEditingStatus(null)} className="text-zinc-600 hover:text-white"><X size={18} /></button></div>
              <Field label="Novo status"><StatusSelect value={statusForm.active} onChange={(active) => setStatusForm({ active, reason: active ? "" : statusForm.reason })} /></Field>
              {!statusForm.active && <Field label="Motivo da inativação"><textarea required rows={3} value={statusForm.reason} onChange={(event) => setStatusForm({ ...statusForm, reason: event.target.value })} className="dash-input w-full resize-none rounded-lg px-3.5 py-3 text-sm" placeholder="Registre o motivo para preservar o contexto operacional." /></Field>}
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs leading-5 text-zinc-600">A alteração será registrada no histórico com data, responsável e origem manual.</div>
              <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingStatus(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : null} Salvar status</Button></div>
            </form>
          </Panel>
        </div>
      )}

      {importReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <Panel className="flex max-h-[85vh] w-full max-w-2xl flex-col border-white/15 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="dash-eyebrow">Importação do ClickUp</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{importDone ? "Importação concluída" : "Pré-visualização"}</h2>
              </div>
              <button type="button" onClick={() => setImportReport(null)} className="text-zinc-600 hover:text-white"><X size={18} /></button>
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              {importReport.matched.length} de {importReport.totalClients} clientes ativos casaram com um card do ClickUp ({importReport.totalCards} cards lidos).
              {importDone ? " Campos vazios preenchidos." : " Só campos vazios serão preenchidos — nada é sobrescrito."}
            </p>

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
              {importReport.matched.map((m) => (
                <div key={m.client} className="rounded-lg border border-white/8 bg-black/20 px-4 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-200">{m.client}</span>
                    <span className="text-xs text-zinc-600">
                      {m.fieldsToFill.length} campo(s){m.contacts ? ` · ${m.contacts} contato(s)` : ""}{m.team ? ` · ${m.team} resp.` : ""}
                    </span>
                  </div>
                  {m.fieldsToFill.length > 0 && <p className="mt-1 text-xs text-zinc-600">{m.fieldsToFill.join(", ")}</p>}
                </div>
              ))}
              {importReport.unmatchedClients.length > 0 && (
                <div className="rounded-lg border border-amber-400/15 bg-amber-500/[0.06] px-4 py-2.5 text-xs text-amber-200/80">
                  Sem card no ClickUp ({importReport.unmatchedClients.length}): {importReport.unmatchedClients.join(", ")}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-white/8 pt-4">
              <Button variant="secondary" onClick={() => setImportReport(null)}>Fechar</Button>
              {!importDone && (
                <Button onClick={() => runImport(false)} disabled={importBusy || importReport.matched.length === 0}>
                  {importBusy ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />} Aplicar importação
                </Button>
              )}
            </div>
          </Panel>
        </div>
      )}

      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-lg border-white/15 p-6 shadow-2xl">
            <form onSubmit={saveEdit} className="space-y-5">
              <div className="flex items-start justify-between gap-4"><div><p className="dash-eyebrow">Editar cliente</p><h2 className="mt-2 text-xl font-semibold text-white">Dados do cliente</h2></div><button type="button" onClick={() => setEditingClient(null)} className="text-zinc-600 hover:text-white"><X size={18} /></button></div>
              <Field label="Nome"><Input required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} placeholder="Nome do cliente" /></Field>
              <Field label="Descrição opcional"><Input value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} placeholder="Escopo ou observação curta" /></Field>
              <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingClient(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : null} Salvar</Button></div>
            </form>
          </Panel>
        </div>
      )}
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-400">{label}</span>{children}</label>
}

function StatusSelect({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onChange(true)} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium", value ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-zinc-600")}><CircleCheck size={15} /> Ativo</button><button type="button" onClick={() => onChange(false)} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium", !value ? "border-white/20 bg-white/[0.07] text-zinc-200" : "border-white/10 text-zinc-600")}><CirclePause size={15} /> Inativo</button></div>
}

function Metric({ label, value, icon: Icon, tone = "default" }: { label: string; value: number; icon: React.ComponentType<{ size?: number; className?: string }>; tone?: "default" | "active" | "inactive" }) {
  const color = tone === "active" ? "text-emerald-400" : tone === "inactive" ? "text-zinc-600" : "text-[#FF8F50]"
  return <Panel className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-zinc-500">{label}</p><Icon size={17} className={color} /></div><p className="dash-display mt-4 text-3xl text-white">{value}</p></Panel>
}
