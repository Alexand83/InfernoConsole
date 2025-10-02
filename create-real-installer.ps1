# Script PowerShell per creare installer e uninstaller veri
param(
    [string]$Version = "1.4.86"
)

Write-Host "========================================"
Write-Host "    CREAZIONE INSTALLER VERO"
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

Write-Host "[1/3] Creazione installer PowerShell..." -ForegroundColor Green

# Crea installer PowerShell
$installerScript = @"
# Inferno Console Self-Extracting Installer
param([string]$InstallDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Inferno Console'))

Write-Host "========================================"
Write-Host "   INFERNO CONSOLE - INSTALLER"
Write-Host "========================================"
Write-Host ""

# Crea directory di installazione
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Host "[INFO] Directory creata: $InstallDir"
} else {
    Write-Host "[INFO] Directory esistente: $InstallDir"
}

# Estrai i file dell'applicazione dalla directory win-unpacked
Write-Host "[INFO] Copiando file applicazione..."
$SourceDir = Join-Path $PSScriptRoot "win-unpacked"
if (Test-Path $SourceDir) {
    Copy-Item -Path "$SourceDir\*" -Destination $InstallDir -Recurse -Force
    Write-Host "[OK] File applicazione copiati"
} else {
    Write-Host "[ERRORE] Directory win-unpacked non trovata"
    exit 1
}

# Crea shortcut desktop
Write-Host "[INFO] Creazione shortcut desktop..."
$WshShell = New-Object -comObject WScript.Shell
$DesktopShortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Inferno Console.lnk'))
$DesktopShortcut.TargetPath = Join-Path $InstallDir "Inferno Console.exe"
$DesktopShortcut.WorkingDirectory = $InstallDir
$DesktopShortcut.Description = "Inferno Console - DJ Software"
$DesktopShortcut.Save()
Write-Host "[OK] Shortcut desktop creato"

# Crea shortcut Start Menu
Write-Host "[INFO] Creazione shortcut Start Menu..."
$StartMenuShortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('StartMenuPrograms'), 'Inferno Console.lnk'))
$StartMenuShortcut.TargetPath = Join-Path $InstallDir "Inferno Console.exe"
$StartMenuShortcut.WorkingDirectory = $InstallDir
$StartMenuShortcut.Description = "Inferno Console - DJ Software"
$StartMenuShortcut.Save()
Write-Host "[OK] Shortcut Start Menu creato"

Write-Host ""
Write-Host "[OK] Installazione completata!"
Write-Host ""

$launch = Read-Host "Vuoi avviare Inferno Console ora? (S/N)"
if ($launch -eq "S" -or $launch -eq "s") {
    Write-Host "[INFO] Avvio di Inferno Console..."
    Start-Process -FilePath (Join-Path $InstallDir "Inferno Console.exe")
} else {
    Write-Host "[INFO] Non avvio l'applicazione."
}

Write-Host ""
Write-Host "Premi INVIO per uscire..."
Read-Host | Out-Null
"@

$installerScript | Out-File -FilePath "Inferno-Console-Installer.ps1" -Encoding UTF8

Write-Host "[OK] Installer PowerShell creato: Inferno-Console-Installer.ps1" -ForegroundColor Green

Write-Host ""
Write-Host "[2/3] Creazione uninstaller PowerShell..." -ForegroundColor Green

# Crea uninstaller PowerShell
$uninstallerScript = @"
# Inferno Console Self-Extracting Uninstaller
param([string]$InstallDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Inferno Console'))

Write-Host "========================================"
Write-Host "   INFERNO CONSOLE - UNINSTALLER"
Write-Host "========================================"
Write-Host ""

Write-Host "[INFO] Tentativo di terminare il processo Inferno Console..."
$processes = Get-Process -Name "Inferno Console" -ErrorAction SilentlyContinue
if ($processes) {
    $processes | Stop-Process -Force
    Write-Host "[OK] Processo terminato"
} else {
    Write-Host "[INFO] Processo non in esecuzione o non trovato"
}

Write-Host "[INFO] Rimozione shortcut desktop..."
$desktopShortcut = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Inferno Console.lnk')
if (Test-Path $desktopShortcut) {
    Remove-Item $desktopShortcut -Force
    Write-Host "[OK] Shortcut desktop rimosso"
} else {
    Write-Host "[INFO] Shortcut desktop non trovato"
}

Write-Host "[INFO] Rimozione shortcut Start Menu..."
$startMenuShortcut = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('StartMenuPrograms'), 'Inferno Console.lnk')
if (Test-Path $startMenuShortcut) {
    Remove-Item $startMenuShortcut -Force
    Write-Host "[OK] Shortcut Start Menu rimosso"
} else {
    Write-Host "[INFO] Shortcut Start Menu non trovato"
}

Write-Host "[INFO] Rimozione directory di installazione: $InstallDir"
if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force
    Write-Host "[OK] Directory di installazione rimossa"
} else {
    Write-Host "[INFO] Directory di installazione non trovata"
}

Write-Host ""
Write-Host "[OK] Disinstallazione completata!"
Write-Host ""
Write-Host "Premi INVIO per uscire..."
Read-Host | Out-Null
"@

$uninstallerScript | Out-File -FilePath "Inferno-Console-Uninstaller.ps1" -Encoding UTF8

Write-Host "[OK] Uninstaller PowerShell creato: Inferno-Console-Uninstaller.ps1" -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Test dell'installer..." -ForegroundColor Green

Write-Host "[INFO] Esecuzione di Inferno-Console-Installer.ps1" -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy Bypass -File Inferno-Console-Installer.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    INSTALLER E UNINSTALLER CREATI!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "File creati:" -ForegroundColor White
Write-Host "- Inferno-Console-Installer.ps1 (INSTALLER)" -ForegroundColor Cyan
Write-Host "- Inferno-Console-Uninstaller.ps1 (UNINSTALLER)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vantaggi:" -ForegroundColor White
Write-Host "- Installer PowerShell completo" -ForegroundColor Green
Write-Host "- Uninstaller PowerShell completo" -ForegroundColor Green
Write-Host "- Nessuna dipendenza esterna" -ForegroundColor Green
Write-Host "- Compatibile con electron-updater" -ForegroundColor Green
Write-Host ""

Set-Location ".."
