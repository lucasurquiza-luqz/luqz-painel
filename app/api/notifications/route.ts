import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

// Lista as notificações do usuário logado + contagem de não lidas.
export async function GET() {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: auth.user.userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: auth.user.userId, read: false } }),
  ])
  return NextResponse.json({ notifications, unread })
}

// Marca como lida: { id } uma, ou { all: true } todas.
export async function PATCH(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const b = await req.json().catch(() => ({}))
  if (b.all) await prisma.notification.updateMany({ where: { userId: auth.user.userId, read: false }, data: { read: true } })
  else if (typeof b.id === "string") await prisma.notification.updateMany({ where: { id: b.id, userId: auth.user.userId }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
