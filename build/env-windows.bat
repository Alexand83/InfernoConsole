@echo off
REM Impostazione variabili d'ambiente per build Windows
echo Impostazione variabili d'ambiente per build Windows...

REM Imposta variabili per Node.js
set NODE_ENV=production
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1

REM Imposta variabili per electron-builder
set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

REM Imposta variabili per il build
set BUILD_TARGET=win
set BUILD_ARCH=x64
set BUILD_TYPE=nsis

REM Mostra variabili impostate
echo.
echo Variabili d'ambiente impostate:
echo NODE_ENV=%NODE_ENV%
echo ELECTRON_ENABLE_LOGGING=%ELECTRON_ENABLE_LOGGING%
echo BUILD_TARGET=%BUILD_TARGET%
echo BUILD_ARCH=%BUILD_ARCH%
echo BUILD_TYPE=%BUILD_TYPE%
echo.

REM Avvia il build
echo Avvio build per Windows...
call npm run build:win

echo.
echo Build completato!
pause
