import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { snapshotProjectTasks } from "@/lib/templates"
import type { Prisma } from "@prisma/client"

// Lista os templates (com a contagem de tarefas).
export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const rows = await prisma.projectTemplate.findMany({ orderBy: { createdAt: "desc" } })
  const templates = rows.map((t) => ({ id: t.id, name: t.name, kind: t.kind, description: t.description, taskCount: Array.isArray(t.tasks) ? (t.tasks as unknown[]).length : 0 }))
  return NextResponse.json({ templates })
}

// Cria um template a partir de um projeto existente (snapshot de meta + tarefas).
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const b = await req.json().catch(() => ({}))
  const name = typeof b.name === "string" ? b.name.trim() : ""
  if (!name) return NextResponse.json({ error: "Informe o nome do template." }, { status: 400 })

  // Modo "em branco": cria template vazio pra montar no editor.
  if (b.blank || !b.fromProjectId) {
    const template = await prisma.projectTemplate.create({ data: { name, tasks: [] as unknown as Prisma.InputJsonValue, createdById: auth.user.userId } })
    return NextResponse.json({ template: { id: template.id, name: template.name, taskCount: 0 } })
  }
  if (typeof b.fromProjectId !== "string") return NextResponse.json({ error: "Projeto de origem ausente." }, { status: 400 })

  const project = await prisma.project.findUnique({ where: { id: b.fromProjectId } })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  const tasks = await snapshotProjectTasks(project.id)
  const template = await prisma.projectTemplate.create({
    data: {
      name, kind: project.kind, description: project.description, objectives: project.objectives, notes: project.notes,
      links: (project.links ?? undefined) as Prisma.InputJsonValue | undefined,
      tasks: tasks as unknown as Prisma.InputJsonValue,
      createdById: auth.user.userId,
    },
  })
  return NextResponse.json({ template: { id: template.id, name: template.name, taskCount: tasks.length } })
}
