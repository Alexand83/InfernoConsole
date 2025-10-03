const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const installerDir = __dirname;
const outputDir = path.join(installerDir, '..', 'dist-electron');
const mainFile = 'main-gui-simple.js';
const outputExe = 'Inferno-Console-Installer.exe';

console.log('\n🔨 BUILDING CUSTOM INSTALLER FOR GITHUB RELEASE\n');

// 1. Clean previous builds
console.log('🧹 Cleaning previous builds...');
if (fs.existsSync(outputDir)) {
    fs.removeSync(outputDir);
}
fs.mkdirpSync(outputDir);
console.log('✅ Clean completed');

// 2. Build installer executable using pkg
console.log('🔨 Building installer executable...');
try {
    execSync(`pkg ${mainFile} --targets node18-win-x64 --output ${path.join(outputDir, outputExe)}`, {
        cwd: installerDir,
        stdio: 'inherit'
    });
    console.log('✅ Installer executable built');
} catch (error) {
    console.error('❌ Failed to build installer executable:', error.message);
    process.exit(1);
}

// 3. Copy GUI files to output directory
console.log('📁 Copying GUI files...');
try {
    fs.copySync(path.join(installerDir, 'gui'), path.join(outputDir, 'gui'));
    fs.copySync(path.join(installerDir, 'assets'), path.join(outputDir, 'assets'));
    console.log('✅ GUI files copied');
} catch (error) {
    console.error('❌ Failed to copy GUI files:', error.message);
    process.exit(1);
}

// 3.5. Copy portable executable if it exists
console.log('📁 Looking for portable executable...');
const portableExePath = path.join(installerDir, '..', 'dist-electron', 'Inferno-Console-win.exe');
if (fs.existsSync(portableExePath)) {
    try {
        fs.copySync(portableExePath, path.join(outputDir, 'Inferno-Console-win.exe'));
        console.log('✅ Portable executable copied');
    } catch (error) {
        console.error('❌ Failed to copy portable executable:', error.message);
    }
} else {
    console.log('⚠️  Portable executable not found, will be created by main build');
}

// 4. Create uninstaller
console.log('📦 Creating uninstaller...');
const uninstallerContent = `@echo off
echo ========================================
echo    INFERNO CONSOLE - UNINSTALLER
echo ========================================
echo.
echo [AVVISO] Questo rimuoverà Inferno Console dal sistema.
echo.

set "INSTALL_DIR=%USERPROFILE%\\Desktop\\Inferno Console"

:CONFIRM
set /p CONFIRM="Sei sicuro di voler disinstallare? (S/N): "
if /i "%CONFIRM%"=="s" (
    goto :UNINSTALL
) else if /i "%CONFIRM%"=="n" (
    echo [INFO] Disinstallazione annullata.
    goto :END
) else (
    echo [AVVISO] Scelta non valida. Inserisci S o N.
    goto :CONFIRM
)

:UNINSTALL
echo [INFO] Rimozione file applicazione...
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRORE] Impossibile rimuovere alcuni file. Prova a chiudere l'applicazione e riprova.
    ) else (
        echo [OK] File applicazione rimossi.
    )
) else (
    echo [INFO] Directory non trovata, probabilmente già rimossa.
)

echo [INFO] Rimozione shortcut desktop...
if exist "%USERPROFILE%\\Desktop\\Inferno Console.lnk" (
    del "%USERPROFILE%\\Desktop\\Inferno Console.lnk" 2>nul
    echo [OK] Shortcut desktop rimosso.
)

echo [INFO] Rimozione shortcut Start Menu...
if exist "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Inferno Console.lnk" (
    del "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Inferno Console.lnk" 2>nul
    echo [OK] Shortcut Start Menu rimosso.
)

echo.
echo ========================================
echo    DISINSTALLAZIONE COMPLETATA!
echo ========================================
echo.
echo [OK] Inferno Console è stato rimosso dal sistema.
echo.

:END
echo Premi un tasto per uscire...
pause >nul`;

fs.writeFileSync(path.join(outputDir, 'Inferno-Console-Uninstaller.exe'), uninstallerContent);
console.log('✅ Uninstaller created');

// 5. Create latest.yml for electron-updater
console.log('📦 Creating latest.yml...');
const installerExePath = path.join(outputDir, outputExe);
const portableExeInOutputPath = path.join(outputDir, 'Inferno-Console-win.exe');

