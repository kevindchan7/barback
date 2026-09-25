@echo off
title Barback - Avvia e Condividi
setlocal
set "BASE=%~dp0"
set "NODEDIR=%BASE%..\.tools\node-v24.16.0-win-x64"
set "CF=%BASE%..\.tools\cloudflared.exe"
set "PATH=%NODEDIR%;%PATH%"
cd /d "%BASE%"

echo ============================================================
echo    BARBACK - avvio + creazione link da mandare all'amico
echo ============================================================
echo.
echo [1/2] Avvio il server dell'app...
start "Barback Server" /min cmd /c "node --experimental-sqlite server.js"
timeout /t 4 /nobreak >nul

echo [2/2] Creo il link pubblico.
echo.
echo    --^> Tra poco comparira' un RIQUADRO con un indirizzo tipo:
echo        https://qualcosa.trycloudflare.com
echo        COPIA quell'indirizzo e mandalo al tuo amico.
echo.
echo    NON chiudere questa finestra: finche' resta aperta, il link funziona.
echo ============================================================
echo.
"%CF%" tunnel --no-autoupdate --url http://localhost:3100

echo.
echo Il link e' stato chiuso. Premi un tasto per uscire.
pause >nul
