import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { groups: true, messages: true } },
    },
  })
  return NextResponse.json({ clients })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { name, description } = await req.json()
  if (!name) return NextResponse.json({ error: "Nome obrigatorio." }, { status: 400 })

  const client = await prisma.client.create({
    data: { name: String(name).trim(), description: description ? String(description).trim() : null },
  })
  return NextResponse.json({ client }, { status: 201 })
}
