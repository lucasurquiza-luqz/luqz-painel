import { NextRequest, NextResponse } from "next/server"
import { requireApiKeyOrUser } from "@/lib/api-auth"

const IG_BASE = "https://graph.facebook.com/v21.0"

// Descobre as contas Instagram business acessíveis por um token (varre as Páginas do FB).
// Assim o usuário cola só o token e o Dash acha o igUserId + @username sozinho.
export async function POST(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const { token } = await req.json().catch(() => ({}))
  if (!token) return NextResponse.json({ error: "Token obrigatório." }, { status: 400 })

  const url = `${IG_BASE}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(String(token))}`
  const res = await fetch(url)
  const json = await res.json().catch(() => null)

  if (!res.ok || json?.error) {
    return NextResponse.json({ error: json?.error?.message ?? "Token inválido ou sem permissão." }, { status: 400 })
  }

  const seen = new Set<string>()
  const candidates: { igUserId: string; username: string | null; pageName: string }[] = []
  for (const page of json?.data ?? []) {
    const iga = page?.instagram_business_account
    if (iga?.id && !seen.has(iga.id)) {
      seen.add(iga.id)
      candidates.push({ igUserId: iga.id, username: iga.username ?? null, pageName: page.name ?? "" })
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: "Nenhuma conta Instagram business encontrada. A conta precisa ser Profissional e vinculada a uma Página do Facebook." }, { status: 400 })
  }

  return NextResponse.json({ candidates })
}
