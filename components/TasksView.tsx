"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, X, Clock, MessageSquare, Trash2, CornerDownRight, Check, Copy, Circle, User, Flag, CalendarDays, Folder, AlignLeft, Repeat, ChevronDown } from "lucide-react"
import { PageHeader, Panel, Button } from "@/components/ui/primitives"
import { Pop, MenuItem, PickerSelect } from "@/components/ui/Picker"
import { cn } from "@/lib/utils"

const STATUS: { v: string; label: string; tone: string }[] = [
  { v: "BACKLOG", label: "Backlog", tone: "text-zinc-400" },
  { v: "TODO", label: "A fazer", tone: "text-sky-300" },
  { v: "DOING", label: "Fazendo", tone: "text-[#FFB185]" },
  { v: "REVIEW", label: "Revisão", tone: "text-violet-300" },
  { v: "DONE", label: "Concluído", tone: "text-emerald-300" },
]
const STATUS_LABEL = Object.fromEntries(STATUS.map((s) => [s.v, s.label]))
const STATUS_PILL: Record<string, string> = {
  BACKLOG: "bg-zinc-500/20 text-zinc-300", TODO: "bg-sky-500/20 text-sky-300", DOING: "bg-[#FF8F50]/20 text-[#FFB185]",
  REVIEW: "bg-violet-500/20 text-violet-300", DONE: "bg-emerald-500/20 text-emerald-300",
}
const PRIORITY: Record<string, { label: string; cls: string }> = {
  BAIXA: { label: "Baixa", cls: "bg-white/5 text-zinc-400" },
  MEDIA: { label: "Média", cls: "bg-sky-500/15 text-sky-300" },
  ALTA: { label: "Alta", cls: "bg-amber-500/15 text-amber-300" },
  URGENTE: { label: "Urgente", cls: "bg-red-500/15 text-red-300" },
}

const REPEAT_LABEL: Record<string, string> = { DIARIA: "Diária", SEMANAL: "Semanal", MENSAL: "Mensal" }
const WD_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const WD_INIT = ["D", "S", "T", "Q", "Q", "S", "S"]
type RecurPayload = { freq: string; interval: number; weekdays: number[] }

function recurLabel(r: RecurPayload | null): string {
  if (!r) return "Não repete"
  if (r.freq === "SEMANAL" && r.weekdays?.length) {
    if (r.weekdays.length === 7) return "Todo dia"
    const days = r.weekdays.slice().sort((a, b) => a - b).map((w) => WD_SHORT[w]).join(", ")
    return r.interval > 1 ? `${days} · a cada ${r.interval} sem` : days
  }
  if (r.interval > 1) { const u = r.freq === "DIARIA" ? "dias" : r.freq === "SEMANAL" ? "semanas" : "meses"; return `A cada ${r.interval} ${u}` }
  return REPEAT_LABEL[r.freq] ?? "Repete"
}

// Campo "Repetir" reutilizável: presets + personalizado (estilo ClickUp).
function RecurField({ value, onChange, trigger }: { value: RecurPayload | null; onChange: (v: RecurPayload | null) => void; trigger: React.ReactNode }) {
  const [custom, setCustom] = useState(false)
  return (
    <>
      <Pop trigger={trigger}>
        {(close) => <>
          <MenuItem active={!value} onClick={() => { onChange(null); close() }}>Não repete</MenuItem>
          {Object.entries(REPEAT_LABEL).map(([v, l]) => <MenuItem key={v} active={value?.freq === v && value.interval === 1 && !value.weekdays?.length} onClick={() => { onChange({ freq: v, interval: 1, weekdays: [] }); close() }}><Repeat size={12} /> {l}</MenuItem>)}
          <MenuItem onClick={() => { setCustom(true); close() }}>Personalizado…</MenuItem>
        </>}
      </Pop>
      {custom && <RecurEditor initial={value} onClose={() => setCustom(false)} onSave={(v) => { onChange(v); setCustom(false) }} />}
    </>
  )
}

