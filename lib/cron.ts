import cron from "node-cron"
import { sendDueMessages } from "./scheduler"
import { generateAutomaticDailySummaries } from "./group-summary-cron"

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

  // Resumo diário automático: 21h (horário de SP), após o expediente.
  // Gera rascunhos para revisão — nunca vira saúde oficial sozinho.
  cron.schedule(
    "0 21 * * *",
    async () => {
      try {
        const result = await generateAutomaticDailySummaries()
        console.log(`[cron] Resumos automáticos: ${JSON.stringify(result)}`)
      } catch (err) {
        console.error("[cron] Erro ao gerar resumos automáticos:", err)
      }
    },
    { timezone: "America/Sao_Paulo" }
  )

  console.log("[cron] Scheduler iniciado (mensagens + resumos diários)")
}
