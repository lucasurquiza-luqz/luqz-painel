import { NextResponse, type NextRequest } from "next/server"
import { unsealData } from "iron-session"
import { type SessionData, isEquipe } from "@/lib/auth"
import { clientHome, isClientAllowedPath } from "@/lib/client-access"

const publicPaths = ["/login"]
const apiPublicPaths = ["/api/auth/login", "/api/webhook/evolution", "/api/health", "/api/ingest"]

async function getSession(request: NextRequest): Promise<Partial<SessionData>> {
  const cookieValue = request.cookies.get("luqz_session")?.value
  if (!cookieValue) return {}
  try {
    return await unsealData<SessionData>(cookieValue, { password: process.env.SESSION_SECRET! })
  } catch {
    return {}
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/_next") || pathname.startsWith("/uploads")) {
    return NextResponse.next()
  }

  // Automação LUQZ: chamadas a /api/instagram/* com AUTOMATION_API_KEY válida
  // passam direto pro handler (que refaz a verificação). Sem sessão de navegador.
  if (pathname.startsWith("/api/instagram")) {
    const key = process.env.AUTOMATION_API_KEY?.trim()
    if (key) {
      const authHeader = request.headers.get("authorization") ?? ""
      const bearer = /^bearer\s+/i.test(authHeader) ? authHeader.replace(/^bearer\s+/i, "").trim() : ""
      const provided = (bearer || (request.headers.get("x-api-key") ?? "")).trim()
      if (provided && provided === key) {
        return NextResponse.next()
      }
    }
  }

  if (apiPublicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getSession(request)

  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))

  if (!session.userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
    if (!isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return response
  }

  if (session.role === "CLIENTE" && !session.clientId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Usuario sem cliente vinculado." }, { status: 403 })
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    const redirect = NextResponse.redirect(url)
    redirect.cookies.delete("luqz_session")
    return redirect
  }

  // Apos login: redireciona conforme o role
  if (isPublic) {
    const url = request.nextUrl.clone()
    if (session.role === "CLIENTE" && session.clientId) {
      url.pathname = `/clientes/${session.clientId}/chat`
    } else {
      url.pathname = "/clientes"
    }
    return NextResponse.redirect(url)
  }

  // Papel EFETIVO: ADMIN/OPERADOR com impersonate ligado é confinado ao painel do
  // cliente impersonado, igual a um CLIENTE de verdade.
  const impersonating = (session.role === "ADMIN" || session.role === "OPERADOR") && !!session.impersonateClientId
  const effRole = impersonating ? "CLIENTE" : session.role
  const effClientId = impersonating ? session.impersonateClientId : session.clientId

  // CLIENTE (real ou impersonado): acesso restrito ao proprio cliente e apenas a superficie liberada.
  if (effRole === "CLIENTE" && effClientId) {
    if (pathname.startsWith("/api/")) {
      // /api/impersonate (ligar/desligar) sempre passa; a autorizacao fina fica no handler.
      if (pathname.startsWith("/api/impersonate")) {
        // segue o fluxo normal
      } else if (pathname.startsWith("/api/clients/") && !pathname.startsWith(`/api/clients/${effClientId}`)) {
        // APIs: bloqueia outros clientes; a autorizacao fina fica em requireApiUser.
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
    } else if (!isClientAllowedPath(pathname, effClientId)) {
      // Paginas internas (tarefas, cadastro, contexto, etc.) e outros clientes
      // caem aqui e voltam pra home do cliente. Allowlist em lib/client-access.ts.
      const url = request.nextUrl.clone()
      url.pathname = clientHome(effClientId)
      return NextResponse.redirect(url)
    }
  }

  // Somente ADMIN gerencia usuarios
  if (pathname.startsWith("/usuarios") || pathname.startsWith("/api/users")) {
    if (session.role !== "ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
      const url = request.nextUrl.clone()
      url.pathname = "/clientes"
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)"],
}
