import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"
import { notifyUsers, parseMentions, taskLink } from "@/lib/notifications"

type Params = { params: Promise<{ id: string }> }

// Comentário = entrada de histórico do tipo COMMENTED (tudo na mesma timeline).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { body } = await req.json().catch(() => ({}))
  if (typeof body !== "string" || !body.trim()) return NextResponse.json({ error: "Comentário vazio." }, { status: 400 })

  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true, clientId: true, projectId: true } })
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 })

  const text = body.trim()
  await logActivity("TASK", id, { userId: auth.user.userId, name: auth.user.name }, "COMMENTED", { body: text })

  // Notifica os mencionados (@Nome) no comentário.
  if (text.includes("@")) {
    const team = await prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "OPERADOR"] } }, select: { id: true, name: true } })
    const mentioned = parseMentions(text, team)
    if (mentioned.length) {
      await notifyUsers(mentioned, auth.user.userId, {
        type: "MENTION",
        title: `${auth.user.name} mencionou você`,
        body: `${task.title}: ${text.slice(0, 120)}`,
        link: taskLink(task),
        taskId: id,
        actorName: auth.user.name,
      })
    }
  }
  return NextResponse.json({ ok: true })
}
