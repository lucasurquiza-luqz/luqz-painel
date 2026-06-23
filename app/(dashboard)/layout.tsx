import { cookies } from "next/headers"
import { getIronSession } from "iron-session"
import { redirect } from "next/navigation"
import { sessionOptions, type SessionData } from "@/lib/auth"
import { Sidebar } from "@/components/Sidebar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (!session.userId) redirect("/login")

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--app-bg)]">
      <Sidebar role={session.role} name={session.name} />
      <main className="dash-scrollbar flex-1 overflow-y-auto bg-[var(--app-bg)]">
        {children}
      </main>
    </div>
  )
}
