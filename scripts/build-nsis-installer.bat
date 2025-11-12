@echo off
echo ========================================
echo   INFERNO CONSOLE - NSIS INSTALLER
echo ========================================
echo.

REM Verifica Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRORE] Node.js non trovato!
    echo Installa Node.js da: https://nodejs.org/
    pause
    exit /b 1
)

REM Esegui lo script di build
node "%~dp0build-nsis-installer.js"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   BUILD COMPLETATO CON SUCCESSO!
    echo ========================================
    echo.
) else (
    echo.
    echo ========================================
    echo   BUILD FALLITO!
    echo ========================================
    echo.
)

pause

