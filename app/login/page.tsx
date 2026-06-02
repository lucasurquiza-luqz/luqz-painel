"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Erro ao entrar.")
      setLoading(false)
      return
    }

    // Redireciona conforme o role
    if (data.role === "CLIENTE" && data.clientId) {
      window.location.href = `/clientes/${data.clientId}/chat`
    } else {
      window.location.href = "/clientes"
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] px-4 relative overflow-hidden">
      {/* Glow de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-orange-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Image src="/logo-clara.png" alt="LUQZ" width={200} height={60} className="opacity-90 mb-2" />
          <p className="text-xs text-zinc-600 tracking-widest uppercase mt-2">Performance & Solucoes Digitais</p>
        </div>

        {/* Card */}
        <div className="bg-[#161616] rounded-2xl border border-white/8 px-8 py-8">
          <h2 className="text-base font-semibold text-zinc-100 mb-6">Acessar painel</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0D0D0D] text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 text-sm transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-white/8 bg-[#0D0D0D] text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-900/15 px-4 py-2.5 rounded-xl border border-red-800/30">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #FCD34D 0%, #F97316 100%)",
                boxShadow: loading ? "none" : "0 0 24px rgba(249,115,22,0.3)",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-700 mt-8 tracking-wider uppercase">
          dash.luqz.com.br
        </p>
      </div>
    </div>
  )
}
