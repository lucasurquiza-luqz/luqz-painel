"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { DashBrandMark } from "@/components/DashBrandMark"
import { Button, Input, Panel } from "@/components/ui/primitives"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Não foi possível entrar.")
        return
      }

      window.location.href = data.role === "CLIENTE" && data.clientId
        ? `/clientes/${data.clientId}/chat`
        : "/clientes"
    } catch {
      setError("Não foi possível conectar ao LUQZ Dash.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080808] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-70 [background:var(--app-glow)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF8F50]/30 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <DashBrandMark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
            Inteligência, operação e saúde da carteira em um só lugar.
          </p>
        </div>

        <Panel className="rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <p className="dash-eyebrow mb-2">Acesso seguro</p>
            <h1 className="dash-display text-2xl text-white">Entrar no Dash</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-300">E-mail</span>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-300">Senha</span>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Panel>

        <p className="mt-6 text-center text-xs uppercase tracking-[0.16em] text-zinc-700">
          dash.luqz.com.br
        </p>
      </div>
    </main>
  )
}
