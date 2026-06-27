import cron from "node-cron"
import { sendDueMessages } from "./scheduler"
import { generateAutomaticDailySummaries } from "./group-summary-cron"
import { refreshActiveSnapshots } from "./ads/snapshot"

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

  // Snapshots de performance (Ads): atualiza de madrugada (06h SP).
  cron.schedule(
    "0 6 * * *",
    async () => {
      try {
        const r = await refreshActiveSnapshots()
        console.log(`[cron] Snapshots de performance: ${JSON.stringify(r)}`)
      } catch (err) {
        console.error("[cron] Erro ao atualizar snapshots de performance:", err)
      }
    },
    { timezone: "America/Sao_Paulo" }
  )

  console.log("[cron] Scheduler iniciado (mensagens + resumos diários + performance)")
}
