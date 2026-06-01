"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, UserCheck, UserX } from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string
}

const ROLES = ["ADMIN", "OPERADOR", "CLIENTE"]

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "OPERADOR" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/users")
    const data = await res.json()
    setUsers(data.users ?? [])
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
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar usuario.")
    } else {
      setShowForm(false)
      setForm({ name: "", email: "", password: "", role: "OPERADOR" })
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

  const roleColor: Record<string, string> = {
    ADMIN: "bg-purple-500/15 text-purple-400",
    OPERADOR: "bg-blue-500/15 text-blue-400",
    CLIENTE: "bg-zinc-500/15 text-zinc-400",
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Usuarios</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gerenciamento de acesso ao painel</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
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
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">E-mail</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Senha</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Perfil</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 bg-zinc-800 text-zinc-400 text-sm rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              {saving ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-20 text-zinc-600 text-sm">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 bg-zinc-900 border border-white/8 rounded-2xl px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100">{u.name}</p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColor[u.role] ?? ""}`}>
                {u.role}
              </span>
              <button
                onClick={() => toggleActive(u.id, u.active)}
                title={u.active ? "Desativar" : "Ativar"}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  u.active
                    ? "text-green-400 hover:bg-red-900/10 hover:text-red-400"
                    : "text-zinc-600 hover:bg-green-900/10 hover:text-green-400"
                }`}
              >
                {u.active ? <UserCheck size={16} /> : <UserX size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
