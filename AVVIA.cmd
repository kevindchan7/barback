@echo off
REM ============================================================
REM  Avvia Barback (magazzino & turni). Doppio click su questo file.
REM  Usa il Node.js portatile in ..\.tools (niente installazioni).
REM ============================================================
setlocal
set "NODEDIR=%~dp0..\.tools\node-v24.16.0-win-x64"
set "PATH=%NODEDIR%;%PATH%"
cd /d "%~dp0"
echo Avvio del server... apri il browser su http://localhost:3100
node --experimental-sqlite server.js
echo.
echo Il server e' stato chiuso. Premi un tasto per uscire.
pause >nul
