@echo off
chcp 65001 >nul
setlocal
title Barback - il PC dal telefono

echo.
echo  ════════════════════════════════════════════════════════════
echo   BARBACK - lavorare sul PC dal telefono
echo  ════════════════════════════════════════════════════════════
echo.
echo  Questo apre il tuo VS Code dentro il browser del telefono:
echo  file, terminale, tutto quello che hai sul computer.
echo.
echo  PRIMA DI CONTINUARE, SAPPI CHE:
echo.
echo   - Il PC deve restare ACCESO, SBLOCCATO e connesso a internet.
echo     Se va in sospensione, il collegamento cade.
echo.
echo   - Chi entra con il TUO account GitHub raggiunge questa macchina.
echo     Non e' pubblico, ma non e' nemmeno niente: non lasciarlo
echo     acceso quando non ti serve.
echo.
echo   - Per spegnerlo: chiudi questa finestra, oppure premi Ctrl+C.
echo.
echo  ════════════════════════════════════════════════════════════
echo.
set /p RISPOSTA="  Vuoi accenderlo adesso? (s/n): "
if /i not "%RISPOSTA%"=="s" (
  echo.
  echo  Annullato. Non e' stato acceso niente.
  echo.
  pause
  exit /b 0
)

set "CODE=%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
if not exist "%CODE%" (
  echo.
  echo  ERRORE: non trovo VS Code in
  echo    %CODE%
  echo.
  echo  Se l'hai installato altrove, apri questo file e correggi
  echo  la riga che comincia con  set "CODE="
  echo.
  pause
  exit /b 1
)

echo.
echo  ────────────────────────────────────────────────────────────
echo   LA PRIMA VOLTA ti chiede di collegare l'account GitHub:
echo   ti stampa un CODICE e l'indirizzo  github.com/login/device
echo   Apri quell'indirizzo, inserisci il codice, e basta.
echo   Le volte dopo parte da solo.
echo  ────────────────────────────────────────────────────────────
echo.
echo   Quando vedi "Open this link in your browser", dal telefono vai su:
echo.
echo       https://vscode.dev/tunnel/barback-pc
echo.
echo  ────────────────────────────────────────────────────────────
echo.

call "%CODE%" tunnel --accept-server-license-terms --name barback-pc

echo.
echo  Collegamento chiuso. Dal telefono non si arriva piu' al PC.
echo.
pause
