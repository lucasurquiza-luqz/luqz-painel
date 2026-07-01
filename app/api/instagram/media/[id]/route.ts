import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser } from "@/lib/api-auth"
import { PILLAR_KEYS } from "@/lib/instagram-pillars"

type Params = { params: Promise<{ id: string }> }

// Marca (ou limpa) o pilar de conteúdo de um post publicado.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { pillar } = await req.json().catch(() => ({}))
  if (pillar !== null && !PILLAR_KEYS.includes(pillar)) {
    return NextResponse.json({ error: "Pilar inválido." }, { status: 400 })
  }

  const media = await prisma.instagramMedia.findUnique({ where: { id } })
  if (!media) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 })

  const updated = await prisma.instagramMedia.update({ where: { id }, data: { pillar } })
  return NextResponse.json({ pillar: updated.pillar })
}
