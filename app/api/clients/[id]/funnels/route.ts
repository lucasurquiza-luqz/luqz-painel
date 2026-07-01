import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR", "CLIENTE"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const funnels = await prisma.clientFunnel.findMany({
    where: { clientId: id },
    orderBy: { order: "asc" },
    select: { id: true, name: true, terms: true, order: true },
  })
  return NextResponse.json({ funnels })
}

// PUT: substitui o conjunto de funis do cliente (edição simples de tudo de uma vez).
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const body = await req.json().catch(() => ({}))
  const raw = Array.isArray(body.funnels) ? body.funnels : null
  if (!raw) return NextResponse.json({ error: "Envie funnels[]." }, { status: 400 })

  const funnels = raw
    .map((f: { name?: unknown; terms?: unknown }, i: number) => ({
      name: typeof f.name === "string" ? f.name.trim() : "",
      terms: Array.isArray(f.terms) ? f.terms.filter((t: unknown): t is string => typeof t === "string" && t.trim() !== "").map((t: string) => t.trim()) : [],
      order: i,
    }))
    .filter((f: { name: string }) => f.name !== "")

  await prisma.$transaction([
    prisma.clientFunnel.deleteMany({ where: { clientId: id } }),
    ...(funnels.length ? [prisma.clientFunnel.createMany({ data: funnels.map((f: { name: string; terms: string[]; order: number }) => ({ clientId: id, ...f })) })] : []),
  ])

  const saved = await prisma.clientFunnel.findMany({ where: { clientId: id }, orderBy: { order: "asc" }, select: { id: true, name: true, terms: true, order: true } })
  return NextResponse.json({ funnels: saved })
}
