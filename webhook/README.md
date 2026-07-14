# Írható webhook – feladatkezelő

A webhook a `data/tasks.json`-t olvassa/írja a GitHub API-n keresztül.
Minden **írás egy commit** → automatikus verziózás + teljes visszakereshető előzmény.
Használható a Claude-ból és külső rendszerekből (pl. webshop) is.

## Műveletek (POST, JSON body)
| op | mit csinál | mezők |
|----|------------|-------|
| `list` | összes lista + feladat visszaadása | – |
| `get` | egy feladat | `id` |
| `add` | új feladat felvitele | `task`: `title`, `list` (név) v. `listId`, `due` (YYYY-MM-DD), `note`, `important`, `reminder`, `steps[]` |
| `update` | mezők módosítása | `id`, `fields`: bármelyik: `title`,`note`,`due`,`important`,`done`,`reminder` |
| `setDue` | határidő beállítása/módosítása | `id`, `due` |
| `setReminder` | emlékeztető beállítása/módosítása/törlése | `id`, `reminder` (ISO idő; `null` = törlés) |

- **Leírás módosítása** → `update` + `fields.note`
- **Időpont (határidő) hozzáadása/módosítása** → `setDue` vagy `update` + `fields.due`
- **Emlékeztető hozzáadása/módosítása** → `setReminder` vagy `update` + `fields.reminder`

## Telepítés (Cloudflare Worker – ingyenes, CLI nélkül)
1. Regisztrálj / lépj be: https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → adj nevet (pl. `feladat-webhook`) → **Deploy**.
2. **Edit code** → töröld a mintát, másold be a `worker.js` teljes tartalmát → **Deploy**.
3. A Worker → **Settings → Variables and Secrets**, add hozzá:
   - `REPO` = `pengemedia-fejlesztes/feladatkezelo`  (Text)
   - `FILE_PATH` = `data/tasks.json`  (Text)
   - `BRANCH` = `main`  (Text)
   - `GITHUB_TOKEN` = a GitHub tokened  (**Secret / Encrypt**)
   - `WEBHOOK_SECRET` = egy általad választott hosszú titkos string  (**Secret / Encrypt**)
4. GitHub token: https://github.com/settings/personal-access-tokens → **Fine-grained token** → Repository access: csak a `feladatkezelo` repó → Permissions: **Contents: Read and write** → Generate → másold a `GITHUB_TOKEN`-be.
5. A Worker URL-je: `https://feladat-webhook.<felhasznalod>.workers.dev`

## Hívási példák (curl)
```bash
URL="https://feladat-webhook.XXXX.workers.dev"
SEC="a_WEBHOOK_SECRET_erteked"

# olvasás
curl -s -X POST "$URL" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" \
  -d '{"op":"list"}'

# új feladat + határidő + emlékeztető
curl -s -X POST "$URL" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" \
  -d '{"op":"add","task":{"title":"Teszt feladat","list":"Feladatok","due":"2026-07-25","note":"leírás","important":true,"reminder":"2026-07-25T09:00"}}'

# leírás módosítása
curl -s -X POST "$URL" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" \
  -d '{"op":"update","id":"<taskId>","fields":{"note":"frissített leírás"}}'

# határidő módosítása
curl -s -X POST "$URL" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" \
  -d '{"op":"setDue","id":"<taskId>","due":"2026-07-28"}'

# emlékeztető beállítása
curl -s -X POST "$URL" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" \
  -d '{"op":"setReminder","id":"<taskId>","reminder":"2026-07-28T07:30"}'
```

## Megjegyzés – az app frissülése
A webhook a GitHub adatot írja. Ahhoz, hogy a **futó app is azonnal mutassa** a webhookon át
tett változást, az appnak újra kell olvasnia a `tasks.json`-t. Ezt egy következő lépésben kötjük be
(pl. „Frissítés GitHubról" gomb vagy időzített újratöltés), a backend/adatvédelmi körrel együtt.
