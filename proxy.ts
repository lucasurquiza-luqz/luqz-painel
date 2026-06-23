import { NextResponse, type NextRequest } from "next/server"
import { unsealData } from "iron-session"
import { type SessionData, isEquipe } from "@/lib/auth"

const publicPaths = ["/login"]
const apiPublicPaths = ["/api/auth/login", "/api/webhook/evolution"]

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

  // CLIENTE so acessa o proprio cliente
  if (session.role === "CLIENTE" && session.clientId) {
    const allowed = `/clientes/${session.clientId}`
    if (!pathname.startsWith(allowed) && !pathname.startsWith("/api/")) {
      const url = request.nextUrl.clone()
      url.pathname = `${allowed}/chat`
      return NextResponse.redirect(url)
    }

    // APIs: bloqueia acesso a outros clientes
    if (pathname.startsWith("/api/clients/") && !pathname.startsWith(`/api/clients/${session.clientId}`)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
  }

  // So equipe acessa pagina de usuarios
  if (pathname.startsWith("/usuarios") || pathname.startsWith("/api/users")) {
    if (!isEquipe(session.role ?? "")) {
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
