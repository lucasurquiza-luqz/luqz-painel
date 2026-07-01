import { NextRequest, NextResponse } from "next/server"
import { requireApiKeyOrUser } from "@/lib/api-auth"
import { publishPostNow } from "@/lib/instagram-scheduler"

type Params = { params: Promise<{ id: string }> }

// Publica um post imediatamente, ignorando o horário agendado (teste / disparo manual).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  try {
    const post = await publishPostNow(id)
    if (post.status === "FAILED") {
      return NextResponse.json({ post, error: post.error }, { status: 502 })
    }
    return NextResponse.json({ post })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao publicar." },
      { status: 400 }
    )
  }
}
