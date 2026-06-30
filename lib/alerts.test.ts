import { describe, it, expect } from "vitest"
import { computeAlerts, worstLevel } from "@/lib/alerts"

const base = { configured: true, spend: 1000, cpa: 50, roas: null, dayOfMonth: 15, daysInMonth: 30 }

describe("computeAlerts", () => {
  it("cliente sem Ads não gera alerta", () => {
    expect(computeAlerts({ ...base, configured: false, spend: 0 })).toEqual([])
  })

  it("sem veiculação só a partir do dia 2", () => {
    expect(computeAlerts({ ...base, spend: 0, dayOfMonth: 1 })).toEqual([])
    const d2 = computeAlerts({ ...base, spend: 0, dayOfMonth: 2 })
    expect(d2).toHaveLength(1)
    expect(d2[0].code).toBe("no_delivery")
    expect(d2[0].level).toBe("critical")
  })

  it("sem veiculação ofusca os demais alertas", () => {
    const a = computeAlerts({ ...base, spend: 0, targetCpa: 10, budget: 9999 })
    expect(a.map((x) => x.code)).toEqual(["no_delivery"])
  })

  it("CPA acima da meta (com 10% de tolerância)", () => {
    expect(computeAlerts({ ...base, cpa: 54, targetCpa: 50 }).find((a) => a.code === "cpa_high")).toBeUndefined() // dentro da tolerância
    expect(computeAlerts({ ...base, cpa: 60, targetCpa: 50 }).find((a) => a.code === "cpa_high")).toBeDefined()
  })

  it("ROAS abaixo da meta", () => {
    expect(computeAlerts({ ...base, roas: 2, targetRoas: 3 }).find((a) => a.code === "roas_low")).toBeDefined()
    expect(computeAlerts({ ...base, roas: 4, targetRoas: 3 }).find((a) => a.code === "roas_low")).toBeUndefined()
  })

  it("verba ociosa: gastou menos da metade do ritmo esperado", () => {
    // meio do mês, budget 3000 → esperado ~1500; gastou 500 (<750) → alerta
    expect(computeAlerts({ ...base, spend: 500, budget: 3000 }).find((a) => a.code === "underpacing")).toBeDefined()
    // gastou 1400 (perto do esperado) → sem alerta
    expect(computeAlerts({ ...base, spend: 1400, budget: 3000 }).find((a) => a.code === "underpacing")).toBeUndefined()
  })

  it("worstLevel", () => {
    expect(worstLevel([])).toBeNull()
    expect(worstLevel([{ code: "x", label: "x", level: "attention" }])).toBe("attention")
    expect(worstLevel([{ code: "x", label: "x", level: "attention" }, { code: "y", label: "y", level: "critical" }])).toBe("critical")
  })
})
