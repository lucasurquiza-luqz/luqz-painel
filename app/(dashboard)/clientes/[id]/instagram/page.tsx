import Link from "next/link"
import { Plus, Instagram, Clock, Loader2, CheckCircle2, XCircle, Ban, ExternalLink, Images } from "lucide-react"
import { prisma } from "@/lib/db"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { notFound } from "next/navigation"

const TZ = "America/Sao_Paulo"

const STATUS_CONFIG = {
  PENDING:    { label: "Agendado",   color: "bg-yellow-500/15 text-yellow-400", icon: Clock },
  PUBLISHING: { label: "Publicando", color: "bg-orange-500/15 text-orange-400", icon: Loader2 },
  PUBLISHED:  { label: "Publicado",  color: "bg-green-500/15 text-green-400",    icon: CheckCircle2 },
  FAILED:     { label: "Falhou",     color: "bg-red-500/15 text-red-400",        icon: XCircle },
  CANCELLED:  { label: "Cancelado",  color: "bg-zinc-500/15 text-zinc-400",      icon: Ban },
}

export default async function ClienteInstagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, instagramAccount: { select: { username: true } } },
  })
  if (!client) notFound()

  const posts = await prisma.instagramScheduledPost.findMany({
    where: { clientId },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  })

  const account = client.instagramAccount

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Instagram</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {client.name}
            {account?.username && <span className="text-zinc-600"> · @{account.username}</span>}
          </p>
        </div>
        {account && (
          <Link
            href={`/clientes/${clientId}/instagram/novo`}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={16} />
            Novo post
          </Link>
        )}
      </div>

      {!account ? (
        <div className="text-center py-20 text-zinc-600">
          <Instagram size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Este cliente ainda não tem uma conta de Instagram conectada.</p>
          <p className="text-xs text-zinc-700 mt-1">Conecte a conta para agendar publicações.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Instagram size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum post agendado ainda.</p>
          <Link href={`/clientes/${clientId}/instagram/novo`} className="text-orange-400 text-sm mt-1 inline-block hover:underline">
            Agendar primeiro post
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const cfg = STATUS_CONFIG[post.status]
            const Icon = cfg.icon
            const thumb = post.imageUrls[0]

            return (
              <div key={post.id} className="bg-zinc-900 border border-white/8 rounded-2xl px-5 py-4 flex items-start gap-4">
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="w-14 h-[70px] object-cover rounded-lg border border-white/8 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-100 line-clamp-2 whitespace-pre-line">{post.caption}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Images size={12} />
                      {post.imageUrls.length === 1 ? "Imagem única" : `Carrossel · ${post.imageUrls.length}`}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatInTimeZone(post.scheduledAt, TZ, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {post.ref && <span className="text-xs text-zinc-600">{post.ref}</span>}
                    {post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-orange-400 hover:underline">
                        <ExternalLink size={12} />
                        Ver post
                      </a>
                    )}
                    {post.status === "FAILED" && post.error && (
                      <span className="text-xs text-red-400/80 truncate max-w-md" title={post.error}>{post.error}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium", cfg.color)}>
                    <Icon size={12} />
                    {cfg.label}
                  </span>
                  {post.status === "PENDING" && <CancelButton id={post.id} />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CancelButton({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server"
        await prisma.instagramScheduledPost.update({ where: { id }, data: { status: "CANCELLED" } })
      }}
    >
      <button type="submit" className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-900/10 cursor-pointer">
        Cancelar
      </button>
    </form>
  )
}
