import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"

type Params = { params: Promise<{ id: string }> }

// Comentário = entrada de histórico do tipo COMMENTED (tudo na mesma timeline).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { body } = await req.json().catch(() => ({}))
  if (typeof body !== "string" || !body.trim()) return NextResponse.json({ error: "Comentário vazio." }, { status: 400 })

  const exists = await prisma.task.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  await logActivity("TASK", id, { userId: auth.user.userId, name: auth.user.name }, "COMMENTED", { body: body.trim() })
  return NextResponse.json({ ok: true })
}
