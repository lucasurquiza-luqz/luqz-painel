import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const groups = await prisma.group.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ groups })
}
