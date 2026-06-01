import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { active } = await req.json()
  const group = await prisma.group.update({ where: { id }, data: { active } })
  return NextResponse.json({ group })
}
