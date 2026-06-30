import { describe, it, expect } from "vitest"
import { computeNextRun } from "@/lib/recurrence"

const iso = (d: Date) => d.toISOString().slice(0, 10)

describe("computeNextRun", () => {
  it("diária: +N dias", () => {
    expect(iso(computeNextRun({ freq: "DIARIA", interval: 1 }, new Date("2026-06-30T00:00:00Z")))).toBe("2026-07-01")
    expect(iso(computeNextRun({ freq: "DIARIA", interval: 3 }, new Date("2026-06-30T00:00:00Z")))).toBe("2026-07-03")
  })
  it("semanal: +N semanas", () => {
    expect(iso(computeNextRun({ freq: "SEMANAL", interval: 1 }, new Date("2026-06-01T00:00:00Z")))).toBe("2026-06-08")
  })
  it("semanal com weekday: cai no dia da semana desejado", () => {
    // 2026-06-01 é segunda (getUTCDay=1). weekday=3 (quarta) → após +1 semana ajusta pra quarta
    const r = computeNextRun({ freq: "SEMANAL", interval: 1, weekday: 3 }, new Date("2026-06-01T00:00:00Z"))
    expect(r.getUTCDay()).toBe(3)
  })
  it("mensal: +N meses no mesmo dia", () => {
    expect(iso(computeNextRun({ freq: "MENSAL", interval: 1 }, new Date("2026-01-15T00:00:00Z")))).toBe("2026-02-15")
  })
  it("mensal com dayOfMonth, clampa pro último dia (fev)", () => {
    expect(iso(computeNextRun({ freq: "MENSAL", interval: 1, dayOfMonth: 31 }, new Date("2026-01-31T00:00:00Z")))).toBe("2026-02-28")
  })
  it("semanal personalizado: próximo dia da lista na mesma semana", () => {
    // 2026-06-01 é segunda(1); dias = seg/qua/sex → próximo é quarta(2026-06-03)
    expect(iso(computeNextRun({ freq: "SEMANAL", interval: 1, weekdays: [1, 3, 5] }, new Date("2026-06-01T00:00:00Z")))).toBe("2026-06-03")
  })
  it("semanal personalizado: esgotou a semana, pula pro primeiro dia da próxima", () => {
    // 2026-06-05 é sexta(5); dias = seg/qua/sex → não há dia >5, vai pra segunda seguinte (2026-06-08)
    expect(iso(computeNextRun({ freq: "SEMANAL", interval: 1, weekdays: [1, 3, 5] }, new Date("2026-06-05T00:00:00Z")))).toBe("2026-06-08")
  })
  it("semanal personalizado a cada 2 semanas: pula 2 semanas ao virar", () => {
    // 2026-06-05 sexta(5); dias = seg/sex, a cada 2 semanas → segunda 2 semanas depois (2026-06-15)
    expect(iso(computeNextRun({ freq: "SEMANAL", interval: 2, weekdays: [1, 5] }, new Date("2026-06-05T00:00:00Z")))).toBe("2026-06-15")
  })
})
