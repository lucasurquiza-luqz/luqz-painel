import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"
import type { Role } from "@prisma/client"
import { prisma } from "@/lib/db"
import { sessionOptions, type SessionData } from "@/lib/auth"

export type ApiUser = {
  userId: string
  name: string
  email: string
  role: Role
  clientId: string | null
}

type AuthSuccess = { ok: true; user: ApiUser }
type AuthFailure = { ok: false; response: NextResponse }
export type AuthResult = AuthSuccess | AuthFailure

export async function requireApiUser(roles?: Role[]): Promise<AuthResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nao autorizado." }, { status: 401 }),
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clientId: true,
      active: true,
    },
  })

  if (!user?.active) {
    session.destroy()
    return {
      ok: false,
      response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }),
    }
  }

  if (user.role === "CLIENTE" && !user.clientId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Usuario sem cliente vinculado." }, { status: 403 }),
    }
  }

  if (roles && !roles.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acesso negado." }, { status: 403 }),
    }
  }

  return {
    ok: true,
    user: {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
    },
  }
}

// Comparação em tempo constante (evita timing attack na chave).
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

// Usuário virtual das chamadas por chave de serviço (automação LUQZ operando pela API).
const AUTOMATION_USER: ApiUser = {
  userId: "automation",
  name: "Automação LUQZ",
  email: "automation@luqz.com.br",
  role: "ADMIN",
  clientId: null,
}

// Aceita `Authorization: Bearer <AUTOMATION_API_KEY>` (ou header `x-api-key`) OU sessão logada.
// É o que permite a automação agendar posts pela API sem um login de navegador.
export async function requireApiKeyOrUser(req: NextRequest, roles?: Role[]): Promise<AuthResult> {
  const key = process.env.AUTOMATION_API_KEY
  if (key) {
    const authHeader = req.headers.get("authorization") ?? ""
    const bearer = /^bearer\s+/i.test(authHeader) ? authHeader.replace(/^bearer\s+/i, "").trim() : ""
    const provided = bearer || (req.headers.get("x-api-key") ?? "")
    if (provided && safeEqual(provided, key)) {
      return { ok: true, user: AUTOMATION_USER }
    }
  }
  return requireApiUser(roles)
}

export function canAccessClient(user: ApiUser, clientId: string) {
  return user.role === "ADMIN" || user.role === "OPERADOR" || user.clientId === clientId
}

export function denyClientAccess() {
  return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 })
}
