import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

const ROLES = new Set(["GESTOR_PROJETO", "TRAFEGO", "CONTEUDO", "COMERCIAL", "DESIGN", "OUTRO"])

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const teamMembers = await prisma.clientTeamMember.findMany({
    where: { clientId: id },
    orderBy: { role: "asc" },
    include: { user: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ teamMembers })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const role = typeof body.role === "string" && ROLES.has(body.role) ? body.role : "OUTRO"
  const userId = typeof body.userId === "string" && body.userId ? body.userId : null

  // Se veio um usuário do sistema, o nome vem dele; senão exige nome digitado.
  let name = typeof body.name === "string" ? body.name.trim() : ""
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    if (!user) return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 400 })
    name = user.name
  }
  if (!name) return NextResponse.json({ error: "Informe o responsavel." }, { status: 400 })

  const member = await prisma.clientTeamMember.create({
    data: { clientId: id, userId, name, role: role as never },
    include: { user: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ member }, { status: 201 })
}
