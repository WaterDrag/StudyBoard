@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   StudyBoard - nahrani na GitHub
echo   ==============================
echo.

rem ------------------------------------------------------------------
rem  Zalozeni repozitare. Na rozdil od Game Hubu se tu nic nenastavuje
rem  rucne - kdyz slozka jeste neni git, skript si ji zalozi sam.
rem ------------------------------------------------------------------
git --version >nul 2>&1
if errorlevel 1 (
  echo   CHYBA: neni nainstalovany Git.
  echo   Stahni ho z https://git-scm.com/download/win a spust tenhle soubor znovu.
  goto :konec
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo   [1/5] Zakladam git slozku...
  git init -b main >nul
  if errorlevel 1 goto :chyba
  echo         hotovo
) else (
  echo   [1/5] Git slozka uz existuje
)

rem ------------------------------------------------------------------
rem  Bez jmena a e-mailu git odmitne udelat commit. Nastavuje se jen pro
rem  tuhle slozku (stejne jako u Game Hubu), takze to nic jineho neovlivni.
rem ------------------------------------------------------------------
git config user.email >nul 2>&1
if errorlevel 1 (
  echo   [1b] Git jeste nevi, kdo jsi - nastavuji podpis pro commity...
  git config user.name "zitka"
  git config user.email "zitkatomik00@gmail.com"
  echo         zitka ^<zitkatomik00@gmail.com^>
)

rem ------------------------------------------------------------------
rem  Pojistka - co na GitHub nepatri. Firebase konfigurace v js\config.js
rem  je verejna zamerne (chrani ji Firestore pravidla, ne utajeni), takze
rem  ta jit muze. Hlidaji se opravdove klice a certifikaty.
rem ------------------------------------------------------------------
echo   [2/5] Kontroluji, ze nic tajneho neodejde...
for /f "delims=" %%f in ('git ls-files --cached --others --exclude-standard') do (
  echo %%f | findstr /I /R "\.key$ \.pem$ \.secret$ id_rsa serviceAccount" >nul && (
    echo.
    echo   STOP: mezi soubory je %%f - to na GitHub nepatri.
    echo   Smaz ho nebo pridej do .gitignore a zkus to znovu.
    goto :konec
  )
)
echo         v poradku

rem ------------------------------------------------------------------
rem  Kam to posilat. Pta se jen poprve, pak si to pamatuje git sam.
rem ------------------------------------------------------------------
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [3/5] Jeste nevim, kam nahravat.
  echo.
  echo         Zaloz prazdny repozitar na https://github.com/new
  echo         Nazev:     StudyBoard
  echo         DULEZITE:  nezaskrtavej README, .gitignore ani licenci,
  echo                    jinak se prvni nahrani odmitne.
  echo.
  set "VYCHOZI=https://github.com/waterdrag/StudyBoard.git"
  set /p "URL=        Adresa [Enter = !VYCHOZI!]: "
  if "!URL!"=="" set "URL=!VYCHOZI!"
  git remote add origin "!URL!"
  if errorlevel 1 goto :chyba
  echo         nastaveno na !URL!
) else (
  for /f "delims=" %%r in ('git remote get-url origin') do echo   [3/5] Cil: %%r
)

rem ------------------------------------------------------------------
echo   [4/5] Ukladam zmeny...
git add -A
if errorlevel 1 goto :chyba

git diff --cached --quiet
if errorlevel 1 (
  for /f "delims=" %%d in ('powershell -NoProfile -Command "Get-Date -Format \"yyyy-MM-dd HH:mm\""') do set "STAMP=%%d"
  git commit -q -m "Aktualizace !STAMP!"
  if errorlevel 1 (
    echo.
    echo   Commit se nepovedl. Nejcasteji chybi podpis - spust rucne:
    echo     git config user.name "tvoje jmeno"
    echo     git config user.email "tvuj@email.cz"
    goto :chyba
  )
  echo         ulozeno
) else (
  echo         zadne zmeny, posilam jen to, co jeste neodeslo
)

rem ------------------------------------------------------------------
echo   [5/5] Nahravam na GitHub...
echo         (poprve otevre prohlizec kvuli prihlaseni)
git push -u origin main
if errorlevel 1 goto :chyba

git fetch -q origin
for /f "delims=" %%a in ('git rev-parse HEAD') do set "MISTNI=%%a"
for /f "delims=" %%b in ('git rev-parse origin/main') do set "VZDALENY=%%b"
if not "!MISTNI!"=="!VZDALENY!" (
  echo.
  echo   POZOR: na GitHubu je neco jineho, nez mas tady.
  goto :konec
)

echo.
echo   HOTOVO. Vse je na GitHubu.
for /f "delims=" %%r in ('git remote get-url origin') do echo   %%r
echo.
echo   Stranka:  https://waterdrag.github.io/StudyBoard/dashboard.html
echo.
echo   Kdyby se stranka neotevrela, zapni jednou GitHub Pages:
echo     repozitar - Settings - Pages - Source: Deploy from a branch
echo     Branch: main    slozka: / (root)   - Save
echo.
echo   POZOR: Firestore pravidla se timhle NENAHRAVAJI. Ty se publikuji
echo   rucne ve Firebase Console (Firestore - Rules - Publish) ze souboru
echo   firestore.rules.
echo.
goto :konec

:chyba
echo.
echo   NEPOVEDLO SE. Chyba je vypsana vys.
echo   Nejcastejsi duvody:
echo     - repozitar na GitHubu jeste neexistuje (zaloz ho na github.com/new)
echo     - repozitar neni prazdny (zalozil jsi ho s README nebo licenci)
echo     - spatne heslo / token v prihlasovacim okne
echo     - neni internet
echo.

:konec
pause
endlocal
