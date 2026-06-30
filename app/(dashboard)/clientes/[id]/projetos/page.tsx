"use client"
import { useParams } from "next/navigation"
import { ProjectsView } from "@/components/ProjectsView"

export default function ClienteProjetosPage() {
  const { id } = useParams<{ id: string }>()
  return <ProjectsView clientId={id} />
}
