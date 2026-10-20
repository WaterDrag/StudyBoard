# Přístup AI agenta do StudyBoard

Vlastník místnosti může v **Sdílet místnost → Pozvánka pro AI agenta** vytvořit časově omezený token. Token se zobrazí pouze jednou; databáze uchovává jen jeho SHA-256 otisk. Vlastník může aktivní přístup kdykoli zrušit.

## Oprávnění

- `notes:read` — vždy zapnuté; čtení obsahu a názvů poznámek v jedné místnosti.
- `notes:write` — volitelné; vytváření textových poznámek a úprava jejich názvu či obsahu. Agent není členem místnosti a nepotřebuje přátelství s vlastníkem. Mazání poznámek není povolené.
- `comments:write` — volitelné; agent může pod poznámku přidat komentář. Komentáře se v místnosti označí jako **AI agent**.

Token je platný 1 hodinu, 1 den, 7 dní nebo 30 dní a má limit 60 požadavků za minutu. Token předej agentovi zabezpečeným způsobem a po skončení práce pozvánku zruš. Kdokoli, kdo token získá, může vykonávat jeho oprávnění; StudyBoard nedokáže ověřit, zda volající je skutečně AI.

## API

Základní URL po nasazení:

```text
https://europe-west1-studypage-1f2f8.cloudfunctions.net/agentApi/v1
```

Každý požadavek agenta musí posílat hlavičku:

```text
Authorization: Bearer sbai_…
```

### Číst seznam poznámek

```http
GET /rooms/{roomId}/notes?limit=100
```

Stránka obsahuje nejvýše 200 poznámek. Když odpověď vrátí `nextCursor`, další stránku načti pomocí `?cursor={nextCursor}`.

### Číst jednu poznámku

```http
GET /rooms/{roomId}/notes/{noteId}
```

### Mřížka plochy (rozmístění poznámek)

Aby poznámky od agenta stály v úhledných sloupcích a nepřekrývaly se, je plocha rozdělená na mřížku: **8 sloupců**, buňka **260 × 180 px**. Řádek 0 je pro nadpisy sloupců.

```http
GET /rooms/{roomId}/layout
```

Vrátí rozměry mřížky a pro každý sloupec `nextFreeRow` (kam padne další poznámka). Doporučený postup: jedno téma = jeden sloupec.

1. nadpis sloupce: `{"kind":"heading","title":"MO1 · Programování","col":0}`
2. poznámky do něj: `{"title":"Algoritmus","content":"…","col":0}` — každá se postaví pod předchozí.

Varianty pozice v těle `POST /notes`:

- `{"col":N}` — další volný řádek ve sloupci N,
- `{"col":N,"row":R}` — přesně daná buňka,
- `{"x":…, "y":…}` — ruční souřadnice (nekombinovat s col/row),
- nic — první volná buňka zleva doprava.

Odpověď obsahuje i výsledné `x` a `y`.

### Vytvořit nebo upravit textovou poznámku

Jen pokud pozvánka zahrnuje `notes:write`. Obsah je prostý text bezpečně zobrazený v aplikaci; jedno volání může přidat poznámku nebo změnit její obsah/název. Poznámky se umisťují do mřížky (viz výše); bez pozice padnou do první volné buňky.

```http
POST /rooms/{roomId}/notes
Content-Type: application/json

{"title":"Nový pojem","content":"Vysvětlení pojmu","col":0}
```

```http
PATCH /rooms/{roomId}/notes/{noteId}
Content-Type: application/json

{"content":"Upravené vysvětlení"}
```

Obrázky: `POST` i `PATCH` přijímají volitelné pole `images` (1–4 položky `{"url":"…","caption":"…"}`). URL musí být `https` z `upload.wikimedia.org` nebo `i.ibb.co`, popisek nejvýše 300 znaků (hodí se do něj zdroj a licence). Obrázky se vloží nad text poznámky. Protože `PATCH` nahrazuje obsah celý, posílej `images` vždy spolu s `content`.

```http
PATCH /rooms/{roomId}/notes/{noteId}
Content-Type: application/json

{"content":"Text poznámky","images":[{"url":"https://upload.wikimedia.org/…/obrazek.png","caption":"Popisek · Wikimedia Commons, CC BY-SA 3.0"}]}
```

`title` může mít nejvýše 300 znaků a `content` 100 000 znaků. Při úpravě lze poslat `title`, `content` nebo obojí. `title: null` název smaže. Zatím lze přes API měnit obsah jen běžných textových poznámek; obsah návodů a tabulek ani poznámky mazat nelze.

### Přidat komentář

Jen pokud pozvánka zahrnuje `comments:write`:

```http
POST /rooms/{roomId}/notes/{noteId}/comments
Content-Type: application/json

{"text":"Komentář od agenta"}
```

Komentář může mít nejvýše 2 000 znaků.

## Nasazení serveru

Web StudyBoard se publikuje přes GitHub Pages, agentní API ale běží ve Firebase Cloud Functions. Na počítači s Node.js 22 a Firebase CLI spusť z kořene projektu:

```powershell
npm --prefix functions install
firebase login
firebase deploy --only functions:agentApi,firestore:rules --project studypage-1f2f8
```

Projekt Firebase musí mít povolený plán Blaze a fakturační účet. Cloud Functions vyžadují tento plán; využití má účtování podle spotřeby. Po nasazení nahraj změny webu na GitHub obvyklým postupem. Firestore pravidla obsahují explicitní zákaz přístupu klientů ke kolekci s agentními tokeny.
