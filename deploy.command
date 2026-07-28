#!/bin/bash
REPO_DIR="$HOME/feladatkezelo"
PAGE="https://pengemedia-fejlesztes.github.io/feladatkezelo/"
cd "$REPO_DIR" 2>/dev/null || { echo "HIBA: nincs $REPO_DIR mappa."; read -n1 -p "Nyomj egy gombot..."; exit 1; }
echo "=== Feladatok - elesites ==="
NEW="$(ls -t "$HOME/Downloads/"*.html 2>/dev/null | head -1)"
if [ -z "$NEW" ]; then echo "HIBA: nincs letoltott .html a Letoltesek mappaban."; read -n1 -p "Nyomj egy gombot..."; exit 1; fi
echo "Legfrissebb letoltes: $NEW"
cp "$NEW" index.html
BYTES=$(wc -c < index.html | tr -d ' ')
echo "Meret: $BYTES bajt"
if [ "$BYTES" -lt 140000 ]; then echo "MEGSZAKITVA: gyanusan kicsi ($BYTES) - talan regi fajl."; git checkout -- index.html 2>/dev/null; read -n1 -p "Nyomj egy gombot..."; exit 1; fi
if git diff --quiet -- index.html; then echo "Nincs valtozas - mar ez van fent."; read -n1 -p "Nyomj egy gombot..."; exit 0; fi
git add -A
git commit -m "App frissites $(date '+%Y-%m-%d %H:%M')" >/dev/null
echo "Feltoltes GitHubra..."
if git push; then V=$(date +%s); URL="${PAGE}?v=${V}"; echo ""; echo "KESZ! Friss cim: $URL"; sleep 2; open "$URL"; else echo "A push NEM sikerult (lasd fent)."; fi
echo ""; read -n1 -p "Kesz. Nyomj egy gombot a bezarashoz..."
