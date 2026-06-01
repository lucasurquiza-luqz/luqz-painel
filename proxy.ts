import { NextResponse, type NextRequest } from "next/server"
import { unsealData } from "iron-session"
import { type SessionData } from "@/lib/auth"

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

  if (isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/agendamentos"
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith("/usuarios") || pathname.startsWith("/api/users")) {
    if (session.role !== "ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
      const url = request.nextUrl.clone()
      url.pathname = "/agendamentos"
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)"],
}
