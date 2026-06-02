"use client"

import { useState, useRef, useEffect } from "react"
import { Smile } from "lucide-react"

const EMOJIS = [
  "😀","😂","😍","🥰","😎","🤔","😅","🙏","👏","🔥",
  "❤️","✅","⚠️","🎉","👍","👎","💪","🤝","📌","📊",
  "🚀","💡","📱","💬","🗓️","⏰","📝","🔑","💰","🎯",
  "😊","😢","😮","🤣","😴","🥳","😤","🫡","🤩","😬",
  "👋","🙌","🤞","✌️","🫶","💯","🆗","✨","🌟","⭐",
]

interface Props {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
        title="Emoji"
      >
        <Smile size={18} />
      </button>

      {open && (
        <div className="absolute bottom-12 left-0 w-64 bg-zinc-900 border border-white/10 rounded-2xl p-3 shadow-xl z-50">
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onSelect(emoji); setOpen(false) }}
                className="text-lg p-1 rounded hover:bg-white/10 cursor-pointer transition-colors leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
