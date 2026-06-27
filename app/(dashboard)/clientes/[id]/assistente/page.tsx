"use client"

import { useParams } from "next/navigation"
import { AssistantChat } from "@/components/AssistantChat"

export default function AssistenteClientePage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="h-[calc(100vh-0px)]">
      <AssistantChat
        endpoint={`/api/clients/${id}/assistant`}
        title="Copiloto de gestão"
        description="Saúde, próxima ação, riscos e o que está travando — mais o contexto aprovado. Sem inventar, citando a fonte."
        suggestions={[
          "Como está a conta? O que está travando?",
          "Qual a próxima ação e quem é o responsável?",
          "Escreva 3 ganchos de anúncio no tom de voz do cliente.",
          "Qual a promessa central e o mecanismo único?",
        ]}
      />
    </div>
  )
}
