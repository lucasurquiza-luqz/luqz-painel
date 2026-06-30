"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Popover estilo ClickUp: um gatilho (pill/botão) que abre um menu flutuante.
export function Pop({ trigger, children, align = "left" }: { trigger: React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [open])
  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-white/5">{trigger}</button>
      {open && <div className={cn("absolute top-full z-50 mt-1 max-h-64 min-w-[200px] overflow-y-auto rounded-lg border border-white/10 bg-[#1b1b1b] p-1 shadow-2xl", align === "right" ? "right-0" : "left-0")}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function MenuItem({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-white/5", active && "bg-white/5")}>{children}{active && <Check size={13} className="ml-auto text-[#FF8F50]" />}</button>
}

// Select pronto estilo ClickUp: valor atual como botão + menu de opções.
export type PickerOption = { value: string; label: string; node?: React.ReactNode }
export function PickerSelect({ value, options, onChange, placeholder = "—", className }: { value: string; options: PickerOption[]; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const cur = options.find((o) => o.value === value)
  return (
    <Pop trigger={<span className={cn("flex items-center gap-1.5 text-sm text-zinc-200", className)}>{cur?.node ?? cur?.label ?? <span className="text-zinc-500">{placeholder}</span>}<ChevronDown size={13} className="text-zinc-600" /></span>}>
      {(close) => options.map((o) => <MenuItem key={o.value} active={o.value === value} onClick={() => { onChange(o.value); close() }}>{o.node ?? o.label}</MenuItem>)}
    </Pop>
  )
}
