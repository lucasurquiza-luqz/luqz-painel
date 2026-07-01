import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

// Marca (ou limpa) o pilar de conteúdo de um post publicado.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { pillar } = await req.json().catch(() => ({}))

  const media = await prisma.instagramMedia.findUnique({ where: { id }, select: { accountId: true } })
  if (!media) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 })

  // pillar deve ser null (limpar) ou o id de um pilar cadastrado desta conta.
  if (pillar) {
    const exists = await prisma.instagramPillar.findFirst({
      where: { id: String(pillar), accountId: media.accountId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: "Pilar inválido." }, { status: 400 })
  }

  const updated = await prisma.instagramMedia.update({ where: { id }, data: { pillar: pillar || null } })
  return NextResponse.json({ pillar: updated.pillar })
}
