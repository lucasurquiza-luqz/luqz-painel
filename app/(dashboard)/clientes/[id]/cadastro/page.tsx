"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Save, Star, Trash2, UserPlus } from "lucide-react"
import { Button, Input, PageHeader, Panel } from "@/components/ui/primitives"

type Contact = {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  notes: string | null
}
type TeamMember = {
  id: string
  name: string
  role: string
  user: { id: string; name: string } | null
}
type Client = {
  id: string
  name: string
  description: string | null
  segment: string | null
  website: string | null
  instagram: string | null
  region: string | null
  product: string | null
  contractValue: number | null
  billingCycle: string | null
  contractStart: string | null
  renewalDate: string | null
  projectPhase: string | null
  contacts: Contact[]
  teamMembers: TeamMember[]
}

const ROLE_LABEL: Record<string, string> = {
  GESTOR_PROJETO: "Gestor de projeto",
  TRAFEGO: "Tráfego",
  CONTEUDO: "Conteúdo",
  COMERCIAL: "Comercial",
  DESIGN: "Design",
  OUTRO: "Outro",
}

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : ""
}

export default function CadastroClientePage() {
  const { id: clientId } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}`)
    const payload = await res.json()
    if (res.ok) setClient(payload.client)
    else setError(payload.error ?? "Não foi possível carregar o cliente.")
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <main className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-[#FF8F50]" /></main>
  }
  if (!client) {
    return <main className="p-8 text-sm text-red-300">{error || "Cliente não encontrado."}</main>
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link href={`/clientes/${clientId}`} className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-100">
          <ArrowLeft size={18} />
        </Link>
        <PageHeader eyebrow="Cadastro do cliente" title={client.name} description="Perfil, contrato, contatos e responsáveis — tudo centralizado aqui." />
      </div>

      {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <ProfileSection client={client} onSaved={load} onError={setError} />
      <ContractSection client={client} onSaved={load} onError={setError} />
      <ContactsSection clientId={clientId} contacts={client.contacts} onChanged={load} onError={setError} />
      <TeamSection clientId={clientId} members={client.teamMembers} onChanged={load} onError={setError} />
    </main>
  )
}

// === Perfil do negócio ===
function ProfileSection({ client, onSaved, onError }: { client: Client; onSaved: () => void; onError: (m: string) => void }) {
  const [form, setForm] = useState({
    segment: client.segment ?? "",
    website: client.website ?? "",
    instagram: client.instagram ?? "",
    region: client.region ?? "",
    description: client.description ?? "",
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    onError("")
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao salvar perfil."); return }
    onSaved()
  }

  return (
    <SectionPanel title="Perfil do negócio">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Segmento"><Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} placeholder="Ex: Estética, Imobiliária..." /></FormField>
        <FormField label="Praça / região"><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Cidade / estado" /></FormField>
        <FormField label="Site"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></FormField>
        <FormField label="Instagram"><Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@perfil" /></FormField>
      </div>
      <FormField label="Descrição do negócio">
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="dash-input w-full resize-none rounded-lg px-3.5 py-3 text-sm" placeholder="O que o cliente faz, contexto geral." />
      </FormField>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar perfil</Button></div>
    </SectionPanel>
  )
}

// === Plano / contrato ===
function ContractSection({ client, onSaved, onError }: { client: Client; onSaved: () => void; onError: (m: string) => void }) {
  const [form, setForm] = useState({
    product: client.product ?? "",
    contractValue: client.contractValue != null ? String(client.contractValue) : "",
    billingCycle: client.billingCycle ?? "",
    contractStart: dateInput(client.contractStart),
    renewalDate: dateInput(client.renewalDate),
    projectPhase: client.projectPhase ?? "",
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    onError("")
    const value = form.contractValue.trim().replace(/\./g, "").replace(",", ".")
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: form.product,
        contractValue: value ? Number(value) : null,
        billingCycle: form.billingCycle,
        contractStart: form.contractStart || null,
        renewalDate: form.renewalDate || null,
        projectPhase: form.projectPhase,
      }),
    })
    setSaving(false)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao salvar contrato."); return }
    onSaved()
  }

  return (
    <SectionPanel title="Plano / contrato">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Produto contratado"><Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Ex: Arquitetura de Performance 360" /></FormField>
        <FormField label="Fase do projeto"><Input value={form.projectPhase} onChange={(e) => setForm({ ...form, projectPhase: e.target.value })} placeholder="Ex: Execução — T3" /></FormField>
        <FormField label="Valor (R$)"><Input value={form.contractValue} onChange={(e) => setForm({ ...form, contractValue: e.target.value })} placeholder="Ex: 3000,00" inputMode="decimal" /></FormField>
        <FormField label="Ciclo de cobrança"><Input value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} placeholder="Mensal, trimestral, projeto fechado..." /></FormField>
        <FormField label="Início do contrato"><Input type="date" value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} className="[color-scheme:dark]" /></FormField>
        <FormField label="Renovação"><Input type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} className="[color-scheme:dark]" /></FormField>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar contrato</Button></div>
    </SectionPanel>
  )
}

// === Contatos do cliente ===
function ContactsSection({ clientId, contacts, onChanged, onError }: { clientId: string; contacts: Contact[]; onChanged: () => void; onError: (m: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "", isPrimary: false })
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!form.name.trim()) { onError("Informe o nome do contato."); return }
    setBusy(true)
    onError("")
    const res = await fetch(`/api/clients/${clientId}/contacts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    })
    setBusy(false)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao adicionar contato."); return }
    setForm({ name: "", role: "", email: "", phone: "", isPrimary: false })
    setAdding(false)
    onChanged()
  }

  async function remove(contactId: string) {
    onError("")
    const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, { method: "DELETE" })
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao remover contato."); return }
    onChanged()
  }

  return (
    <SectionPanel title="Contatos do cliente" action={<Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => setAdding((v) => !v)}><Plus size={14} /> Adicionar</Button>}>
      {adding && (
        <div className="rounded-xl border border-[#FF8F50]/20 bg-black/20 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome *" />
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Cargo" />
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp / telefone" />
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} /> Contato principal
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button className="min-h-9 px-3 py-1.5 text-xs" onClick={add} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Salvar contato</Button>
          </div>
        </div>
      )}
      {contacts.length === 0 && !adding ? (
        <p className="text-sm text-zinc-600">Nenhum contato cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-zinc-200">{c.name}</p>
                  {c.isPrimary && <span className="flex items-center gap-1 text-xs text-[#FFD482]"><Star size={11} /> principal</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {[c.role, c.email, c.phone].filter(Boolean).join(" · ") || "sem detalhes"}
                </p>
              </div>
              <button onClick={() => remove(c.id)} className="shrink-0 text-zinc-600 hover:text-red-400" aria-label="Remover"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  )
}

// === Responsáveis LUQZ ===
function TeamSection({ clientId, members, onChanged, onError }: { clientId: string; members: TeamMember[]; onChanged: () => void; onError: (m: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", role: "GESTOR_PROJETO" })
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!form.name.trim()) { onError("Informe o responsável."); return }
    setBusy(true)
    onError("")
    const res = await fetch(`/api/clients/${clientId}/team`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    })
    setBusy(false)
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao adicionar responsável."); return }
    setForm({ name: "", role: "GESTOR_PROJETO" })
    setAdding(false)
    onChanged()
  }

  async function remove(memberId: string) {
    onError("")
    const res = await fetch(`/api/clients/${clientId}/team/${memberId}`, { method: "DELETE" })
    if (!res.ok) { onError((await res.json()).error ?? "Erro ao remover responsável."); return }
    onChanged()
  }

  return (
    <SectionPanel title="Responsáveis LUQZ" action={<Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => setAdding((v) => !v)}><UserPlus size={14} /> Adicionar</Button>}>
      {adding && (
        <div className="rounded-xl border border-[#FF8F50]/20 bg-black/20 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do responsável *" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="dash-input min-h-11 rounded-lg px-3.5 py-2.5 text-sm">
              {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button className="min-h-9 px-3 py-1.5 text-xs" onClick={add} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Salvar</Button>
          </div>
        </div>
      )}
      {members.length === 0 && !adding ? (
        <p className="text-sm text-zinc-600">Nenhum responsável vinculado.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-200">{m.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{ROLE_LABEL[m.role] ?? m.role}</p>
              </div>
              <button onClick={() => remove(m.id)} className="shrink-0 text-zinc-600 hover:text-red-400" aria-label="Remover"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  )
}

// === Helpers de layout ===
function SectionPanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </Panel>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>{children}</label>
}
