import { NextResponse } from "next/server"
import { AiProvider } from "@prisma/client"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

type Params = { params: Promise<{ provider: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const { provider } = await params
  if (!Object.values(AiProvider).includes(provider as AiProvider)) {
    return NextResponse.json({ error: "Provedor invalido." }, { status: 400 })
  }

  await prisma.aiCredential.deleteMany({ where: { provider: provider as AiProvider } })

  return NextResponse.json({ ok: true })
}
