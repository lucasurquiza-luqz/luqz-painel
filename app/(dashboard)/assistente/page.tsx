"use client"

import { AssistantChat } from "@/components/AssistantChat"

export default function AssistenteGlobalPage() {
  return (
    <div className="h-[calc(100vh-0px)]">
      <AssistantChat
        endpoint="/api/assistant"
        title="Assistente da carteira"
        description="Responde sobre a carteira com base no contexto aprovado de todos os clientes ativos."
        suggestions={[
          "Quais clientes são do nicho de saúde?",
          "Que clientes têm restrição de tom de voz?",
          "Resuma o posicionamento dos clientes de consultoria.",
        ]}
      />
    </div>
  )
}
