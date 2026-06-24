import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, requireApiUser } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  let clientId = req.nextUrl.searchParams.get("clientId")
  if (auth.user.role === "CLIENTE") clientId = auth.user.clientId
  if (clientId && !canAccessClient(auth.user, clientId)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const messages = await prisma.scheduledMessage.findMany({
    where: clientId ? { clientId } : {},
    orderBy: { scheduledAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      client: { select: { id: true, name: true } },
      groups: { include: { group: { select: { name: true } } } },
    },
    take: 100,
  })
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { text, scheduledAt, groupIds, clientId, mediaPath, mediaType, mediaName } = await req.json()

  if (!text || !scheduledAt || !groupIds?.length) {
    return NextResponse.json({ error: "Campos obrigatorios: text, scheduledAt, groupIds." }, { status: 400 })
  }

  const scheduled = new Date(scheduledAt)
  if (scheduled <= new Date()) {
    return NextResponse.json({ error: "A data deve ser no futuro." }, { status: 400 })
  }

  const message = await prisma.scheduledMessage.create({
    data: {
      text,
      scheduledAt: scheduled,
      mediaPath: mediaPath ?? null,
      mediaType: mediaType ?? null,
      mediaName: mediaName ?? null,
      clientId: clientId ?? null,
      createdById: auth.user.userId,
      groups: {
        create: (groupIds as string[]).map((groupId) => ({ groupId })),
      },
    },
  })

  return NextResponse.json({ message }, { status: 201 })
}
