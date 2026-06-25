// Sugestões rápidas de data/hora para agendamento (estilo CRM).
// Uso só no cliente (browser): depende de new Date().

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function dateSuggestions(): { label: string; value: string }[] {
  const now = new Date()
  const list: { label: string; value: string }[] = []
  const add = (label: string, d: Date) => list.push({ label, value: toLocalInput(d) })

  add("Em 1 hora", new Date(now.getTime() + 60 * 60 * 1000))

  const today18 = new Date(now)
  today18.setHours(18, 0, 0, 0)
  if (today18 > now) add("Hoje 18h", today18)

  const tom9 = new Date(now)
  tom9.setDate(tom9.getDate() + 1)
  tom9.setHours(9, 0, 0, 0)
  add("Amanhã 9h", tom9)

  const tom14 = new Date(now)
  tom14.setDate(tom14.getDate() + 1)
  tom14.setHours(14, 0, 0, 0)
  add("Amanhã 14h", tom14)

  const mon = new Date(now)
  const diff = ((8 - mon.getDay()) % 7) || 7
  mon.setDate(mon.getDate() + diff)
  mon.setHours(9, 0, 0, 0)
  add("Próx. 2ª 9h", mon)

  return list
}
