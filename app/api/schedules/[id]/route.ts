import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status } = await req.json()

  const message = await prisma.scheduledMessage.update({
    where: { id },
    data: { status },
  })
  return NextResponse.json({ message })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.scheduledMessage.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
