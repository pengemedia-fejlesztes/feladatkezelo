# Feladatok – projekt (Claude Code utasitasok)

Egyfajlos teendokezelo webapp. A teljes app az `index.html`-ben van
(HTML + CSS + vanilla JS, string-alapu render() + innerHTML). GitHub Pages szolgalja ki.
Elo cim: https://pengemedia-fejlesztes.github.io/feladatkezelo/

## ELESITES – mindig csinald meg magadtol, kulon keres nelkul
Miutan barmit modositottal az index.html-ben:
1. Noveld a verziot: az `APP_VERSION` konstans erteket (pl. "v34" -> "v35").
2. Ellenorizd a fajlt:
   - a meret legyen legalabb 140000 bajt (a regi hibas fajl ~135000 volt),
   - a <script> legyen szintaktikailag helyes (vond ki es futtasd: node --check).
3. Commitold es pushold a main agra:
   git add -A && git commit -m "..." && git push
4. Ird ki az elo cimet ?v=<verzio> vegzodessel.
Ne kerdezz ra kulon engedelyre az elesiteshez – ez az alap munkafolyamat.

## Fontos szabalyok
- Adatvesztes SOHA nem megengedett. A szinkron MERGE-alapu (mod idobelyeg + tombstone), ne ird felul.
- A felhasznalo kezdo es magyarul kommunikal – magyarazz roviden, lepesrol lepesre.
- Ket lista van: Magan es Ceges (lst_magan / lst_ceges).
- Firebase: projectId feladatkezelo-68f31 (Auth email/jelszo, Firestore appdata/{uid}.blob).
- Minden valtoztatas elott ellenorizd, hogy nem a regi ~135000 bajtos fajlon dolgozol-e.
