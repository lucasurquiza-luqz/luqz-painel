import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { requireApiUser } from "@/lib/api-auth"

const MAX_SIZE = 20 * 1024 * 1024

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "audio/wav": "audio",
  "audio/mp4": "audio",
}

function detectType(mimeType: string): string | undefined {
  // Match direto
  if (ALLOWED_TYPES[mimeType]) return ALLOWED_TYPES[mimeType]
  // Match por prefixo (ex: "audio/webm; codecs=opus" → "audio/webm")
  const base = mimeType.split(";")[0].trim()
  return ALLOWED_TYPES[base]
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  const form = await req.formData()
  const file = form.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo muito grande (max 20MB)." }, { status: 400 })

  const mediaType = detectType(file.type)
  if (!mediaType) return NextResponse.json({ error: `Tipo nao permitido: ${file.type}` }, { status: 400 })

  const ext = file.name.split(".").pop() ?? "bin"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // base64 puro (sem prefixo data:mime) — formato que Evolution API aceita
  const base64 = buffer.toString("base64")

  // MinIO disponivel → usa MinIO
  if (process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY) {
    try {
      const { uploadToMinIO } = await import("@/lib/storage")
      const key = `uploads/${filename}`
      const url = await uploadToMinIO(key, buffer, file.type.split(";")[0].trim())
      return NextResponse.json({ url, type: mediaType, name: file.name, base64 })
    } catch (err) {
      console.error("[uploads] MinIO falhou, usando local:", err)
    }
  }

  // Fallback: armazenamento local
  const uploadDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/uploads/${filename}`
  return NextResponse.json({ url, type: mediaType, name: file.name, base64 })
}
