"use client"

import { useParams } from "next/navigation"
import { ProjectWorkspace } from "@/components/ProjectWorkspace"

export default function ClienteProjetoPage() {
  const { id, projectId } = useParams<{ id: string; projectId: string }>()
  return <ProjectWorkspace id={projectId} backHref={`/clientes/${id}/projetos`} />
}
