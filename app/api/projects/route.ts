import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { logActivity } from "@/lib/tasks"

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const clientId = req.nextUrl.searchParams.get("clientId")
  const projects = await prisma.project.findMany({
    where: { ...(clientId ? { clientId } : {}) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, name: true, description: true, kind: true, status: true, clientId: true,
      client: { select: { name: true } },
      _count: { select: { tasks: true } },
    },
  })
  return NextResponse.json({ projects })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return NextResponse.json({ error: "Informe o nome do projeto." }, { status: 400 })

  // Projeto SÓ existe atrelado a um cliente.
  const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null
  if (!clientId) return NextResponse.json({ error: "Todo projeto precisa de um cliente." }, { status: 400 })

  const KINDS = ["CONTEUDO", "TRAFEGO", "ONBOARDING", "WEB", "COMERCIAL", "OUTRO"]
  const project = await prisma.project.create({
    data: {
      name,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      kind: KINDS.includes(body.kind) ? body.kind : "OUTRO",
      clientId,
      ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : null,
      createdById: auth.user.userId,
    },
  })
  await logActivity("PROJECT", project.id, { userId: auth.user.userId, name: auth.user.name }, "CREATED", { name })
  return NextResponse.json({ project })
}
