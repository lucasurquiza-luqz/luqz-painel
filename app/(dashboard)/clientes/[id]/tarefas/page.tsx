"use client"
import { useParams } from "next/navigation"
import { TasksView } from "@/components/TasksView"

export default function ClienteTarefasPage() {
  const { id } = useParams<{ id: string }>()
  return <TasksView clientId={id} />
}
