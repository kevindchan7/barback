@echo off
REM ============================================================
REM  Avvia Barback (magazzino & turni). Doppio click su questo file.
REM  Usa il Node.js portatile in ..\.tools (niente installazioni).
REM ============================================================
setlocal
set "NODEDIR=%~dp0..\.tools\node-v24.16.0-win-x64"
set "PATH=%NODEDIR%;%PATH%"
cd /d "%~dp0"

REM ------------------------------------------------------------
REM  Se dal telefono hai modificato qualcosa, quelle modifiche
REM  stanno su GitHub e non qui. Le scarichiamo prima di partire,
REM  altrimenti lavori su una versione vecchia e poi tocca
REM  risolvere i conflitti a mano. Se non sei in un repository, o non c'e'
REM  rete, si tira dritto: non e' un motivo per non avviare l'app.
REM ------------------------------------------------------------
git rev-parse --is-inside-work-tree >nul 2>&1
if not errorlevel 1 (
  echo Controllo se c'e' qualcosa di nuovo su GitHub...
  git pull --ff-only 2>nul
  if errorlevel 1 (
    echo.
    echo   ATTENZIONE: non sono riuscito ad aggiornare da GitHub.
    echo   Puo' essere che tu abbia modifiche locali non salvate,
    echo   oppure che manchi la rete. L'app parte lo stesso, ma
    echo   controlla con  git status  prima di lavorarci.
    echo.
  )
)

echo Avvio del server... apri il browser su http://localhost:3100
node --experimental-sqlite server.js
echo.
echo Il server e' stato chiuso. Premi un tasto per uscire.
pause >nul
