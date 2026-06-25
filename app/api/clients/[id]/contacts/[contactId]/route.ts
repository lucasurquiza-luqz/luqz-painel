import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string; contactId: string }> }

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, contactId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.clientContact.findFirst({ where: { id: contactId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Contato nao encontrado." }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if ("role" in body) data.role = str(body.role)
  if ("email" in body) data.email = str(body.email)
  if ("phone" in body) data.phone = str(body.phone)
  if ("notes" in body) data.notes = str(body.notes)
  if (typeof body.isPrimary === "boolean") data.isPrimary = body.isPrimary

  const contact = await prisma.clientContact.update({ where: { id: contactId }, data })
  return NextResponse.json({ contact })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, contactId } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const existing = await prisma.clientContact.findFirst({ where: { id: contactId, clientId: id } })
  if (!existing) return NextResponse.json({ error: "Contato nao encontrado." }, { status: 404 })

  await prisma.clientContact.delete({ where: { id: contactId } })
  return NextResponse.json({ ok: true })
}
