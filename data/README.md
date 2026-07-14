# Feladat-adatok (todo)

- **`tasks.json`** — az aktuális, mérvadó adat (listák + feladatok). Ez a forrás.
- **`versions/`** — automatikus biztonsági mentések, a **legutóbbi 4** megőrizve.
- Teljes előzmény: a git commit-történet (minden változás visszakereshető).

## Adatmodell
- `lists[]`: `{id, name, color}`
- `tasks[]`: `{id, listId, title, done, important, note, due (YYYY-MM-DD), steps[], createdAt, order}`
- `steps[]`: `{id, text, done, order}`

## Verziókezelés
- Új verzió mentése (módosítás előtt/után): `bash scripts/save-version.sh`
- Visszaállítás: `bash scripts/rollback.sh <sorszam>`  (a lista a legújabbtól a legrégebbiig)
