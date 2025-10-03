@echo off
title Inferno Console Installer
color 0A

echo.
echo  ========================================
echo     🔥 INFERNO CONSOLE INSTALLER 🔥
echo  ========================================
echo.
echo  [INFO] Starting beautiful GUI installer...
echo.

REM Check if we're in the right directory
if not exist "main-gui-simple.js" (
    echo  [ERROR] Installer files not found!
    echo  [INFO] Please run this from the installer directory
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo  [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed successfully!
    echo.
)

REM Launch the beautiful GUI installer
echo  [INFO] Launching beautiful GUI installer...
echo  [INFO] Please wait while the installer loads...
echo.

REM Launch Electron with the GUI
call npx electron main-gui-simple.js

echo.
echo  [INFO] Installer session completed
pause
