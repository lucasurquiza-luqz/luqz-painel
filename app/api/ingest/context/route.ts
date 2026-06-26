import { ContextDomain, ContextKind, ContextSourceType } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeName } from "@/lib/clickup"

// Ingestão única de contexto (Torre do ClickUp + diretórios) → Contexto Vivo.
// Rota pública no middleware, protegida por secret (a ferramenta local envia).
// Cada doc/página vira UM item (PROPOSED) num domínio. Idempotente por (cliente,
// fonte, título). Nada vira oficial sozinho — entra como proposta para revisão.

type IngestItem = {
  clientName: string
  domain: string
  kind?: string
  title: string
  content: string
  sourceType?: string // FILE | INTEGRATION | MANUAL | GROUP | MEETING
  sourceLabel: string
  sourceRef?: string
}

const DOMAINS = new Set(Object.values(ContextDomain))
const KINDS = new Set(Object.values(ContextKind))
const SOURCE_TYPES = new Set(Object.values(ContextSourceType))

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret")
  if (!process.env.INGEST_SECRET || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const items: IngestItem[] = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ error: "Nenhum item enviado." }, { status: 400 })

  // Atribuição: precisa de um usuário (createdById). Usa o primeiro ADMIN.
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  if (!admin) return NextResponse.json({ error: "Nenhum usuario ADMIN para atribuir." }, { status: 500 })

  const clients = await prisma.client.findMany({ select: { id: true, name: true } })
  const clientByName = new Map(clients.map((c) => [normalizeName(c.name), c]))

  const report = { created: 0, skipped: 0, unmatched: new Set<string>(), byClient: {} as Record<string, number> }

  for (const item of items) {
    if (!item?.clientName || !item.title?.trim() || !item.content?.trim() || !item.sourceLabel?.trim()) {
      report.skipped++
      continue
    }
    const client = clientByName.get(normalizeName(item.clientName))
    if (!client) { report.unmatched.add(item.clientName); continue }

    const domain = DOMAINS.has(item.domain as ContextDomain) ? (item.domain as ContextDomain) : "CLIENTE"
    const kind = KINDS.has(item.kind as ContextKind) ? (item.kind as ContextKind) : "FACT"
    const sourceType = SOURCE_TYPES.has(item.sourceType as ContextSourceType) ? (item.sourceType as ContextSourceType) : "FILE"

    // Idempotência: mesmo cliente + mesmo título já ingerido → pula.
    const existing = await prisma.contextItem.findFirst({
      where: { clientId: client.id, title: item.title.trim() },
      select: { id: true },
    })
    if (existing) { report.skipped++; continue }

    await prisma.$transaction(async (tx) => {
      const source = await tx.contextSource.create({
        data: {
          clientId: client.id,
          type: sourceType,
          label: item.sourceLabel.trim(),
          reference: item.sourceRef?.trim() || null,
        },
      })
      await tx.contextItem.create({
        data: {
          clientId: client.id,
          sourceId: source.id,
          domain,
          kind,
          status: "PROPOSED",
          visibility: "INTERNAL",
          title: item.title.trim(),
          content: item.content.trim(),
          createdById: admin.id,
        },
      })
    })
    report.created++
    report.byClient[client.name] = (report.byClient[client.name] ?? 0) + 1
  }

  return NextResponse.json({
    report: { ...report, unmatched: [...report.unmatched] },
  })
}
