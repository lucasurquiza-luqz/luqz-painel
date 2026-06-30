"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, X, CircleDot, Clock, MessageSquare, Trash2, CornerDownRight, Check, Copy } from "lucide-react"
import { PageHeader, Panel, Button } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

const STATUS: { v: string; label: string; tone: string }[] = [
  { v: "BACKLOG", label: "Backlog", tone: "text-zinc-400" },
  { v: "TODO", label: "A fazer", tone: "text-sky-300" },
  { v: "DOING", label: "Fazendo", tone: "text-[#FFB185]" },
  { v: "REVIEW", label: "Revisão", tone: "text-violet-300" },
  { v: "DONE", label: "Concluído", tone: "text-emerald-300" },
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

// Avatar estilo ClickUp: iniciais em círculo colorido (cor derivada do nome).
const AV_COLORS = ["#FF8F50", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#22d3ee", "#fb7185"]
function Avatar({ name, size = 22 }: { name: string | null; size?: number }) {
  const n = name?.trim() || "?"
  const initials = n === "?" ? "?" : n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  const color = AV_COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length]
  return (
    <span style={{ width: size, height: size, background: `${color}26`, color, fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold leading-none" title={name ?? undefined}>
      {initials}
    </span>
  )
}

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
  const [view, setView] = useState<"list" | "board">("list")
  const [quickAdd, setQuickAdd] = useState("")
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)
  const [closing, setClosing] = useState<string | null>(null) // tarefa aguardando o "resultado" pra fechar
  const [meName, setMeName] = useState<string | null>(null)
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then((d) => setMeName(d.name ?? null)).catch(() => {}) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (clientId) qs.set("clientId", clientId)
    if (projectId) qs.set("projectId", projectId)
    if (mine) qs.set("assignee", "me")
    if (onlyOpen && view === "list") qs.set("open", "1") // no quadro, mostra todas (inclui coluna Concluído)
    const res = await fetch(`/api/tasks?${qs}`)
    const data = await res.json().catch(() => ({}))
    setTasks(data.tasks ?? [])
    setLoading(false)
  }, [clientId, projectId, mine, onlyOpen, view])
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
  // Mudar status: fechar (DONE) exige o resultado → abre o modal.
  function changeStatus(id: string, status: string) {
    if (status === "DONE") setClosing(id)
    else patch(id, { status })
  }
  async function confirmClose(result: string) {
    const id = closing!
    const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DONE", result }) })
    if (res.ok) { const d = await res.json(); setTasks((ts) => ts.map((t) => (t.id === id ? d.task : t))); if (selected?.id === id) setSelected(d.task) }
    setClosing(null)
  }
  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    setTasks((ts) => ts.filter((t) => t.id !== id)); setSelected(null)
  }
  // Quick-add (só quando o projeto é fixo — a tarefa precisa de projeto).
  async function createQuick(status?: string) {
    if (!quickAdd.trim() || !projectId) return
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: quickAdd.trim(), projectId, status: status ?? "TODO" }) })
    if (res.ok) { const d = await res.json(); setTasks((ts) => [d.task, ...ts]); setQuickAdd("") }
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-white/8 bg-black/20 p-0.5">
          <Toggle on={view === "list"} onClick={() => setView("list")}>Lista</Toggle>
          <Toggle on={view === "board"} onClick={() => setView("board")}>Quadro</Toggle>
        </div>
        <Toggle on={mine} onClick={() => setMine((v) => !v)}>Minhas</Toggle>
        {view === "list" && <Toggle on={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>Só abertas</Toggle>}
      </div>

      {projectId && canCreate && (
        <input value={quickAdd} onChange={(e) => setQuickAdd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createQuick()} placeholder="+ Adicionar tarefa rápida (Enter)" className="w-full rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF8F50]/40 focus:outline-none" />
      )}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : !canCreate ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Crie um <b className="text-zinc-400">projeto</b> primeiro — tarefas vivem dentro de projetos.</Panel>
      ) : view === "board" ? (
        <Board tasks={tasks} showProject={!projectId} onOpen={setSelected} onDrop={changeStatus} />
      ) : tasks.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Nenhuma tarefa. Crie a primeira em “Nova tarefa”.</Panel>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Panel key={t.id} className="flex items-center gap-3 p-3">
              <select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value)} onClick={(e) => e.stopPropagation()}
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
              {t.assignee ? <Avatar name={t.assignee.name} /> : <span className="hidden text-[11px] text-zinc-700 sm:inline">sem resp.</span>}
            </Panel>
          ))}
        </div>
      )}

      {creating && <CreateModal team={team} projects={projects} fixedProjectId={projectId} onClose={() => setCreating(false)} onCreated={(t) => { setTasks((ts) => [t, ...ts]); setCreating(false) }} />}
      {selected && <TaskDrawer task={selected} team={team} projects={projects} meName={meName} onClose={() => setSelected(null)} onPatch={patch} onStatus={changeStatus} onRemove={remove} onChanged={load} />}
      {closing && <ResultModal onClose={() => setClosing(null)} onConfirm={confirmClose} />}
    </Wrapper>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", on ? "bg-[#FF8F50] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10")}>{children}</button>
}

