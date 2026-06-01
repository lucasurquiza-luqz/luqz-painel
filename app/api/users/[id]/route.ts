import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const user = await prisma.user.update({
    where: { id },
    data: body,
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  return NextResponse.json({ user })
}
