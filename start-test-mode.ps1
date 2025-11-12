# Script PowerShell per avviare l'app in modalità test update
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AVVIO APP IN MODALITA' TEST UPDATE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server mock: http://localhost:3456" -ForegroundColor Yellow
Write-Host ""

# Imposta variabile d'ambiente per modalità test
$env:UPDATE_TEST_MODE = "local"

# Avvia Electron
Write-Host "Avvio Electron in modalità test..." -ForegroundColor Green
Write-Host ""
npm run electron

