@echo off
echo ========================================
echo    TEST GITHUB WORKFLOW LOCALE
echo ========================================
echo.

echo [1/4] Build applicazione...
npm run build
if %errorLevel% neq 0 (
    echo [ERROR] Build fallito!
    pause
    exit /b 1
)
echo [OK] Build completato

echo.
echo [2/4] Build Electron app...
npm run dist:win:portable
if %errorLevel% neq 0 (
    echo [ERROR] Build Electron fallito!
    pause
    exit /b 1
)
echo [OK] Build Electron completato

echo.
echo [3/4] Creazione installer self-extracting...
cd dist-electron

REM Crea installer self-extracting
echo @echo off > Inferno-Console-Installer.bat
echo setlocal enabledelayedexpansion >> Inferno-Console-Installer.bat
echo echo ======================================== >> Inferno-Console-Installer.bat
echo echo    INFERNO CONSOLE - INSTALLER >> Inferno-Console-Installer.bat
echo echo ======================================== >> Inferno-Console-Installer.bat
echo echo. >> Inferno-Console-Installer.bat
echo set "INSTALL_DIR=%%USERPROFILE%%\Desktop\Inferno Console" >> Inferno-Console-Installer.bat
echo if not exist "%%INSTALL_DIR%%" mkdir "%%INSTALL_DIR%%" >> Inferno-Console-Installer.bat
echo echo [INFO] Copiando file applicazione... >> Inferno-Console-Installer.bat
echo xcopy "win-unpacked\*" "%%INSTALL_DIR%%\" /E /I /Y /Q ^>nul >> Inferno-Console-Installer.bat
echo echo [INFO] Creazione shortcut desktop... >> Inferno-Console-Installer.bat
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%USERPROFILE%%\Desktop\Inferno Console.lnk'); $Shortcut.TargetPath = '%%INSTALL_DIR%%\Inferno Console.exe'; $Shortcut.WorkingDirectory = '%%INSTALL_DIR%%'; $Shortcut.Description = 'Inferno Console - DJ Software'; $Shortcut.Save()" ^>nul 2^>^&1 >> Inferno-Console-Installer.bat
echo echo [INFO] Creazione shortcut Start Menu... >> Inferno-Console-Installer.bat
echo powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Inferno Console.lnk'); $Shortcut.TargetPath = '%%INSTALL_DIR%%\Inferno Console.exe'; $Shortcut.WorkingDirectory = '%%INSTALL_DIR%%'; $Shortcut.Description = 'Inferno Console - DJ Software'; $Shortcut.Save()" ^>nul 2^>^&1 >> Inferno-Console-Installer.bat
echo echo [OK] Installazione completata! >> Inferno-Console-Installer.bat
echo echo Premi INVIO per avviare Inferno Console... >> Inferno-Console-Installer.bat
echo pause ^>nul >> Inferno-Console-Installer.bat
echo start "" "%%INSTALL_DIR%%\Inferno Console.exe" >> Inferno-Console-Installer.bat

REM Crea wrapper .exe
echo @echo off > Inferno-Console-Installer.exe
echo echo ======================================== >> Inferno-Console-Installer.exe
echo echo    INFERNO CONSOLE - INSTALLER >> Inferno-Console-Installer.exe
echo echo ======================================== >> Inferno-Console-Installer.exe
echo echo. >> Inferno-Console-Installer.exe
echo echo [INFO] Avvio installer... >> Inferno-Console-Installer.exe
echo call "%%~dp0Inferno-Console-Installer.bat" >> Inferno-Console-Installer.exe

echo [OK] Installer self-extracting creato: Inferno-Console-Installer.exe

echo.
echo [4/4] Test installer...
echo [INFO] Testando installer...
echo [INFO] Premi INVIO per testare l'installer...
pause >nul
.\Inferno-Console-Installer.exe

echo.
echo ========================================
echo    TEST COMPLETATO!
echo ========================================
echo.
echo File creati:
echo - Inferno-Console-Installer.exe (INSTALLER PRINCIPALE)
echo - Inferno-Console-Installer.bat (script installazione)
echo.
echo Questo è esattamente quello che farà GitHub Actions!
echo.
pause
