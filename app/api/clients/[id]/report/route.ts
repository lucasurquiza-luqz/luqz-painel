import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

// Dados "de agência" do relatório: o que FIZEMOS (tarefas concluídas no mês, com
// resultado) e os PRÓXIMOS PASSOS (tarefas abertas). Complementa a performance.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const month = req.nextUrl.searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 })
  const [y, m] = month.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))

  // Ações realizadas: tarefas-mãe concluídas no mês.
  const completed = await prisma.task.findMany({
    where: { clientId: id, status: "DONE", parentTaskId: null, completedAt: { gte: start, lt: end } },
    orderBy: { completedAt: "desc" },
    select: { id: true, title: true, completedAt: true, project: { select: { name: true } } },
    take: 100,
  })

  // Resultado de cada tarefa (fica na atividade COMPLETED).
  const resultById = new Map<string, string>()
  if (completed.length) {
    const acts = await prisma.activity.findMany({
      where: { entity: "TASK", entityId: { in: completed.map((t) => t.id) }, type: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, payload: true },
    })
    for (const a of acts) {
      const r = (a.payload as { result?: string } | null)?.result
      if (r && !resultById.has(a.entityId)) resultById.set(a.entityId, r)
    }
  }

  const actions = completed.map((t) => ({ id: t.id, title: t.title, project: t.project?.name ?? null, completedAt: t.completedAt, result: resultById.get(t.id) ?? null }))

  // Próximos passos: tarefas abertas (não concluídas), por prazo.
  const upcoming = await prisma.task.findMany({
    where: { clientId: id, status: { not: "DONE" }, parentTaskId: null },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    select: { id: true, title: true, dueDate: true, status: true, project: { select: { name: true } } },
    take: 20,
  })

  return NextResponse.json({ actions, upcoming })
}
