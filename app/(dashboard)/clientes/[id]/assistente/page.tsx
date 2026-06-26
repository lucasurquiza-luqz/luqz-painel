"use client"

import { useParams } from "next/navigation"
import { AssistantChat } from "@/components/AssistantChat"

export default function AssistenteClientePage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="h-[calc(100vh-0px)]">
      <AssistantChat
        endpoint={`/api/clients/${id}/assistant`}
        title="Assistente do cliente"
        description="Responde com base no contexto aprovado deste cliente — sem inventar, citando a fonte."
        suggestions={[
          "Qual a promessa central e o mecanismo único?",
          "Escreva 3 ganchos de anúncio no tom de voz do cliente.",
          "O que eu NÃO posso dizer pra esse público?",
          "Resuma o posicionamento pra um designer novo.",
        ]}
      />
    </div>
  )
}
