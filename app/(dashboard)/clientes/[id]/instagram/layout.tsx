import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { InstagramTabs } from "./_tabs"

export default async function InstagramLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, instagramAccount: { select: { username: true } } },
  })
  if (!client) notFound()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-100">Instagram</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {client.name}
          {client.instagramAccount?.username && (
            <span className="text-zinc-600"> · @{client.instagramAccount.username}</span>
          )}
        </p>
      </div>
      <InstagramTabs clientId={clientId} />
      {children}
    </div>
  )
}
