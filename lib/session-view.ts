import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions, type SessionData } from "@/lib/auth"

// Papel EFETIVO da sessão (server-only). Quando um ADMIN/OPERADOR está com
// impersonate ligado, ele passa a ser tratado como CLIENTE daquele cliente —
// menu, telas e permissões viram as do cliente (preview read-only).
export type SessionView = {
  userId?: string
  name?: string
  role?: SessionData["role"]
  clientId?: string
  impersonating: boolean
  realRole?: SessionData["role"]
}

export async function getSessionView(): Promise<SessionView> {
  const s = await getIronSession<SessionData>(await cookies(), sessionOptions)
  const isEquipe = s.role === "ADMIN" || s.role === "OPERADOR"
  const impersonating = isEquipe && !!s.impersonateClientId
  return {
    userId: s.userId,
    name: s.name,
    role: impersonating ? "CLIENTE" : s.role,
    clientId: impersonating ? s.impersonateClientId : s.clientId,
    impersonating,
    realRole: s.role,
  }
}
