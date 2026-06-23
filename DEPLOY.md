# Deploy do LUQZ Dash no EasyPanel

> Processo oficial. Nenhuma pessoa ou LLM precisa receber a `DATABASE_URL`.

## Arquitetura de inicialização

O EasyPanel injeta as variáveis no container. O `docker-entrypoint.sh` executa:

```sh
./node_modules/.bin/prisma migrate deploy
exec node server.js
```

O servidor só inicia depois das migrations. O runtime contém Prisma CLI, OpenSSL e
health check em `GET /api/health`. A rota responde `200` quando aplicação e PostgreSQL
estão disponíveis; responde `503` sem expor o erro interno quando o banco falha.

## Pré-deploy

1. Confirmar `DATABASE_URL` e `SESSION_SECRET` no serviço do EasyPanel.
2. Nunca copiar os valores para chats, documentos ou commits.
3. Criar snapshot/backup do PostgreSQL.
4. Confirmar repositório `lucasurquiza-luqz/luqz-painel` e branch correta.
5. Validar primeiro em homologação, usando banco próprio ou cópia anonimizada.
6. Configurar health check HTTP no EasyPanel: caminho `/api/health`, porta `3000`.
7. Executar localmente:

```powershell
npm.cmd exec tsc -- --noEmit
npm.cmd run build
git diff --check
git status --short --branch
```

## Homologação obrigatória

1. Criar um serviço separado, por exemplo `luqz-dash-staging`.
2. Apontar para a branch técnica que será promovida.
3. Usar domínio próprio de homologação e banco que não seja o de produção.
4. Confirmar que o container fica `healthy`.
5. Validar login, permissões, carteira, Status e Contexto Vivo.
6. Promover o mesmo commit aprovado para `main`.

## Logs esperados

```text
[luqz-dash] iniciando release
[luqz-dash] validando migrations do Prisma
Prisma schema loaded from prisma/schema.prisma
Applying migration ...
All migrations have been successfully applied
[luqz-dash] migrations aplicadas com sucesso
[luqz-dash] iniciando servidor Next.js na porta 3000
```

Se uma migration falhar, o servidor não inicia. O primeiro erro após a linha de
validação é a causa a investigar; não usar `db push` para contornar migrations.

## Publicação

Após a aprovação em homologação:

```powershell
git fetch origin
git push origin HEAD:main
```

No EasyPanel, conferir o commit e acompanhar o deploy. Se não iniciar automaticamente,
executar `Deploy`, `Redeploy` ou `Rebuild`.

## Validação pós-deploy

1. Abrir `https://dash.luqz.com.br/api/health` e confirmar HTTP `200`.
2. Abrir `/login` e entrar com um usuário já existente.
3. Confirmar que nenhuma senha ou conta foi redefinida.
4. Validar permissões de Admin, Operador e Cliente.
5. Validar Clientes, Status, Contexto, chats, uploads e agendamentos.
6. Monitorar logs e health check durante os primeiros minutos.

## Rollback

As migrations atuais são aditivas. Se a aplicação falhar:

1. Não executar exclusões ou alterações manuais no banco.
2. Reapontar o serviço para o último commit saudável.
3. Fazer rebuild e confirmar `/api/health` em `200`.
4. Manter tabelas e colunas novas; o código anterior não as utiliza.
5. Restaurar snapshot somente em corrupção confirmada ou orientação técnica explícita.

## Diagnóstico rápido

### `Environment variable not found: DATABASE_URL`

A variável não chegou ao runtime. Corrigir no EasyPanel; não criar `.env` no repositório.

### `prisma: not found`

Confirmar que o runner copia `/app/node_modules` e que `docker-entrypoint.sh` é executável.

### Container reinicia ou fica `unhealthy`

Ler a primeira falha após `[luqz-dash] validando migrations do Prisma`. Se as migrations
passarem, consultar `/api/health`: `503` aponta indisponibilidade do banco ou configuração
incorreta da conexão no runtime.

### Objeto da migration já existe

Interromper. Comparar `_prisma_migrations` com `prisma/migrations/` e criar um baseline
controlado. Não forçar com `db push`.

### Versão antiga continua no domínio

Conferir commit/branch do serviço, executar rebuild e validar sem cache.
