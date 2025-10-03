@echo off
title 🔥 Inferno Console Installer 🔥
color 0A
mode con cols=80 lines=25

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                    🔥 INFERNO CONSOLE 🔥                     ║
echo  ║                   INSTALLER PERSONALIZZATO                   ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.
echo  [INFO] Avvio installer con interfaccia grafica moderna...
echo  [INFO] Controllo dipendenze...
echo.

REM Check if we're in the installer directory
if not exist "main-gui-simple.js" (
    echo  [ERROR] File installer non trovato!
    echo  [INFO] Esegui questo file dalla directory installer
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo  [INFO] Installazione dipendenze...
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Errore installazione dipendenze
        pause
        exit /b 1
    )
    echo  [OK] Dipendenze installate!
    echo.
)

REM Launch the GUI installer
echo  [INFO] Avvio interfaccia grafica...
echo  [INFO] Aspetta mentre l'installer si carica...
echo.

REM Try to launch Electron
call npx electron main-gui-simple.js

if errorlevel 1 (
    echo.
    echo  [ERROR] Errore avvio GUI!
    echo  [INFO] Tentativo con metodo alternativo...
    echo.
    
    REM Try alternative method
    call node -e "require('child_process').spawn('npx', ['electron', 'main-gui-simple.js'], {stdio: 'inherit', shell: true})"
)

echo.
echo  [INFO] Installer completato
pause
