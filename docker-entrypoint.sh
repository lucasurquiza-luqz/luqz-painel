#!/bin/sh
set -eu

echo "[luqz-dash] iniciando release"
echo "[luqz-dash] validando migrations do Prisma"

./node_modules/.bin/prisma migrate deploy

echo "[luqz-dash] migrations aplicadas com sucesso"
echo "[luqz-dash] iniciando servidor Next.js na porta ${PORT:-3000}"

exec node server.js
