#!/bin/sh
set -eu

echo "[luqz-dash] iniciando release"
echo "[luqz-dash] verificando baseline do banco"

set +e
node prisma/prepare-migrations.mjs
BASELINE_STATUS=$?
set -e

case "$BASELINE_STATUS" in
  0)
    ;;
  42)
    echo "[luqz-dash] banco legado reconhecido; registrando baseline"
    ./node_modules/.bin/prisma migrate resolve --applied 20260623000000_baseline_legacy
    ;;
  *)
    echo "[luqz-dash] banco incompatível com o baseline; inicialização interrompida"
    exit "$BASELINE_STATUS"
    ;;
esac

echo "[luqz-dash] aplicando migrations do Prisma"

set +e
./node_modules/.bin/prisma migrate deploy
DEPLOY_STATUS=$?
set -e

if [ "$DEPLOY_STATUS" -ne 0 ]; then
  echo "[luqz-dash] migrate deploy falhou (possivel P3009); tentando recuperar migration interrompida"
  # Migrations sao transacionais no Postgres: uma falha nao deixa objetos parciais.
  # Marca a migration interrompida como rolled-back para que seja reaplicada do zero.
  # As migrations envolvidas sao idempotentes (IF NOT EXISTS / guards), entao a
  # reaplicacao e segura mesmo em estados intermediarios.
  ./node_modules/.bin/prisma migrate resolve --rolled-back 20260624200000_add_meetings_and_checkin || true
  ./node_modules/.bin/prisma migrate deploy
fi

echo "[luqz-dash] migrations aplicadas com sucesso"
echo "[luqz-dash] iniciando servidor Next.js na porta ${PORT:-3000}"

exec node server.js
