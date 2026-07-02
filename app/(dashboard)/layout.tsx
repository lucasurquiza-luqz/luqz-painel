import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getSessionView } from "@/lib/session-view"
import { Sidebar } from "@/components/Sidebar"
import { ImpersonationBanner } from "@/components/ImpersonationBanner"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const view = await getSessionView()

  if (!view.userId) redirect("/login")

  // Nome do cliente impersonado, pra barra do topo.
  const impersonated = view.impersonating && view.clientId
    ? await prisma.client.findUnique({ where: { id: view.clientId }, select: { name: true } })
    : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)]">
      {impersonated && <ImpersonationBanner clientName={impersonated.name} />}
      <div className="flex min-h-0 flex-1">
        <Sidebar role={view.role ?? ""} name={view.name ?? ""} />
        <main className="dash-scrollbar flex-1 overflow-y-auto bg-[var(--app-bg)]">
          {children}
        </main>
      </div>
    </div>
  )
}
