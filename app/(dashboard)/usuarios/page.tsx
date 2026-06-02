"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, UserCheck, UserX, Building2 } from "lucide-react"

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

const ROLES = ["ADMIN", "OPERADOR", "CLIENTE"]

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:    { label: "Admin",    color: "bg-purple-500/15 text-purple-400" },
  OPERADOR: { label: "Equipe",   color: "bg-orange-500/15 text-orange-400" },
  CLIENTE:  { label: "Cliente",  color: "bg-zinc-500/15 text-zinc-400" },
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "OPERADOR", clientId: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, clientsRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/clients"),
    ])
    const usersData = await usersRes.json()
    const clientsData = await clientsRes.json()
    setUsers(usersData.users ?? [])
    setClients(clientsData.clients ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        clientId: form.role === "CLIENTE" && form.clientId ? form.clientId : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar usuario.")
    } else {
      setShowForm(false)
      setForm({ name: "", email: "", password: "", role: "OPERADOR", clientId: "" })
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Usuarios</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Equipe e acessos de clientes</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Novo usuario
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-100">Criar usuario</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Nome</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">E-mail</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Senha</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Perfil</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]?.label ?? r}</option>)}
              </select>
            </div>
            {form.role === "CLIENTE" && (
              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1">Cliente vinculado</label>
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                  <option value="">Selecione um cliente...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 bg-zinc-800 text-zinc-400 text-sm rounded-xl hover:bg-zinc-700 cursor-pointer">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl cursor-pointer">
              {saving ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-20 text-zinc-600 text-sm">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {/* Equipe */}
          <p className="text-xs text-zinc-600 uppercase tracking-wider px-1 mb-2">Equipe</p>
          {users.filter((u) => u.role !== "CLIENTE").map((u) => (
            <UserRow key={u.id} user={u} onToggle={toggleActive} />
          ))}

          {/* Clientes */}
          {users.some((u) => u.role === "CLIENTE") && (
            <>
              <p className="text-xs text-zinc-600 uppercase tracking-wider px-1 mt-5 mb-2">Clientes com acesso</p>
              {users.filter((u) => u.role === "CLIENTE").map((u) => (
                <UserRow key={u.id} user={u} onToggle={toggleActive} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function UserRow({ user, onToggle }: { user: User; onToggle: (id: string, active: boolean) => void }) {
  const cfg = ROLE_LABELS[user.role] ?? { label: user.role, color: "bg-zinc-500/15 text-zinc-400" }
  return (
    <div className="flex items-center gap-4 bg-zinc-900 border border-white/8 rounded-2xl px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100">{user.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-zinc-500">{user.email}</p>
          {user.client && (
            <span className="flex items-center gap-1 text-xs text-zinc-600">
              <Building2 size={10} />
              {user.client.name}
            </span>
          )}
        </div>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
      <button onClick={() => onToggle(user.id, user.active)}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${user.active ? "text-green-400 hover:bg-red-900/10 hover:text-red-400" : "text-zinc-600 hover:bg-green-900/10 hover:text-green-400"}`}>
        {user.active ? <UserCheck size={16} /> : <UserX size={16} />}
      </button>
    </div>
  )
}
