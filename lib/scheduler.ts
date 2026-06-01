import { prisma } from "./db"
import { sendText, sendMedia } from "./evolution"

export async function sendDueMessages() {
  const now = new Date()

  const messages = await prisma.scheduledMessage.findMany({
    where: { status: "PENDING", scheduledAt: { lte: now } },
    include: { groups: { include: { group: true } } },
  })

  if (messages.length === 0) return

  for (const msg of messages) {
    await prisma.scheduledMessage.update({
      where: { id: msg.id },
      data: { status: "SENDING" },
    })

    const logs: { groupId: string; groupName: string; status: string; response?: string; error?: string }[] = []
    let allOk = true

    for (const gm of msg.groups) {
      const { group } = gm
      try {
        let response: unknown

        if (msg.mediaPath) {
          const mediaUrl = `${process.env.NEXT_PUBLIC_APP_URL}${msg.mediaPath}`
          const type = (msg.mediaType as "image" | "document" | "video") ?? "document"
          response = await sendMedia(group.remoteJid, mediaUrl, type, msg.text, msg.mediaName ?? undefined)
        } else {
          response = await sendText(group.remoteJid, msg.text)
        }

        logs.push({
          groupId: group.id,
          groupName: group.name,
          status: "SENT",
          response: JSON.stringify(response),
        })
      } catch (err) {
        allOk = false
        logs.push({
          groupId: group.id,
          groupName: group.name,
          status: "FAILED",
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    await prisma.scheduledMessage.update({
      where: { id: msg.id },
      data: {
        status: allOk ? "SENT" : "FAILED",
        sentAt: new Date(),
      },
    })

    await prisma.messageLog.createMany({
      data: logs.map((l) => ({ ...l, messageId: msg.id })),
    })
  }
}
