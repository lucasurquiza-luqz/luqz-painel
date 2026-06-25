"use client"

import { useParams } from "next/navigation"
import { ChatWorkspace } from "@/components/ChatWorkspace"

export default function ChatPage() {
  const { id: clientId } = useParams<{ id: string }>()
  return <ChatWorkspace clientId={clientId} />
}
