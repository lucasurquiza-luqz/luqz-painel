import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { saveProviderApiKey } from "@/lib/ai/credentials"

const VALID_PROVIDERS = ["OPENAI", "ANTHROPIC"] as const

export async function GET() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const credentials = await prisma.aiCredential.findMany({
    select: {
      provider: true,
      label: true,
      lastFour: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
    orderBy: { provider: "asc" },
  })

  return NextResponse.json({ credentials })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const { provider, label, apiKey } = await req.json()

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Provedor invalido." }, { status: 400 })
  }
  if (!apiKey?.trim() || apiKey.trim().length < 10) {
    return NextResponse.json({ error: "Chave invalida." }, { status: 400 })
  }

  const credential = await saveProviderApiKey(
    provider,
    label?.trim() || provider,
    apiKey.trim(),
    auth.user.userId
  )

  return NextResponse.json({
    credential: {
      provider: credential.provider,
      label: credential.label,
      lastFour: credential.lastFour,
      updatedAt: credential.updatedAt,
    },
  })
}
