import { AiFunction, AiProvider } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { prisma } from "@/lib/db"
import { DEFAULTS, MODEL_OPTIONS, resolveModel } from "@/lib/ai/provider"

const FUNCTIONS = Object.values(AiFunction)
const PROVIDERS = Object.values(AiProvider)

export async function GET() {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const configs = await Promise.all(
    FUNCTIONS.map(async (fn) => {
      const resolved = await resolveModel(fn)
      const saved = await prisma.aiModelConfig.findUnique({ where: { function: fn } })
      return { function: fn, ...resolved, isDefault: !saved, default: DEFAULTS[fn] }
    })
  )

  return NextResponse.json({ configs, providers: PROVIDERS, modelOptions: MODEL_OPTIONS })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const { function: fn, provider, model } = await req.json()
  if (!FUNCTIONS.includes(fn)) return NextResponse.json({ error: "Função inválida." }, { status: 400 })
  if (!PROVIDERS.includes(provider)) return NextResponse.json({ error: "Provedor inválido." }, { status: 400 })
  if (typeof model !== "string" || !model.trim()) return NextResponse.json({ error: "Informe o modelo." }, { status: 400 })

  const config = await prisma.aiModelConfig.upsert({
    where: { function: fn },
    create: { function: fn, provider, model: model.trim(), updatedById: auth.user.userId },
    update: { provider, model: model.trim(), updatedById: auth.user.userId },
  })

  return NextResponse.json({ config })
}