let latestYml = `version: 1.4.100
files:
  - url: Inferno-Console-Installer.exe
    sha512: ${require('crypto').createHash('sha512').update(fs.readFileSync(installerExePath)).digest('hex')}
    size: ${fs.statSync(installerExePath).size}`;

// Add portable executable if it exists
if (fs.existsSync(portableExeInOutputPath)) {
    latestYml += `
  - url: Inferno-Console-win.exe
    sha512: ${require('crypto').createHash('sha512').update(fs.readFileSync(portableExeInOutputPath)).digest('hex')}
    size: ${fs.statSync(portableExeInOutputPath).size}`;
}

latestYml += `
path: Inferno-Console-Installer.exe
sha512: ${require('crypto').createHash('sha512').update(fs.readFileSync(installerExePath)).digest('hex')}
releaseDate: ${new Date().toISOString()}`;

fs.writeFileSync(path.join(outputDir, 'latest.yml'), latestYml);
console.log('✅ latest.yml created');

// 6. Create installer package
console.log('📦 Creating installer package...');
const installerPackage = {
    name: 'Inferno-Console-Installer',
    version: '1.4.100',
    description: 'Custom installer for Inferno Console',
    main: outputExe,
    files: [
        outputExe,
        'Inferno-Console-Uninstaller.exe',
        'latest.yml',
        'gui/**/*',
        'assets/**/*'
    ]
};

fs.writeFileSync(
    path.join(outputDir, 'package.json'),
    JSON.stringify(installerPackage, null, 2)
);

console.log('✅ Installer package created');

// 5. Create README for installer
const readmeContent = `# Inferno Console Installer

## Installazione

1. Scarica \`${outputExe}\`
2. Esegui l'installer
3. Segui le istruzioni a schermo

## Caratteristiche

- 🎨 Interfaccia moderna in stile NSIS
- 📁 Selezione directory personalizzabile
- 📊 Progress bar in tempo reale
- 🔗 Creazione automatica shortcut
- 🗑️ Uninstaller incluso

## Requisiti

- Windows 10/11 (64-bit)
- 4 GB RAM (8 GB consigliati)
- 100 MB spazio libero
- Connessione internet per download

## Supporto

Per problemi o domande, visita: https://github.com/Alexand83/InfernoConsole
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), readmeContent);

console.log('✅ README created');

console.log('\n🎉 INSTALLER BUILD COMPLETED!\n');
console.log(`📁 Output: ${outputDir}`);
console.log(`📦 Installer: ${path.join(outputDir, outputExe)}`);
console.log(`📊 Installer size: ${(fs.statSync(path.join(outputDir, outputExe)).size / (1024 * 1024)).toFixed(2)} MB`);

// 6. Create GitHub release info
const releaseInfo = {
    tag_name: 'v1.4.99',
    name: 'Inferno Console v1.4.99 - Custom Installer',
    body: `## 🎉 Inferno Console v1.4.98 - Custom Installer

### ✨ Nuove Caratteristiche
- 🎨 **Installer personalizzato** con interfaccia moderna
- 📁 **Selezione directory** personalizzabile
- 📊 **Progress bar** in tempo reale
- 🔗 **Shortcut automatici** desktop e Start Menu
- 🗑️ **Uninstaller** incluso

### 📦 Installazione
1. Scarica \`Inferno-Console-Installer.exe\`
2. Esegui l'installer
3. Segui le istruzioni a schermo

### 🔧 Requisiti
- Windows 10/11 (64-bit)
- 4 GB RAM (8 GB consigliati)
- 100 MB spazio libero
- Connessione internet

### 🚀 Download
- **Installer Personalizzato**: \`Inferno-Console-Installer.exe\`
- **App Portabile**: \`Inferno-Console-win.exe\` (per utenti avanzati)

### 📝 Note
- L'installer scarica automaticamente l'applicazione da GitHub
- Dimensioni installer: ~5MB (efficiente e veloce)
- Installazione completa: ~120MB`,
    draft: false,
    prerelease: false
};

fs.writeFileSync(
    path.join(outputDir, 'release-info.json'),
    JSON.stringify(releaseInfo, null, 2)
);

console.log('✅ Release info created');
console.log('\n🚀 Ready for GitHub Release!');
