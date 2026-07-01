import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import type { InstagramPostStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser, canAccessClient } from "@/lib/api-auth"
import { uploadBase64ToMinIO } from "@/lib/storage"

const VALID_STATUS = ["PENDING", "PUBLISHING", "PUBLISHED", "FAILED", "CANCELLED"]

// Lista posts agendados/publicados. Filtra por cliente e status (opcionais).
export async function GET(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR", "CLIENTE"])
  if (!auth.ok) return auth.response

  let clientId = req.nextUrl.searchParams.get("clientId")
  if (auth.user.role === "CLIENTE") clientId = auth.user.clientId
  if (clientId && !canAccessClient(auth.user, clientId)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const statusParam = req.nextUrl.searchParams.get("status")
  const where: Prisma.InstagramScheduledPostWhereInput = {}
  if (clientId) where.clientId = clientId
  if (statusParam && VALID_STATUS.includes(statusParam)) where.status = statusParam as InstagramPostStatus

  const posts = await prisma.instagramScheduledPost.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      account: { select: { username: true } },
    },
    take: 100,
  })
  return NextResponse.json({ posts })
}

// Agenda um post. Imagens via `images` (base64 → MinIO) ou `imageUrls` (já públicas).
// 1 imagem = frase; 2-10 = carrossel.
export async function POST(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { clientId, caption, scheduledAt, images, imageUrls, ref } = await req.json()
  if (!clientId || !caption || !scheduledAt) {
    return NextResponse.json({ error: "Campos obrigatórios: clientId, caption, scheduledAt." }, { status: 400 })
  }
  if (String(caption).length > 2200) {
    return NextResponse.json({ error: "Legenda passa de 2200 caracteres." }, { status: 400 })
  }

  const account = await prisma.instagramAccount.findUnique({ where: { clientId: String(clientId) } })
  if (!account) {
    return NextResponse.json({ error: "Cliente sem conta de Instagram cadastrada." }, { status: 400 })
  }

  const scheduled = new Date(scheduledAt)
  if (Number.isNaN(scheduled.getTime())) {
    return NextResponse.json({ error: "scheduledAt inválido (use ISO 8601)." }, { status: 400 })
  }

  // Resolve as imagens.
  let urls: string[] = []
  if (Array.isArray(images) && images.length > 0) {
    const folder = randomUUID()
    for (let i = 0; i < images.length; i++) {
      const key = `clients/${clientId}/instagram/${folder}/slide-${String(i + 1).padStart(2, "0")}.jpg`
      urls.push(await uploadBase64ToMinIO(key, String(images[i]), "image/jpeg"))
    }
  } else if (Array.isArray(imageUrls) && imageUrls.length > 0) {
    urls = imageUrls.map(String)
  }
  if (urls.length < 1 || urls.length > 10) {
    return NextResponse.json({ error: "Envie 1 a 10 imagens (images base64 ou imageUrls)." }, { status: 400 })
  }

  const post = await prisma.instagramScheduledPost.create({
    data: {
      clientId: String(clientId),
      accountId: account.id,
      caption: String(caption),
      imageUrls: urls,
      scheduledAt: scheduled,
      ref: ref ? String(ref) : null,
      createdById: auth.user.userId,
    },
    include: { client: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ post }, { status: 201 })
}
