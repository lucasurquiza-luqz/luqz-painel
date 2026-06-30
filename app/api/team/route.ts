import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

// Usuários internos atribuíveis (responsável de tarefa). Acessível a ADMIN e OPERADOR.
export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "OPERADOR"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ users })
}
