import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/db"
import { formatInTimeZone } from "date-fns-tz"
import { EditScheduleForm } from "../../../_edit-form"

const TZ = "America/Sao_Paulo"

export default async function EditarProgramadoPage({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id: clientId, postId } = await params

  const post = await prisma.instagramScheduledPost.findUnique({ where: { id: postId } })
  if (!post || post.clientId !== clientId) notFound()

  const backHref = `/clientes/${clientId}/instagram/programados`

  if (post.status !== "PENDING") {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-zinc-500">Só dá pra editar posts que ainda estão agendados (pendentes).</p>
        <Link href={backHref} className="text-orange-400 text-sm mt-2 inline-block hover:underline">Voltar</Link>
      </div>
    )
  }

  const scheduledLocal = formatInTimeZone(post.scheduledAt, TZ, "yyyy-MM-dd'T'HH:mm")

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="p-2 rounded-xl text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Editar agendamento</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Ajuste a legenda e o horário (as imagens não mudam).</p>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        {post.imageUrls.slice(0, 4).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="w-16 h-20 object-cover rounded-lg border border-white/8" />
        ))}
        {post.imageUrls.length > 4 && <span className="text-xs text-zinc-600 self-end">+{post.imageUrls.length - 4}</span>}
      </div>

      <EditScheduleForm postId={postId} backHref={backHref} initialCaption={post.caption} initialScheduledAt={scheduledLocal} />
    </div>
  )
}
