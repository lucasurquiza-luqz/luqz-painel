import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      groups: { orderBy: { name: "asc" } },
      messages: {
        orderBy: { scheduledAt: "desc" },
        take: 5,
        include: {
          createdBy: { select: { name: true } },
          groups: { include: { group: { select: { name: true } } } },
        },
      },
    },
  })
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
  return NextResponse.json({ client })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const client = await prisma.client.update({ where: { id }, data: body })
  return NextResponse.json({ client })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.client.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