function RecurEditor({ initial, onClose, onSave }: { initial: RecurPayload | null; onClose: () => void; onSave: (v: RecurPayload) => void }) {
  const [freq, setFreq] = useState(initial?.freq && initial.freq !== "DIARIA" ? initial.freq : initial?.freq ?? "SEMANAL")
  const [interval, setIntervalN] = useState(initial?.interval ?? 1)
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? [])
  const toggle = (w: number) => setWeekdays((ds) => (ds.includes(w) ? ds.filter((x) => x !== w) : [...ds, w]))
  return (
    <Overlay title="Repetição personalizada" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <Field label="A cada"><input type="number" min={1} value={interval} onChange={(e) => setIntervalN(Math.max(1, Number(e.target.value)))} className={cn(inp, "w-20")} /></Field>
          <Field label="Período"><select value={freq} onChange={(e) => setFreq(e.target.value)} className={inp}><option value="DIARIA">dia(s)</option><option value="SEMANAL">semana(s)</option><option value="MENSAL">mês(es)</option></select></Field>
        </div>
        {freq === "SEMANAL" && (
          <div>
            <p className="mb-1.5 text-[11px] text-zinc-500">Nos dias da semana</p>
            <div className="flex gap-1.5">
              {WD_INIT.map((w, i) => (
                <button key={i} type="button" title={WD_SHORT[i]} onClick={() => toggle(i)} className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition", weekdays.includes(i) ? "bg-[#FF8F50] text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10")}>{w}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-600">Vazio = usa o dia do prazo da tarefa.</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ freq, interval, weekdays: freq === "SEMANAL" ? weekdays.slice().sort((a, b) => a - b) : [] })}><Check size={15} /> Aplicar</Button>
        </div>
      </div>
    </Overlay>
  )
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
  const [fPriority, setFPriority] = useState("")        // filtro por prioridade
  const [sortBy, setSortBy] = useState("due")           // due | priority | recent
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [err, setErr] = useState("")
  const flash = (m: string) => { setErr(m); setTimeout(() => setErr(""), 4000) }
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
    else flash((await res.json().catch(() => ({})))?.error ?? "Não foi possível salvar.")
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
    else flash((await res.json().catch(() => ({})))?.error ?? "Não foi possível concluir.")
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
    else flash((await res.json().catch(() => ({})))?.error ?? "Não foi possível criar.")
  }

  // Filtro (prioridade) + ordenação, aplicados sobre as tarefas carregadas.
  const PRIO_ORDER: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 }
  const visibleTasks = tasks
    .filter((t) => !fPriority || t.priority === fPriority)
    .slice()
    .sort((a, b) => {
      if (sortBy === "priority") return (PRIO_ORDER[a.priority] ?? 9) - (PRIO_ORDER[b.priority] ?? 9)
      if (sortBy === "recent") return b.createdAt.localeCompare(a.createdAt)
      return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") // due: prazo asc, sem prazo por último
    })

  function togglePick(id: string) { setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  async function bulk(data: Record<string, unknown>) {
    await Promise.all([...picked].map((id) => fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })))
    setPicked(new Set()); await load()
  }
  async function bulkDelete() {
    if (!confirm(`Excluir ${picked.size} tarefa(s)?`)) return
    await Promise.all([...picked].map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" })))
    setPicked(new Set()); await load()
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
        <span className="rounded-lg border border-white/8 bg-black/20 px-1">
          <PickerSelect value={fPriority} onChange={setFPriority} placeholder="Prioridade: todas" options={[{ value: "", label: "Prioridade: todas" }, ...Object.entries(PRIORITY).map(([v, p]) => ({ value: v, label: p.label }))]} />
        </span>
        <span className="rounded-lg border border-white/8 bg-black/20 px-1">
          <PickerSelect value={sortBy} onChange={setSortBy} options={[{ value: "due", label: "Ordenar: prazo" }, { value: "priority", label: "Ordenar: prioridade" }, { value: "recent", label: "Ordenar: recentes" }]} />
        </span>
      </div>

      {projectId && canCreate && (
        <input value={quickAdd} onChange={(e) => setQuickAdd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createQuick()} placeholder="+ Adicionar tarefa rápida (Enter)" className="w-full rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF8F50]/40 focus:outline-none" />
      )}

      {/* Barra de ações em massa */}
      {picked.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-[#FF8F50]/30 bg-[#1a1410] px-3 py-2 text-xs">
          <span className="font-medium text-[#FFB185]">{picked.size} selecionada(s)</span>
          <select onChange={(e) => { if (e.target.value) bulk({ status: e.target.value }); e.target.value = "" }} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-200 [color-scheme:dark]">
            <option value="">Status…</option>{STATUS.filter((s) => s.v !== "DONE").map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
          <select value="" onChange={(e) => { if (e.target.value) bulk({ assigneeId: e.target.value === "__none" ? null : e.target.value }) }} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-200 [color-scheme:dark]">
            <option value="">Responsável…</option><option value="__none">— remover —</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select onChange={(e) => { if (e.target.value) bulk({ priority: e.target.value }); e.target.value = "" }} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-200 [color-scheme:dark]">
            <option value="">Prioridade…</option>{Object.entries(PRIORITY).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
          </select>
          <input type="date" onChange={(e) => { if (e.target.value) bulk({ dueDate: e.target.value }) }} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-200 [color-scheme:dark]" />
          <select onChange={(e) => { if (e.target.value) bulk({ projectId: e.target.value }); e.target.value = "" }} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-200 [color-scheme:dark]">
            <option value="">Mover p/ projeto…</option>{projects.map((p) => <option key={p.id} value={p.id}>{projLabel(p)}</option>)}
          </select>
          <button onClick={bulkDelete} className="rounded-md px-2 py-1 text-red-300 hover:bg-red-500/10">Excluir</button>
          <button onClick={() => setPicked(new Set())} className="rounded-md px-2 py-1 text-zinc-500 hover:text-zinc-300">Limpar</button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : !canCreate ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Crie um <b className="text-zinc-400">projeto</b> primeiro — tarefas vivem dentro de projetos.</Panel>
      ) : view === "board" ? (
        <Board tasks={visibleTasks} showProject={!projectId} onOpen={setSelected} onDrop={changeStatus} />
      ) : visibleTasks.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Nenhuma tarefa{fPriority ? " com esse filtro" : ""}.</Panel>
      ) : (
        // Lista agrupada por status (estilo ClickUp)
        <div className="space-y-4">
          {STATUS.map((s) => {
            const group = visibleTasks.filter((t) => t.status === s.v)
            if (!group.length) return null
            return (
              <div key={s.v}>
                <p className={cn("mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide", s.tone)}>
                  <span className={cn("rounded px-1.5 py-0.5", STATUS_PILL[s.v])}>{s.label}</span>
                  <span className="text-zinc-600">{group.length}</span>
                </p>
                <div className="space-y-1.5">
                  {group.map((t) => (
                    <Panel key={t.id} className={cn("flex items-center gap-3 p-3", picked.has(t.id) && "border-[#FF8F50]/40")}>
                      <input type="checkbox" checked={picked.has(t.id)} onChange={() => togglePick(t.id)} className="shrink-0 accent-[#FF8F50]" />
                      <span className="shrink-0">
                        <Pop trigger={<span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase", STATUS_PILL[t.status])}>{STATUS_LABEL[t.status]}</span>}>
                          {(close) => STATUS.map((o) => <MenuItem key={o.v} active={o.v === t.status} onClick={() => { changeStatus(t.id, o.v); close() }}><span className={cn("h-2 w-2 rounded-full", STATUS_DOT[o.v])} /> {o.label}</MenuItem>)}
                        </Pop>
                      </span>
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
              </div>
            )
          })}
        </div>
      )}

      {err && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-950/80 px-4 py-2 text-sm text-red-200 shadow-xl backdrop-blur">{err}</div>}

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
  const [repeat, setRepeat] = useState<RecurPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function submit() {
    if (!f.title.trim()) { setErr("Informe o título."); return }
    if (!f.projectId) { setErr("Escolha um projeto."); return }
    setBusy(true); setErr("")
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setBusy(false); setErr(d.error ?? "Erro ao criar."); return }
    // Recorrência definida já na criação (cadência puxada do prazo ou dos dias escolhidos).
    if (repeat && d.task?.id) await fetch(`/api/tasks/${d.task.id}/recur`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(repeat) })
    setBusy(false)
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
          <Field label="Repetir">
            <div className={cn(inp, "flex items-center py-1")}>
              <RecurField value={repeat} onChange={setRepeat} trigger={<span className="flex items-center gap-1.5 text-sm text-zinc-200">{recurLabel(repeat)}<ChevronDown size={13} className="text-zinc-600" /></span>} />
            </div>
          </Field>
        </div>
        {repeat && <p className="-mt-1 text-[11px] text-zinc-500">{repeat.freq === "SEMANAL" && repeat.weekdays.length ? "Repete nos dias escolhidos." : "A cadência segue o prazo da tarefa"}{repeat.freq !== "SEMANAL" || !repeat.weekdays.length ? (!f.dueDate ? " (defina um prazo, ou usa a data de hoje como base)." : ".") : ""}</p>}
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : "Criar tarefa"}</Button></div>
      </div>
    </Overlay>
  )
}

function TaskDrawer({ task, team, projects, meName, onClose, onPatch, onStatus, onRemove, onChanged }: { task: Task; team: Ref[]; projects: Proj[]; meName: string | null; onClose: () => void; onPatch: (id: string, d: Record<string, unknown>) => void; onStatus: (id: string, status: string) => void; onRemove: (id: string) => void; onChanged: () => void }) {
  const [activity, setActivity] = useState<Activity[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [recur, setRecur] = useState<RecurPayload | null>(null)
  const [desc, setDesc] = useState("")
  const [titleVal, setTitleVal] = useState(task.title)
  const [comment, setComment] = useState("")
  const [newSub, setNewSub] = useState("")
  const [busy, setBusy] = useState(false)
  const subDone = subtasks.filter((s) => s.status === "DONE").length
  useEffect(() => { setTitleVal(task.title) }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    const res = await fetch(`/api/tasks/${task.id}`)
    const d = await res.json().catch(() => ({}))
    setActivity(d.activity ?? [])
    setSubtasks(d.task?.subtasks ?? [])
    setRecur(d.recurrence ? { freq: d.recurrence.freq, interval: d.recurrence.interval, weekdays: d.recurrence.weekdays ?? [] } : null)
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
  async function setRecurrence(v: RecurPayload | null) {
    if (!v) await fetch(`/api/tasks/${task.id}/recur`, { method: "DELETE" })
    else await fetch(`/api/tasks/${task.id}/recur`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) })
    await reload()
  }
  return (
    <Overlay onClose={onClose} size="xxl" bare>
      <div className="flex h-[85vh] min-h-0">
        {/* ===== Painel principal ===== */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-zinc-400">Tarefa</span>
            <span className="text-zinc-700">·</span>
            {task.client ? `${task.client.name} › ` : ""}{task.project?.name ?? "—"}
          </p>
          <input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} onBlur={() => titleVal.trim() && titleVal !== task.title && onPatch(task.id, { title: titleVal.trim() })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="Título da tarefa" className="mb-5 w-full bg-transparent text-2xl font-semibold text-white placeholder:text-zinc-600 focus:outline-none" />

          {/* Propriedades em linhas (estilo ClickUp) */}
          <div className="space-y-0.5">
            <PropRow icon={<Circle size={13} />} label="Status">
              <Pop trigger={<span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase", STATUS_PILL[task.status])}>{STATUS_LABEL[task.status]}</span>}>
                {(close) => STATUS.map((s) => (
                  <MenuItem key={s.v} active={s.v === task.status} onClick={() => { onStatus(task.id, s.v); close() }}>
                    <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s.v])} /> {s.label}
                  </MenuItem>
                ))}
              </Pop>
            </PropRow>
            <PropRow icon={<User size={13} />} label="Responsável">
              <Pop trigger={<span className="flex items-center gap-1.5 text-sm text-zinc-200"><Avatar name={task.assignee?.name ?? null} size={20} />{task.assignee?.name ?? <span className="text-zinc-500">Não atribuído</span>}</span>}>
                {(close) => <>
                  <MenuItem active={!task.assignee} onClick={() => { onPatch(task.id, { assigneeId: "" }); close() }}><Avatar name={null} size={18} /> Não atribuído</MenuItem>
                  {team.map((u) => <MenuItem key={u.id} active={u.id === task.assignee?.id} onClick={() => { onPatch(task.id, { assigneeId: u.id }); close() }}><Avatar name={u.name} size={18} /> {u.name}</MenuItem>)}
                </>}
              </Pop>
            </PropRow>
            <PropRow icon={<Flag size={13} />} label="Prioridade">
              <Pop trigger={<span className={cn("flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium", PRIORITY[task.priority]?.cls)}><span className={cn("h-2 w-2 rounded-full", PRIO_DOT[task.priority])} />{PRIORITY[task.priority]?.label}</span>}>
                {(close) => Object.entries(PRIORITY).map(([v, p]) => (
                  <MenuItem key={v} active={v === task.priority} onClick={() => { onPatch(task.id, { priority: v }); close() }}><span className={cn("h-2 w-2 rounded-full", PRIO_DOT[v])} /> {p.label}</MenuItem>
                ))}
              </Pop>
            </PropRow>
            <PropRow icon={<CalendarDays size={13} />} label="Prazo">
              <input type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ""} onChange={(e) => onPatch(task.id, { dueDate: e.target.value || null })} className={cn(inlineSel, "[color-scheme:dark]")} />
            </PropRow>
            <PropRow icon={<Repeat size={13} />} label="Repetir">
              <RecurField value={recur} onChange={setRecurrence} trigger={<span className={cn("flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px]", recur ? "bg-[#FF8F50]/15 text-[#FFB185]" : "text-zinc-500 hover:bg-white/5")}>{recur ? <><Repeat size={11} /> {recurLabel(recur)}</> : "Não repete"}</span>} />
            </PropRow>
            <PropRow icon={<Folder size={13} />} label="Projeto">
              <Pop trigger={<span className="text-sm text-zinc-200">{task.project?.name ?? "—"}</span>}>
                {(close) => projects.map((p) => <MenuItem key={p.id} active={p.id === task.project?.id} onClick={() => { onPatch(task.id, { projectId: p.id }); close() }}>{projLabel(p)}</MenuItem>)}
              </Pop>
            </PropRow>
          </div>

          {/* Descrição */}
          <div className="mt-6">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600"><AlignLeft size={13} /> Descrição</p>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => onPatch(task.id, { description: desc })} placeholder="Adicione uma descrição…" rows={3} className={cn(inp, "resize-none")} />
          </div>

          {/* Subtarefas */}
          <div className="mt-6">
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
                  {s.assignee && <Avatar name={s.assignee.name} size={16} />}
                </div>
              ))}
            </div>
            <input value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubtask()} placeholder="+ Adicionar subtarefa" className={cn(inp, "mt-2")} />
          </div>

          {/* Ações */}
          <div className="mt-6 flex items-center gap-4 border-t border-white/8 pt-4">
            <button onClick={duplicate} disabled={busy} className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-100"><Copy size={13} /> Duplicar</button>
            <button onClick={() => onRemove(task.id)} className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-red-300"><Trash2 size={13} /> Excluir</button>
          </div>
        </div>

        {/* ===== Painel de Atividade (direita) ===== */}
        <div className="flex w-80 shrink-0 flex-col border-l border-white/8 bg-black/20">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-white"><Clock size={14} /> Atividade</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {activity.map((a) => a.type === "COMMENTED" ? (
              <div key={a.id} className="flex gap-2.5">
                <Avatar name={a.userName} size={26} />
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-white/[0.04] px-3 py-2">
                  <p className="text-[11px]"><span className="font-semibold text-zinc-200">{a.userName ?? "Alguém"}</span> <span className="text-zinc-600">· {relTime(a.createdAt)}</span></p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-5 text-zinc-200">{String(a.payload?.body ?? "")}</p>
                </div>
              </div>
            ) : (
              <div key={a.id} className="flex items-start gap-2 text-[11px] text-zinc-500">
                <Avatar name={a.userName} size={18} />
                <span className="min-w-0"><span className={cn(a.type === "COMPLETED" && "text-emerald-300")}>{describe(a)}</span> <span className="text-zinc-700">· {relTime(a.createdAt)}</span></span>
              </div>
            ))}
            {!activity.length && <p className="text-[11px] text-zinc-600">Sem atividade ainda.</p>}
          </div>
          <div className="border-t border-white/8 p-3">
            <div className="flex items-center gap-2">
              <Avatar name={meName} size={26} />
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendComment()} placeholder="Escreva um comentário…" className={cn(inp, "flex-1")} />
              <Button onClick={sendComment} disabled={busy || !comment.trim()} className="min-h-9 px-2.5"><MessageSquare size={14} /></Button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

