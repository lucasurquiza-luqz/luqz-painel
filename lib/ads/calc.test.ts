import { describe, it, expect } from "vitest"
import { cpa, roas, ctr, cpc, cpm, rowRatios } from "@/lib/ads/calc"

describe("calc — fórmulas de performance", () => {
  it("CPA = gasto / resultados, null se sem resultado", () => {
    expect(cpa(100, 4)).toBe(25)
    expect(cpa(100, 0)).toBeNull()
    expect(cpa(0, 5)).toBe(0)
  })

  it("ROAS = receita / gasto, null se sem receita ou sem gasto", () => {
    expect(roas(300, 100)).toBe(3)
    expect(roas(null, 100)).toBeNull()
    expect(roas(300, 0)).toBeNull()
  })

  it("CTR = cliques/impressões em %, null se sem impressão", () => {
    expect(ctr(5, 100)).toBe(5)
    expect(ctr(0, 100)).toBe(0)
    expect(ctr(5, 0)).toBeNull()
  })

  it("CPC = gasto / cliques, null se sem clique", () => {
    expect(cpc(50, 10)).toBe(5)
    expect(cpc(50, 0)).toBeNull()
  })

  it("CPM = gasto por mil impressões, null se sem impressão", () => {
    expect(cpm(20, 10000)).toBe(2)
    expect(cpm(20, 0)).toBeNull()
  })

  it("rowRatios anexa cpa e ctr ao nó", () => {
    const r = rowRatios({ spend: 100, impressions: 1000, clicks: 50, results: 4 })
    expect(r.cpa).toBe(25)
    expect(r.ctr).toBe(5)
    expect(r.spend).toBe(100)
  })
})
