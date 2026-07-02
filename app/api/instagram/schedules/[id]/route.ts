import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

// Edita um post ainda PENDING (legenda e/ou horário).
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const post = await prisma.instagramScheduledPost.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 })
  if (post.status !== "PENDING") {
    return NextResponse.json({ error: "Só dá pra editar posts pendentes." }, { status: 400 })
  }

  const { caption, scheduledAt, pillar } = await req.json()
  const data: Prisma.InstagramScheduledPostUpdateInput = {}
  if (caption !== undefined) {
    if (String(caption).length > 2200) {
      return NextResponse.json({ error: "Legenda passa de 2200 caracteres." }, { status: 400 })
    }
    data.caption = String(caption)
  }
  if (scheduledAt !== undefined) {
    const d = new Date(scheduledAt)
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "scheduledAt inválido (use ISO 8601)." }, { status: 400 })
    }
    data.scheduledAt = d
  }
  if (pillar !== undefined) {
    data.pillar = pillar ? String(pillar) : null
  }

  const updated = await prisma.instagramScheduledPost.update({ where: { id }, data })
  return NextResponse.json({ post: updated })
}

// Cancela um post (não publicado). Mantém o histórico com status CANCELLED.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const post = await prisma.instagramScheduledPost.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 })
  if (post.status === "PUBLISHED") {
    return NextResponse.json({ error: "Post já publicado, não dá pra cancelar." }, { status: 400 })
  }

  const updated = await prisma.instagramScheduledPost.update({
    where: { id },
    data: { status: "CANCELLED" },
  })
  return NextResponse.json({ post: updated })
}
