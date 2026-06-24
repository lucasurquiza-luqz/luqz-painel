import type { ContextDomain, ContextKind } from "@prisma/client"

export type PilotContextProposal = {
  domain: ContextDomain
  kind: ContextKind
  title: string
  content: string
  sourceLabel: string
  sourceReference: string
  capturedAt: string
}

const summarySource = "Resumo operacional · 12/05/2026"
const summaryReference = "clientes/Deposito Santa Helena/resumo.md"
const memorySource = "Memória validada · 12/05/2026"
const memoryReference = "clientes/Deposito Santa Helena/historico/memoria-cliente.md"
const scopeSource = "Escopo confirmado · 26/05/2026"
const scopeReference = "clientes/Deposito Santa Helena/contexto/escopo-entrega.md"

export const DEPOSITO_SANTA_HELENA_PROPOSALS: PilotContextProposal[] = [
  {
    domain: "CLIENTE", kind: "FACT", title: "Modelo de negócio local",
    content: "Depósito e loja física de materiais de construção, com venda local e atendimento comercial pelo WhatsApp.",
    sourceLabel: summarySource, sourceReference: summaryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "CLIENTE", kind: "FACT", title: "Interlocutora principal",
    content: "Carol é a principal interlocutora e decisora da conta.",
    sourceLabel: summarySource, sourceReference: summaryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "CLIENTE", kind: "FACT", title: "Canal comercial principal",
    content: "O WhatsApp é o principal canal de atendimento comercial da operação local.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "DIRETRIZES", kind: "RULE", title: "Não tratar como e-commerce tradicional",
    content: "A estratégia deve priorizar demanda local, loja física e WhatsApp. O site está desatualizado e não deve ser tratado como principal ativo de venda.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "DIRETRIZES", kind: "RULE", title: "Qualidade visual exige revisão rigorosa",
    content: "Cor, tonalidade, roteiro e gravação devem ser revisados antes da entrega. Erros de fala e delegação sem fiscalização geram atrito com a cliente.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "DIRETRIZES", kind: "RULE", title: "Formato recomendado para Google Meu Negócio",
    content: "Evitar carrosséis. Priorizar peças estáticas ou vídeos simples replicados do Instagram.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "OPERACIONAL", kind: "DECISION", title: "Rotina semanal de Google Meu Negócio",
    content: "Manter publicação semanal às quartas-feiras, reaproveitando conteúdos adequados do Instagram.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "OPERACIONAL", kind: "DECISION", title: "Cobrança direta do responsável por social media",
    content: "Feedbacks sobre produção e qualidade devem ser tratados diretamente com Guilherme, evitando delegação sem fiscalização.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "OPERACIONAL", kind: "FACT", title: "Escopo vigente confirmado",
    content: "O escopo de entrega confirmado em 26/05/2026 contempla Meta Ads. Acesso e automação de leitura ainda dependiam de configuração.",
    sourceLabel: scopeSource, sourceReference: scopeReference, capturedAt: "2026-05-26T12:00:00.000Z",
  },
  {
    domain: "MEMORIA", kind: "FACT", title: "Campanha promocional da Copa",
    content: "A campanha utilizou rifa de churrasqueira para compras acima de R$ 100, conectando mídia e ação promocional da loja física.",
    sourceLabel: summarySource, sourceReference: summaryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "MEMORIA", kind: "PERCEPTION", title: "Sensibilidade da relação à qualidade de conteúdo",
    content: "A relação apresenta boa percepção sobre mídia, mas exige atenção constante à qualidade do social media e das gravações.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "MEMORIA", kind: "PERCEPTION", title: "Resistência da equipe de balcão a CRM",
    content: "A equipe comercial demonstra resistência a sistemas. Uma futura adoção de CRM provavelmente exigirá incentivo, comissão ou bônus.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "OPERACIONAL", kind: "HYPOTHESIS", title: "Testar PMax ou visitas à loja",
    content: "Avaliar PMax ou objetivo de visitas à loja como evolução da operação local no Google Ads.",
    sourceLabel: summarySource, sourceReference: summaryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "OPERACIONAL", kind: "HYPOTHESIS", title: "Rastreamento estruturado do WhatsApp",
    content: "O WhatsApp é canal relevante de comércio e existe oportunidade de testar ferramenta de rastreamento antes de qualquer conclusão sobre impacto.",
    sourceLabel: memorySource, sourceReference: memoryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
  {
    domain: "OFERTA", kind: "HYPOTHESIS", title: "Frente futura B2B e PJ",
    content: "Avaliar no futuro uma página institucional voltada a incorporadoras, construtoras e vendas de maior volume.",
    sourceLabel: summarySource, sourceReference: summaryReference, capturedAt: "2026-05-12T12:00:00.000Z",
  },
]
