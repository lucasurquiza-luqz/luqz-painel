import { createHash } from "crypto"
import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } })
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })

  const items = await prisma.contextItem.findMany({
    where: { clientId, status: "ACTIVE" },
    include: { source: true },
    orderBy: [{ domain: "asc" }, { createdAt: "asc" }],
  })

  if (!items.length) {
    return NextResponse.json({ error: "Ative ao menos um item antes de gerar o snapshot." }, { status: 400 })
  }

  const latest = await prisma.contextSnapshot.findFirst({
    where: { clientId },
    select: { version: true },
    orderBy: { version: "desc" },
  })
  const version = (latest?.version ?? 0) + 1

  const domains = items.reduce<Record<string, Array<Record<string, unknown>>>>((result, item) => {
    result[item.domain] ??= []
    result[item.domain].push({
      id: item.id,
      kind: item.kind,
      visibility: item.visibility,
      title: item.title,
      content: item.content,
      validFrom: item.validFrom?.toISOString() ?? null,
      validUntil: item.validUntil?.toISOString() ?? null,
      source: {
        id: item.source.id,
        type: item.source.type,
        label: item.source.label,
        reference: item.source.reference,
        checksum: item.source.checksum,
      },
    })
    return result
  }, {})

  const content = {
    client: { id: client.id, name: client.name },
    version,
    generatedAt: new Date().toISOString(),
    domains,
  }
  const serialized = JSON.stringify(content)
  const checksum = createHash("sha256").update(serialized).digest("hex")

  const snapshot = await prisma.contextSnapshot.create({
    data: {
      clientId,
      version,
      content: content as Prisma.InputJsonValue,
      checksum,
      compiledById: auth.user.userId,
      items: {
        create: items.map((item, position) => ({ itemId: item.id, position })),
      },
    },
    select: {
      id: true,
      version: true,
      checksum: true,
      compiledAt: true,
      _count: { select: { items: true } },
    },
  })

  return NextResponse.json({ snapshot }, { status: 201 })
}
