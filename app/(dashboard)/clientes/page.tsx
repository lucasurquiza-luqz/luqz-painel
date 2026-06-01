"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Building2, ChevronRight } from "lucide-react"

interface Client {
  id: string
  name: string
  description: string | null
  active: boolean
  _count: { groups: number; messages: number }
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/clients")
    const data = await res.json()
    setClients(data.clients ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Erro ao criar cliente.")
    } else {
      setShowForm(false)
      setForm({ name: "", description: "" })
      await load()
    }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Clientes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gerencie os clientes da LUQZ</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Novo cliente
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-white/8 rounded-2xl p-5 mb-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-100">Novo cliente</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Nome</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: RH Lovers"
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Descricao (opcional)</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Cliente de trafego pago"
                className="w-full bg-zinc-800 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
      ) : clients.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Building2 size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="flex items-center gap-4 bg-zinc-900 border border-white/8 rounded-2xl px-5 py-4 hover:border-white/15 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100">{c.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {c._count.groups} grupo{c._count.groups !== 1 ? "s" : ""} · {c._count.messages} mensagem{c._count.messages !== 1 ? "s" : ""}
                  {c.description ? ` · ${c.description}` : ""}
                </p>
              </div>
              <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
