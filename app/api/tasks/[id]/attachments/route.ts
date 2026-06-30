import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"

type Params = { params: Promise<{ id: string }> }

// Anexa um arquivo/link à tarefa (o upload em si vai por /api/uploads antes).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const b = await req.json().catch(() => ({}))
  const name = typeof b.name === "string" ? b.name.trim() : ""
  const url = typeof b.url === "string" ? b.url.trim() : ""
  if (!name || !url) return NextResponse.json({ error: "Informe nome e URL do anexo." }, { status: 400 })

  const task = await prisma.task.findUnique({ where: { id }, select: { id: true } })
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  const attachment = await prisma.taskAttachment.create({
    data: { taskId: id, name, url, type: typeof b.type === "string" ? b.type : "link", uploadedById: auth.user.userId, uploadedByName: auth.user.name },
  })
  await logActivity("TASK", id, { userId: auth.user.userId, name: auth.user.name }, "EDITED", { field: "anexo", to: name })
  return NextResponse.json({ attachment })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const attachmentId = req.nextUrl.searchParams.get("attachmentId")
  if (attachmentId) await prisma.taskAttachment.deleteMany({ where: { id: attachmentId, taskId: id } })
  return NextResponse.json({ ok: true })
}
