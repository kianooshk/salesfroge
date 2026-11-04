#!/bin/sh
set -e
cd /app/backend
npx prisma db push --skip-generate
node dist/seed-cli.js
exec node dist/main.js
