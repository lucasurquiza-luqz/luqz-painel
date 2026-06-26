// Cliente da API REST do ClickUp — usado APENAS na migração única dos clientes
// ativos para o Dash. O ClickUp será descontinuado; isto é uma ponte, não uma
// integração viva. Token e lista vêm do ambiente do Dash.

const API = "https://api.clickup.com/api/v2"
// Lista "Clientes" (espaço Administrativo) onde vivem os cards cadastrais.
const CLIENTES_LIST_ID = process.env.CLICKUP_CLIENTES_LIST_ID || "901314255524"

export class ClickUpNotConfiguredError extends Error {
  constructor() {
    super("Token do ClickUp não configurado. Defina CLICKUP_API_KEY no ambiente do Dash.")
  }
}

type CustomField = {
  name: string
  type: string
  value?: unknown
  type_config?: { options?: Array<{ id: string; name?: string; label?: string; orderindex?: number }> }
}
export type ClickUpTask = { id: string; name: string; custom_fields?: CustomField[] }

function authHeader(): Record<string, string> {
  const token = process.env.CLICKUP_API_KEY
  if (!token) throw new ClickUpNotConfiguredError()
  return { Authorization: token }
}

// Busca todos os cards da lista "Clientes" (paginado).
export async function fetchClientCards(): Promise<ClickUpTask[]> {
  const headers = authHeader()
  const tasks: ClickUpTask[] = []
  for (let page = 0; page < 20; page++) {
    const url = `${API}/list/${CLIENTES_LIST_ID}/task?include_closed=true&subtasks=false&page=${page}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`ClickUp respondeu ${res.status} ao listar a lista de clientes.`)
    const data = (await res.json()) as { tasks?: ClickUpTask[]; last_page?: boolean }
    tasks.push(...(data.tasks ?? []))
    if (data.last_page || !data.tasks?.length) break
  }
  return tasks
}

// Acha um custom field por nome (tolerante a espaços/maiúsculas) e resolve o valor.
function field(task: ClickUpTask, ...names: string[]): unknown {
  const norm = (s: string) => s.trim().toLowerCase()
  for (const name of names) {
    const f = task.custom_fields?.find((cf) => norm(cf.name) === norm(name))
    if (!f || f.value === undefined || f.value === null || f.value === "") continue
    return resolveValue(f)
  }
  return null
}

function resolveValue(f: CustomField): unknown {
  const v = f.value
  if (f.type === "drop_down") {
    const o = f.type_config?.options?.find((o) => o.id === v || o.orderindex === v)
    return o ? o.name ?? o.label : v
  }
  if (f.type === "labels" && Array.isArray(v)) {
    return v.map((id) => f.type_config?.options?.find((o) => o.id === id)?.label ?? id)
  }
  if (f.type === "users" && Array.isArray(v)) {
    return (v as Array<{ username?: string; email?: string }>).map((u) => u.username ?? u.email).filter(Boolean)
  }
  if (f.type === "location" && v && typeof v === "object") {
    return (v as { formatted_address?: string }).formatted_address ?? null
  }
  return v
}

function asText(v: unknown): string | null {
  if (v == null) return null
  if (Array.isArray(v)) return v.length ? String(v[0]).trim() : null
  const s = String(v).trim()
  return s || null
}
function asNumber(v: unknown): number | null {
  if (v == null) return null
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."))
  return isFinite(n) && n !== 0 ? n : null
}
function asDate(v: unknown): string | null {
  if (v == null) return null
  const ms = Number(v)
  if (!isFinite(ms)) return null
  return new Date(ms).toISOString()
}
function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  const s = asText(v)
  return s ? [s] : []
}

export type MappedCadastro = {
  business: { legalName: string | null; cnpj: string | null; segment: string | null; website: string | null; instagram: string | null; region: string | null; description: string | null }
  contract: { product: string | null; contractValue: number | null; ticket: number | null; billingCycle: string | null; contractStart: string | null; renewalDate: string | null; projectPhase: string | null }
  contacts: Array<{ name: string; role: string | null; email: string | null; phone: string | null; isPrimary: boolean }>
  team: Array<{ name: string; role: "GESTOR_PROJETO" | "TRAFEGO" | "CONTEUDO" | "COMERCIAL" | "DESIGN" | "OUTRO" }>
}

// Mapeia um card do ClickUp para os campos do cadastro do Dash (só cadastro).
export function mapCardToCadastro(task: ClickUpTask): MappedCadastro {
  const decisor = asText(field(task, "Nome Decisor", "Nome Decisor / responsável pelo projeto"))
  const email = asText(field(task, "Personal Email", "E-mail Pessoal", "E-mail"))
  const phone = asText(field(task, "Telefone", "Telefone da Empresa", "Personal Number"))

  const teamRaw: Array<[string, MappedCadastro["team"][number]["role"]]> = []
  for (const n of asList(field(task, "Costumer Success", "Customer Success"))) teamRaw.push([n, "GESTOR_PROJETO"])
  for (const n of asList(field(task, "Supervisor"))) teamRaw.push([n, "GESTOR_PROJETO"])
  for (const n of asList(field(task, "Gestor de Tráfego"))) teamRaw.push([n, "TRAFEGO"])
  for (const n of asList(field(task, "Social Media Responsável"))) teamRaw.push([n, "CONTEUDO"])
  // Dedup por nome (mantém o primeiro papel).
  const seen = new Set<string>()
  const team = teamRaw.filter(([n]) => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .map(([name, role]) => ({ name, role }))

  return {
    business: {
      legalName: asText(field(task, "Razão Social")),
      cnpj: asText(field(task, "CNPJ")),
      segment: asText(field(task, "Nicho", "Ramo de Atuação")),
      website: asText(field(task, "Site", "Client Site")),
      instagram: asText(field(task, "Instagram")),
      region: asText(field(task, "Localização", "Endereço Comercial")),
      description: asText(field(task, "Em uma frase: o que sua empresa faz?")),
    },
    contract: {
      product: asText(field(task, "Produto Contratado")),
      contractValue: asNumber(field(task, "MRR")),
      ticket: asNumber(field(task, "Ticket médio aproximado:")),
      billingCycle: asText(field(task, "Subscription Type")),
      contractStart: asDate(field(task, "Início do Contrato")),
      renewalDate: asDate(field(task, "Fim do Contrato")),
      projectPhase: asText(field(task, "Account Stage - Estágio da Conta")),
    },
    contacts: decisor ? [{ name: decisor, role: "Decisor", email, phone, isPrimary: true }] : [],
    team,
  }
}

// Normaliza nome para casar card do ClickUp com cliente do Dash.
export function normalizeName(name: string): string {
  // remove acentos (combining diacritics U+0300–U+036F)
  return name.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").trim().toLowerCase()
}
