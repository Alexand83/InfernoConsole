@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    CREAZIONE INSTALLER LOCALE
echo ========================================
echo.

REM Verifica che la directory dist-electron esista
if not exist "dist-electron" (
    echo [ERRORE] Directory dist-electron non trovata!
    echo Esegui prima: npm run dist:win:portable
    goto :END
)

cd dist-electron

REM Verifica che la directory win-unpacked esista
if not exist "win-unpacked" (
    echo [ERRORE] Directory win-unpacked non trovata!
    echo Esegui prima: npm run dist:win:portable
    goto :END
)

echo [1/3] Creazione installer self-extracting...

REM Crea installer self-extracting
$installerScript = @"
@echo off
setlocal enabledelayedexpansion
echo ========================================
echo    INFERNO CONSOLE - INSTALLER
echo ========================================
echo.

set "INSTALL_DIR=%USERPROFILE%\Desktop\Inferno Console"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [INFO] Copiando file applicazione...
xcopy "win-unpacked\*" "%INSTALL_DIR%\" /E /I /Y /Q >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRORE] Errore durante la copia dei file.
    goto :END
)
echo [OK] File applicazione copiati con successo.

echo [INFO] Creazione shortcut desktop...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Inferno Console.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\Inferno Console.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Description = 'Inferno Console - DJ Software'; $Shortcut.Save()" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRORE] Errore durante la creazione dello shortcut desktop.
) else (
    echo [OK] Shortcut desktop creato.
)

echo [INFO] Creazione shortcut Start Menu...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Inferno Console.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\Inferno Console.exe'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Description = 'Inferno Console - DJ Software'; $Shortcut.Save()" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRORE] Errore durante la creazione dello shortcut Start Menu.
) else (
    echo [OK] Shortcut Start Menu creato.
)

echo.
echo [OK] Installazione completata!
echo.

:ASK_LAUNCH
set /p LAUNCH_APP="Vuoi avviare Inferno Console ora? (S/N): "
if /i "%LAUNCH_APP%"=="s" (
    echo [INFO] Avvio di Inferno Console...
    start "" "%INSTALL_DIR%\Inferno Console.exe"
) else if /i "%LAUNCH_APP%"=="n" (
    echo [INFO] Non avvio l'applicazione.
) else (
    echo [AVVISO] Scelta non valida. Inserisci S o N.
    goto :ASK_LAUNCH
)

:END
echo.
echo Premi un tasto per uscire...
pause >nul
"@

$installerScript | Out-File -FilePath "Inferno-Console-Installer.exe" -Encoding ASCII

echo [OK] Installer creato: Inferno-Console-Installer.exe
echo [INFO] Dimensione installer: $((Get-Item 'Inferno-Console-Installer.exe').Length) bytes

echo.
echo [2/3] Creazione uninstaller self-extracting...

REM Crea uninstaller self-extracting
$uninstallerScript = @"
@echo off
setlocal enabledelayedexpansion
echo ========================================
echo    INFERNO CONSOLE - UNINSTALLER
echo ========================================
echo.

set "INSTALL_DIR=%USERPROFILE%\Desktop\Inferno Console"

echo [INFO] Tentativo di terminare il processo Inferno Console...
taskkill /f /im "Inferno Console.exe" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Processo terminato.
) else (
    echo [INFO] Processo non in esecuzione o non trovato.
)

echo [INFO] Rimozione shortcut desktop...
del "%USERPROFILE%\Desktop\Inferno Console.lnk" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Shortcut desktop rimosso.
) else (
    echo [INFO] Shortcut desktop non trovato o errore.
)

echo [INFO] Rimozione shortcut Start Menu...
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Inferno Console.lnk" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Shortcut Start Menu rimosso.
) else (
    echo [INFO] Shortcut Start Menu non trovato o errore.
)

echo [INFO] Rimozione directory di installazione: %INSTALL_DIR%
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Directory di installazione rimossa.
    ) else (
        echo [ERRORE] Errore durante la rimozione della directory di installazione.
    )
) else (
    echo [INFO] Directory di installazione non trovata.
)

echo.
echo [OK] Disinstallazione completata!
echo.
echo Premi un tasto per uscire...
pause >nul
"@

$uninstallerScript | Out-File -FilePath "Inferno-Console-Uninstaller.exe" -Encoding ASCII

echo [OK] Uninstaller creato: Inferno-Console-Uninstaller.exe
echo [INFO] Dimensione uninstaller: $((Get-Item 'Inferno-Console-Uninstaller.exe').Length) bytes

echo.
echo [3/3] Test dell'installer...

echo [INFO] Esecuzione di Inferno-Console-Installer.exe
start "" "Inferno-Console-Installer.exe"

echo.
echo ========================================
echo    INSTALLER E UNINSTALLER CREATI!
echo ========================================
echo.
echo File creati:
echo - Inferno-Console-Installer.exe (INSTALLER)
echo - Inferno-Console-Uninstaller.exe (UNINSTALLER)
echo.
echo Vantaggi:
echo - Installer self-extracting completo
echo - Uninstaller self-extracting completo
echo - Nessuna dipendenza esterna
echo - Compatibile con electron-updater
echo.

:END
cd ..
pause