// Kanban: colunas por status, cartões arrastáveis (drop → muda status; DONE pede resultado).
function Board({ tasks, showProject, onOpen, onDrop }: { tasks: Task[]; showProject: boolean; onOpen: (t: Task) => void; onDrop: (id: string, status: string) => void }) {
  const [over, setOver] = useState<string | null>(null)
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS.map((col) => {
        const items = tasks.filter((t) => t.status === col.v)
        return (
          <div key={col.v}
            onDragOver={(e) => { e.preventDefault(); setOver(col.v) }}
            onDragLeave={() => setOver((o) => (o === col.v ? null : o))}
            onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); setOver(null); if (id) onDrop(id, col.v) }}
            className={cn("flex w-64 shrink-0 flex-col rounded-xl border bg-black/20 p-2", over === col.v ? "border-[#FF8F50]/40" : "border-white/8")}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className={cn("text-xs font-semibold", col.tone)}>{col.label}</span>
              <span className="text-[10px] text-zinc-600">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  onClick={() => onOpen(t)}
                  className="cursor-pointer rounded-lg border border-white/8 bg-[#161616] p-2.5 hover:border-white/15">
                  <p className={cn("text-[13px] font-medium", t.status === "DONE" ? "text-zinc-500 line-through" : "text-zinc-100")}>{t.title}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${PRIORITY[t.priority]?.cls}`}>{PRIORITY[t.priority]?.label}</span>
                      {t.dueDate && <span className={cn("text-[10px]", isOverdue(t) ? "text-red-300" : "text-zinc-600")}>{fmtDay(t.dueDate)}</span>}
                    </span>
                    {t.assignee && <Avatar name={t.assignee.name} size={20} />}
                  </div>
                  {showProject && t.project && <p className="mt-1.5 truncate text-[10px] text-zinc-600">{t.client ? t.client.name + " · " : ""}{t.project.name}</p>}
                </div>
              ))}
              {!items.length && <p className="px-1 py-3 text-center text-[10px] text-zinc-700">—</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
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

function TaskDrawer({ task, team, projects, meName, onClose, onPatch, onStatus, onRemove, onChanged }: { task: Task; team: Ref[]; projects: Proj[]; meName: string | null; onClose: () => void; onPatch: (id: string, d: Record<string, unknown>) => void; onStatus: (id: string, status: string) => void; onRemove: (id: string) => void; onChanged: () => void }) {
  const [activity, setActivity] = useState<Activity[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [desc, setDesc] = useState("")
  const [comment, setComment] = useState("")
  const [newSub, setNewSub] = useState("")
  const [busy, setBusy] = useState(false)
  const subDone = subtasks.filter((s) => s.status === "DONE").length

  const reload = useCallback(async () => {
    const res = await fetch(`/api/tasks/${task.id}`)
    const d = await res.json().catch(() => ({}))
    setActivity(d.activity ?? [])
    setSubtasks(d.task?.subtasks ?? [])
    setDesc(d.task?.description ?? "")
  }, [task.id])
  useEffect(() => { void reload() }, [reload])

  async function duplicate() { setBusy(true); await fetch(`/api/tasks/${task.id}/duplicate`, { method: "POST" }); setBusy(false); onChanged(); onClose() }
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
  const st = STATUS.find((s) => s.v === task.status)

  return (
    <Overlay onClose={onClose} size="xl" bare>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-6 py-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] text-zinc-500">{task.client ? task.client.name + " › " : ""}{task.project?.name ?? "—"}</p>
          <input value={task.title} onChange={(e) => onPatch(task.id, { title: e.target.value })} className="w-full bg-transparent text-lg font-semibold text-white focus:outline-none" />
        </div>
        <button onClick={onClose} className="shrink-0 text-zinc-500 hover:text-white"><X size={18} /></button>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_240px]">
        {/* Coluna principal */}
        <div className="space-y-5 border-white/8 p-6 md:border-r">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Descrição</p>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => onPatch(task.id, { description: desc })} placeholder="Detalhe a tarefa…" rows={3} className={cn(inp, "resize-none")} />
          </div>

          {/* Subtarefas */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600"><CornerDownRight size={13} /> Subtarefas</p>
              {subtasks.length > 0 && <span className="text-[10px] text-zinc-600">{subDone}/{subtasks.length}</span>}
            </div>
            {subtasks.length > 0 && <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${(subDone / subtasks.length) * 100}%` }} /></div>}
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
              <input value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubtask()} placeholder="+ Adicionar subtarefa" className={cn(inp, "flex-1")} />
            </div>
          </div>

          {/* Atividade / Histórico */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600"><Clock size={13} /> Atividade & histórico</p>
            <div className="flex items-center gap-2">
              <Avatar name={meName} size={26} />
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendComment()} placeholder="Escreva um comentário…" className={cn(inp, "flex-1")} />
              <Button onClick={sendComment} disabled={busy || !comment.trim()}><MessageSquare size={14} /></Button>
            </div>
            <div className="mt-4 space-y-3">
              {activity.map((a) => a.type === "COMMENTED" ? (
                // Comentário: card com avatar + nome + texto (estilo ClickUp)
                <div key={a.id} className="flex gap-2.5">
                  <Avatar name={a.userName} size={26} />
                  <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-white/[0.04] px-3 py-2">
                    <p className="text-[11px]"><span className="font-semibold text-zinc-200">{a.userName ?? "Alguém"}</span> <span className="text-zinc-600">· {new Date(a.createdAt).toLocaleString("pt-BR")}</span></p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-5 text-zinc-200">{String(a.payload?.body ?? "")}</p>
                  </div>
                </div>
              ) : (
                // Evento do sistema: linha discreta com avatar pequeno
                <div key={a.id} className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Avatar name={a.userName} size={18} />
                  <span className={cn(a.type === "COMPLETED" && "text-emerald-300")}>{describe(a)}</span>
                  <span className="text-zinc-700">· {new Date(a.createdAt).toLocaleString("pt-BR")}</span>
                </div>
              ))}
              {!activity.length && <p className="text-[11px] text-zinc-600">Sem atividade ainda.</p>}
            </div>
          </div>
        </div>

        {/* Sidebar de propriedades */}
        <div className="space-y-3 p-6">
          <Field label="Status">
            <select value={task.status} onChange={(e) => onStatus(task.id, e.target.value)} className={cn(inp, st && "font-medium", st?.tone)}>{STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select>
          </Field>
          <Field label="Responsável"><select value={task.assignee?.id ?? ""} onChange={(e) => onPatch(task.id, { assigneeId: e.target.value })} className={inp}><option value="">—</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Prioridade"><select value={task.priority} onChange={(e) => onPatch(task.id, { priority: e.target.value })} className={inp}>{Object.entries(PRIORITY).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}</select></Field>
          <Field label="Prazo"><input type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ""} onChange={(e) => onPatch(task.id, { dueDate: e.target.value || null })} className={cn(inp, "[color-scheme:dark]")} /></Field>
          <Field label="Projeto"><select value={task.project?.id ?? ""} onChange={(e) => { if (e.target.value) onPatch(task.id, { projectId: e.target.value }) }} className={inp}>{projects.map((p) => <option key={p.id} value={p.id}>{projLabel(p)}</option>)}</select></Field>
          <div className="space-y-2 border-t border-white/8 pt-3">
            <button onClick={duplicate} disabled={busy} className="flex w-full items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-100"><Copy size={13} /> Duplicar tarefa</button>
            <button onClick={() => onRemove(task.id)} className="flex w-full items-center gap-1.5 text-[12px] text-zinc-500 hover:text-red-300"><Trash2 size={13} /> Excluir tarefa</button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

