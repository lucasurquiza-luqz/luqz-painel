import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string; meetingId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId, meetingId } = await params

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, clientId },
    include: {
      createdBy: { select: { name: true } },
      summary: {
        include: {
          generatedBy: { select: { name: true } },
          items: {
            include: { reviewedBy: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })

  if (!meeting) return NextResponse.json({ error: "Reuniao nao encontrada." }, { status: 404 })

  return NextResponse.json({ meeting })
}