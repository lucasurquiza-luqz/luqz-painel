"use client"
import { useParams } from "next/navigation"
import { TasksView } from "@/components/TasksView"

// Detalhe do projeto = a "lista" do ClickUp: as tarefas daquele projeto.
export default function ProjetoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  return <TasksView projectId={id} />
}
