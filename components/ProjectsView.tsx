"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, X, FolderKanban, Trash2 } from "lucide-react"
import { PageHeader, Panel, Button } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = { ATIVO: "Ativo", PAUSADO: "Pausado", CONCLUIDO: "Concluído", ARQUIVADO: "Arquivado" }
const KIND: Record<string, string> = { CONTEUDO: "Produção de Conteúdo", TRAFEGO: "Tráfego", ONBOARDING: "Onboarding", WEB: "Web/LP", COMERCIAL: "Comercial", OUTRO: "Outro" }
const inp = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF8F50]/40 focus:outline-none"
type Project = { id: string; name: string; description: string | null; kind: string; status: string; client: { name: string } | null; _count: { tasks: number } }
type Ref = { id: string; name: string }
type PLink = { label: string; url: string }

const AV_COLORS = ["#FF8F50", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#22d3ee"]
function PAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  const color = AV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length]
  return <span style={{ background: `${color}26`, color }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">{initials}</span>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">{label}</span>{children}</label>
}

export function ProjectsView({ clientId }: { clientId?: string }) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/projects${clientId ? `?clientId=${clientId}` : ""}`)
    const d = await res.json().catch(() => ({}))
    setProjects(d.projects ?? [])
    setLoading(false)
  }, [clientId])
  useEffect(() => { void load() }, [load])

  // Dentro de um cliente, abre a rota aninhada (sidebar mantém o cliente).
  const openProject = (pid: string) => router.push(clientId ? `/clientes/${clientId}/projetos/${pid}` : `/projetos/${pid}`)

  async function remove(id: string, name: string) {
    if (!confirm(`Excluir o projeto "${name}" e TODAS as suas tarefas?`)) return
    await fetch(`/api/projects/${id}`, { method: "DELETE" })
    setProjects((ps) => ps.filter((p) => p.id !== id))
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <PageHeader eyebrow="Operação" title="Projetos" description="Projetos do cliente. Abra um projeto para configurar e gerir suas tarefas." />
        <Button onClick={() => setCreating(true)}><Plus size={16} /> Novo projeto</Button>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></div>
      ) : projects.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-zinc-600">Nenhum projeto ainda. Crie o primeiro.</Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Panel key={p.id} className="group flex items-center gap-3 p-4 hover:border-white/15">
              <button onClick={() => openProject(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FF8F50]/20 bg-[#FF8F50]/10"><FolderKanban size={18} className="text-[#FF8F50]" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">{p.name}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{KIND[p.kind] ?? p.kind} · {p._count.tasks} tarefa(s) · {STATUS_LABEL[p.status]}</p>
                </div>
              </button>
              <button onClick={() => remove(p.id, p.name)} title="Excluir projeto" className="shrink-0 text-zinc-700 hover:text-red-300"><Trash2 size={15} /></button>
            </Panel>
          ))}
        </div>
      )}

      {creating && <CreateProject fixedClientId={clientId} onClose={() => setCreating(false)} onCreated={openProject} />}
    </main>
  )
}

function CreateProject({ fixedClientId, onClose, onCreated }: { fixedClientId?: string; onClose: () => void; onCreated: (projectId: string) => void }) {
  const [f, setF] = useState({ name: "", kind: "OUTRO", ownerId: "", dueDate: "", description: "", objectives: "", notes: "" })
  const [members, setMembers] = useState<string[]>([])
  const [links, setLinks] = useState<PLink[]>([])
  const [team, setTeam] = useState<Ref[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { fetch("/api/team").then((r) => r.json()).then((d) => setTeam(d.users ?? [])).catch(() => {}) }, [])

  const toggleMember = (id: string) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const setLink = (i: number, k: "label" | "url", v: string) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  async function submit() {
    if (!f.name.trim()) { setErr("Informe o nome."); return }
    if (!fixedClientId) { setErr("Projeto precisa de um cliente."); return }
    setBusy(true); setErr("")
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, clientId: fixedClientId, memberIds: members, links: links.filter((l) => l.url.trim()) }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(d.error ?? "Erro ao criar."); return }
    onCreated(d.project.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-12 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-white">Novo projeto</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
        <div className="space-y-4">
          <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome do projeto" className={cn(inp, "text-base font-semibold")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Tipo"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inp}>{Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Responsável"><select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })} className={inp}><option value="">—</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Prazo"><input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className={cn(inp, "[color-scheme:dark]")} /></Field>
          </div>
          <Field label="Descrição curta"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Uma linha sobre o projeto" className={inp} /></Field>
          <Field label="Objetivos / metas"><textarea value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} rows={2} placeholder="O que esse projeto precisa alcançar…" className={cn(inp, "resize-none")} /></Field>
          <Field label="Documentação / briefing / contexto"><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={5} placeholder="Escopo, contexto, briefing, observações…" className={cn(inp, "resize-none")} /></Field>

          <div>
            <p className="mb-1.5 text-[11px] text-zinc-500">Pessoas envolvidas</p>
            <div className="flex flex-wrap gap-2">
              {team.map((u) => (
                <button key={u.id} type="button" onClick={() => toggleMember(u.id)} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs", members.includes(u.id) ? "border-[#FF8F50]/50 bg-[#FF8F50]/15 text-[#FFB185]" : "border-white/10 text-zinc-400")}>
                  <PAvatar name={u.name} /> {u.name}
                </button>
              ))}
              {!team.length && <p className="text-xs text-zinc-600">Sem equipe cadastrada.</p>}
            </div>
          </div>

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

          <p className="text-[11px] text-zinc-600">📎 Arquivos e criativos você anexa logo após criar, na aba <b className="text-zinc-400">Documentos</b> do projeto.</p>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : "Criar projeto"}</Button></div>
        </div>
      </div>
    </div>
  )
}
