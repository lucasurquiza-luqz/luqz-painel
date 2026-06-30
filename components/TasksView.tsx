"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, X, CircleDot, Clock, MessageSquare, Trash2, CornerDownRight, Check, Copy } from "lucide-react"
import { PageHeader, Panel, Button } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

const STATUS: { v: string; label: string }[] = [
  { v: "BACKLOG", label: "Backlog" },
  { v: "TODO", label: "A fazer" },
  { v: "DOING", label: "Fazendo" },
  { v: "REVIEW", label: "Revisão" },
  { v: "DONE", label: "Concluído" },
]
const STATUS_LABEL = Object.fromEntries(STATUS.map((s) => [s.v, s.label]))
const PRIORITY: Record<string, { label: string; cls: string }> = {
  BAIXA: { label: "Baixa", cls: "bg-white/5 text-zinc-400" },
  MEDIA: { label: "Média", cls: "bg-sky-500/15 text-sky-300" },
  ALTA: { label: "Alta", cls: "bg-amber-500/15 text-amber-300" },
  URGENTE: { label: "Urgente", cls: "bg-red-500/15 text-red-300" },
}

type Ref = { id: string; name: string }
type Proj = { id: string; name: string; clientName: string | null }
type Task = {
  id: string; title: string; status: string; priority: string; dueDate: string | null; completedAt: string | null
  assignee: Ref | null; project: Ref | null; client: Ref | null; createdAt: string
}
type Subtask = { id: string; title: string; status: string; assignee: { name: string } | null }
type Activity = { id: string; type: string; userName: string | null; payload: Record<string, unknown> | null; createdAt: string }

const isOverdue = (t: Task) => !!t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < new Date(new Date().toDateString())
const fmtDay = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null)

export function TasksView({ clientId, projectId, embedded }: { clientId?: string; projectId?: string; embedded?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<Ref[]>([])
  const [projects, setProjects] = useState<Proj[]>([])
  const [projectInfo, setProjectInfo] = useState<{ name: string; clientName: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState(false)
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (clientId) qs.set("clientId", clientId)
    if (projectId) qs.set("projectId", projectId)
    if (mine) qs.set("assignee", "me")
    if (onlyOpen) qs.set("open", "1")
    const res = await fetch(`/api/tasks?${qs}`)
    const data = await res.json().catch(() => ({}))
    setTasks(data.tasks ?? [])
    setLoading(false)
  }, [clientId, projectId, mine, onlyOpen])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    fetch("/api/team").then((r) => r.json()).then((d) => setTeam(d.users ?? [])).catch(() => {})
    fetch(`/api/projects${clientId ? `?clientId=${clientId}` : ""}`).then((r) => r.json())
      .then((d) => setProjects((d.projects ?? []).map((p: { id: string; name: string; client: { name: string } | null }) => ({ id: p.id, name: p.name, clientName: p.client?.name ?? null }))))
      .catch(() => {})
    if (projectId) fetch(`/api/projects/${projectId}`).then((r) => r.json()).then((d) => d.project && setProjectInfo({ name: d.project.name, clientName: d.project.client?.name ?? null })).catch(() => {})
  }, [clientId, projectId])

  async function patch(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    if (res.ok) { const d = await res.json(); setTasks((ts) => ts.map((t) => (t.id === id ? d.task : t))); if (selected?.id === id) setSelected(d.task) }
  }
  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    setTasks((ts) => ts.filter((t) => t.id !== id)); setSelected(null)
  }

  const title = projectId ? (projectInfo?.name ?? "Projeto") : "Tarefas"
  const subtitle = projectId
    ? `${projectInfo?.clientName ? projectInfo.clientName + " · " : "Interno · "}Tarefas do projeto`
    : "Toda tarefa vive num projeto. Cliente vem do projeto. Cada tarefa tem histórico e subtarefas."
  const canCreate = projectId || projects.length > 0

  const Wrapper = embedded ? "div" : "main"
  return (
    <Wrapper className={embedded ? "space-y-4" : "mx-auto max-w-6xl space-y-5 p-6 lg:p-8"}>
      <div className="flex items-center justify-between gap-3">
        {embedded ? <span /> : <PageHeader eyebrow={projectId ? "Projeto" : "Operação"} title={title} description={subtitle} />}
        {canCreate && <Button onClick={() => setCreating(true)}><Plus size={16} /> Nova tarefa</Button>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Toggle on={mine} onClick={() => setMine((v) => !v)}>Minhas</Toggle>
        <Toggle on={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>Só abertas</Toggle>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : !canCreate ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Crie um <b className="text-zinc-400">projeto</b> primeiro — tarefas vivem dentro de projetos.</Panel>
      ) : tasks.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Nenhuma tarefa. Crie a primeira em “Nova tarefa”.</Panel>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Panel key={t.id} className="flex items-center gap-3 p-3">
              <select value={t.status} onChange={(e) => patch(t.id, { status: e.target.value })} onClick={(e) => e.stopPropagation()}
                className="shrink-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-200 [color-scheme:dark]">
                {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
              <button onClick={() => setSelected(t)} className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className={cn("truncate text-sm font-medium", t.status === "DONE" ? "text-zinc-500 line-through" : "text-zinc-100")}>{t.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  {!projectId && t.project && <span className="rounded bg-white/5 px-1.5 py-0.5">{t.project.name}</span>}
                  {!clientId && !projectId && t.client && <span className="text-orange-400/70">{t.client.name}</span>}
                  <span className={`rounded px-1.5 py-0.5 ${PRIORITY[t.priority]?.cls}`}>{PRIORITY[t.priority]?.label}</span>
                </span>
              </button>
              {t.dueDate && <span className={cn("shrink-0 text-[11px]", isOverdue(t) ? "text-red-300" : "text-zinc-500")}>{fmtDay(t.dueDate)}{isOverdue(t) ? " ⚠" : ""}</span>}
              <span className="hidden shrink-0 text-[11px] text-zinc-500 sm:inline">{t.assignee?.name ?? "sem responsável"}</span>
            </Panel>
          ))}
        </div>
      )}

      {creating && <CreateModal team={team} projects={projects} fixedProjectId={projectId} onClose={() => setCreating(false)} onCreated={(t) => { setTasks((ts) => [t, ...ts]); setCreating(false) }} />}
      {selected && <TaskDrawer task={selected} team={team} projects={projects} onClose={() => setSelected(null)} onPatch={patch} onRemove={remove} onChanged={load} />}
    </Wrapper>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", on ? "bg-[#FF8F50] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10")}>{children}</button>
}