// Modal de conclusão: exige o RESULTADO antes de fechar a tarefa.
function ResultModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (result: string) => void }) {
  const [result, setResult] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <Overlay onClose={onClose} title="Concluir tarefa">
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">Descreva o <b className="text-zinc-300">resultado</b> da tarefa. Sem isso ela não pode ser fechada.</p>
        <textarea autoFocus value={result} onChange={(e) => setResult(e.target.value)} rows={4} placeholder="O que foi entregue / resultado…" className={cn(inp, "resize-none")} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy || !result.trim()} onClick={() => { setBusy(true); onConfirm(result.trim()) }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <><Check size={15} /> Concluir</>}</Button>
        </div>
      </div>
    </Overlay>
  )
}

function describe(a: Activity): string {
  const p = a.payload ?? {}
  switch (a.type) {
    case "CREATED": return p.duplicatedFrom ? "Tarefa criada (duplicada)" : "Tarefa criada"
    case "STATUS_CHANGED": return `Status: ${STATUS_LABEL[p.from as string] ?? p.from} → ${STATUS_LABEL[p.to as string] ?? p.to}`
    case "COMPLETED": return p.result ? `Concluída ✓ — ${p.result}` : "Concluída ✓"
    case "ASSIGNED": return p.to ? "Responsável alterado" : "Responsável removido"
    case "DUE_DATE": return p.to ? `Prazo: ${new Date(p.to as string).toLocaleDateString("pt-BR")}` : "Prazo removido"
    case "MOVED": return "Movida de projeto"
    case "COMMENTED": return String(p.body ?? "")
    case "EDITED": return `Editou ${p.field ?? "campo"}`
    default: return a.type
  }
}

const inp = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF8F50]/40 focus:outline-none"
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">{label}</span>{children}</label>
}
function Overlay({ title, size = "lg", bare, onClose, children }: { title?: string; size?: "lg" | "xl"; bare?: boolean; onClose: () => void; children: React.ReactNode }) {
  const max = size === "xl" ? "max-w-3xl" : "max-w-lg"
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={cn("mt-12 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl", max)} onClick={(e) => e.stopPropagation()}>
        {bare ? children : (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-white">{title}</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
