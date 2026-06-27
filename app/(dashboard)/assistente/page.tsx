"use client"

import { AssistantChat } from "@/components/AssistantChat"

export default function AssistenteGlobalPage() {
  return (
    <div className="h-[calc(100vh-0px)]">
      <AssistantChat
        endpoint="/api/assistant"
        title="Copiloto da carteira"
        description="Briefing do dia: saúde, riscos, pendências e o que está travando em toda a carteira."
        suggestions={[
          "Quais contas estão críticas ou em atenção hoje?",
          "O que está travando na carteira? Onde focar?",
          "Quais ações estão atrasadas e de quem?",
          "Quais clientes estão sem atividade há mais tempo?",
        ]}
      />
    </div>
  )
}
