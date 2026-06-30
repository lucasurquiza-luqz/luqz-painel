"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowLeft, Pencil, Check, Clock, FileText, Link2, Upload, Paperclip, Trash2, Plus, RefreshCw } from "lucide-react"
import { PageHeader, Panel, Button } from "@/components/ui/primitives"
import { TasksView } from "@/components/TasksView"
import { PerformanceSummaryCard } from "@/components/PerformanceSummaryCard"
import { cn } from "@/lib/utils"

const KIND: Record<string, string> = { CONTEUDO: "Produção de Conteúdo", TRAFEGO: "Tráfego", ONBOARDING: "Onboarding", WEB: "Web/LP", COMERCIAL: "Comercial", OUTRO: "Outro" }
const STATUS: Record<string, string> = { ATIVO: "Ativo", PAUSADO: "Pausado", CONCLUIDO: "Concluído", ARQUIVADO: "Arquivado" }
const inp = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF8F50]/40 focus:outline-none"

type ProjLink = { label: string; url: string; category?: string | null }
type Project = { id: string; name: string; description: string | null; kind: string; notes: string | null; objectives: string | null; links: ProjLink[] | null; memberIds: string[]; status: string; startDate: string | null; dueDate: string | null; ownerId: string | null; clientId: string | null; client: { id: string; name: string } | null }
type Data = { project: Project; counts: { total: number; done: number }; activity: { id: string; type: string; userName: string | null; payload: Record<string, unknown> | null; createdAt: string }[] }
type Ref = { id: string; name: string }

