import { NextRequest, NextResponse } from "next/server"
import { uploadToMinIO } from "@/lib/storage"

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

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

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo muito grande (max 20MB)." }, { status: 400 })

  const mediaType = ALLOWED_TYPES[file.type]
  if (!mediaType) return NextResponse.json({ error: "Tipo de arquivo nao permitido." }, { status: 400 })

  const ext = file.name.split(".").pop() ?? "bin"
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadToMinIO(key, buffer, file.type)

  return NextResponse.json({ url, type: mediaType, name: file.name })
}