import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("dash-panel rounded-[var(--radius-card)]", className)}>{children}</div>
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger"
}) {
  const variants = {
    primary: "dash-button-primary font-semibold",
    secondary: "border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white",
    danger: "border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/15",
  }

  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("dash-input min-h-11 w-full rounded-lg px-3.5 py-2.5 text-sm", className)}
      {...props}
    />
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="dash-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="dash-display text-2xl text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

const statusStyles = {
  healthy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  attention: "border-[#FFD482]/25 bg-[#FFD482]/10 text-[#FFD482]",
  critical: "border-red-400/20 bg-red-400/10 text-red-300",
  info: "border-blue-300/20 bg-blue-300/10 text-blue-200",
  unknown: "border-white/10 bg-white/[0.04] text-zinc-400",
}

export function StatusBadge({
  children,
  status = "unknown",
}: {
  children: ReactNode
  status?: keyof typeof statusStyles
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", statusStyles[status])}>
      {children}
    </span>
  )
}
