import Link from "next/link"
import { prisma } from "@/lib/db"
import { Users, Eye, Radar, UserPlus, Instagram, Clock, Heart, MousePointerClick, Play, Bookmark, Share2 } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { ReachChart, FollowersChart } from "./_chart"
import { RefreshButton } from "./_refresh"

const TZ = "America/Sao_Paulo"

type Demo = { label: string; value: number }
type Totals = { reach: number; views: number; profileViews: number; websiteClicks: number; accountsEngaged: number; interactions: number; saves: number; shares: number; newFollowers: number }
type SnapData = {
  followersCount: number | null
  mediaCount: number | null
  periods: Record<string, Totals>
  demographics: Record<string, Demo[]>
  bestTimes: number[]
}

const nf = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n))
const PERIODS = [7, 30, 90]

export default async function InstagramVisaoGeralPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ d?: string }>
}) {
  const { id: clientId } = await params
  const { d } = await searchParams
  const days = PERIODS.includes(Number(d)) ? Number(d) : 30

  const account = await prisma.instagramAccount.findUnique({ where: { clientId }, select: { id: true } })
  if (!account) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <Instagram size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Este cliente ainda não tem uma conta de Instagram conectada.</p>
        <Link href={`/clientes/${clientId}/instagram/configuracoes`} className="text-orange-400 text-sm mt-1 inline-block hover:underline">
          Conectar conta
        </Link>
      </div>
    )
  }

  const snapshot = await prisma.instagramSnapshot.findUnique({ where: { accountId: account.id } })
  if (!snapshot) {
    return (
      <div className="text-center py-16 text-zinc-600">
        <Instagram size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Nenhum dado sincronizado ainda.</p>
        <p className="text-xs text-zinc-700 mt-1 mb-4">Puxe os insights da conta pela primeira vez.</p>
        <div className="flex justify-center"><RefreshButton clientId={clientId} /></div>
      </div>
    )
  }

  const data = snapshot.data as unknown as SnapData
  const t: Totals = data.periods?.[String(days)] ?? { reach: 0, views: 0, profileViews: 0, websiteClicks: 0, accountsEngaged: 0, interactions: 0, saves: 0, shares: 0, newFollowers: 0 }

  const [topByReach, topByViews] = await Promise.all([
    prisma.instagramMedia.findMany({ where: { accountId: account.id }, orderBy: { reach: { sort: "desc", nulls: "last" } }, take: 6 }),
    prisma.instagramMedia.findMany({ where: { accountId: account.id }, orderBy: { views: { sort: "desc", nulls: "last" } }, take: 6 }),
  ])

  const stats = await prisma.instagramDailyStat.findMany({
    where: { accountId: account.id },
    orderBy: { date: "asc" },
    take: 120,
  })
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
  const chartData = stats
    .filter((s) => s.date.toISOString().slice(0, 10) >= cutoff)
    .map((s) => ({ date: s.date.toISOString().slice(0, 10), reach: s.reach, newFollowers: s.newFollowers, followers: s.followers }))

  const kpis = [
    { label: "Seguidores", value: nf(data.followersCount), icon: Users },
    { label: "Alcance", value: nf(t.reach), icon: Radar },
    { label: "Visualizações", value: nf(t.views), icon: Eye },
    { label: "Visitas ao perfil", value: nf(t.profileViews), icon: Users },
    { label: "Interações", value: nf(t.interactions), icon: Heart },
    { label: "Salvamentos", value: nf(t.saves), icon: Bookmark },
    { label: "Compartilhamentos", value: nf(t.shares), icon: Share2 },
    { label: "Novos seguidores", value: nf(t.newFollowers), icon: UserPlus },
    { label: "Cliques no site", value: nf(t.websiteClicks), icon: MousePointerClick },
    { label: "Contas engajadas", value: nf(t.accountsEngaged), icon: Users },
  ]

  const bestTimes = data.bestTimes ?? []
  const peak = Math.max(0, ...bestTimes)
  const topHours = bestTimes.map((v, h) => ({ h, v })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3).map((x) => `${String(x.h).padStart(2, "0")}h`)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-zinc-900 border border-white/8 rounded-xl p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`?d=${p}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${days === p ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {p} dias
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-zinc-500">Atualizado {formatInTimeZone(snapshot.fetchedAt, TZ, "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
          <RefreshButton clientId={clientId} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-zinc-900 border border-white/8 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Icon size={15} />
                <span className="text-xs">{k.label}</span>
              </div>
              <p className="text-2xl font-semibold text-zinc-100">{k.value}</p>
            </div>
          )
        })}
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Alcance por dia</h2>
          <ReachChart data={chartData} />
        </div>
        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Crescimento de seguidores</h2>
          <FollowersChart data={chartData} />
        </div>
      </div>

      {/* Top posts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Top posts</h2>
          <Link href={`/clientes/${clientId}/instagram/analise`} className="text-xs text-orange-400 hover:underline">Ver análise completa →</Link>
        </div>
        <TopStrip title="Por alcance" metric="reach" posts={topByReach} />
        <TopStrip title="Por visualização" metric="views" posts={topByViews} />
      </div>

      {/* Demografia + horarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DemoCard title="Principais cidades" rows={data.demographics?.city} />
        <DemoCard title="Faixa etária" rows={data.demographics?.age} />
        <DemoCard title="Gênero" rows={data.demographics?.gender} labelMap={{ M: "Masculino", F: "Feminino", U: "Não informado" }} />

        <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-zinc-500" />
            <h2 className="text-sm font-medium text-zinc-300">Melhores horários</h2>
          </div>
          {peak === 0 ? (
            <p className="text-sm text-zinc-600">Dados insuficientes ainda.</p>
          ) : (
            <>
              <div className="flex items-end gap-0.5 h-20">
                {bestTimes.map((v, h) => (
                  <div key={h} title={`${String(h).padStart(2, "0")}h`} className="flex-1 bg-orange-500/70 rounded-sm min-h-[2px]" style={{ height: `${(v / peak) * 100}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
              </div>
              {topHours.length > 0 && <p className="text-xs text-zinc-500 mt-3">Picos: <span className="text-zinc-300">{topHours.join(" · ")}</span></p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type MediaRow = { id: string; permalink: string | null; mediaType: string | null; thumb: string | null; reach: number | null; views: number | null; likes: number | null; saved: number | null; shares: number | null }

function TopStrip({ title, metric, posts }: { title: string; metric: "reach" | "views"; posts: MediaRow[] }) {
  const MetricIcon = metric === "views" ? Eye : Radar
  return (
    <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
      <p className="text-xs text-zinc-500 mb-3">{title}</p>
      {posts.length === 0 ? (
        <p className="text-sm text-zinc-600">Nenhum post sincronizado. Clique em Atualizar.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {posts.map((p) => (
            <a key={p.id} href={p.permalink ?? "#"} target="_blank" rel="noreferrer" className="group">
              <div className="aspect-[4/5] rounded-xl overflow-hidden border border-white/8 bg-zinc-800 relative">
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb} alt="" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600"><Instagram size={18} /></div>
                )}
                {p.mediaType === "VIDEO" && <Play size={13} className="absolute top-2 right-2 text-white drop-shadow" />}
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white rounded px-1.5 py-0.5 flex items-center gap-1">
                  <MetricIcon size={10} /> {nf(metric === "views" ? p.views : p.reach)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-500">
                <span className="flex items-center gap-0.5"><Heart size={10} /> {nf(p.likes)}</span>
                <span className="flex items-center gap-0.5"><Bookmark size={10} /> {nf(p.saved)}</span>
                <span className="flex items-center gap-0.5"><Share2 size={10} /> {nf(p.shares)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function DemoCard({ title, rows, labelMap }: { title: string; rows?: Demo[]; labelMap?: Record<string, string> }) {
  const items = (rows ?? []).slice(0, 6)
  const max = Math.max(1, ...items.map((r) => r.value))
  return (
    <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
      <h2 className="text-sm font-medium text-zinc-300 mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-600">Sem dados.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 truncate pr-2">{labelMap?.[r.label] ?? r.label}</span>
                <span className="text-zinc-500 flex-shrink-0">{new Intl.NumberFormat("pt-BR").format(r.value)}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500/70 rounded-full" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
