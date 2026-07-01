import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireApiKeyOrUser } from "@/lib/api-auth"
import { uploadToMinIO } from "@/lib/storage"

// Recebe o arquivo de vídeo (multipart), sobe pro MinIO e devolve a URL pública
// que a Graph API vai baixar para publicar o Reel.
export async function POST(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const clientId = req.nextUrl.searchParams.get("clientId") ?? "misc"
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo de vídeo obrigatório." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const key = `clients/${clientId}/instagram/reels/${randomUUID()}.mp4`
  const url = await uploadToMinIO(key, buffer, file.type || "video/mp4")
  return NextResponse.json({ url })
}
