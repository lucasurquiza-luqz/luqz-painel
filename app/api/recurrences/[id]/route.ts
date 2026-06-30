import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof b.active === "boolean") data.active = b.active
  const recurrence = await prisma.taskRecurrence.update({ where: { id }, data })
  return NextResponse.json({ recurrence })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  await prisma.taskRecurrence.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
