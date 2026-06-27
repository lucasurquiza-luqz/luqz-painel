import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"
import { encryptSecret } from "@/lib/crypto-secrets"

type Params = { params: Promise<{ id: string }> }
const PROVIDERS = new Set(["META", "GOOGLE"])

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const accounts = await prisma.clientAdAccount.findMany({
    where: { clientId: id },
    select: { provider: true, accountId: true, lastFour: true, updatedAt: true },
  })
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const provider = typeof body.provider === "string" && PROVIDERS.has(body.provider) ? body.provider : null
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : ""
  if (!provider) return NextResponse.json({ error: "Provedor inválido." }, { status: 400 })
  if (!accountId) return NextResponse.json({ error: "Informe o ID da conta." }, { status: 400 })

  // Meta exige token por cliente; Google usa o MCC central (token não é necessário).
  const token = typeof body.token === "string" && body.token.trim() ? body.token.trim() : null
  const tokenEnc = token ? encryptSecret(token) : undefined
  const lastFour = token ? token.slice(-4) : undefined

  const account = await prisma.clientAdAccount.upsert({
    where: { clientId_provider: { clientId: id, provider: provider as never } },
    create: { clientId: id, provider: provider as never, accountId, tokenEnc: tokenEnc ?? null, lastFour: lastFour ?? null, updatedById: auth.user.userId },
    update: { accountId, ...(tokenEnc ? { tokenEnc, lastFour } : {}), updatedById: auth.user.userId },
    select: { provider: true, accountId: true, lastFour: true, updatedAt: true },
  })
  return NextResponse.json({ account })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const provider = req.nextUrl.searchParams.get("provider")
  if (!provider || !PROVIDERS.has(provider)) return NextResponse.json({ error: "Provedor inválido." }, { status: 400 })

  await prisma.clientAdAccount.deleteMany({ where: { clientId: id, provider: provider as never } })
  return NextResponse.json({ ok: true })
}
