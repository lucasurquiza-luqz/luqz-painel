import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClient, denyClientAccess, requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }

const CATEGORIES = new Set(["PROPOSTA", "CONTRATO", "BRIEFING", "RELATORIO", "CRIATIVO", "ESTRATEGIA", "APRESENTACAO", "OUTRO"])
const VISIBILITIES = new Set(["INTERNAL", "CLIENT"])

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  if (!canAccessClient(auth.user, id)) return denyClientAccess()

  // CLIENTE só enxerga documentos aprovados e marcados como visíveis ao cliente.
  const clientOnly = auth.user.role === "CLIENTE"

  const documents = await prisma.clientDocument.findMany({
    where: {
      clientId: id,
      ...(clientOnly ? { status: "APPROVED", visibility: "CLIENT" } : {}),
    },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    include: {
      uploadedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  })
  return NextResponse.json({ documents })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (!title) return NextResponse.json({ error: "Informe o título do documento." }, { status: 400 })

  const category = typeof body.category === "string" && CATEGORIES.has(body.category) ? body.category : "OUTRO"
  const visibility = typeof body.visibility === "string" && VISIBILITIES.has(body.visibility) ? body.visibility : "INTERNAL"
  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null)

  const fileUrl = str(body.fileUrl)
  const externalUrl = str(body.externalUrl)
  if (!fileUrl && !externalUrl) {
    return NextResponse.json({ error: "Anexe um arquivo ou informe um link." }, { status: 400 })
  }

  const document = await prisma.clientDocument.create({
    data: {
      clientId: id,
      title,
      category: category as never,
      visibility: visibility as never,
      fileUrl,
      fileName: str(body.fileName),
      fileType: str(body.fileType),
      externalUrl,
      notes: str(body.notes),
      uploadedById: auth.user.userId,
    },
    include: { uploadedBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
  })
  return NextResponse.json({ document }, { status: 201 })
}
