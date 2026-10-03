@echo off
chcp 65001 >nul
title Barback - Demo da mostrare
setlocal
set "BASE=%~dp0"
set "NODEDIR=%BASE%..\.tools\node-v24.16.0-win-x64"
set "CF=%BASE%..\.tools\cloudflared.exe"
set "PATH=%NODEDIR%;%PATH%"
cd /d "%BASE%"

REM ============================================================
REM  Demo da far provare a qualcuno.
REM  Differenze da AVVIA-E-CONDIVIDI.cmd:
REM   - parte PIENA di prodotti finti (SEED_DEMO), sennò chi la apre
REM     trova un magazzino vuoto e non capisce cosa dovrebbe guardare;
REM   - usa un database separato, quindi i dati veri non si toccano;
REM   - chi la prova puo' rompere qualsiasi cosa senza conseguenze.
REM ============================================================

echo.
echo  ════════════════════════════════════════════════════════════
echo   BARBACK - demo da mostrare
echo  ════════════════════════════════════════════════════════════
echo.
echo   Dati finti, database separato: chi la prova puo' toccare tutto.
echo   I tuoi dati veri non vengono sfiorati.
echo.

set "DBDEMO=%TEMP%\barback-demo-mostra.db"
if exist "%DBDEMO%" del /q "%DBDEMO%" >nul 2>&1
if exist "%DBDEMO%-wal" del /q "%DBDEMO%-wal" >nul 2>&1
if exist "%DBDEMO%-shm" del /q "%DBDEMO%-shm" >nul 2>&1

echo  [1/2] Avvio l'app con i dati della demo...
set "SEED_DEMO=1"
set "DEMO_MODE=1"
set "PORT=3100"
set "DB_PATH=%DBDEMO%"
start "Barback Demo - server" /min cmd /c "set SEED_DEMO=1&& set DEMO_MODE=1&& set PORT=3100&& set DB_PATH=%DBDEMO%&& node --experimental-sqlite server.js"
REM il percorso completo: in certe shell "timeout" e' un altro comando
"%SystemRoot%System32	imeout.exe" /t 5 /nobreak >nul

echo  [2/2] Creo il link pubblico...
echo.
echo  ────────────────────────────────────────────────────────────
echo   Fra poco compare un riquadro con un indirizzo tipo:
echo.
echo       https://qualcosa-qualcosa.trycloudflare.com
echo.
echo   COPIA quell'indirizzo e mandalo. Il PIN e' 1111.
echo.
echo   NON CHIUDERE QUESTA FINESTRA: finche' resta aperta, il link
echo   funziona. Appena la chiudi, o appena spegni il PC, muore.
echo  ────────────────────────────────────────────────────────────
echo.

"%CF%" tunnel --no-autoupdate --url http://localhost:3100

echo.
echo  Link chiuso. Da adesso quell'indirizzo non risponde piu'.
echo.
pause
