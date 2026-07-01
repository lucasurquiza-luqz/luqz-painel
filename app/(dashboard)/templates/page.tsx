"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2, ChevronRight, ArrowLeft, ChevronUp, ChevronDown, Check } from "lucide-react"
import { PageHeader, Panel, Button } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

const KIND: Record<string, string> = { CONTEUDO: "Produção de Conteúdo", TRAFEGO: "Tráfego", ONBOARDING: "Onboarding", WEB: "Web/LP", COMERCIAL: "Comercial", OUTRO: "Outro" }
const PRIO: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" }
const FREQ: Record<string, string> = { "": "Não repete", DIARIA: "Diária", SEMANAL: "Semanal", MENSAL: "Mensal" }
const inp = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF8F50]/40 focus:outline-none"

const fmtEst = (min: number | null | undefined) => { if (!min) return ""; const h = Math.floor(min / 60), m = min % 60; return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m` }
function parseEst(s: string): number | null {
  const str = s.trim().toLowerCase(); if (!str) return null
  const hm = str.match(/^(\d+)\s*h\s*(\d+)?\s*m?$/); if (hm) return parseInt(hm[1]) * 60 + (hm[2] ? parseInt(hm[2]) : 0)
  const mOnly = str.match(/^(\d+)\s*m$/); if (mOnly) return parseInt(mOnly[1])
  const n = parseInt(str); return Number.isFinite(n) && n > 0 ? n : null
}

type TplSub = { title: string }
type TplRecur = { freq: string; interval: number }
type TplTask = { title: string; description?: string | null; priority?: string; estimateMin?: number | null; tagNames?: string[]; dueOffsetDays?: number | null; recur?: TplRecur | null; subtasks?: TplSub[] }
type Tpl = { id: string; name: string; kind: string; description: string | null; objectives: string | null; notes: string | null; tasks: TplTask[] }
type Row = { id: string; name: string; kind: string; description: string | null; taskCount: number }

export default function TemplatesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Tpl | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await (await fetch("/api/project-templates")).json().catch(() => ({}))
    setRows(d.templates ?? []); setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  async function createBlank() {
    const name = prompt("Nome do novo template:")
    if (!name?.trim()) return
    const d = await (await fetch("/api/project-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), blank: true }) })).json().catch(() => ({}))
    if (d.template) openEditor(d.template.id)
  }
  async function openEditor(id: string) {
    const d = await (await fetch(`/api/project-templates/${id}`)).json().catch(() => ({}))
    if (d.template) setEditing({ ...d.template, tasks: Array.isArray(d.template.tasks) ? d.template.tasks : [] })
  }
  async function remove(id: string, name: string) {
    if (!confirm(`Excluir o template "${name}"?`)) return
    await fetch(`/api/project-templates/${id}`, { method: "DELETE" }); load()
  }

  if (editing) return <Editor tpl={editing} onClose={() => { setEditing(null); load() }} />

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <PageHeader eyebrow="Operação" title="Modelos de projeto" description="Estruturas reutilizáveis pra abrir projetos já prontos. Use em 'Novo projeto' dentro de um cliente." />
        <Button onClick={createBlank}><Plus size={16} /> Novo template</Button>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : rows.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Nenhum template ainda. Crie um do zero, ou salve um projeto existente como template.</Panel>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Panel key={r.id} className="flex items-center gap-3 p-4 hover:border-white/15">
              <button onClick={() => openEditor(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">{r.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{KIND[r.kind] ?? r.kind} · {r.taskCount} tarefa(s)</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-zinc-600" />
              </button>
              <button onClick={() => remove(r.id, r.name)} title="Excluir" className="shrink-0 text-zinc-700 hover:text-red-300"><Trash2 size={15} /></button>
            </Panel>
          ))}
        </div>
      )}
    </main>
  )
}

function Editor({ tpl, onClose }: { tpl: Tpl; onClose: () => void }) {
  const [meta, setMeta] = useState({ name: tpl.name, kind: tpl.kind, description: tpl.description ?? "", objectives: tpl.objectives ?? "", notes: tpl.notes ?? "" })
  const [tasks, setTasks] = useState<TplTask[]>(tpl.tasks)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const upd = (i: number, patch: Partial<TplTask>) => setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const addTask = () => setTasks((ts) => [...ts, { title: "", priority: "MEDIA" }])
  const delTask = (i: number) => setTasks((ts) => ts.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) => setTasks((ts) => { const n = [...ts]; const j = i + dir; if (j < 0 || j >= n.length) return ts; [n[i], n[j]] = [n[j], n[i]]; return n })

  async function save() {
    setBusy(true)
    const clean = tasks.filter((t) => t.title.trim()).map((t) => ({ ...t, title: t.title.trim(), subtasks: (t.subtasks ?? []).filter((s) => s.title.trim()) }))
    await fetch(`/api/project-templates/${tpl.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...meta, tasks: clean }) })
    setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><ArrowLeft size={18} /></button>
        <PageHeader eyebrow="Modelo de projeto" title={meta.name || "Template"} description="Edite o cadastro e a estrutura de tarefas." />
        <Button onClick={save} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : saved ? <><Check size={15} /> Salvo</> : "Salvar"}</Button>
      </div>

      <Panel className="space-y-3 p-5">
        <input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Nome do template" className={cn(inp, "text-base font-semibold")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">Tipo</span>
            <select value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value })} className={inp}>{Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">Descrição</span>
            <input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className={inp} /></label>
        </div>
        <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">Objetivos</span>
          <textarea value={meta.objectives} onChange={(e) => setMeta({ ...meta, objectives: e.target.value })} rows={2} className={cn(inp, "resize-none")} /></label>
        <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">Documentação / briefing</span>
          <textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} rows={4} className={cn(inp, "resize-none")} /></label>
      </Panel>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Tarefas do modelo ({tasks.length})</h2>
        <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={addTask}><Plus size={14} /> Adicionar tarefa</Button>
      </div>

      <div className="space-y-3">
        {tasks.map((t, i) => (
          <Panel key={i} className="space-y-3 p-4">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 pt-1 text-zinc-600">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-zinc-300 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === tasks.length - 1} className="hover:text-zinc-300 disabled:opacity-30"><ChevronDown size={14} /></button>
              </div>
              <input value={t.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Título da tarefa" className={cn(inp, "flex-1 font-medium")} />
              <button onClick={() => delTask(i)} className="p-2 text-zinc-600 hover:text-red-300"><Trash2 size={15} /></button>
            </div>
            <div className="grid gap-2 pl-7 sm:grid-cols-4">
              <label className="block"><span className="mb-1 block text-[10px] text-zinc-600">Prioridade</span>
                <select value={t.priority ?? "MEDIA"} onChange={(e) => upd(i, { priority: e.target.value })} className={inp}>{Object.entries(PRIO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-[10px] text-zinc-600">Estimativa</span>
                <input defaultValue={fmtEst(t.estimateMin)} onBlur={(e) => upd(i, { estimateMin: parseEst(e.target.value) })} placeholder="2h 30m" className={inp} /></label>
              <label className="block"><span className="mb-1 block text-[10px] text-zinc-600">Prazo (+dias)</span>
                <input type="number" value={t.dueOffsetDays ?? ""} onChange={(e) => upd(i, { dueOffsetDays: e.target.value === "" ? null : Number(e.target.value) })} placeholder="—" className={inp} /></label>
              <label className="block"><span className="mb-1 block text-[10px] text-zinc-600">Etiquetas (vírgula)</span>
                <input defaultValue={(t.tagNames ?? []).join(", ")} onBlur={(e) => upd(i, { tagNames: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="conteúdo, urgente" className={inp} /></label>
            </div>
            <div className="grid gap-2 pl-7 sm:grid-cols-2">
              <div className="flex items-end gap-2">
                <label className="block flex-1"><span className="mb-1 block text-[10px] text-zinc-600">Repetir</span>
                  <select value={t.recur?.freq ?? ""} onChange={(e) => upd(i, { recur: e.target.value ? { freq: e.target.value, interval: t.recur?.interval ?? 1 } : null })} className={inp}>{Object.entries(FREQ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                {t.recur && <label className="block w-24"><span className="mb-1 block text-[10px] text-zinc-600">A cada</span>
                  <input type="number" min={1} value={t.recur.interval} onChange={(e) => upd(i, { recur: { freq: t.recur!.freq, interval: Math.max(1, Number(e.target.value)) } })} className={inp} /></label>}
              </div>
              <label className="block"><span className="mb-1 block text-[10px] text-zinc-600">Subtarefas (uma por linha)</span>
                <textarea defaultValue={(t.subtasks ?? []).map((s) => s.title).join("\n")} onBlur={(e) => upd(i, { subtasks: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((title) => ({ title })) })} rows={2} placeholder="Subtarefa 1&#10;Subtarefa 2" className={cn(inp, "resize-none")} /></label>
            </div>
          </Panel>
        ))}
        {tasks.length === 0 && <Panel className="p-6 text-center text-sm text-zinc-600">Sem tarefas. Adicione a estrutura que esse tipo de projeto sempre tem.</Panel>}
      </div>
    </main>
  )
}
