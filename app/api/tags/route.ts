import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

// Lista todas as etiquetas (reutilizáveis em qualquer tarefa).
export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json({ tags })
}

// Cria uma etiqueta (ou retorna a existente de mesmo nome).
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const b = await req.json().catch(() => ({}))
  const name = typeof b.name === "string" ? b.name.trim() : ""
  if (!name) return NextResponse.json({ error: "Informe o nome da etiqueta." }, { status: 400 })
  const color = typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : "#FF8F50"
  const tag = await prisma.tag.upsert({ where: { name }, update: { color }, create: { name, color } })
  return NextResponse.json({ tag })
}
