import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { groups: true, messages: true } },
    },
  })
  return NextResponse.json({ clients })
}

export async function POST(req: NextRequest) {
  const { name, description } = await req.json()
  if (!name) return NextResponse.json({ error: "Nome obrigatorio." }, { status: 400 })

  const client = await prisma.client.create({
    data: { name, description: description ?? null },
  })
  return NextResponse.json({ client }, { status: 201 })
}
