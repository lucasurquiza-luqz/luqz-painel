"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { INSTAGRAM_PILLARS, pillarColor } from "@/lib/instagram-pillars"

export function PillarSelect({ mediaId, current }: { mediaId: string; current: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: value ? pillarColor(value) : "#3f3f46" }} />
      <select
        value={value}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-800 border border-white/8 rounded-lg text-[11px] text-zinc-300 px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500/50 cursor-pointer max-w-36"
      >
        <option value="">Sem pilar</option>
        {INSTAGRAM_PILLARS.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>
    </div>
  )
}
