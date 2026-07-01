import { prisma } from "@/lib/db"
import { AccountConfig } from "../_account-config"

export default async function InstagramConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const account = await prisma.instagramAccount.findUnique({
    where: { clientId },
    select: { igUserId: true, username: true },
  })

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-sm font-medium text-zinc-300">Conta de Instagram</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Conecte a conta business do cliente para agendar e ler insights.</p>
      </div>
      <AccountConfig clientId={clientId} initial={account} />
    </div>
  )
}
