import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

// Reordenação manual: recebe a ordem dos ids e grava `order` = índice.
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const b = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(b.ids) ? b.ids.filter((x: unknown): x is string => typeof x === "string") : []
  if (!ids.length) return NextResponse.json({ ok: true })

  await prisma.$transaction(ids.map((id, i) => prisma.task.update({ where: { id }, data: { order: i } })))
  return NextResponse.json({ ok: true })
}
