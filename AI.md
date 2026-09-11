# AI-ügynököknek – hogyan dolgozz ezzel az apppal

Ez a fájl **csak az automatáknak / AI-ügynököknek** szól. A felhasználói felület
és a kézi használat ettől nem változik.

## A leggyakoribb hiba: ékezetek

A feladatcímek vegyesen tartalmaznak ékezetet (`Ügyvéd egyeztetés`, de
`Julcsi gyamugy - vedelembe vetel`). Egyszerű szövegegyezéssel az `ugyved`
**nem** találja meg az `Ügyvéd`-et.

Ezért **soha ne szűrj nyers `includes` / `grep` hívással a címekre.**
Használd az alább leírt, ékezet- és kisbetű-független kereséseket.

---

## 1. Böngészőből (a futó app) – `window.FK`

Ha az appot böngészőben vezérled, **ne gépelj a szerkesztőbe és ne kattintgass**.
A leírásmező `contenteditable` elem – a gépelés törékeny, és háttérfrissítés
esetén megduplázhatja a szöveget. Helyette:

```js
FK.find("ugyved")              // ["Ügyvéd egyeztetés", "Számla kifizetés"] – cím + leírás + lépések
FK.find("ugyved", {in:"title"})// csak a címben keres
FK.get("Ugyved egyeztetes")    // egy feladat id VAGY (ékezetfüggetlen) cím alapján
FK.list({list:"Céges", done:false})
FK.lists()

FK.setNote(ref, "teljes új leírás")     // egy lépésben, gépelés nélkül
FK.appendNote(ref, "hozzáfűzött sor")
FK.setTitle(ref, "…")
FK.setDue(ref, "2026-08-30")            // YYYY-MM-DD, "" = nincs határidő
FK.setReminder(ref, "2026-08-30T09:00") // null = törlés
FK.setDone(ref, true) / FK.setImportant(ref, true)
FK.set(ref, {title, note, due, done, important, reminder})
FK.add({title, list, note, due, important, steps})
FK.remove(ref)
FK.help()
```

`ref` = a feladat **id-je vagy címe**. A cím feloldása ékezetfüggetlen; ha a
keresés több címre illeszkedik, a hívás hibát dob és felsorolja a találatokat
id-vel – ilyenkor id-vel hívd újra. Pontos címegyezés mindig elsőbbséget élvez.

### Ellenőrzés MENTÉS ELŐTT

Minden író hívás elfogad `{dryRun:true}` opciót: elvégzi a módosítást a
memóriában, visszaadja az eredményt, de **nem ment**. Így ellenőrizhető, hogy jó
lesz-e az eredmény, mielőtt rögzülne:

```js
const proba = FK.setNote(id, ujSzoveg, {dryRun:true});
if (proba.note === ujSzoveg) FK.setNote(id, ujSzoveg);   // csak ekkor ment
FK.verify(id, {note: ujSzoveg});   // -> {ok:true, elteresek:[]}
```

Minden író hívás a **mentett** állapotot adja vissza, így utólag is ellenőrizhető
egy külön olvasás nélkül.

---

## 2. Webhookon át (`data/tasks.json`)

Végpont: **`https://feladatkezelo.pengemedia.workers.dev/api`**
(figyelem: az `/api` útvonal kell, a gyökér a weboldalt adja vissza).
A hitelesítést lásd: `webhook/README.md`.

```bash
URL="https://feladatkezelo.pengemedia.workers.dev/api"

# ékezetfüggetlen keresés
curl -s -X POST "$URL" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" \
  -d '{"op":"find","q":"ugyved"}'
# csak a címben:
  -d '{"op":"find","q":"ugyved","in":"title"}'
```

Válasz: `{ok, count, tasks:[{id,title,list,due,done,important,note}]}`.

A `get`, `update`, `setDue`, `setReminder` műveletek `id` helyett `q` (vagy
`title`) mezőt is elfogadnak, ugyanazzal az ékezetfüggetlen feloldással:

```bash
curl -s -X POST "$URL" -H "Authorization: Bearer $SEC" -H "Content-Type: application/json" \
  -d '{"op":"update","q":"ugyved egyeztetes","fields":{"note":"frissített leírás"}}'
```

Több találatnál a válasz **409** és tartalmazza a `matches` listát id-kkel –
ilyenkor id-vel ismételd meg a hívást.

---

## 3. Amire figyelj

- **Ne gépelj a `#netext` elembe.** Használd az `FK.setNote()` hívást.
- Egy feladat azonosítója az `id`; a cím változhat, és nem feltétlenül egyedi.
- A `data/tasks.json` **beérkező postaláda**, nem a teljes adatbázis: az app csak
  az `inboxSince` utáni új elemeket hozza be belőle. A felhasználó teljes
  adathalmaza a böngészőben (localStorage) és a Firestore-ban van – azt a
  `window.FK` API-n át éred el.
- Adatvesztés nem megengedett: a szinkron MERGE alapú (módosítási időbélyeg +
  tombstone). Ne írj felül teljes listákat.

---

## 4. Kapcsolatok írásának kötelező formája

A leírásból a program automatikusan felismeri a neveket, telefonszámokat és
e-mail-címeket, és személyenként csoportosítja őket. Ahhoz, hogy ez **soha ne
keveredjen össze**, a kapcsolatokat mindig így kell leírni:

```
Név: Dr. Kristóf Bálint
+36 30 686 1915
kristof@pelda.hu
Internetről találva – Bécsi út
---
Név: Szatmári Norbert
+36 70 256 1904
Fb Post hirdetés – nagyon korrekt
```

Két szabály, ennyi:

1. **`---` sor két kapcsolat között.** Ez KEMÉNY határ: elérhetőség soha nem
   kerülhet át rajta a másik személyhez. Bármilyen, betűt és számot nem
   tartalmazó sor jó (`---`, `- - -`, `———`, `***`).
2. **`Név:` előtag a személy neve előtt.** Ez felülír minden automatikus
   felismerést — akkor is működik, ha a név kisbetűs, számot vagy szokatlan
   szót tartalmaz (pl. `Név: szatmári norbert 2-es rendelő`).

A `Név:` helyett ezek is jók: `Kapcsolattartó:`, `Ügyintéző:`, `Cég:`, `Partner:`,
`Ügyfél:`, `Feladó:`, `Kontakt:`.

### Amit a program magától kezel
- A cím- és megjegyzéssorok kimaradnak (számot tartalmazó sor sosem név).
- A titulusok nem zavarnak: `dr.`, `Dr.`, `prof.`, `ifj.`, `özv.`, `PhD`.
- Ha egy blokkban nincs felismerhető név, a csoport fejléce
  „Nincs felismert név" lesz — ez jelzés, hogy oda `Név:` sor kell.

### Amit NE csinálj
- Ne írj kapcsolatokat elválasztó nélkül egymás után.
- Ne tegyél megjegyzést a név helyére (pl. „Fb Post hirdetés" magában).
- Meglévő leírást ne írj át csak azért, hogy megfeleljen ennek — csak ha a
  felhasználó kéri, vagy ha te viszel fel új kapcsolatot.
