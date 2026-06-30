import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"

type Params = { params: Promise<{ id: string }> }
const CATEGORIES = new Set(["PROPOSTA", "CONTRATO", "BRIEFING", "RELATORIO", "CRIATIVO", "ESTRATEGIA", "APRESENTACAO", "OUTRO"])

// Lista documentos do projeto + documentos do cliente ainda não atrelados (para anexar).
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const project = await prisma.project.findUnique({ where: { id }, select: { clientId: true } })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  const documents = await prisma.clientDocument.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  })
  // Docs do mesmo cliente que ainda não estão neste projeto (para "anexar existente").
  const available = project.clientId
    ? await prisma.clientDocument.findMany({ where: { clientId: project.clientId, projectId: null }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, category: true } })
    : []
  return NextResponse.json({ documents, available })
}

// POST: atrela um doc existente ({ docId }) OU cria um novo (link/arquivo) já no projeto.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response

  const project = await prisma.project.findUnique({ where: { id }, select: { clientId: true } })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  const b = await req.json().catch(() => ({}))

  if (typeof b.docId === "string" && b.docId) {
    await prisma.clientDocument.update({ where: { id: b.docId }, data: { projectId: id } })
    return NextResponse.json({ ok: true })
  }

  // Criar novo documento atrelado (precisa de cliente — projetos internos não têm doc por ora).
  if (!project.clientId) return NextResponse.json({ error: "Projeto interno não tem cliente para anexar documento." }, { status: 400 })
  const title = typeof b.title === "string" ? b.title.trim() : ""
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  const fileUrl = str(b.fileUrl), externalUrl = str(b.externalUrl)
  if (!title) return NextResponse.json({ error: "Informe o título." }, { status: 400 })
  if (!fileUrl && !externalUrl) return NextResponse.json({ error: "Anexe um arquivo ou informe um link." }, { status: 400 })

  const document = await prisma.clientDocument.create({
    data: {
      clientId: project.clientId, projectId: id, title,
      category: (typeof b.category === "string" && CATEGORIES.has(b.category) ? b.category : "OUTRO") as never,
      fileUrl, fileName: str(b.fileName), fileType: str(b.fileType), externalUrl,
      uploadedById: auth.user.userId,
    },
    include: { uploadedBy: { select: { name: true } } },
  })
  return NextResponse.json({ document })
}

// DELETE ?docId= : desatrela o doc do projeto (não apaga o documento).
export async function DELETE(req: NextRequest, { params }: Params) {
  await params
  const auth = await requireApiUser(["ADMIN", "OPERADOR"])
  if (!auth.ok) return auth.response
  const docId = req.nextUrl.searchParams.get("docId")
  if (docId) await prisma.clientDocument.update({ where: { id: docId }, data: { projectId: null } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
