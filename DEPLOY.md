# Deploy do LUQZ Dash no EasyPanel

> Processo oficial. Nenhuma LLM precisa receber a `DATABASE_URL`.

## Como funciona

O EasyPanel já injeta as variáveis de produção no container. O comando de inicialização executa:

```text
prisma migrate deploy
  → aplica somente migrations pendentes
  → registra o resultado em _prisma_migrations
  → interrompe o start se houver erro
  → inicia o Next.js somente após sucesso
```

Comando definido no Dockerfile:

```dockerfile
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node server.js"]
```

## Pré-deploy

1. Confirmar que o serviço do Dash no EasyPanel possui `DATABASE_URL` e `SESSION_SECRET`.
2. Não copiar nem enviar os valores dessas variáveis para chats ou commits.
3. Criar snapshot/backup do PostgreSQL no EasyPanel.
4. Confirmar que a aplicação usa o repositório `lucasurquiza-luqz/luqz-painel`.
5. Confirmar que a branch de produção é `main`.
6. Executar localmente:

```powershell
npm.cmd exec tsc -- --noEmit
npm.cmd run build
git status --short --branch
git log --oneline origin/main..HEAD
```

## Publicação

Depois das validações:

```powershell
git fetch origin
git push origin HEAD:main
```

No EasyPanel:

1. Abrir o serviço do LUQZ Dash.
2. Conferir o commit recebido.
3. Acionar `Deploy`, `Redeploy` ou `Rebuild` quando o deploy automático não iniciar.
4. Acompanhar os logs do container.

Sinais esperados nos logs:

```text
Prisma schema loaded from prisma/schema.prisma
Applying migration 20260623230000_add_context_foundation
Applying migration 20260623233000_add_client_status
All migrations have been successfully applied
```

Depois, deve aparecer o start do servidor Next.js.

## Validação pós-deploy

1. Abrir `https://dash.luqz.com.br/login`.
2. Entrar com o usuário que já existia antes do deploy.
3. Confirmar que nenhum usuário ou senha foi redefinido.
4. Abrir Clientes.
5. Como Admin, clicar uma única vez em `Sincronizar carteira`.
6. Confirmar 35 registros no roster: 26 ativos e 9 inativos.
7. Abrir Depósito Santa Helena.
8. Abrir Status e conferir o estado Ativo.
9. Abrir Contexto e clicar `Importar piloto`.
10. Confirmar 15 propostas e zero ativações automáticas.
11. Aprovar apenas itens revisados.
12. Gerar snapshot v1 somente após a revisão.

## Testes de permissão

- Admin acessa Usuários, Status, Contexto e sincronização da carteira.
- Operador acessa Status e Contexto, mas não Usuários nem importações administrativas.
- Cliente acessa apenas o próprio workspace permitido e não acessa Status ou Contexto internos.
- Usuário desativado perde acesso na requisição seguinte.

## Rollback

As migrations deste ciclo são aditivas: criam novas tabelas e campos sem remover dados anteriores.

Se a aplicação falhar após o deploy:

1. Não executar comandos manuais de exclusão no banco.
2. Fazer rollback do serviço para o commit anterior no EasyPanel.
3. As tabelas e colunas novas podem permanecer; o código anterior simplesmente não as utiliza.
4. Investigar logs antes de qualquer reversão de banco.
5. Restaurar o snapshot do PostgreSQL somente em caso de corrupção ou orientação técnica explícita.

## Diagnóstico rápido

### `Environment variable not found: DATABASE_URL`

A variável não está disponível no runtime do serviço. Corrigir no EasyPanel; não criar `.env` no repositório.

### `prisma: not found`

O build não contém o Prisma CLI. Conferir as cópias de `node_modules/prisma`, `node_modules/@prisma` e `node_modules/.bin/prisma` no Dockerfile.

### Migration já existe ou objeto já existe

Interromper o deploy. Isso indica que o banco foi alterado fora do histórico de migrations. Não usar `db push` para forçar. Comparar `_prisma_migrations` com `prisma/migrations/` e registrar um baseline antes de continuar.

### Aplicação antiga continua no domínio

Conferir se o EasyPanel recebeu a `main`, fazer rebuild manual e validar sem cache.
