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

./node_modules/.bin/prisma migrate deploy

echo "[luqz-dash] migrations aplicadas com sucesso"
echo "[luqz-dash] iniciando servidor Next.js na porta ${PORT:-3000}"

exec node server.js
