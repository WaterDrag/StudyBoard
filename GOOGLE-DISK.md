# Připojení Google Disku

StudyBoard umí poslat export rovnou do složky **StudyBoard** na tvém Google Disku.
Než to půjde, musíš jednou vyrobit vlastní přístupové ID. Trvá to pár minut a je to zdarma.

## Co StudyBoard uvidí

Používá se oprávnění **`drive.file`** — appka vidí **jen soubory, které sama vytvoří**.
Do zbytku tvého Disku se nedostane, i kdyby chtěla. Proto to taky Google nemusí schvalovat.

## Postup

1. Otevři **https://console.cloud.google.com/** a přihlas se stejným Googlem, jehož Disk chceš používat.
2. Nahoře vytvoř **nový projekt** (stačí jméno `StudyBoard`).
3. V nabídce **APIs & Services → Library** najdi **Google Drive API** a dej **Enable**.
4. **APIs & Services → OAuth consent screen**:
   - typ **External**, vyplň název aplikace a svůj e-mail,
   - v kroku **Scopes** nic nepřidávej (`drive.file` si appka vyžádá sama),
   - v kroku **Test users** přidej svůj e-mail (a e-maily spolužáků, kteří to mají používat).
   Dokud je projekt v režimu *Testing*, funguje jen pro tyhle přidané lidi — na schválení
   od Googlu čekat nemusíš.
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - typ **Web application**,
   - do **Authorized JavaScript origins** přidej:
     - `https://waterdrag.github.io`
     - `http://localhost:8137` (jen když testuješ lokálně)
   - **Redirect URI nech prázdné** — tenhle způsob přihlášení ho nepoužívá.
6. Zkopíruj vygenerované **Client ID** (končí na `.apps.googleusercontent.com`)
   a vlož ho v **`js/config.js`**:

   ```js
   const GOOGLE_CLIENT_ID = 'sem-to-vloz.apps.googleusercontent.com';
   ```

7. Nahraj změnu na GitHub (`nahrat.bat`) a hotovo.

## Aby to mohli používat všichni (ne jen ty)

Každý si připojí **svůj vlastní** Disk — přihlašuje se svým Googlem a složka
StudyBoard vznikne na jeho Disku. Client ID je jen identita aplikace, nespojuje
nikoho s tvým účtem a nikdo nevidí cizí soubory.

Dokud je ale projekt v režimu **Testing**, platí omezení:

- přihlásit se smí **jen e-maily uvedené v Test users** (max 100),
- ostatní dostanou `access_denied`,
- zobrazí se varování o neověřené aplikaci,
- **souhlas vyprší po 7 dnech** a musí se udělit znovu.

**Nejdřív Branding.** Google pustí projekt do produkce až když je na stránce
**Branding** vyplněné: název, kontaktní e-mail, **domovská stránka** a
**odkaz na zásady ochrany soukromí**. Vyplň:

| pole | hodnota |
|---|---|
| Application home page | `https://waterdrag.github.io/StudyBoard/` |
| Application privacy policy link | `https://waterdrag.github.io/StudyBoard/soukromi.html` |
| Application terms of service link | nepovinné, nech prázdné |

Stránka se zásadami je v repozitáři jako **`soukromi.html`** — musí být
nahraná na GitHub, jinak ten odkaz nikam nevede a Google ho neuzná.

**Pak už samotné přepnutí:**

1. Otevři **https://console.cloud.google.com/auth/audience**
2. Nahoře zkontroluj, že je vybraný **ten projekt**, ve kterém jsi dělal Client ID
3. U **Publishing status: Testing** klikni na **Publish app** a potvrď
4. Stav se přepne na **In production**

(Dřív to bylo pod *APIs & Services → OAuth consent screen*. Google to přesunul
do sekce **Google Auth Platform → Audience**, takže hledání „OAuth consent
screen" tě dovede právě sem.)

Protože StudyBoard žádá jen rozsah **`drive.file`**, který Google řadí mezi
**nesensitive**, **není potřeba žádné ověřování** — žádné video, žádné
zdůvodňování, žádný bezpečnostní audit. Je to jedno tlačítko a hned nato se
může přihlásit kdokoli.

> **Důležité:** na consent screenu nesmí být vypsaný žádný sensitive ani
> restricted rozsah. Stačí jediný a Google začne vyžadovat plné ověření —
> proto se v kroku *Scopes* nic nepřidává, appka si `drive.file` vyžádá sama.

## Jak se to používá

V místnosti **⬇️ Export → ☁️ Uložit na Google Disk**. Poprvé vyskočí okno Googlu
s žádostí o přístup; složka **StudyBoard** se na Disku založí sama při prvním uložení.

## Když to nefunguje

| hláška | co s tím |
|---|---|
| „Google Disk zatím není nastavený" | chybí `GOOGLE_CLIENT_ID` v `js/config.js` |
| `redirect_uri_mismatch` / `origin_mismatch` | adresa, ze které to pouštíš, není v **Authorized JavaScript origins** |
| „Okno přihlášení bylo zavřené" | zavřel jsi ho, nebo ho blokuje blokovač vyskakovacích oken |
| `access_denied` | e-mail není mezi **Test users** — nebo rovnou přepni projekt na *In production* |

Přístup jde kdykoli odebrat na **https://myaccount.google.com/permissions**.
