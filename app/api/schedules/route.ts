import { NextRequest, NextResponse } from "next/server"
import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { sessionOptions, type SessionData } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId")

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
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.userId) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })

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
      createdById: session.userId,
      groups: {
        create: (groupIds as string[]).map((groupId) => ({ groupId })),
      },
    },
  })

  return NextResponse.json({ message }, { status: 201 })
}
