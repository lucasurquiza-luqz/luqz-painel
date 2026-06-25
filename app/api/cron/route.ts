import { NextRequest, NextResponse } from "next/server"
import { sendDueMessages } from "@/lib/scheduler"
import { generateAutomaticDailySummaries } from "@/lib/group-summary-cron"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  }

  // ?job=daily-summary dispara a geração de resumos (data opcional via body.date).
  const job = req.nextUrl.searchParams.get("job")

  try {
    if (job === "daily-summary") {
      const body = await req.json().catch(() => ({}))
      const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : undefined
      const result = await generateAutomaticDailySummaries(date)
      return NextResponse.json({ ok: true, result })
    }

    await sendDueMessages()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro no cron." },
      { status: 500 }
    )
  }
}
