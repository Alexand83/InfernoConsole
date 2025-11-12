# Upload Release to GitHub
$ErrorActionPreference = "Stop"

$REPO_OWNER = "Alexand83"
$REPO_NAME = "InfernoConsole"
$VERSION = "1.4.151"
$TAG = "v$VERSION"
$INSTALLER_PATH = "dist\Inferno-Console-Setup.exe"

Write-Host "🚀 Upload Release $TAG su GitHub..." -ForegroundColor Cyan
Write-Host ""

# Verifica token
$GITHUB_TOKEN = $env:GITHUB_TOKEN
if (-not $GITHUB_TOKEN) {
    $GITHUB_TOKEN = $env:GH_TOKEN
}

if (-not $GITHUB_TOKEN) {
    Write-Host "❌ GITHUB_TOKEN non trovato!" -ForegroundColor Red
    Write-Host "   Esegui: " -NoNewline
    Write-Host '$env:GITHUB_TOKEN = "your_token_here"' -ForegroundColor Yellow
    exit 1
}

# Verifica file
if (-not (Test-Path $INSTALLER_PATH)) {
    Write-Host "❌ File non trovato: $INSTALLER_PATH" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $INSTALLER_PATH).Length / 1MB
Write-Host "📦 File: $INSTALLER_PATH" -ForegroundColor Green
Write-Host "   Dimensione: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Step 1: Crea release
Write-Host "📝 Step 1: Creazione release..." -ForegroundColor Yellow

$releaseBody = @"
## 🎉 Novità v$VERSION

### ✨ Caratteristiche Principali
- ✅ **Installer NSIS** integrato con auto-updater
- ✅ **Aggiornamenti automatici** nella stessa directory
- ✅ **Installazione silenziosa** (modalità ``/S``)
- ✅ **Chiusura automatica** dell'app prima dell'update
- ✅ **Shortcuts preservati** (Desktop + Start Menu)

### 🔧 Miglioramenti Tecnici
- Ottimizzazione memoria durante import massivi (cleanup ogni 50 file)
- Fix durata brani in File Manager (analisi audio robusta)
- Fix connessione DJ Remoto (ngrok WebSocket)
- DevTools shortcuts (F12, Ctrl+Shift+I)

### 📦 Installazione
Scarica ``Inferno-Console-Setup.exe`` per l'installazione completa con auto-updater.

### 🔄 Aggiornamento
Se hai già installato una versione precedente, l'app rileverà automaticamente questo aggiornamento e lo installerà nella stessa directory.

---

**Dimensione**: ~127 MB (compresso LZMA)  
**Compatibilità**: Windows 7+  
**Tipo**: Installer NSIS con auto-updater
"@

$releaseData = @{
    tag_name = $TAG
    name = "$TAG - Auto-Update NSIS Integration"
    body = $releaseBody
    draft = $false
    prerelease = $false
} | ConvertTo-Json

$headers = @{
    "Authorization" = "token $GITHUB_TOKEN"
    "Accept" = "application/vnd.github+json"
    "User-Agent" = "inferno-console-release"
}

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases" `
        -Method Post `
        -Headers $headers `
        -Body $releaseData `
        -ContentType "application/json"
    
    Write-Host "✅ Release creata!" -ForegroundColor Green
    Write-Host "   URL: $($release.html_url)" -ForegroundColor Gray
    Write-Host "   ID: $($release.id)" -ForegroundColor Gray
    Write-Host ""
    
    # Step 2: Upload asset
    Write-Host "📤 Step 2: Upload Inferno-Console-Setup.exe..." -ForegroundColor Yellow
    
    $uploadUrl = $release.upload_url -replace '\{\?.*\}', "?name=Inferno-Console-Setup.exe"
    
    $uploadHeaders = @{
        "Authorization" = "token $GITHUB_TOKEN"
        "Accept" = "application/vnd.github+json"
        "Content-Type" = "application/octet-stream"
        "User-Agent" = "inferno-console-release"
    }
    
    $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $INSTALLER_PATH))
    
    Write-Host "   Uploading $([math]::Round($fileBytes.Length / 1MB, 2)) MB..." -ForegroundColor Gray
    
    $asset = Invoke-RestMethod -Uri $uploadUrl `
        -Method Post `
        -Headers $uploadHeaders `
        -Body $fileBytes
    
    Write-Host "✅ Upload completato!" -ForegroundColor Green
    Write-Host "   Asset URL: $($asset.browser_download_url)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "🎉 Release pubblicata con successo!" -ForegroundColor Green
    Write-Host "🔗 $($release.html_url)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🧪 Ora puoi testare l'auto-updater nell'app v1.4.150" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Errore: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception -ForegroundColor Red
    exit 1
}

