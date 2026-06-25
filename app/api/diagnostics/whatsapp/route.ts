import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { getConnectionState, getWebhook } from "@/lib/evolution"

// Diagnostico da integracao WhatsApp: estado da conexao, ultimo webhook recebido,
// configuracao do webhook na Evolution e volume de mensagens por grupo.
export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const [runtime, connectionState, webhook, conversations, totalMessages, groupsTotal, groupsLinked] =
    await Promise.all([
      prisma.whatsAppRuntime.findUnique({ where: { id: "singleton" } }),
      getConnectionState(),
      getWebhook(),
      prisma.waConversation.findMany({
        select: {
          id: true,
          name: true,
          lastMessageAt: true,
          client: { select: { name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 100,
      }),
      prisma.waMessage.count(),
      prisma.group.count(),
      prisma.group.count({ where: { clientId: { not: null } } }),
    ])

  const webhookConfig = webhook && typeof webhook === "object" ? (webhook as Record<string, unknown>) : null
  const rawUrl = typeof webhookConfig?.url === "string" ? webhookConfig.url : null

  return NextResponse.json({
    connectionState,
    runtime,
    webhook: webhookConfig
      ? {
          enabled: webhookConfig.enabled ?? null,
          url: rawUrl ? rawUrl.replace(/secret=[^&]+/, "secret=***") : null,
          events: webhookConfig.events ?? null,
        }
      : null,
    totals: {
      messages: totalMessages,
      groups: groupsTotal,
      groupsLinkedToClient: groupsLinked,
    },
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      group: conversation.name,
      client: conversation.client?.name ?? "Sem cliente",
      lastMessageAt: conversation.lastMessageAt,
      messageCount: conversation._count.messages,
    })),
  })
}
