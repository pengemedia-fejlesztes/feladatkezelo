#!/usr/bin/env bash
# Elmenti a jelenlegi data/tasks.json-t egy idobelyeges verzioba, es csak a legujabb 4-et tartja meg.
set -euo pipefail
cd "$(dirname "$0")/.."
TS=$(date +%Y%m%d-%H%M%S)
cp data/tasks.json "data/versions/tasks_${TS}.json"
ls -1t data/versions/tasks_*.json | tail -n +5 | xargs -I{} rm -f "{}"
echo "Verzio mentve: tasks_${TS}.json  (max 4 megorizve)"
ls -1t data/versions/tasks_*.json
