"use client"

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

type Point = { date: string; reach: number | null; newFollowers: number | null }

const fmtDay = (d: string) => {
  const [, m, day] = d.split("-")
  return `${day}/${m}`
}

const axisTick = { fill: "#71717a", fontSize: 11 }
const tooltipStyle = { background: "#18181b", border: "1px solid #ffffff15", borderRadius: 12, fontSize: 12 }

export function ReachChart({ data }: { data: Point[] }) {
  if (data.filter((d) => d.reach != null).length === 0) {
    return <p className="text-sm text-zinc-600 py-10 text-center">Sem série de alcance ainda.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF8F50" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#FF8F50" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDay} tick={axisTick} tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e4e4e7" }} labelFormatter={(l) => `Dia ${fmtDay(String(l))}`} />
        <Area type="monotone" dataKey="reach" name="Alcance" stroke="#FF8F50" strokeWidth={2} fill="url(#reachFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function FollowersChart({ data }: { data: Point[] }) {
  const has = data.some((d) => (d.newFollowers ?? 0) !== 0)
  if (!has) {
    return <p className="text-sm text-zinc-600 py-10 text-center">Sem variação de seguidores no período.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDay} tick={axisTick} tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e4e4e7" }} labelFormatter={(l) => `Dia ${fmtDay(String(l))}`} />
        <Bar dataKey="newFollowers" name="Novos seguidores" fill="#22c55e" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
