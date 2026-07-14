#!/usr/bin/env bash
# Visszaallit egy korabbi verziot. Hasznalat: bash scripts/rollback.sh <sorszam>
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Elerheto verziok (ujtol regiig):"
ls -1t data/versions/tasks_*.json | nl
if [ "${1:-}" = "" ]; then
  echo; echo "Visszaallitas: bash scripts/rollback.sh <sorszam>"
  exit 0
fi
FILE=$(ls -1t data/versions/tasks_*.json | sed -n "${1}p")
[ -z "${FILE:-}" ] && { echo "Nincs ilyen verzio."; exit 1; }
cp data/tasks.json "data/versions/tasks_$(date +%Y%m%d-%H%M%S)_pre-rollback.json"
cp "$FILE" data/tasks.json
ls -1t data/versions/tasks_*.json | tail -n +5 | xargs -I{} rm -f "{}"
echo "Visszaallitva innen: $FILE"
