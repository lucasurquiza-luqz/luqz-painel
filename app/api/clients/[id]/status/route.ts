import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      statusReason: true,
      statusChangedAt: true,
      clickupFolderId: true,
      statusHistory: {
        select: {
          id: true,
          active: true,
          reason: true,
          source: true,
          changedAt: true,
          changedBy: { select: { id: true, name: true } },
        },
        orderBy: { changedAt: "desc" },
        take: 50,
      },
    },
  })

  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
  return NextResponse.json({ client })
}
