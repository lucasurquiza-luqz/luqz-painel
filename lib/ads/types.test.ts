import { describe, it, expect } from "vitest"
import { monthRange, previousRange, effectiveObjectives } from "@/lib/ads/types"
import { metaResultKeys } from "@/lib/ads/meta"

describe("monthRange", () => {
  it("mês de 31 dias", () => {
    expect(monthRange("2026-01")).toEqual({ since: "2026-01-01", until: "2026-01-31" })
  })
  it("fevereiro bissexto", () => {
    expect(monthRange("2024-02")).toEqual({ since: "2024-02-01", until: "2024-02-29" })
  })
  it("fevereiro não bissexto", () => {
    expect(monthRange("2026-02")).toEqual({ since: "2026-02-01", until: "2026-02-28" })
  })
})

describe("previousRange — janela anterior de mesmo tamanho", () => {
  it("mês cheio → mês anterior cheio", () => {
    expect(previousRange({ since: "2026-06-01", until: "2026-06-30" })).toEqual({ since: "2026-05-02", until: "2026-05-31" })
  })
  it("janela de 7 dias → 7 dias anteriores", () => {
    expect(previousRange({ since: "2026-06-08", until: "2026-06-14" })).toEqual({ since: "2026-06-01", until: "2026-06-07" })
  })
  it("um único dia → dia anterior", () => {
    expect(previousRange({ since: "2026-06-10", until: "2026-06-10" })).toEqual({ since: "2026-06-09", until: "2026-06-09" })
  })
})

describe("effectiveObjectives — back-compat com objective legado", () => {
  it("usa objectives quando há", () => {
    expect(effectiveObjectives(["LEAD", "WHATSAPP"], "ECOMMERCE")).toEqual(["LEAD", "WHATSAPP"])
  })
  it("cai no legado quando objectives vazio", () => {
    expect(effectiveObjectives([], "WHATSAPP")).toEqual(["WHATSAPP"])
  })
})

describe("metaResultKeys — eventos contados como resultado", () => {
  it("custom override prevalece sobre o padrão", () => {
    expect(metaResultKeys({ objectives: ["LEAD"], resultActions: ["custom_event_x"], trackRevenue: false })).toEqual(["custom_event_x"])
  })
  it("sem custom, usa os eventos padrão do(s) funil(is)", () => {
    const keys = metaResultKeys({ objectives: ["LEAD"], resultActions: [], trackRevenue: false })
    expect(keys).toContain("offsite_conversion.fb_pixel_lead")
    expect(keys.length).toBeGreaterThan(0)
  })
  it("une eventos de vários funis sem duplicar", () => {
    const keys = metaResultKeys({ objectives: ["LEAD", "ECOMMERCE"], resultActions: [], trackRevenue: false })
    expect(new Set(keys).size).toBe(keys.length)
  })
})
