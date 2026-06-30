"use client"

import { useParams } from "next/navigation"
import { ProjectWorkspace } from "@/components/ProjectWorkspace"

export default function ProjetoPage() {
  const { id } = useParams<{ id: string }>()
  return <ProjectWorkspace id={id} backHref="/clientes" />
}