export default function ProjetoWorkspace() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [team, setTeam] = useState<Ref[]>([])
  const [tab, setTab] = useState("overview")
  const [editing, setEditing] = useState(false)

  async function deleteProject() {
    if (!confirm("Excluir este projeto e TODAS as suas tarefas? Esta ação não pode ser desfeita.")) return
    await fetch(`/api/projects/${id}`, { method: "DELETE" })
    router.push(data?.project.clientId ? `/clientes/${data.project.clientId}/projetos` : "/clientes")
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`)
    const d = await res.json().catch(() => ({}))
    if (res.ok) setData(d)
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => { fetch("/api/team").then((r) => r.json()).then((d) => setTeam(d.users ?? [])).catch(() => {}) }, [])

  if (!data) return <div className="flex min-h-60 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
  const p = data.project
  const pct = data.counts.total > 0 ? Math.round((data.counts.done / data.counts.total) * 100) : 0
  const ownerName = team.find((u) => u.id === p.ownerId)?.name ?? null

  const tabs = [["overview", "Visão geral"], ["tasks", "Tarefas"], ["recur", "Recorrentes"], ["docs", "Documentos"], ...(p.clientId ? [["perf", "Performance"]] : []), ["history", "Histórico"]] as [string, string][]

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link href="/projetos" className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><ArrowLeft size={18} /></Link>
        <PageHeader eyebrow={`${KIND[p.kind]} · ${STATUS[p.status]}${p.client ? " · " + p.client.name : " · Interno"}`} title={p.name} description={p.description ?? "Workspace do projeto"} />
      </div>

      <div className="flex flex-wrap gap-4 border-b border-white/8 text-sm">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("-mb-px border-b-2 pb-2 font-medium transition", tab === k ? "border-[#FF8F50] text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}>{label}{k === "tasks" && data.counts.total > 0 ? ` (${data.counts.done}/${data.counts.total})` : ""}</button>
        ))}
      </div>

      {tab === "overview" && (
        editing
          ? <EditConfig project={p} team={team} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load() }} />
          : (
            <div className="space-y-4">
              <div className="flex justify-end"><Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => setEditing(true)}><Pencil size={13} /> Editar cadastro</Button></div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Info label="Tipo" value={KIND[p.kind]} />
                <Info label="Status" value={STATUS[p.status]} />
                <Info label="Responsável" value={ownerName ?? "—"} />
                <Info label="Prazo" value={p.dueDate ? new Date(p.dueDate).toLocaleDateString("pt-BR") : "—"} />
              </div>
              <Panel className="p-5">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-zinc-300">Progresso</span><span className="text-xs text-zinc-500">{data.counts.done}/{data.counts.total} tarefas · {pct}%</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-[#FF8F50]" style={{ width: `${pct}%` }} /></div>
              </Panel>
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel className="p-5">
                  <p className="mb-2 text-xs font-semibold text-zinc-300">🎯 Objetivos</p>
                  {p.objectives ? <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{p.objectives}</p> : <p className="text-sm text-zinc-600">Sem objetivos definidos.</p>}
                </Panel>
                <Panel className="p-5">
                  <p className="mb-2 text-xs font-semibold text-zinc-300">👥 Pessoas</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {ownerName && <span className="flex items-center gap-1.5 text-sm text-zinc-200"><PAvatar name={ownerName} /> {ownerName} <span className="text-[10px] text-zinc-600">(resp.)</span></span>}
                    {p.memberIds.map((mid) => { const n = team.find((u) => u.id === mid)?.name; return n ? <span key={mid} className="flex items-center gap-1.5 text-sm text-zinc-300"><PAvatar name={n} /> {n}</span> : null })}
                    {!ownerName && !p.memberIds.length && <p className="text-sm text-zinc-600">Ninguém atribuído.</p>}
                  </div>
                </Panel>
              </div>
              <Panel className="p-5">
                <p className="mb-2 text-xs font-semibold text-zinc-300">📄 Documentação / briefing</p>
                {p.notes ? <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{p.notes}</p> : <p className="text-sm text-zinc-600">Sem documentação ainda. Clique em Editar cadastro para escrever o briefing/escopo.</p>}
              </Panel>
              <Panel className="p-5">
                <p className="mb-2 text-xs font-semibold text-zinc-300">🔗 Links & acessos</p>
                {p.links && p.links.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {p.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-[#FFB185] hover:bg-white/5">{l.label} ↗</a>)}
                  </div>
                ) : <p className="text-sm text-zinc-600">Sem links cadastrados (site, Drive, Analytics, Ads…).</p>}
              </Panel>
              <button onClick={deleteProject} className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-red-300"><Trash2 size={12} /> Excluir projeto</button>
            </div>
          )
      )}

      {tab === "tasks" && <TasksView projectId={id} embedded />}
      {tab === "recur" && <RecurrencesTab projectId={id} team={team} />}
      {tab === "docs" && <DocumentsTab projectId={id} canUpload={!!p.clientId} />}
      {tab === "perf" && p.client && <PerformanceSummaryCard clientId={p.client.id} />}
      {tab === "history" && (
        <Panel className="p-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-300"><Clock size={13} /> Histórico do projeto</p>
          <div className="space-y-2 text-[12px]">
            {data.activity.map((a) => (
              <div key={a.id} className="flex gap-2"><span className="text-zinc-600">·</span><div><p className="text-zinc-300">{a.type === "CREATED" ? "Projeto criado" : a.type === "EDITED" ? "Configuração editada" : a.type}</p><p className="text-[10px] text-zinc-600">{a.userName ?? "sistema"} · {new Date(a.createdAt).toLocaleString("pt-BR")}</p></div></div>
            ))}
            {!data.activity.length && <p className="text-zinc-600">Sem histórico ainda.</p>}
          </div>
        </Panel>
      )}
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <Panel className="p-4"><p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p><p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p></Panel>
}

const AV_COLORS = ["#FF8F50", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#22d3ee"]
function PAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  const color = AV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length]
  return <span style={{ background: `${color}26`, color }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">{initials}</span>
}

function EditConfig({ project, team, onClose, onSaved }: { project: Project; team: Ref[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: project.name, kind: project.kind, status: project.status, ownerId: project.ownerId ?? "",
    description: project.description ?? "", notes: project.notes ?? "", objectives: project.objectives ?? "",
    startDate: project.startDate ? project.startDate.slice(0, 10) : "", dueDate: project.dueDate ? project.dueDate.slice(0, 10) : "",
  })
  const [members, setMembers] = useState<string[]>(project.memberIds ?? [])
  const [links, setLinks] = useState<ProjLink[]>(project.links ?? [])
  const [busy, setBusy] = useState(false)
  const toggleMember = (id: string) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const setLink = (i: number, k: "label" | "url", v: string) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  async function save() {
    setBusy(true)
    await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, memberIds: members, links: links.filter((l) => l.url.trim()) }) })
    setBusy(false); onSaved()
  }
  return (
    <Panel className="space-y-4 p-5">
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome do projeto" className={cn(inp, "text-base font-semibold")} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Tipo"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inp}>{Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inp}>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Responsável"><select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })} className={inp}><option value="">—</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Prazo"><input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className={cn(inp, "[color-scheme:dark]")} /></Field>
      </div>
      <Field label="Descrição curta"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inp} /></Field>
      <Field label="Objetivos / metas"><textarea value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} rows={3} placeholder="O que esse projeto precisa alcançar…" className={cn(inp, "resize-none")} /></Field>
      <Field label="Documentação (briefing, escopo)"><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={6} className={cn(inp, "resize-none")} /></Field>

      {/* Pessoas envolvidas */}
      <div>
        <p className="mb-1.5 text-[11px] text-zinc-500">Pessoas envolvidas</p>
        <div className="flex flex-wrap gap-2">
          {team.map((u) => (
            <button key={u.id} type="button" onClick={() => toggleMember(u.id)} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs", members.includes(u.id) ? "border-[#FF8F50]/50 bg-[#FF8F50]/15 text-[#FFB185]" : "border-white/10 text-zinc-400")}>
              <PAvatar name={u.name} /> {u.name}
            </button>
          ))}
        </div>
      </div>

      {/* Links & acessos */}
      <div>
        <p className="mb-1.5 text-[11px] text-zinc-500">Links & acessos (site, Drive, Analytics, Ads…)</p>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input value={l.label} onChange={(e) => setLink(i, "label", e.target.value)} placeholder="Rótulo" className={cn(inp, "flex-1")} />
              <input value={l.url} onChange={(e) => setLink(i, "url", e.target.value)} placeholder="https://…" className={cn(inp, "flex-[2]")} />
              <button type="button" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))} className="px-2 text-zinc-600 hover:text-red-300"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}>+ link</Button>
        </div>
      </div>

      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <><Check size={15} /> Salvar</>}</Button></div>
    </Panel>
  )
}

type Doc = { id: string; title: string; category: string; fileUrl: string | null; externalUrl: string | null; uploadedBy?: { name: string } | null }
function DocumentsTab({ projectId, canUpload }: { projectId: string; canUpload: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [available, setAvailable] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [linkForm, setLinkForm] = useState({ title: "", externalUrl: "" })
  const [attachId, setAttachId] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/projects/${projectId}/documents`)
    const d = await res.json().catch(() => ({}))
    setDocs(d.documents ?? []); setAvailable(d.available ?? [])
    setLoading(false)
  }, [projectId])
  useEffect(() => { void load() }, [load])

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    await fetch(`/api/projects/${projectId}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setBusy(false); await load()
  }
  async function attach() { if (attachId) { await post({ docId: attachId }); setAttachId("") } }
  async function addLink() { if (linkForm.title && linkForm.externalUrl) { await post(linkForm); setLinkForm({ title: "", externalUrl: "" }) } }
  async function upload(file: File) {
    setBusy(true)
    const fd = new FormData(); fd.append("file", file)
    const up = await fetch("/api/uploads", { method: "POST", body: fd })
    const u = await up.json().catch(() => ({}))
    if (up.ok) await fetch(`/api/projects/${projectId}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: u.name ?? file.name, fileUrl: u.url, fileName: u.name, fileType: u.type }) })
    setBusy(false); await load()
  }
  async function detach(docId: string) { await fetch(`/api/projects/${projectId}/documents?docId=${docId}`, { method: "DELETE" }); await load() }

  if (loading) return <div className="flex min-h-24 items-center justify-center"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>

  return (
    <div className="space-y-4">
      {canUpload && (
        <Panel className="space-y-3 p-4">
          <p className="text-xs font-semibold text-zinc-300">Adicionar documento ao projeto</p>
          {available.length > 0 && (
            <div className="flex gap-2">
              <select value={attachId} onChange={(e) => setAttachId(e.target.value)} className={inp}><option value="">Anexar documento existente do cliente…</option>{available.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
              <Button variant="secondary" onClick={attach} disabled={busy || !attachId}><Paperclip size={14} /> Anexar</Button>
            </div>
          )}
          <div className="flex gap-2">
            <input value={linkForm.title} onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })} placeholder="Título do link" className={inp} />
            <input value={linkForm.externalUrl} onChange={(e) => setLinkForm({ ...linkForm, externalUrl: e.target.value })} placeholder="https://…" className={inp} />
            <Button variant="secondary" onClick={addLink} disabled={busy || !linkForm.title || !linkForm.externalUrl}><Link2 size={14} /> Link</Button>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5">
            <Upload size={14} /> Enviar arquivo
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </Panel>
      )}

      {docs.length === 0 ? (
        <Panel className="p-6 text-center text-sm text-zinc-600">Nenhum documento atrelado a este projeto.</Panel>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const isImg = !!d.fileUrl && /\.(png|jpe?g|webp|gif|avif)$/i.test(d.fileUrl)
            return (
            <Panel key={d.id} className="flex items-center gap-3 p-3">
              {isImg
                ? <img src={d.fileUrl!} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                : <FileText size={16} className="shrink-0 text-[#FF8F50]" />}
              <div className="min-w-0 flex-1">
                <a href={d.fileUrl ?? d.externalUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-zinc-100 hover:underline">{d.title}</a>
                <p className="text-[11px] text-zinc-600">{d.category}{d.uploadedBy ? ` · ${d.uploadedBy.name}` : ""}</p>
              </div>
              <button onClick={() => detach(d.id)} title="Desatrelar do projeto" className="shrink-0 text-zinc-600 hover:text-red-300"><Trash2 size={14} /></button>
            </Panel>
          )})}
        </div>
      )}
    </div>
  )
}

