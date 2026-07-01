import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireApiKeyOrUser } from "@/lib/api-auth"
import { getPresignedUploadUrl } from "@/lib/storage"

// Devolve uma URL ASSINADA para o navegador subir o vídeo DIRETO no MinIO
// (sem passar pelo app nem pelo proxy — resolve arquivos grandes de Reel).
export async function POST(req: NextRequest) {
  const auth = await requireApiKeyOrUser(req, ["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const clientId = req.nextUrl.searchParams.get("clientId") ?? "misc"
  const { contentType } = await req.json().catch(() => ({}))
  const type = typeof contentType === "string" && contentType ? contentType : "video/mp4"

  const key = `clients/${clientId}/instagram/reels/${randomUUID()}.mp4`
  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, type)
  return NextResponse.json({ uploadUrl, publicUrl })
}
