import { prisma } from "@/lib/db"
import type { TaskPriority } from "@prisma/client"

export type TplSub = { title: string; priority?: string }
export type TplTask = { title: string; description?: string | null; priority?: string; estimateMin?: number | null; tagNames?: string[]; subtasks?: TplSub[] }

const PRIO = ["BAIXA", "MEDIA", "ALTA", "URGENTE"]
const prio = (p?: string): TaskPriority => (PRIO.includes(p ?? "") ? (p as TaskPriority) : "MEDIA")

// Garante tags (por nome) e devolve seus ids.
async function resolveTagIds(names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const name of [...new Set(names.filter((n) => n && n.trim()))]) {
    const tag = await prisma.tag.upsert({ where: { name: name.trim() }, update: {}, create: { name: name.trim(), color: "#FF8F50" } })
    ids.push(tag.id)
  }
  return ids
}

// Cria as tarefas (e subtarefas) do template dentro de um projeto recém-criado.
export async function materializeTemplateTasks(tasks: TplTask[], projectId: string, clientId: string | null, createdById: string): Promise<number> {
  let count = 0, order = 0
  for (const t of tasks) {
    if (!t?.title) continue
    const tagIds = await resolveTagIds(t.tagNames ?? [])
    const parent = await prisma.task.create({
      data: { title: t.title, description: t.description ?? null, priority: prio(t.priority), estimateMin: typeof t.estimateMin === "number" ? t.estimateMin : null, tagIds, projectId, clientId, status: "TODO", order: order++, createdById },
      select: { id: true },
    })
    count++
    let sOrder = 0
    for (const s of t.subtasks ?? []) {
      if (!s?.title) continue
      await prisma.task.create({ data: { title: s.title, priority: prio(s.priority), projectId, clientId, parentTaskId: parent.id, status: "TODO", order: sOrder++, createdById } })
      count++
    }
  }
  return count
}

// Tira um "retrato" das tarefas de topo (com subtarefas) de um projeto p/ virar template.
export async function snapshotProjectTasks(projectId: string): Promise<TplTask[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId, parentTaskId: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { title: true, description: true, priority: true, estimateMin: true, tagIds: true, subtasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { title: true, priority: true } } },
  })
  const allTagIds = [...new Set(tasks.flatMap((t) => t.tagIds))]
  const tagMap = new Map((await prisma.tag.findMany({ where: { id: { in: allTagIds } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]))
  return tasks.map((t) => ({
    title: t.title,
    description: t.description,
    priority: t.priority,
    estimateMin: t.estimateMin,
    tagNames: t.tagIds.map((id) => tagMap.get(id)).filter(Boolean) as string[],
    subtasks: t.subtasks.map((s) => ({ title: s.title, priority: s.priority })),
  }))
}
