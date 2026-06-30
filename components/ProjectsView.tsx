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
              <button onClick={() => router.push(`/projetos/${p.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
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

      {creating && <CreateProject fixedClientId={clientId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load() }} />}
    </main>
  )
}

function CreateProject({ fixedClientId, onClose, onCreated }: { fixedClientId?: string; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", kind: "OUTRO", description: "" })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function submit() {
    if (!f.name.trim()) { setErr("Informe o nome."); return }
    if (!fixedClientId) { setErr("Projeto precisa de um cliente."); return }
    setBusy(true); setErr("")
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, clientId: fixedClientId }) })
    setBusy(false)
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Erro ao criar."); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-16 w-full max-w-lg rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-white">Novo projeto</h2><button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
        <div className="space-y-3">
          <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome do projeto" className={inp} />
          <label className="block"><span className="mb-1 block text-[11px] text-zinc-500">Tipo</span>
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inp}>{Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Descrição (opcional)" rows={3} className={cn(inp, "resize-none")} />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : "Criar projeto"}</Button></div>
        </div>
      </div>
    </div>
  )
}
