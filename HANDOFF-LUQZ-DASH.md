# Handoff Técnico — Aplicação LUQZ Dash

> Atualizado em 23/06/2026  
> Repositório: `luqz-painel`  
> Produção: `https://dash.luqz.com.br`

## Leitura obrigatória

Este repositório contém a aplicação em produção do LUQZ Dash. O documento canônico de produto e continuidade está no repositório principal LUQZ:

```text
docs/luqz-dash/00-handoff-executivo-tecnico.md
```

Antes de trabalhar, ler também:

```text
docs/plano-acao-luqz-dash.md
docs/luqz-dash/01-fundacao-contexto-cliente.md
docs/luqz-dash/02-plano-evolucao-design.md
docs/luqz-dash/03-registro-implementacao-seguranca.md
```

## O que este projeto é

- Evolução do painel existente; não reescrever do zero.
- Monólito modular multi-tenant em Next.js, Prisma e PostgreSQL.
- Console interno primeiro; portal do cliente por último.
- Produto separado do LUQZCRM.
- Banco, clientes, usuários, grupos, conversas e agendamentos existentes devem ser preservados.

## Estado Git registrado

Branch de trabalho:

```text
codex/luqz-dash-visual-foundation
```

Commits relevantes:

```text
3427e34 feat: cria fundacao do contexto vivo do cliente
1a450e8 security: reforca RBAC e isolamento por cliente
d461dcf feat: aplica fundacao visual do LUQZ Dash
```

Em 23/06/2026:

- `d461dcf` estava publicado em produção e em `origin/main`.
- `1a450e8` e `3427e34` estavam na branch técnica, aguardando build, validação da migration, push para `main` e deploy.
- Após `3427e34`, existe um incremento local ainda não commitado com carteira, status e piloto do Depósito Santa Helena. O Git foi bloqueado por limite operacional da ferramenta; não descartar o worktree.

Arquivos principais desse incremento local:

```text
lib/client-roster.ts
lib/pilots/deposito-santa-helena.ts
app/api/clients/import/route.ts
app/api/clients/[id]/status/route.ts
app/api/clients/[id]/context/import-pilot/route.ts
app/(dashboard)/clientes/page.tsx
app/(dashboard)/clientes/[id]/status/page.tsx
prisma/migrations/20260623233000_add_client_status/migration.sql
```

Sempre confirmar novamente com:

```powershell
git status --short --branch
git log -5 --oneline --decorate
git fetch origin
git rev-list --left-right --count origin/main...HEAD
```

## Stack

- Next.js 16.2.6
- React 19
- TypeScript
- Prisma 6
- PostgreSQL
- iron-session
- Tailwind CSS 4
- Evolution API
- MinIO/S3 opcional
- node-cron
- EasyPanel

## Estrutura crítica

```text
app/(dashboard)/              páginas autenticadas
app/api/                      handlers HTTP
components/Sidebar.tsx        navegação por papel e cliente
components/DashBrandMark.tsx  marca do produto
components/ui/primitives.tsx  primitives visuais
lib/api-auth.ts               autorização central no servidor
lib/auth.ts                   sessão e tipos básicos
lib/db.ts                     Prisma client
lib/evolution.ts              integração WhatsApp
lib/storage.ts                storage
prisma/schema.prisma          modelo atual
proxy.ts                      proteção e redirecionamento de borda
public/brand/                 assets oficiais
```

## Papéis vigentes

### ADMIN

- carteira completa;
- usuários;
- grupos;
- chats;
- agendamentos;
- exclusão de cliente.

### OPERADOR

- carteira completa;
- grupos;
- chats;
- agendamentos;
- sem gestão de usuários;
- sem exclusão de cliente.

### CLIENTE

- apenas o próprio `clientId`;
- apenas conversas e agendamentos próprios;
- não lista carteira, usuários ou grupos internos;
- sem `clientId`, não autentica.

## Segurança

Não remover a defesa em profundidade:

1. `proxy.ts` protege navegação e APIs na borda.
2. Cada handler interno chama `requireApiUser`.
3. `requireApiUser` revalida usuário ativo, papel e vínculo no banco.
4. Rotas com tenant chamam `canAccessClient` ou filtram pelo `clientId` confirmado.

Cron e webhook usam segredos próprios e não devem exigir sessão de navegador.

## Identidade visual

```text
#080808 fundo
#111111 superfície principal
#232323 e #2E2E2E superfícies auxiliares
#FF8F50 destaque
#FFD482 e #FFF7AD apoio
Sulphur Point títulos
Roboto Flex interface
```

Manter o padrão visual do LUQZCRM e da identidade LUQZ, sem copiar arquitetura de produto ou dados do CRM.

## Variáveis esperadas

Não registrar valores neste arquivo:

```text
DATABASE_URL
SESSION_SECRET
EVOLUTION_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE
NEXT_PUBLIC_APP_URL
CRON_SECRET
EVOLUTION_WEBHOOK_SECRET
MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
```

## Validação antes de publicar

```powershell
npm.cmd exec tsc -- --noEmit
npm.cmd run build
git diff --check
git status --short
```

O build local pode registrar falta de `DATABASE_URL` durante coleta estática quando não existe `.env.local`. Ele só pode ser considerado aprovado se encerrar com código `0` e mostrar compilação concluída.

## Publicação

Produção acompanha `main`:

```powershell
git fetch origin
git push origin HEAD:main
```

O EasyPanel pode não realizar deploy automático. Se o domínio continuar na versão anterior, abrir o produto do Dash no EasyPanel e executar `Deploy`, `Redeploy` ou `Rebuild`.

Depois validar:

1. login existente;
2. Admin acessa `/usuarios`;
3. Operador não acessa `/usuarios` nem `/api/users`;
4. Cliente não acessa outro cliente;
5. chats, uploads e agendamentos continuam funcionando;
6. nenhuma senha ou usuário foi redefinido.

## Próximo incremento

O Contexto Vivo base foi implementado. Não começar pelo radar de saúde. Validar primeiro um cliente piloto:

1. aplicar a migration em homologação;
2. testar propostas, aprovação, rejeição e correção;
3. importar as fontes canônicas;
4. gerar snapshot v1;
5. corrigir um item e gerar snapshot v2;
6. confirmar isolamento entre clientes e bloqueio do papel Cliente.

Somente depois conectar resumos de grupos, reuniões, resultado, NPS e cálculo de saúde.

## Regras de continuidade

- Não usar `git reset --hard`.
- Não usar `git add .` sem auditar o worktree.
- Não commitar `.env`, tokens ou senhas.
- Não alterar dados de produção para testar localmente.
- Não criar tabelas destrutivas ou migrations que apaguem dados.
- Não confiar em `clientId` recebido do navegador.
- Não permitir atualização ampla por spread de body em Prisma.
- Não publicar sem TypeScript e build aprovados.
- Atualizar este handoff quando o estado de produção mudar.
