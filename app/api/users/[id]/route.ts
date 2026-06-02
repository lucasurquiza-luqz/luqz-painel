import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { password, ...rest } = await req.json()

  const data: Record<string, unknown> = { ...rest }

  if (password) {
    data.password = await bcrypt.hash(password, 12)
  }

  // Limpa clientId se role nao for CLIENTE
  if (rest.role && rest.role !== "CLIENTE") {
    data.clientId = null
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, name: true, email: true, role: true,
      active: true, clientId: true,
      client: { select: { name: true } },
    },
  })

  return NextResponse.json({ user })
}
