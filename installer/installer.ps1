# Inferno Console Installer
# PowerShell version for better compatibility

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    INFERNO CONSOLE - INSTALLER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[INFO] Starting Inferno Console Installer..." -ForegroundColor Yellow
Write-Host "[INFO] Checking requirements..." -ForegroundColor Yellow

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    Write-Host "[OK] Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "[INFO] Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "npm not found"
    }
    Write-Host "[OK] npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] npm is not available" -ForegroundColor Red
    Write-Host "[INFO] Please reinstall Node.js with npm" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if we're in the installer directory
if (-not (Test-Path "main-gui-simple.js")) {
    Write-Host "[ERROR] Installer files not found" -ForegroundColor Red
    Write-Host "[INFO] Please run this installer from the correct directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] Installer files found" -ForegroundColor Green

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "[OK] Dependencies already installed" -ForegroundColor Green
}

# Launch the installer
Write-Host "[INFO] Launching installer GUI..." -ForegroundColor Yellow
Write-Host ""

try {
    npx electron main-gui-simple.js
    if ($LASTEXITCODE -ne 0) {
        throw "Installer failed"
    }
    Write-Host "[OK] Installer completed successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Installer failed to start" -ForegroundColor Red
    Write-Host "[INFO] Please check the error messages above" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to exit"
