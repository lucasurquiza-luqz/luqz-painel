import { prisma } from "@/lib/db"
import { AccountConfig } from "../_account-config"
import { HistorySyncButton } from "../_history-sync"
import { PillarsConfig } from "../_pillars-config"

export default async function InstagramConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const account = await prisma.instagramAccount.findUnique({
    where: { clientId },
    select: { id: true, igUserId: true, username: true },
  })
  const pillars = account
    ? await prisma.instagramPillar.findMany({ where: { accountId: account.id }, orderBy: { order: "asc" }, select: { id: true, label: true, color: true } })
    : []

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-5">
          <h2 className="text-sm font-medium text-zinc-300">Conta de Instagram</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Conecte a conta business do cliente para agendar e ler insights.</p>
        </div>
        <AccountConfig clientId={clientId} initial={account} />
      </div>
      {account && (
        <div className="max-w-xl">
          <PillarsConfig clientId={clientId} initial={pillars} />
        </div>
      )}
      {account && (
        <div className="max-w-xl">
          <HistorySyncButton clientId={clientId} />
        </div>
      )}
    </div>
  )
}
