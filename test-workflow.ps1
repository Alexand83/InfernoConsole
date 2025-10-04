# Test Workflow Script
# Simula il processo completo di build e release

Write-Host "🔨 TESTING COMPLETE WORKFLOW" -ForegroundColor Green
Write-Host ""

# Step 1: Build main app
Write-Host "1️⃣ Building main Electron app..." -ForegroundColor Yellow
npm run dist:win:portable
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Main app build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Main app built successfully" -ForegroundColor Green

# Step 2: Build installer
Write-Host "2️⃣ Building custom installer..." -ForegroundColor Yellow
cd installer
npm install
node build-installer.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Installer build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Installer built successfully" -ForegroundColor Green

# Step 3: Build uninstaller
Write-Host "3️⃣ Building uninstaller..." -ForegroundColor Yellow
node build-uninstaller.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Uninstaller build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Uninstaller built successfully" -ForegroundColor Green

cd ..

# Step 4: Verify all files
Write-Host "4️⃣ Verifying all release files..." -ForegroundColor Yellow
$requiredFiles = @(
    "dist-electron\Inferno-Console-Installer.exe",
    "dist-electron\Inferno-Console-Uninstaller.exe", 
    "dist-electron\Inferno-Console-win.exe",
    "dist-electron\latest.yml"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "✅ $file - $([math]::Round($size/1MB, 2)) MB" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - MISSING" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host "❌ Some files are missing!" -ForegroundColor Red
    exit 1
}

# Step 5: Test installer
Write-Host "5️⃣ Testing installer..." -ForegroundColor Yellow
Write-Host "Launching installer for testing..."
Start-Process -FilePath "dist-electron\Inferno-Console-Installer.exe" -Wait

Write-Host ""
Write-Host "🎉 WORKFLOW TEST COMPLETED!" -ForegroundColor Green
Write-Host "All files built successfully and ready for GitHub release!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Files ready for release:" -ForegroundColor Cyan
Get-ChildItem "dist-electron" -Filter "*.exe" | ForEach-Object {
    $size = [math]::Round($_.Length/1MB, 2)
    Write-Host "  - $($_.Name) ($size MB)" -ForegroundColor White
}
Write-Host "  - latest.yml" -ForegroundColor White
