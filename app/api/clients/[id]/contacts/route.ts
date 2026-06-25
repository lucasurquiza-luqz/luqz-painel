import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const contacts = await prisma.clientContact.findMany({
    where: { clientId: id },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  })
  return NextResponse.json({ contacts })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return NextResponse.json({ error: "Informe o nome do contato." }, { status: 400 })

  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)

  const contact = await prisma.clientContact.create({
    data: {
      clientId: id,
      name,
      role: str(body.role),
      email: str(body.email),
      phone: str(body.phone),
      notes: str(body.notes),
      isPrimary: body.isPrimary === true,
    },
  })
  return NextResponse.json({ contact }, { status: 201 })
}
