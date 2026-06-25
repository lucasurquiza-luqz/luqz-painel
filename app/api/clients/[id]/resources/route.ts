import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

const CATEGORIES = new Set(["DRIVE", "ANALYTICS", "ADS", "SITE", "SOCIAL", "CREDENTIALS", "OTHER"])

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  const resources = await prisma.clientResource.findMany({
    where: { clientId: id },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  })
  return NextResponse.json({ resources })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === "string" ? body.label.trim() : ""
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!label) return NextResponse.json({ error: "Informe o nome do link." }, { status: 400 })
  if (!url) return NextResponse.json({ error: "Informe a URL." }, { status: 400 })

  const category = typeof body.category === "string" && CATEGORIES.has(body.category) ? body.category : "OTHER"
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null

  const resource = await prisma.clientResource.create({
    data: { clientId: id, label, url, category: category as never, notes },
  })
  return NextResponse.json({ resource }, { status: 201 })
}
