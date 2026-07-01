import Link from "next/link"
import { prisma } from "@/lib/db"
import { BarChart3, Instagram, Heart, Bookmark, Share2, Radar, Eye, Play, MessageCircle } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import type { Prisma } from "@prisma/client"
import { PillarSelect } from "../_pillar-select"

const TZ = "America/Sao_Paulo"

const TYPE_LABEL: Record<string, string> = { IMAGE: "Imagem", VIDEO: "Reel / Vídeo", CAROUSEL_ALBUM: "Carrossel" }

const SORTS: { key: string; label: string; field: keyof Prisma.InstagramMediaOrderByWithRelationInput }[] = [
  { key: "reach", label: "Alcance", field: "reach" },
  { key: "views", label: "Visualizações", field: "views" },
  { key: "saved", label: "Salvamentos", field: "saved" },
  { key: "shares", label: "Compart.", field: "shares" },
  { key: "interactions", label: "Interações", field: "interactions" },
  { key: "recent", label: "Recentes", field: "timestamp" },
]

const nf = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n))

export default async function InstagramAnalisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sort?: string }>
}) {
  const { id: clientId } = await params
  const { sort } = await searchParams
  const activeSort = SORTS.find((s) => s.key === sort) ?? SORTS[0]

  const account = await prisma.instagramAccount.findUnique({ where: { clientId }, select: { id: true } })
  if (!account) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <Instagram size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Conecte a conta em Configurações para ver a análise.</p>
      </div>
    )
  }

  const [media, pillars] = await Promise.all([
    prisma.instagramMedia.findMany({
      where: { accountId: account.id },
      orderBy: { [activeSort.field]: { sort: "desc", nulls: "last" } },
      take: 60,
    }),
    prisma.instagramPillar.findMany({ where: { accountId: account.id }, orderBy: { order: "asc" }, select: { id: true, label: true, color: true } }),
  ])

  if (media.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-600">
        <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Nenhum post sincronizado ainda.</p>
        <Link href={`/clientes/${clientId}/instagram`} className="text-orange-400 text-sm mt-1 inline-block hover:underline">
          Ir para Visão geral e clicar em Atualizar
        </Link>
      </div>
    )
  }

  // Comparação por formato (médias)
  const byType = new Map<string, { count: number; reach: number; interactions: number; saved: number }>()
  for (const m of media) {
    const key = m.mediaType ?? "OUTRO"
    const acc = byType.get(key) ?? { count: 0, reach: 0, interactions: 0, saved: 0 }
    acc.count++
    acc.reach += m.reach ?? 0
    acc.interactions += m.interactions ?? 0
    acc.saved += m.saved ?? 0
    byType.set(key, acc)
  }
  const formats = [...byType.entries()].map(([type, v]) => ({
    type,
    label: TYPE_LABEL[type] ?? type,
    count: v.count,
    avgReach: Math.round(v.reach / v.count),
    avgInteractions: Math.round(v.interactions / v.count),
    avgSaved: Math.round(v.saved / v.count),
  })).sort((a, b) => b.avgReach - a.avgReach)

  // Comparação por pilar (médias) — só posts marcados
  const byPillar = new Map<string, { count: number; reach: number; interactions: number; saved: number }>()
  for (const m of media) {
    if (!m.pillar) continue
    const acc = byPillar.get(m.pillar) ?? { count: 0, reach: 0, interactions: 0, saved: 0 }
    acc.count++
    acc.reach += m.reach ?? 0
    acc.interactions += m.interactions ?? 0
    acc.saved += m.saved ?? 0
    byPillar.set(m.pillar, acc)
  }
  const pillarStats = pillars.map((p) => {
    const v = byPillar.get(p.id)
    return { ...p, count: v?.count ?? 0, avgReach: v ? Math.round(v.reach / v.count) : 0, avgInteractions: v ? Math.round(v.interactions / v.count) : 0, avgSaved: v ? Math.round(v.saved / v.count) : 0 }
  })
  const taggedCount = media.filter((m) => m.pillar).length

  return (
    <div className="space-y-6">
      {/* Desempenho por pilar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-300">Desempenho por pilar</h2>
          <span className="text-xs text-zinc-600">{taggedCount} de {media.length} posts marcados</span>
        </div>
        {pillars.length === 0 ? (
          <p className="text-sm text-zinc-600 bg-zinc-900 border border-white/8 rounded-2xl p-5">
            Nenhum pilar cadastrado. Defina os pilares deste cliente em <span className="text-zinc-400">Configurações → Pilares de conteúdo</span>.
          </p>
        ) : taggedCount === 0 ? (
          <p className="text-sm text-zinc-600 bg-zinc-900 border border-white/8 rounded-2xl p-5">Marque os posts com um pilar na lista abaixo para comparar qual rende mais.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {pillarStats.map((p) => (
              <div key={p.id} className="bg-zinc-900 border border-white/8 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="text-xs text-zinc-300 font-medium leading-tight">{p.label}</span>
                </div>
                {p.count === 0 ? (
                  <p className="text-xs text-zinc-600">Sem posts</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-zinc-500">Alcance méd.</span><span className="text-zinc-200 font-medium">{nf(p.avgReach)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-zinc-500">Interações</span><span className="text-zinc-200 font-medium">{nf(p.avgInteractions)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-zinc-500">Salvam.</span><span className="text-zinc-200 font-medium">{nf(p.avgSaved)}</span></div>
                    <p className="text-[10px] text-zinc-600 pt-1">{p.count} post{p.count !== 1 ? "s" : ""}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparação por formato */}
      <div>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Desempenho médio por formato</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {formats.map((f) => (
            <div key={f.type} className="bg-zinc-900 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-200 font-medium">{f.label}</span>
                <span className="text-xs text-zinc-600">{f.count} posts</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-semibold text-zinc-100">{nf(f.avgReach)}</p><p className="text-[10px] text-zinc-500">alcance méd.</p></div>
                <div><p className="text-lg font-semibold text-zinc-100">{nf(f.avgInteractions)}</p><p className="text-[10px] text-zinc-500">interações</p></div>
                <div><p className="text-lg font-semibold text-zinc-100">{nf(f.avgSaved)}</p><p className="text-[10px] text-zinc-500">salvam.</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ordenação */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">Ordenar por:</span>
        {SORTS.map((s) => (
          <Link key={s.key} href={`?sort=${s.key}`} className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${activeSort.key === s.key ? "border-orange-500/40 bg-orange-500/15 text-orange-200" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
            {s.label}
          </Link>
        ))}
      </div>

      {/* Lista de posts */}
      <div className="space-y-2">
        {media.map((m) => (
          <div key={m.id} className="bg-zinc-900 border border-white/8 rounded-2xl p-3 flex items-center gap-4">
            <a href={m.permalink ?? "#"} target="_blank" rel="noreferrer" className="relative flex-shrink-0">
              <div className="w-12 h-14 rounded-lg overflow-hidden border border-white/8 bg-zinc-800">
                {m.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600"><Instagram size={16} /></div>
                )}
              </div>
              {m.mediaType === "VIDEO" && <Play size={12} className="absolute top-1 right-1 text-white drop-shadow" />}
            </a>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 line-clamp-2">{m.caption || "(sem legenda)"}</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                {TYPE_LABEL[m.mediaType ?? ""] ?? m.mediaType} · {m.timestamp ? formatInTimeZone(m.timestamp, TZ, "dd/MM/yy", { locale: ptBR }) : "—"}
              </p>
              <div className="mt-1.5"><PillarSelect mediaId={m.id} current={m.pillar} pillars={pillars} /></div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs text-zinc-400 flex-shrink-0">
              <Metric icon={Radar} value={m.reach} />
              <Metric icon={Eye} value={m.views} />
              <Metric icon={Heart} value={m.likes} />
              <Metric icon={MessageCircle} value={m.comments} />
              <Metric icon={Bookmark} value={m.saved} />
              <Metric icon={Share2} value={m.shares} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex md:hidden justify-center text-[11px] text-zinc-600 gap-3">
        <span>Alcance</span><span>Views</span><span>Curtidas</span><span>Coment.</span><span>Salvam.</span><span>Compart.</span>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; value: number | null }) {
  return (
    <span className="flex items-center gap-1 w-14 justify-end" title={String(value ?? "—")}>
      <Icon size={13} className="text-zinc-500" />
      {value == null ? "—" : new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value)}
    </span>
  )
}