function projLabel(p: Proj) { return p.clientName ? `${p.clientName} · ${p.name}` : `Interno · ${p.name}` }

function CreateModal({ team, projects, fixedProjectId, onClose, onCreated }: { team: Ref[]; projects: Proj[]; fixedProjectId?: string; onClose: () => void; onCreated: (t: Task) => void }) {
  const [f, setF] = useState({ title: "", description: "", assigneeId: "", projectId: fixedProjectId ?? "", priority: "MEDIA", dueDate: "" })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function submit() {
    if (!f.title.trim()) { setErr("Informe o título."); return }
    if (!f.projectId) { setErr("Escolha um projeto."); return }
    setBusy(true); setErr("")
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(d.error ?? "Erro ao criar."); return }
    onCreated(d.task)
  }

  return (
    <Overlay onClose={onClose} title="Nova tarefa">
      <div className="space-y-3">
        <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Título da tarefa" className={inp} />
        <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Descrição (opcional)" rows={3} className={cn(inp, "resize-none")} />
        <div className="grid grid-cols-2 gap-3">
          {!fixedProjectId && <Field label="Projeto"><select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className={inp}><option value="">— escolher —</option>{projects.map((p) => <option key={p.id} value={p.id}>{projLabel(p)}</option>)}</select></Field>}
          <Field label="Responsável"><select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} className={inp}><option value="">—</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Prioridade"><select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={inp}>{Object.entries(PRIORITY).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}</select></Field>
          <Field label="Prazo"><input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className={cn(inp, "[color-scheme:dark]")} /></Field>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : "Criar tarefa"}</Button></div>
      </div>
    </Overlay>
  )
}

