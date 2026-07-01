import { CalendarDays } from "lucide-react"

export default function InstagramCalendarioPage() {
  return (
    <div className="text-center py-20 text-zinc-600">
      <CalendarDays size={40} className="mx-auto mb-3 opacity-50" />
      <p className="text-sm">Calendário editorial — em breve.</p>
      <p className="text-xs text-zinc-700 mt-1">Grade mensal para programar e visualizar os posts por data.</p>
    </div>
  )
}
