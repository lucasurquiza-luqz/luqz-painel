import {
  ContextDomain,
  ContextKind,
  ContextSourceType,
  ContextVisibility,
} from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

function enumHasValue<T extends Record<string, string>>(values: T, value: unknown): value is T[keyof T] {
  return typeof value === "string" && Object.values(values).includes(value)
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, clickupFolderId: true },
  })

  if (!client) {
    return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
  }

  const [items, snapshots] = await Promise.all([
    prisma.contextItem.findMany({
      where: { clientId },
      include: {
        source: true,
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        supersedes: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ status: "asc" }, { domain: "asc" }, { createdAt: "desc" }],
    }),
    prisma.contextSnapshot.findMany({
      where: { clientId },
      select: {
        id: true,
        version: true,
        checksum: true,
        compiledAt: true,
        compiledBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { version: "desc" },
    }),
  ])

  return NextResponse.json({ client, items, snapshots, currentUser: { role: auth.user.role } })
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const body = await req.json()
  const { domain, kind, visibility, title, content, validFrom, validUntil, supersedesId, source } = body

  if (!enumHasValue(ContextDomain, domain) || !enumHasValue(ContextKind, kind)) {
    return NextResponse.json({ error: "Dominio ou tipo de conhecimento invalido." }, { status: 400 })
  }

  if (visibility && !enumHasValue(ContextVisibility, visibility)) {
    return NextResponse.json({ error: "Visibilidade invalida." }, { status: 400 })
  }

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Titulo e conteudo sao obrigatorios." }, { status: 400 })
  }

  if (!source?.label?.trim() || !enumHasValue(ContextSourceType, source.type)) {
    return NextResponse.json({ error: "Fonte e tipo da fonte sao obrigatorios." }, { status: 400 })
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })

  if (supersedesId) {
    const previous = await prisma.contextItem.findFirst({
      where: { id: supersedesId, clientId },
      select: { id: true },
    })
    if (!previous) {
      return NextResponse.json({ error: "Item anterior nao encontrado neste cliente." }, { status: 400 })
    }
  }

  const item = await prisma.$transaction(async (tx) => {
    const createdSource = await tx.contextSource.create({
      data: {
        clientId,
        type: source.type,
        label: source.label.trim(),
        reference: source.reference?.trim() || null,
        checksum: source.checksum?.trim() || null,
        capturedAt: source.capturedAt ? new Date(source.capturedAt) : new Date(),
      },
    })

    return tx.contextItem.create({
      data: {
        clientId,
        sourceId: createdSource.id,
        domain,
        kind,
        visibility: visibility ?? "INTERNAL",
        title: title.trim(),
        content: content.trim(),
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        supersedesId: supersedesId || null,
        createdById: auth.user.userId,
      },
      include: {
        source: true,
        createdBy: { select: { id: true, name: true } },
      },
    })
  })

  return NextResponse.json({ item }, { status: 201 })
}
