import { prisma } from "./db"
import { decryptSecret } from "./crypto-secrets"
import { publishToInstagram } from "./instagram"
import type { InstagramScheduledPost, InstagramAccount } from "@prisma/client"

type PostWithAccount = InstagramScheduledPost & { account: InstagramAccount }

// Publica um post específico agora. Atualiza status/erro. Retorna o registro final.
async function publishPost(post: PostWithAccount): Promise<InstagramScheduledPost> {
  await prisma.instagramScheduledPost.update({
    where: { id: post.id },
    data: { status: "PUBLISHING", attempts: { increment: 1 }, error: null },
  })

  try {
    const token = decryptSecret(post.account.tokenEnc)
    const { mediaId, permalink } = await publishToInstagram({
      igUserId: post.account.igUserId,
      token,
      imageUrls: post.imageUrls,
      caption: post.caption,
    })
    return await prisma.instagramScheduledPost.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        igMediaId: mediaId,
        permalink,
        publishedAt: new Date(),
        error: null,
      },
    })
  } catch (err) {
    return await prisma.instagramScheduledPost.update({
      where: { id: post.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
    })
  }
}

// Cron (1 min): publica os posts PENDING cujo horário já venceu.
export async function publishDueInstagramPosts() {
  const now = new Date()
  const posts = await prisma.instagramScheduledPost.findMany({
    where: { status: "PENDING", scheduledAt: { lte: now } },
    include: { account: true },
    orderBy: { scheduledAt: "asc" },
  })
  if (posts.length === 0) return { published: 0, failed: 0 }

  let published = 0
  let failed = 0
  for (const post of posts) {
    const result = await publishPost(post)
    if (result.status === "PUBLISHED") published++
    else failed++
  }
  return { published, failed }
}

// Usado pela rota publish-now (teste / disparo manual). Publica independente do horário.
export async function publishPostNow(id: string): Promise<InstagramScheduledPost> {
  const post = await prisma.instagramScheduledPost.findUnique({
    where: { id },
    include: { account: true },
  })
  if (!post) throw new Error("Post não encontrado.")
  if (post.status === "PUBLISHED") throw new Error("Post já publicado.")
  if (post.status === "CANCELLED") throw new Error("Post cancelado.")
  return publishPost(post)
}
