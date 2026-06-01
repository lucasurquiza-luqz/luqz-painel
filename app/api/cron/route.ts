import { NextRequest, NextResponse } from "next/server"
import { sendDueMessages } from "@/lib/scheduler"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 })
  }

  try {
    await sendDueMessages()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro no cron." },
      { status: 500 }
    )
  }
}
