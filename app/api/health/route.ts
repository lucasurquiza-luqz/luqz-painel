import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

// Marcador de build: bumpado a cada release para confirmar, sem login, qual
// versao esta efetivamente no ar (o middleware bloqueia as demais rotas /api).
const BUILD_MARKER = "impersonate-ver-como-cliente-2026-07-01"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", database: "connected", build: BUILD_MARKER })
  } catch {
    return NextResponse.json(
      { status: "error", database: "unavailable", build: BUILD_MARKER },
      { status: 503 },
    )
  }
}
