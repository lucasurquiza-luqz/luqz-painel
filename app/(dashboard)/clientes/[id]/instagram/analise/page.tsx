import { BarChart3 } from "lucide-react"

export default function InstagramAnalisePage() {
  return (
    <div className="text-center py-20 text-zinc-600">
      <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
      <p className="text-sm">Análise de conteúdos — em breve.</p>
      <p className="text-xs text-zinc-700 mt-1">Desempenho por post (curtidas, salvamentos, alcance) e comparação por formato e pilar.</p>
    </div>
  )
}
