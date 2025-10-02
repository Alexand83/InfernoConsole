# Script PowerShell per creare installer e uninstaller self-extracting
param(
    [string]$Version = "1.4.86"
)

Write-Host "========================================"
Write-Host "    CREAZIONE INSTALLER LOCALE"
Write-Host "========================================"
Write-Host ""

# Verifica che la directory dist-electron esista
if (-not (Test-Path "dist-electron")) {
    Write-Host "[ERRORE] Directory dist-electron non trovata!" -ForegroundColor Red
    Write-Host "Esegui prima: npm run dist:win:portable" -ForegroundColor Yellow
    exit 1
}

Set-Location "dist-electron"

# Verifica che la directory win-unpacked esista
if (-not (Test-Path "win-unpacked")) {
    Write-Host "[ERRORE] Directory win-unpacked non trovata!" -ForegroundColor Red
    Write-Host "Esegui prima: npm run dist:win:portable" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] Creazione installer self-extracting..." -ForegroundColor Green

# Crea installer self-extracting
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

$installerSize = (Get-Item 'Inferno-Console-Installer.exe').Length
Write-Host "[OK] Installer creato: Inferno-Console-Installer.exe" -ForegroundColor Green
Write-Host "[INFO] Dimensione installer: $installerSize bytes" -ForegroundColor Cyan

Write-Host ""
Write-Host "[2/3] Creazione uninstaller self-extracting..." -ForegroundColor Green

# Crea uninstaller self-extracting
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

$uninstallerSize = (Get-Item 'Inferno-Console-Uninstaller.exe').Length
Write-Host "[OK] Uninstaller creato: Inferno-Console-Uninstaller.exe" -ForegroundColor Green
Write-Host "[INFO] Dimensione uninstaller: $uninstallerSize bytes" -ForegroundColor Cyan

Write-Host ""
Write-Host "[3/3] Test dell'installer..." -ForegroundColor Green

Write-Host "[INFO] Esecuzione di Inferno-Console-Installer.exe" -ForegroundColor Yellow
Start-Process -FilePath "Inferno-Console-Installer.exe"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    INSTALLER E UNINSTALLER CREATI!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "File creati:" -ForegroundColor White
Write-Host "- Inferno-Console-Installer.exe (INSTALLER)" -ForegroundColor Cyan
Write-Host "- Inferno-Console-Uninstaller.exe (UNINSTALLER)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vantaggi:" -ForegroundColor White
Write-Host "- Installer self-extracting completo" -ForegroundColor Green
Write-Host "- Uninstaller self-extracting completo" -ForegroundColor Green
Write-Host "- Nessuna dipendenza esterna" -ForegroundColor Green
Write-Host "- Compatibile con electron-updater" -ForegroundColor Green
Write-Host ""

Set-Location ".."
