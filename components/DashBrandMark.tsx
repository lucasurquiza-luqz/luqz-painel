import Image from "next/image"

export function DashBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#111111]">
        <Image
          src="/brand/symbol-gradient.png"
          alt=""
          fill
          sizes="36px"
          className="object-contain p-1.5"
          priority
        />
      </div>

      {!compact && (
        <div className="min-w-0 leading-none">
          <p className="dash-eyebrow text-[10px] text-zinc-500">LUQZ</p>
          <p className="dash-display mt-1 truncate text-lg text-white">
            <span className="dash-gradient-text">Dash</span>
          </p>
        </div>
      )}
    </div>
  )
}
