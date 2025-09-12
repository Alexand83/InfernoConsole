# Script PowerShell per build DJ Console su Windows
param(
    [switch]$Clean,
    [switch]$SkipTests,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    BUILD DJ CONSOLE PER WINDOWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Funzione per logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] $Message" -ForegroundColor $color
}

# Verifica prerequisiti
Write-Log "Verifica prerequisiti..." "INFO"

# Verifica Node.js
try {
    $nodeVersion = node --version
    Write-Log "Node.js trovato: $nodeVersion" "SUCCESS"
} catch {
    Write-Log "ERRORE: Node.js non è installato!" "ERROR"
    Write-Log "Installa Node.js da https://nodejs.org/" "ERROR"
    exit 1
}

# Verifica npm
try {
    $npmVersion = npm --version
    Write-Log "npm trovato: $npmVersion" "SUCCESS"
} catch {
    Write-Log "ERRORE: npm non è installato!" "ERROR"
    exit 1
}

# Verifica Electron
try {
    $electronVersion = npx electron --version
    Write-Log "Electron trovato: $electronVersion" "SUCCESS"
} catch {
    Write-Log "WARN: Electron non trovato, verrà installato automaticamente" "WARN"
}

# Pulizia se richiesto
if ($Clean) {
    Write-Log "Pulizia build precedenti..." "INFO"
    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
    if (Test-Path "dist-electron") { Remove-Item "dist-electron" -Recurse -Force }
    if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
}

# Installazione dipendenze
Write-Log "Installazione dipendenze..." "INFO"
try {
    npm install
    Write-Log "Dipendenze installate con successo" "SUCCESS"
} catch {
    Write-Log "ERRORE: Installazione dipendenze fallita!" "ERROR"
    exit 1
}

# Build React
Write-Log "Build applicazione React..." "INFO"
try {
    npm run build
    Write-Log "Build React completato" "SUCCESS"
} catch {
    Write-Log "ERRORE: Build React fallito!" "ERROR"
    exit 1
}

# Build Electron per Windows
Write-Log "Build applicazione Electron per Windows..." "INFO"
try {
    npm run dist:win
    Write-Log "Build Electron completato" "SUCCESS"
} catch {
    Write-Log "ERRORE: Build Electron fallito!" "ERROR"
    exit 1
}

# Verifica output
Write-Log "Verifica file generati..." "INFO"
if (Test-Path "dist-electron") {
    $files = Get-ChildItem "dist-electron" -File
    Write-Log "File generati:" "SUCCESS"
    foreach ($file in $files) {
        Write-Log "  - $($file.Name)" "INFO"
    }
} else {
    Write-Log "ERRORE: Cartella dist-electron non trovata!" "ERROR"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    BUILD COMPLETATO CON SUCCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Log "I file di output si trovano in: dist-electron/" "INFO"

# Apri cartella output
if (Test-Path "dist-electron") {
    Write-Log "Apertura cartella output..." "INFO"
    Start-Process "dist-electron"
}
