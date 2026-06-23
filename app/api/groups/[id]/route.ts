import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { active } = await req.json()
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 })
  }
  const group = await prisma.group.update({ where: { id }, data: { active } })
  return NextResponse.json({ group })
}
