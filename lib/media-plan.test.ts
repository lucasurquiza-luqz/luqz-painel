import { describe, it, expect } from "vitest"
import { projectFunnel } from "@/lib/media-plan"

describe("projectFunnel", () => {
  const stages = [{ label: "Leads" }, { label: "Qualificados", rate: 0.4 }, { label: "Visitas", rate: 0.45 }, { label: "Vendas", rate: 0.5 }]

  it("topo por CPL: leads = budget / cpl", () => {
    const p = projectFunnel({ budget: 820, cpl: 12, targetLeads: null, stages, ticket: 750 })
    expect(Math.round(p.rows[0].value)).toBe(68) // 820/12 = 68,3
  })

  it("aplica as taxas em cadeia", () => {
    const p = projectFunnel({ budget: 820, cpl: 12, targetLeads: null, stages, ticket: 750 })
    // 68.3 → *0.4 = 27.3 → *0.45 = 12.3 → *0.5 = 6.15
    expect(p.rows[3].value).toBeCloseTo(6.15, 1)
  })

  it("receita = final × ticket; ROAS = receita / budget", () => {
    const p = projectFunnel({ budget: 820, cpl: 12, targetLeads: null, stages, ticket: 750 })
    expect(p.revenue!).toBeCloseTo(4612.5, 0) // 6.15 * 750
    expect(Math.round(p.roas! * 10) / 10).toBe(5.6)
  })

  it("CAC = budget / final", () => {
    const p = projectFunnel({ budget: 820, cpl: 12, targetLeads: null, stages, ticket: 750 })
    expect(Math.round(p.cac!)).toBe(133) // 820 / 6.15
  })

  it("sem CPL, usa targetLeads como topo", () => {
    const p = projectFunnel({ budget: 1000, cpl: null, targetLeads: 100, stages, ticket: null })
    expect(p.rows[0].value).toBe(100)
    expect(p.revenue).toBeNull()
  })

  it("receita por etapa: soma receita de várias etapas (consulta + procedimento)", () => {
    const s = [
      { label: "Leads" },
      { label: "Agendados", rate: 0.5 },
      { label: "Consultas", rate: 0.6, ticket: 200 },
      { label: "Procedimentos", rate: 0.4, ticket: 1500 },
    ]
    // leads = 1000/10 = 100 → agendados 50 → consultas 30 (×200=6000) → procedimentos 12 (×1500=18000)
    const p = projectFunnel({ budget: 1000, cpl: 10, targetLeads: null, stages: s, ticket: null })
    expect(Math.round(p.rows[2].revenue!)).toBe(6000)
    expect(Math.round(p.rows[3].revenue!)).toBe(18000)
    expect(Math.round(p.revenue!)).toBe(24000) // 6000 + 18000
    expect(Math.round(p.roas! * 10) / 10).toBe(24) // 24000/1000
  })

  it("funil vazio não quebra", () => {
    const p = projectFunnel({ budget: 1000, cpl: 10, targetLeads: null, stages: [], ticket: 500 })
    expect(p.rows).toHaveLength(0)
    expect(p.roas).toBeNull()
  })
})
