import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser } from "@/lib/api-auth"

async function accountFor(clientId: string) {
  return prisma.instagramAccount.findUnique({ where: { clientId }, select: { id: true } })
}

// Lista os pilares de conteúdo de um cliente.
export async function GET(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR", "CLIENTE"])
  if (!auth.ok) return auth.response

  let clientId = req.nextUrl.searchParams.get("clientId")
  if (auth.user.role === "CLIENTE") clientId = auth.user.clientId
  if (!clientId) return NextResponse.json({ pillars: [] })

  const account = await accountFor(clientId)
  if (!account) return NextResponse.json({ pillars: [] })

  const pillars = await prisma.instagramPillar.findMany({
    where: { accountId: account.id },
    orderBy: { order: "asc" },
    select: { id: true, label: true, color: true, order: true },
  })
  return NextResponse.json({ pillars })
}

// Salva a lista inteira: cria os novos, atualiza os existentes (por id) e remove os ausentes.
export async function PUT(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { clientId, pillars } = await req.json().catch(() => ({}))
  if (!clientId || !Array.isArray(pillars)) {
    return NextResponse.json({ error: "clientId e pillars[] obrigatórios." }, { status: 400 })
  }
  if (pillars.length > 12) return NextResponse.json({ error: "Máximo de 12 pilares." }, { status: 400 })

  const account = await accountFor(String(clientId))
  if (!account) return NextResponse.json({ error: "Cliente sem conta de Instagram." }, { status: 400 })

  const clean = pillars
    .map((p: { id?: string; label?: string; color?: string }, i: number) => ({
      id: p.id ? String(p.id) : undefined,
      label: String(p.label ?? "").trim().slice(0, 60),
      color: String(p.color ?? "#f59e0b"),
      order: i,
    }))
    .filter((p) => p.label)

  const keepIds = clean.filter((p) => p.id).map((p) => p.id as string)

  await prisma.$transaction([
    prisma.instagramPillar.deleteMany({ where: { accountId: account.id, id: { notIn: keepIds.length ? keepIds : ["__none__"] } } }),
    ...clean.map((p) =>
      p.id
        ? prisma.instagramPillar.update({ where: { id: p.id }, data: { label: p.label, color: p.color, order: p.order } })
        : prisma.instagramPillar.create({ data: { accountId: account.id, label: p.label, color: p.color, order: p.order } })
    ),
  ])

  const saved = await prisma.instagramPillar.findMany({
    where: { accountId: account.id },
    orderBy: { order: "asc" },
    select: { id: true, label: true, color: true, order: true },
  })
  return NextResponse.json({ pillars: saved })
}
