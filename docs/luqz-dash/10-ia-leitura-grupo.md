# Leitura diária do grupo por IA + automação

> Evolução do "Resumo diário do grupo". De extração factual 100% manual para
> **leitura interpretativa do clima do relacionamento, gerada automaticamente**.
> Implementado em 25/06/2026.

## Por que mudou

O resumo antigo só extraía fatos (`rawSummary` sem opinião + itens decisão/risco/etc.)
e dependia de alguém clicar "Gerar" todo dia. Faltava o principal: **uma leitura de
como está a relação com o cliente** — e ela não acontecia sozinha.

## O que a IA produz agora

Duas camadas, no mesmo resumo:

1. **Factual (auditável)** — `rawSummary` + `items` (DECISION/COMMITMENT/RISK/PRAISE/PENDING),
   cada item com evidência (ids de mensagem reais). Base que alimenta o Contexto Vivo após revisão.
2. **Interpretativa (clima)** — novo:
   - `sentiment`: `POSITIVE | NEUTRAL | CONCERN | CRITICAL`
   - `confidence`: `alta | média | baixa` (volume e clareza da conversa)
   - `analysis`: 1–3 frases interpretando o clima e o porquê
   - `attentionPoints`: 0–4 pontos curtos do que o time deveria observar/agir

A IA é instruída a ser conservadora (na dúvida, o nível menos alarmante) e a nunca
inventar tensão fora do texto. Mensagens são tratadas como dado não confiável
(não segue instruções embutidas).

## Como entra na Saúde (`lib/client-health.ts`)

A leitura da IA **sinaliza, nunca vira saúde oficial sozinha**:

- **Com check-in do time** → o nível oficial continua sendo o do time. Se a IA lê
  um clima **pior** que o time (`divergesFromTeam`), aparece um alerta "⚠ a IA leu
  como X — vale revisar". A divergência **sinaliza, não rebaixa** a saúde automaticamente.
- **Sem check-in do time** → a IA dá uma **leitura preliminar** (`source: "ai"`,
  confiança baixa, rotulada como tal). Isso resolve o buraco de a Torre ficar "Sem
  leitura" enquanto ninguém registrou check-in.

Mapa de sentimento → nível: POSITIVE/NEUTRAL → saudável, CONCERN → atenção, CRITICAL → crítico.

## Automação (`lib/group-summary-cron.ts` + `lib/cron.ts`)

- Roda **todo dia às 21h (America/Sao_Paulo)**, após o expediente.
- Gera **rascunhos** para todos os grupos de **clientes ativos** com conversa vinculada.
- Guard-rails de custo:
  - Pula dias com menos de **3 mensagens** (`MIN_MESSAGES`).
  - Teto de **60 grupos por execução** (`MAX_GROUPS_PER_RUN`).
  - **Idempotente**: pula grupos que já têm resumo na data (inclusive corrida com geração manual → 409 benigno).
  - **Sem chave de IA configurada → não faz nada** (não é erro).
- Os resumos automáticos entram como `generatedByAi = true`, `generatedById = null`,
  e seguem o mesmo fluxo de revisão humana — **nada vira oficial sem aprovação**.
- Trigger manual: `POST /api/cron?job=daily-summary` (header `x-cron-secret`), `body.date` opcional (AAAA-MM-DD).

## Mudanças técnicas

- **Schema** (`GroupDailySummary`, aditivo): `sentiment`, `analysis`, `attentionPoints`,
  `confidence`, `generatedByAi`; `generatedById` agora nullable (FK Restrict → SetNull).
  Enum novo `GroupSummarySentiment`. Migração `20260625180000_group_summary_ai_analysis` (idempotente).
- **IA** (`lib/ai/group-summary.ts`): prompt reescrito para as duas camadas; validação dos campos novos.
- **Serviço** (`lib/group-summary-service.ts`): geração+persistência compartilhada entre
  a route manual e o cron (uma fonte de verdade).
- **Tela** (`.../grupo/resumo-diario/page.tsx`): lidera com a Leitura da IA (clima +
  análise + pontos de atenção); registro factual e itens viram secundários/recolhidos.

## O que ficou de fora (próximos passos)

- Divisão em blocos para dias com volume acima do teto seguro (hoje retorna 413).
- Tendência de clima ao longo dos dias (série histórica de `sentiment`).
- Exibir o sinal da IA também com mais riqueza na Visão 360 (hoje vai no texto da leitura).
