// Seed de teste: preenche o cadastro completo da Apex Trade a partir dos dados
// reais do ClickUp. Idempotente — pode rodar de novo sem duplicar.
//
// Como rodar (onde o DATABASE_URL aponta para o banco do Dash):
//   cd luqz-painel
//   node --env-file=.env scripts/seed-apex-trade.mjs
// (ou apenas `node scripts/seed-apex-trade.mjs` se DATABASE_URL já estiver no ambiente)

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const CLICKUP_FOLDER_ID = "901316650777"

const PROFILE = {
  // Negócio do cliente
  legalName: "Apex Trade Ltda",
  cnpj: "35.684.584/0001-46",
  segment: "Consultoria Empresarial",
  website: "http://www.apextrade.com.br",
  instagram: "http://instagram.com/MaikBarbara.PLM",
  region: "Franca - SP",
  description: "Consultoria empresarial em Franca-SP. Escopo LUQZ: gestão de social media e produção de criativos.",
  // Contrato (LUQZ × cliente)
  product: "Social Media e Produção de Criativos",
  contractValue: 1600, // MRR
  billingCycle: "Mensal",
  projectPhase: "Ongoing",
}

const CONTACTS = [
  {
    name: "Maik Anderson Bárbara",
    role: "Sócio proprietário / Decisor",
    email: "Maik@apextrade.com.br",
    phone: "+55 16 98111 9034",
    isPrimary: true,
    notes: "Empresário. E-mail pessoal alternativo: Cubicscria@yahoo.com.br",
  },
]

const TEAM = [
  { name: "Gustavo Queiroz Cunha", role: "GESTOR_PROJETO" }, // CS / Supervisor / Gestor
  { name: "Igor Daniel Cintra", role: "CONTEUDO" }, // Social Media responsável
]

async function main() {
  // Localiza a Apex Trade pela referência do ClickUp ou pelo nome.
  const client =
    (await prisma.client.findUnique({ where: { clickupFolderId: CLICKUP_FOLDER_ID } })) ??
    (await prisma.client.findFirst({ where: { name: { equals: "Apex Trade", mode: "insensitive" } } }))

  if (!client) {
    console.error("Apex Trade não encontrada no banco. Importe a carteira primeiro.")
    process.exit(1)
  }

  await prisma.client.update({ where: { id: client.id }, data: PROFILE })
  console.log("✓ Perfil/contrato atualizados.")

  // Contatos: cria só os que ainda não existem (por nome).
  for (const c of CONTACTS) {
    const exists = await prisma.clientContact.findFirst({ where: { clientId: client.id, name: c.name } })
    if (exists) { console.log(`· contato já existe: ${c.name}`); continue }
    await prisma.clientContact.create({ data: { clientId: client.id, ...c } })
    console.log(`✓ contato criado: ${c.name}`)
  }

  // Responsáveis LUQZ: idem.
  for (const m of TEAM) {
    const exists = await prisma.clientTeamMember.findFirst({ where: { clientId: client.id, name: m.name } })
    if (exists) { console.log(`· responsável já existe: ${m.name}`); continue }
    await prisma.clientTeamMember.create({ data: { clientId: client.id, name: m.name, role: m.role } })
    console.log(`✓ responsável criado: ${m.name} (${m.role})`)
  }

  console.log("\nApex Trade preenchida com sucesso.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