const STATUS_DOT: Record<string, string> = { BACKLOG: "bg-zinc-400", TODO: "bg-sky-400", DOING: "bg-[#FF8F50]", REVIEW: "bg-violet-400", DONE: "bg-emerald-400" }
const PRIO_DOT: Record<string, string> = { BAIXA: "bg-zinc-400", MEDIA: "bg-sky-400", ALTA: "bg-amber-400", URGENTE: "bg-red-400" }

function PropRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-white/[0.02]">
      <span className="flex w-28 shrink-0 items-center gap-2 text-[12px] text-zinc-500">{icon}{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
const inlineSel = "max-w-full cursor-pointer rounded-md bg-transparent px-2 py-1 text-sm text-zinc-200 hover:bg-white/5 focus:bg-white/5 focus:outline-none [color-scheme:dark]"
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return "agora"
  if (m < 60) return `há ${m}min`
  if (h < 24) return `há ${h}h`
  if (d < 7) return `há ${d}d`
  return new Date(iso).toLocaleDateString("pt-BR")
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
function Overlay({ title, size = "lg", bare, onClose, children }: { title?: string; size?: "lg" | "xl" | "xxl"; bare?: boolean; onClose: () => void; children: React.ReactNode }) {
  const max = size === "xxl" ? "max-w-5xl" : size === "xl" ? "max-w-3xl" : "max-w-lg"
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
