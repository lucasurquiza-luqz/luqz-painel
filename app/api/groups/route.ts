import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const groups = await prisma.group.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ groups })
}
