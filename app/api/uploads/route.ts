import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "document",
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo muito grande (max 20MB)." }, { status: 400 })

  const mediaType = ALLOWED_TYPES[file.type]
  if (!mediaType) return NextResponse.json({ error: "Tipo de arquivo nao permitido." }, { status: 400 })

  const ext = file.name.split(".").pop() ?? "bin"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const filePath = path.join(UPLOAD_DIR, filename)

  await mkdir(UPLOAD_DIR, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return NextResponse.json({
    path: `/uploads/${filename}`,
    type: mediaType,
  })
}
