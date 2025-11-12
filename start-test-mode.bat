@echo off
echo ========================================
echo   AVVIO APP IN MODALITA' TEST UPDATE
echo ========================================
echo.
echo Server mock: http://localhost:3456
echo.

REM Imposta variabile d'ambiente per modalità test
set UPDATE_TEST_MODE=local

REM Avvia Electron
echo Avvio Electron in modalità test...
echo.
npm run electron

pause

