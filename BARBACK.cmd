@echo off
REM ============================================================
REM  Barback - avvio con un clic.
REM  Accende il server se e' spento, poi apre l'app in una
REM  finestra sua, senza la barra del browser.
REM  Usa il Node portatile in ..\.tools: niente installazioni.
REM ============================================================
title Barback
setlocal
set "BASE=%~dp0"
set "NODEDIR=%BASE%..\.tools\node-v24.16.0-win-x64"
set "PATH=%NODEDIR%;%PATH%"
cd /d "%BASE%"

REM il server e' gia' acceso?
netstat -ano | findstr ":3100" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto pronto

echo Avvio Barback, un attimo...
start "Barback Server" /min cmd /c "node --experimental-sqlite server.js"

REM aspetto che risponda, massimo 20 secondi
for /l %%i in (1,1,20) do (
  timeout /t 1 /nobreak >nul
  netstat -ano | findstr ":3100" | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 goto pronto
)
echo.
echo Il server non si e' avviato. Prova ad aprire AVVIA.cmd per vedere l'errore.
pause
exit /b 1

:pronto
REM apro in modalita' app: finestra pulita, solo Barback
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app=http://localhost:3100/
) else (
  REM niente Chrome: apro col browser di sistema
  start "" http://localhost:3100/
)
exit