const FREQ: Record<string, string> = { DIARIA: "Diária", SEMANAL: "Semanal", MENSAL: "Mensal" }
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const PRIO_REC: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" }
type Recur = { id: string; title: string; freq: string; interval: number; weekday: number | null; dayOfMonth: number | null; priority: string; assigneeId: string | null; active: boolean; nextRunAt: string }

function RecurrencesTab({ projectId, team }: { projectId: string; team: Ref[] }) {
  const [items, setItems] = useState<Recur[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [f, setF] = useState({ title: "", freq: "SEMANAL", interval: 1, weekday: 1, dayOfMonth: 1, priority: "MEDIA", assigneeId: "", startDate: "" })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await (await fetch(`/api/projects/${projectId}/recurrences`)).json().catch(() => ({}))
    setItems(d.recurrences ?? []); setLoading(false)
  }, [projectId])
  useEffect(() => { void load() }, [load])

  async function create() {
    if (!f.title.trim()) return
    setBusy(true)
    await fetch(`/api/projects/${projectId}/recurrences`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
    setBusy(false); setCreating(false); setF({ ...f, title: "" }); await load()
  }
  async function toggle(r: Recur) { await fetch(`/api/recurrences/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !r.active }) }); await load() }
  async function remove(id: string) { if (!confirm("Excluir esta recorrência? (as tarefas já geradas permanecem)")) return; await fetch(`/api/recurrences/${id}`, { method: "DELETE" }); await load() }

  const rule = (r: Recur) => r.freq === "SEMANAL" ? `${FREQ[r.freq]} (${r.interval > 1 ? `a cada ${r.interval}sem · ` : ""}${r.weekday != null ? WEEKDAYS[r.weekday] : ""})` : r.freq === "MENSAL" ? `${FREQ[r.freq]} (dia ${r.dayOfMonth ?? "?"}${r.interval > 1 ? ` · a cada ${r.interval}m` : ""})` : `${FREQ[r.freq]}${r.interval > 1 ? ` (a cada ${r.interval}d)` : ""}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Moldes que geram tarefas automaticamente (o sistema cria a tarefa na data).</p>
        <Button onClick={() => setCreating((v) => !v)}><Plus size={15} /> Nova recorrência</Button>
      </div>

      {creating && (
        <Panel className="space-y-3 p-4">
          <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Título da tarefa recorrente" className={inp} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Frequência"><select value={f.freq} onChange={(e) => setF({ ...f, freq: e.target.value })} className={inp}>{Object.entries(FREQ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="A cada"><input type="number" min={1} value={f.interval} onChange={(e) => setF({ ...f, interval: Number(e.target.value) })} className={inp} /></Field>
            {f.freq === "SEMANAL" && <Field label="Dia da semana"><select value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })} className={inp}>{WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}</select></Field>}
            {f.freq === "MENSAL" && <Field label="Dia do mês"><input type="number" min={1} max={31} value={f.dayOfMonth} onChange={(e) => setF({ ...f, dayOfMonth: Number(e.target.value) })} className={inp} /></Field>}
            <Field label="Responsável"><select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} className={inp}><option value="">—</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Prioridade"><select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={inp}>{Object.entries(PRIO_REC).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Começa em"><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={cn(inp, "[color-scheme:dark]")} /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={create} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : "Criar recorrência"}</Button></div>
        </Panel>
      )}

      {loading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 size={18} className="animate-spin text-[#FF8F50]" /></div>
      ) : items.length === 0 ? (
        <Panel className="p-6 text-center text-sm text-zinc-600">Nenhuma recorrência. Crie um molde pra gerar tarefas automaticamente.</Panel>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <Panel key={r.id} className="flex items-center gap-3 p-3">
              <RefreshCw size={15} className={cn("shrink-0", r.active ? "text-[#FF8F50]" : "text-zinc-700")} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", r.active ? "text-zinc-100" : "text-zinc-500")}>{r.title}</p>
                <p className="text-[11px] text-zinc-500">{rule(r)} · próximo: {new Date(r.nextRunAt).toLocaleDateString("pt-BR")}{r.assigneeId ? ` · ${team.find((u) => u.id === r.assigneeId)?.name ?? ""}` : ""}</p>
              </div>
              <button onClick={() => toggle(r)} className={cn("shrink-0 rounded-md px-2 py-1 text-[11px]", r.active ? "text-emerald-300 hover:bg-white/5" : "text-zinc-500 hover:bg-white/5")}>{r.active ? "Ativa" : "Pausada"}</button>
              <button onClick={() => remove(r.id)} className="shrink-0 text-zinc-600 hover:text-red-300"><Trash2 size={14} /></button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">{label}</span>{children}</label>
}
