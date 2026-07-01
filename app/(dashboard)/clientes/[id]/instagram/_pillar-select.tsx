"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Pillar = { id: string; label: string; color: string }

export function PillarSelect({ mediaId, current, pillars }: { mediaId: string; current: string | null; pillars: Pillar[] }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [saving, setSaving] = useState(false)

  const color = pillars.find((p) => p.id === value)?.color ?? "#3f3f46"

  async function onChange(next: string) {
    setValue(next)
    setSaving(true)
    try {
      await fetch(`/api/instagram/media/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillar: next || null }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (pillars.length === 0) {
    return <span className="text-[10px] text-zinc-600">Cadastre pilares em Configurações</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: value ? color : "#3f3f46" }} />
      <select
        value={value}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-800 border border-white/8 rounded-lg text-[11px] text-zinc-300 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500/50 cursor-pointer max-w-40"
      >
        <option value="">Sem pilar</option>
        {pillars.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
    </div>
  )
}
