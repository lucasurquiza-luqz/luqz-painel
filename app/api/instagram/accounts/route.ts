import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiKeyOrUser } from "@/lib/api-auth"
import { encryptSecret } from "@/lib/crypto-secrets"

// Lista as contas de Instagram cadastradas (sem expor o token).
export async function GET(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const accounts = await prisma.instagramAccount.findMany({
    select: {
      id: true,
      clientId: true,
      igUserId: true,
      username: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ accounts })
}

// Cadastra/atualiza a conta de Instagram de um cliente (token cifrado no banco).
export async function POST(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { clientId, igUserId, username, token } = await req.json()
  if (!clientId || !igUserId || !token) {
    return NextResponse.json({ error: "Campos obrigatórios: clientId, igUserId, token." }, { status: 400 })
  }

  const client = await prisma.client.findUnique({ where: { id: String(clientId) } })
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })

  const tokenEnc = encryptSecret(String(token))
  const account = await prisma.instagramAccount.upsert({
    where: { clientId: String(clientId) },
    create: { clientId: String(clientId), igUserId: String(igUserId), username: username ? String(username) : null, tokenEnc },
    update: { igUserId: String(igUserId), username: username ? String(username) : null, tokenEnc },
    select: { id: true, clientId: true, igUserId: true, username: true },
  })
  return NextResponse.json({ account }, { status: 201 })
}
