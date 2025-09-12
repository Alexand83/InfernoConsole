@echo off
echo ========================================
echo    BUILD DJ CONSOLE PER WINDOWS
echo ========================================
echo.

REM Verifica se Node.js è installato
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERRORE: Node.js non è installato!
    echo Installa Node.js da https://nodejs.org/
    pause
    exit /b 1
)

REM Verifica se npm è installato
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERRORE: npm non è installato!
    pause
    exit /b 1
)

echo Verifica delle dipendenze...
call npm install

echo.
echo Pulizia delle build precedenti...
if exist dist rmdir /s /q dist
if exist dist-electron rmdir /s /q dist-electron

echo.
echo Build dell'applicazione React...
call npm run build

if %errorlevel% neq 0 (
    echo ERRORE: Build React fallito!
    pause
    exit /b 1
)

echo.
echo Build dell'applicazione Electron per Windows...
call npm run dist:win

if %errorlevel% neq 0 (
    echo ERRORE: Build Electron fallito!
    pause
    exit /b 1
)

echo.
echo ========================================
echo    BUILD COMPLETATO CON SUCCESSO!
echo ========================================
echo.
echo I file di output si trovano in:
echo - dist-electron/
echo.
echo File generati:
dir /b dist-electron\*.exe
dir /b dist-electron\*.msi
echo.
echo Premi un tasto per aprire la cartella...
pause >nul
start dist-electron
