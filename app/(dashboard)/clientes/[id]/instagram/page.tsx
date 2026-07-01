import { prisma } from "@/lib/db"
import { Users, Eye, Radar, UserPlus, Instagram, Clock } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { ReachChart } from "./_chart"
import { RefreshButton } from "./_refresh"

const TZ = "America/Sao_Paulo"

type Demo = { label: string; value: number }
type SnapData = {
  followersCount: number | null
  mediaCount: number | null
  kpis: { reach: number; profileViews: number; newFollowers: number }
  demographics: Record<string, Demo[]>
  bestTimes: number[]
  rangeDays: number
}

const nf = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n))

export default async function InstagramVisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const account = await prisma.instagramAccount.findUnique({ where: { clientId }, select: { id: true } })
  if (!account) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <Instagram size={40} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">Este cliente ainda não tem uma conta de Instagram conectada.</p>
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
        <div className="flex justify-center">
          <RefreshButton clientId={clientId} />
        </div>
      </div>
    )
  }

  const data = snapshot.data as unknown as SnapData
  const stats = await prisma.instagramDailyStat.findMany({
    where: { accountId: account.id },
    orderBy: { date: "asc" },
    take: 60,
  })
  const chartData = stats
    .filter((s) => s.reach != null)
    .map((s) => ({ date: s.date.toISOString().slice(0, 10), reach: s.reach }))

  const kpis = [
    { label: "Seguidores", value: nf(data.followersCount), icon: Users },
    { label: `Alcance (${data.rangeDays}d)`, value: nf(data.kpis?.reach), icon: Radar },
    { label: `Visitas ao perfil (${data.rangeDays}d)`, value: nf(data.kpis?.profileViews), icon: Eye },
    { label: `Novos seguidores (${data.rangeDays}d)`, value: nf(data.kpis?.newFollowers), icon: UserPlus },
  ]

  const bestTimes = data.bestTimes ?? []
  const peak = Math.max(0, ...bestTimes)
  const topHours = bestTimes
    .map((v, h) => ({ h, v }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)
    .map((x) => `${String(x.h).padStart(2, "0")}h`)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Atualizado {formatInTimeZone(snapshot.fetchedAt, TZ, "dd/MM 'às' HH:mm", { locale: ptBR })}
        </p>
        <RefreshButton clientId={clientId} />
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

      {/* Gráfico de alcance */}
      <div className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Alcance por dia</h2>
        <ReachChart data={chartData} />
      </div>

      {/* Demografia + Melhores horários */}
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
                  <div
                    key={h}
                    title={`${String(h).padStart(2, "0")}h`}
                    className="flex-1 bg-orange-500/70 rounded-sm min-h-[2px]"
                    style={{ height: `${(v / peak) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
              </div>
              {topHours.length > 0 && (
                <p className="text-xs text-zinc-500 mt-3">Picos: <span className="text-zinc-300">{topHours.join(" · ")}</span></p>
              )}
            </>
          )}
        </div>
      </div>
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
