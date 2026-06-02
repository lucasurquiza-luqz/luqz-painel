"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, UserCheck, UserX, Building2, Eye, EyeOff, Pencil, X, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface User {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  clientId: string | null
  client: { name: string } | null
}

interface Client {
  id: string
  name: string
}

// Internamente o sistema usa ADMIN/OPERADOR/CLIENTE
// Na UI mostramos Equipe (Admin) / Equipe / Cliente
const ROLE_OPTIONS = [
  { value: "ADMIN",    label: "Equipe (Admin)",  description: "Acesso total, gerencia usuarios" },
  { value: "OPERADOR", label: "Equipe",           description: "Acesso a todos os clientes, sem gerenciar usuarios" },
  { value: "CLIENTE",  label: "Cliente",          description: "Acesso restrito ao proprio painel" },
]

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  ADMIN:    { label: "Admin",  color: "bg-purple-500/15 text-purple-400" },
  OPERADOR: { label: "Equipe", color: "bg-orange-500/15 text-orange-400" },
  CLIENTE:  { label: "Cliente", color: "bg-zinc-500/15 text-zinc-400" },
}

const emptyForm = { name: "", email: "", password: "", role: "OPERADOR", clientId: "" }

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, clientsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/clients"),
    ])
    setUsers((await usersRes.json()).users ?? [])
    setClients((await clientsRes.json()).clients ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingUser(null)
    setForm(emptyForm)
    setError("")
    setShowForm(true)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setForm({ name: user.name, email: user.email, password: "", role: user.role, clientId: user.clientId ?? "" })
    setError("")
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingUser(null)
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")

    const payload = {
      ...form,
      clientId: form.role === "CLIENTE" && form.clientId ? form.clientId : null,
    }

    let res: Response
    if (editingUser) {
      // Edicao: so envia campos alterados
      const body: Record<string, unknown> = { name: form.name, role: form.role, clientId: payload.clientId }
      if (form.password) body.password = form.password
      res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } else {
      res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    }

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Erro ao salvar.")
    } else {
      closeForm()
      await load()
    }
    setSaving(false)
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    })
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)))
  }

  const equipe = users.filter((u) => u.role !== "CLIENTE")
  const clientes = users.filter((u) => u.role === "CLIENTE")

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Usuarios</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{equipe.length} na equipe · {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} com acesso</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer">
          <Plus size={16} />
          Novo usuario
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              {editingUser ? `Editar — ${editingUser.name}` : "Novo usuario"}
            </h2>
            <button onClick={closeForm} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Nome</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">E-mail</label>
                <input type="email" required={!editingUser} disabled={!!editingUser}
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">
                  {editingUser ? "Nova senha (deixe em branco para manter)" : "Senha"}
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    required={!editingUser}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 pr-10 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Perfil de acesso</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-600 mt-1">
                  {ROLE_OPTIONS.find((r) => r.value === form.role)?.description}
                </p>
              </div>
            </div>

            {/* Cliente vinculado — so para CLIENTE */}
            {form.role === "CLIENTE" && (
              <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl p-4">
                <label className="block text-xs font-medium text-orange-400 mb-2">
                  Cliente permitido
                </label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                  <option value="">Selecione o cliente...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-xs text-zinc-600 mt-1.5">Este usuario so vera os dados deste cliente ao fazer login.</p>
              </div>
            )}

            {error && <p className="text-xs text-red-400 bg-red-900/15 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={closeForm}
                className="flex-1 py-2.5 bg-zinc-800 text-zinc-400 text-sm rounded-xl hover:bg-zinc-700 cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl cursor-pointer">
                {saving ? "Salvando..." : editingUser ? "Salvar alteracoes" : "Criar usuario"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-zinc-600 text-sm">Carregando...</div>
      ) : (
        <div className="space-y-6">
          {/* Equipe */}
          <section>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield size={12} />
              Equipe ({equipe.length})
            </p>
            <div className="space-y-2">
              {equipe.length === 0 ? (
                <p className="text-xs text-zinc-700 px-1">Nenhum membro da equipe.</p>
              ) : equipe.map((u) => (
                <UserCard key={u.id} user={u} onEdit={openEdit} onToggle={toggleActive} />
              ))}
            </div>
          </section>

          {/* Clientes com acesso */}
          <section>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Building2 size={12} />
              Clientes com acesso ({clientes.length})
            </p>
            {clientes.length === 0 ? (
              <div className="bg-zinc-900/50 border border-dashed border-white/8 rounded-2xl p-6 text-center">
                <p className="text-xs text-zinc-600">Nenhum cliente com acesso ao painel ainda.</p>
                <p className="text-xs text-zinc-700 mt-1">Crie um usuario com perfil "Cliente" para dar acesso ao painel do cliente.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clientes.map((u) => (
                  <UserCard key={u.id} user={u} onEdit={openEdit} onToggle={toggleActive} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function UserCard({
  user,
  onEdit,
  onToggle,
}: {
  user: User
  onEdit: (u: User) => void
  onToggle: (id: string, active: boolean) => void
}) {
  const badge = ROLE_BADGE[user.role] ?? { label: user.role, color: "bg-zinc-500/15 text-zinc-400" }

  return (
    <div className={cn(
      "flex items-center gap-4 border rounded-2xl px-5 py-3.5 transition-colors",
      user.active ? "bg-zinc-900 border-white/8" : "bg-zinc-950 border-white/5 opacity-60"
    )}>
      {/* Avatar */}
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-semibold",
        user.role === "ADMIN" ? "bg-purple-500/15 text-purple-400" :
        user.role === "OPERADOR" ? "bg-orange-500/15 text-orange-400" :
        "bg-zinc-800 text-zinc-400"
      )}>
        {user.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-100 truncate">{user.name}</p>
          {!user.active && <span className="text-xs text-zinc-600">(inativo)</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          {user.client && (
            <span className="flex items-center gap-1 text-xs text-orange-400/70 flex-shrink-0">
              <Building2 size={10} />
              {user.client.name}
            </span>
          )}
        </div>
      </div>

      <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0", badge.color)}>
        {badge.label}
      </span>

      {/* Acoes */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onEdit(user)}
          className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
          title="Editar">
          <Pencil size={14} />
        </button>
        <button onClick={() => onToggle(user.id, user.active)}
          className={cn("p-1.5 rounded-lg cursor-pointer transition-colors",
            user.active ? "text-green-400 hover:bg-red-900/10 hover:text-red-400" : "text-zinc-600 hover:bg-green-900/10 hover:text-green-400")}
          title={user.active ? "Desativar" : "Ativar"}>
          {user.active ? <UserCheck size={15} /> : <UserX size={15} />}
        </button>
      </div>
    </div>
  )
}
