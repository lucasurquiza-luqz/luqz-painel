import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { DEPOSITO_SANTA_HELENA_PROPOSALS } from "@/lib/pilots/deposito-santa-helena"

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const { id: clientId } = await params
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })

  const isPilot =
    client.clickupFolderId === "901317617481" ||
    client.name.localeCompare("Deposito Santa Helena", "pt-BR", { sensitivity: "base" }) === 0

  if (!isPilot) {
    return NextResponse.json({ error: "Esta importacao pertence somente ao cliente piloto Deposito Santa Helena." }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    let created = 0
    let skipped = 0

    for (const proposal of DEPOSITO_SANTA_HELENA_PROPOSALS) {
      const existing = await tx.contextItem.findFirst({
        where: { clientId, title: proposal.title, domain: proposal.domain },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }

      const checksum = createHash("sha256")
        .update(`${proposal.sourceReference}:${proposal.title}:${proposal.content}`)
        .digest("hex")

      const source = await tx.contextSource.create({
        data: {
          clientId,
          type: "FILE",
          label: proposal.sourceLabel,
          reference: proposal.sourceReference,
          checksum,
          capturedAt: new Date(proposal.capturedAt),
        },
      })

      await tx.contextItem.create({
        data: {
          clientId,
          sourceId: source.id,
          domain: proposal.domain,
          kind: proposal.kind,
          status: "PROPOSED",
          visibility: "INTERNAL",
          title: proposal.title,
          content: proposal.content,
          createdById: auth.user.userId,
        },
      })
      created++
    }

    return { created, skipped, total: DEPOSITO_SANTA_HELENA_PROPOSALS.length }
  })

  return NextResponse.json(result)
}