function TaskDrawer({ task, team, projects, onClose, onPatch, onRemove, onChanged }: { task: Task; team: Ref[]; projects: Proj[]; onClose: () => void; onPatch: (id: string, d: Record<string, unknown>) => void; onRemove: (id: string) => void; onChanged: () => void }) {
  const [activity, setActivity] = useState<Activity[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [comment, setComment] = useState("")
  const [newSub, setNewSub] = useState("")
  const [busy, setBusy] = useState(false)

  async function duplicate() {
    setBusy(true)
    await fetch(`/api/tasks/${task.id}/duplicate`, { method: "POST" })
    setBusy(false); onChanged(); onClose()
  }

  const reload = useCallback(async () => {
    const res = await fetch(`/api/tasks/${task.id}`)
    const d = await res.json().catch(() => ({}))
    setActivity(d.activity ?? [])
    setSubtasks(d.task?.subtasks ?? [])
  }, [task.id])
  useEffect(() => { void reload() }, [reload])

  async function sendComment() {
    if (!comment.trim()) return
    setBusy(true)
    await fetch(`/api/tasks/${task.id}/comment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment }) })
    setComment(""); setBusy(false); await reload()
  }
  async function addSubtask() {
    if (!newSub.trim() || !task.project) return
    setBusy(true)
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newSub, projectId: task.project.id, parentTaskId: task.id }) })
    setNewSub(""); setBusy(false); await reload()
  }
  async function toggleSub(s: Subtask) {
    await fetch(`/api/tasks/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s.status === "DONE" ? "TODO" : "DONE" }) })
    await reload()
  }

  return (
    <Overlay onClose={onClose} title="Detalhes da tarefa" wide>
      <div className="space-y-4">
        <input value={task.title} onChange={(e) => onPatch(task.id, { title: e.target.value })} className={cn(inp, "text-base font-semibold")} />
        {(task.project || task.client) && (
          <p className="text-[11px] text-zinc-500">{task.client ? task.client.name + " › " : ""}{task.project?.name}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status"><select value={task.status} onChange={(e) => onPatch(task.id, { status: e.target.value })} className={inp}>{STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></Field>
          <Field label="Responsável"><select value={task.assignee?.id ?? ""} onChange={(e) => onPatch(task.id, { assigneeId: e.target.value })} className={inp}><option value="">—</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Prioridade"><select value={task.priority} onChange={(e) => onPatch(task.id, { priority: e.target.value })} className={inp}>{Object.entries(PRIORITY).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}</select></Field>
          <Field label="Prazo"><input type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ""} onChange={(e) => onPatch(task.id, { dueDate: e.target.value || null })} className={cn(inp, "[color-scheme:dark]")} /></Field>
          <Field label="Mover para projeto"><select value={task.project?.id ?? ""} onChange={(e) => { if (e.target.value) onPatch(task.id, { projectId: e.target.value }) }} className={inp}>{projects.map((p) => <option key={p.id} value={p.id}>{projLabel(p)}</option>)}</select></Field>
        </div>

        {/* Subtarefas */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-300"><CornerDownRight size={13} /> Subtarefas ({subtasks.length})</p>
          <div className="space-y-1">
            {subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1.5 text-[12px]">
                <button onClick={() => toggleSub(s)} className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", s.status === "DONE" ? "border-emerald-400 bg-emerald-400/20 text-emerald-300" : "border-white/20")}>{s.status === "DONE" && <Check size={11} />}</button>
                <span className={cn("min-w-0 flex-1 truncate", s.status === "DONE" ? "text-zinc-600 line-through" : "text-zinc-200")}>{s.title}</span>
                {s.assignee && <span className="shrink-0 text-[10px] text-zinc-600">{s.assignee.name}</span>}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubtask()} placeholder="Adicionar subtarefa…" className={cn(inp, "flex-1")} />
            <Button onClick={addSubtask} disabled={busy}><Plus size={14} /></Button>
          </div>
        </div>

        {/* Histórico */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-300"><Clock size={13} /> Histórico</p>
          <div className="flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendComment()} placeholder="Comentar…" className={cn(inp, "flex-1")} />
            <Button onClick={sendComment} disabled={busy}><MessageSquare size={14} /></Button>
          </div>
          <div className="mt-3 space-y-2.5">
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2 text-[12px]">
                <CircleDot size={12} className="mt-0.5 shrink-0 text-zinc-600" />
                <div className="min-w-0">
                  <p className="text-zinc-300">{describe(a)}</p>
                  <p className="text-[10px] text-zinc-600">{a.userName ?? "sistema"} · {new Date(a.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
            {!activity.length && <p className="text-[11px] text-zinc-600">Sem histórico ainda.</p>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={duplicate} disabled={busy} className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-200"><Copy size={12} /> Duplicar</button>
          <button onClick={() => onRemove(task.id)} className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-red-300"><Trash2 size={12} /> Excluir tarefa</button>
        </div>
      </div>
    </Overlay>
  )
}

function describe(a: Activity): string {
  const p = a.payload ?? {}
  switch (a.type) {
    case "CREATED": return "Tarefa criada"
    case "STATUS_CHANGED": return `Status: ${STATUS_LABEL[p.from as string] ?? p.from} → ${STATUS_LABEL[p.to as string] ?? p.to}`
    case "COMPLETED": return "Concluída ✓"
    case "ASSIGNED": return p.to ? "Responsável alterado" : "Responsável removido"
    case "DUE_DATE": return p.to ? `Prazo: ${new Date(p.to as string).toLocaleDateString("pt-BR")}` : "Prazo removido"
    case "COMMENTED": return String(p.body ?? "")
    case "EDITED": return `Editou ${p.field ?? "campo"}`
    default: return a.type
  }
}

const inp = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF8F50]/40 focus:outline-none"
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">{label}</span>{children}</label>
}
function Overlay({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={cn("mt-12 w-full rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-white">{title}</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}
