import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiUser } from "@/lib/api-auth"
import { fetchClientCards, mapCardToCadastro, normalizeName, ClickUpNotConfiguredError } from "@/lib/clickup"

// Migração única: importa o cadastro dos clientes ativos a partir dos cards do
// ClickUp. Preenche apenas campos VAZIOS (não sobrescreve edição manual) e só
// cria contatos/responsáveis se o cliente ainda não tiver nenhum.
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(["ADMIN"])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const dryRun = body.dryRun !== false // padrão: preview

  let cards
  try {
    cards = await fetchClientCards()
  } catch (error) {
    if (error instanceof ClickUpNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler o ClickUp." }, { status: 502 })
  }

  // Index dos cards por nome normalizado.
  const cardByName = new Map<string, (typeof cards)[number]>()
  for (const card of cards) cardByName.set(normalizeName(card.name), card)

  const clients = await prisma.client.findMany({
    where: { active: true },
    include: { _count: { select: { contacts: true, teamMembers: true } } },
  })

  const report = {
    dryRun,
    totalCards: cards.length,
    totalClients: clients.length,
    matched: [] as Array<{ client: string; card: string; fieldsToFill: string[]; contacts: number; team: number }>,
    unmatchedClients: [] as string[],
  }

  for (const client of clients) {
    const card = cardByName.get(normalizeName(client.name))
    if (!card) { report.unmatchedClients.push(client.name); continue }

    const mapped = mapCardToCadastro(card)
    const data: Record<string, unknown> = {}
    const fieldsToFill: string[] = []

    // Só preenche campo que está vazio no Dash.
    const setIfEmpty = (key: string, value: unknown) => {
      if (value == null || value === "") return
      if ((client as Record<string, unknown>)[key]) return
      data[key] = value
      fieldsToFill.push(key)
    }
    setIfEmpty("legalName", mapped.business.legalName)
    setIfEmpty("cnpj", mapped.business.cnpj)
    setIfEmpty("segment", mapped.business.segment)
    setIfEmpty("website", mapped.business.website)
    setIfEmpty("instagram", mapped.business.instagram)
    setIfEmpty("region", mapped.business.region)
    setIfEmpty("description", mapped.business.description)
    setIfEmpty("product", mapped.contract.product)
    setIfEmpty("contractValue", mapped.contract.contractValue)
    setIfEmpty("ticket", mapped.contract.ticket)
    setIfEmpty("billingCycle", mapped.contract.billingCycle)
    setIfEmpty("projectPhase", mapped.contract.projectPhase)
    if (mapped.contract.contractStart && !client.contractStart) { data.contractStart = new Date(mapped.contract.contractStart); fieldsToFill.push("contractStart") }
    if (mapped.contract.renewalDate && !client.renewalDate) { data.renewalDate = new Date(mapped.contract.renewalDate); fieldsToFill.push("renewalDate") }

    const willCreateContacts = client._count.contacts === 0 ? mapped.contacts.length : 0
    const willCreateTeam = client._count.teamMembers === 0 ? mapped.team.length : 0

    report.matched.push({ client: client.name, card: card.name, fieldsToFill, contacts: willCreateContacts, team: willCreateTeam })

    if (dryRun) continue

    if (fieldsToFill.length > 0) {
      await prisma.client.update({ where: { id: client.id }, data })
    }
    if (willCreateContacts > 0) {
      await prisma.clientContact.createMany({
        data: mapped.contacts.map((c) => ({ clientId: client.id, ...c })),
      })
    }
    if (willCreateTeam > 0) {
      await prisma.clientTeamMember.createMany({
        data: mapped.team.map((m) => ({ clientId: client.id, name: m.name, role: m.role })),
      })
    }
  }

  return NextResponse.json({ report })
}
