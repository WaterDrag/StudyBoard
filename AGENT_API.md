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

### Vytvořit nebo upravit textovou poznámku

Jen pokud pozvánka zahrnuje `notes:write`. Obsah je prostý text bezpečně zobrazený v aplikaci; jedno volání může přidat poznámku nebo změnit její obsah/název. Poznámky lze vytvořit na volitelných souřadnic tabule, výchozí pozice je `(60, 60)`.

```http
POST /rooms/{roomId}/notes
Content-Type: application/json

{"title":"Nový pojem","content":"Vysvětlení pojmu","x":100,"y":120}
```

```http
PATCH /rooms/{roomId}/notes/{noteId}
Content-Type: application/json

{"content":"Upravené vysvětlení"}
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
