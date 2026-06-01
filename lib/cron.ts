import cron from "node-cron"
import { sendDueMessages } from "./scheduler"

let started = false

export function startCron() {
  if (started) return
  started = true

  cron.schedule("* * * * *", async () => {
    try {
      await sendDueMessages()
    } catch (err) {
      console.error("[cron] Erro ao processar mensagens:", err)
    }
  })

  console.log("[cron] Scheduler de mensagens iniciado")
}
