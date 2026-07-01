import { prisma } from "@/lib/db"
import type { TaskPriority, RecurFreq } from "@prisma/client"
import { computeNextRun } from "@/lib/recurrence"

export type TplSub = { title: string; priority?: string }
export type TplRecur = { freq: string; interval?: number; weekdays?: number[] }
export type TplTask = { title: string; description?: string | null; priority?: string; estimateMin?: number | null; tagNames?: string[]; dueOffsetDays?: number | null; recur?: TplRecur | null; subtasks?: TplSub[] }

const PRIO = ["BAIXA", "MEDIA", "ALTA", "URGENTE"]
const FREQ = ["DIARIA", "SEMANAL", "MENSAL"]
const prio = (p?: string): TaskPriority => (PRIO.includes(p ?? "") ? (p as TaskPriority) : "MEDIA")
const addDays = (base: Date, n: number) => { const d = new Date(base.getTime()); d.setUTCDate(d.getUTCDate() + n); return d }

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
  const now = new Date()
  let count = 0, order = 0
  for (const t of tasks) {
    if (!t?.title) continue
    const tagIds = await resolveTagIds(t.tagNames ?? [])
    const dueDate = typeof t.dueOffsetDays === "number" ? addDays(now, t.dueOffsetDays) : null
    const parent = await prisma.task.create({
      data: { title: t.title, description: t.description ?? null, priority: prio(t.priority), estimateMin: typeof t.estimateMin === "number" ? t.estimateMin : null, tagIds, dueDate, projectId, clientId, status: "TODO", order: order++, createdById },
      select: { id: true },
    })
    count++
    // Recorrência do molde → cria TaskRecurrence e vincula à tarefa.
    if (t.recur && FREQ.includes(t.recur.freq)) {
      const freq = t.recur.freq as RecurFreq
      const interval = t.recur.interval && t.recur.interval > 0 ? Math.floor(t.recur.interval) : 1
      const ref = dueDate ?? now
      const weekdays = freq === "SEMANAL" ? (t.recur.weekdays ?? []).filter((w) => w >= 0 && w <= 6) : []
      const weekday = freq === "SEMANAL" && weekdays.length === 0 ? ref.getUTCDay() : null
      const dayOfMonth = freq === "MENSAL" ? ref.getUTCDate() : null
      const nextRunAt = computeNextRun({ freq, interval, weekday, weekdays, dayOfMonth }, ref)
      const rec = await prisma.taskRecurrence.create({ data: { projectId, clientId, title: t.title, description: t.description ?? null, priority: prio(t.priority), freq, interval, weekday, weekdays, dayOfMonth, nextRunAt, createdById } })
      await prisma.task.update({ where: { id: parent.id }, data: { recurrenceId: rec.id } })
    }
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
