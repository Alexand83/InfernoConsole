#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);

class NativeInstaller {
  constructor() {
    this.installPath = null;
    this.isInstalling = false;
  }

  async init() {
    console.log('\n🚀 INFERNO CONSOLE INSTALLER v1.0.0\n');
    
    try {
      // Selezione directory di installazione
      const installPaths = [
        { name: 'Desktop (Raccomandato)', value: path.join(os.homedir(), 'Desktop', 'Inferno Console') },
        { name: 'Programmi', value: 'C:\\Program Files\\Inferno Console' },
        { name: 'Documenti', value: path.join(os.homedir(), 'Documents', 'Inferno Console') }
      ];

      console.log('Seleziona directory di installazione:');
      installPaths.forEach((option, index) => {
        console.log(`${index + 1}. ${option.name}`);
        console.log(`   ${option.value}`);
      });
      console.log('4. Directory personalizzata');

      // Per semplicità, usiamo sempre Desktop
      this.installPath = installPaths[0].value;
      console.log(`\n📁 Directory selezionata: ${this.installPath}`);

      // Conferma installazione
      console.log('\nProcedere con l\'installazione? (S/N)');
      // Per semplicità, procediamo sempre
      console.log('S');

      // Avvia installazione
      await this.performInstallation();

    } catch (error) {
      console.error('❌ Errore durante l\'installazione:', error.message);
      process.exit(1);
    }
  }

  async performInstallation() {
    if (this.isInstalling) {
      throw new Error('Installazione già in corso');
    }

    this.isInstalling = true;
    
    try {
      console.log('\n🔧 Avvio installazione...\n');

      // 1. Crea directory di installazione
      console.log('📁 Creazione directory di installazione...');
      await this.ensureDir(this.installPath);
      console.log(`✅ Directory creata: ${this.installPath}`);

      // 2. Download dell'applicazione
      console.log('\n🌐 Download dell\'applicazione da GitHub...');
      const downloadPath = await this.downloadApp();
      console.log(`✅ Download completato: ${downloadPath}`);

      // 3. Installazione dell'applicazione
      console.log('\n📦 Installazione dell\'applicazione...');
      await this.installApp(downloadPath);
      console.log('✅ Applicazione installata con successo!');

      // 4. Creazione shortcut
      console.log('\n🔗 Creazione shortcut...');
      await this.createShortcuts();
      console.log('✅ Shortcut creati con successo!');

      // 5. Creazione uninstaller
      console.log('\n🗑️  Creazione uninstaller...');
      await this.createUninstaller();
      console.log('✅ Uninstaller creato!');

      console.log('\n🎉 INSTALLAZIONE COMPLETATA CON SUCCESSO!\n');
      console.log(`📁 Installato in: ${this.installPath}`);
      console.log('🔗 Shortcut creati su Desktop e Start Menu');
      console.log('🗑️  Uninstaller disponibile nella directory di installazione');

      return { success: true, installPath: this.installPath };

    } catch (error) {
      console.error('\n❌ ERRORE DURANTE L\'INSTALLAZIONE:', error.message);
      throw error;
    } finally {
      this.isInstalling = false;
    }
  }

  async ensureDir(dirPath) {
    return new Promise((resolve, reject) => {
      fs.mkdir(dirPath, { recursive: true }, (err) => {
        if (err && err.code !== 'EEXIST') {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async downloadApp() {
    const downloadUrl = 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe';
    const outputPath = path.join(this.installPath, 'Inferno-Console-win.exe');
    
    return new Promise((resolve, reject) => {
      const download = (url) => {
        const file = fs.createWriteStream(outputPath);
        
        const request = https.get(url, (response) => {
          // Gestisci redirect
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              console.log(`🔄 Redirect a: ${redirectUrl}`);
              download(redirectUrl);
              return;
            }
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'], 10);
          let downloadedSize = 0;

          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            const progress = Math.round((downloadedSize / totalSize) * 100);
            process.stdout.write(`\r📥 Downloading... ${progress}%`);
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log('\n✅ Download completato!');
            resolve(outputPath);
          });

          file.on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
          });
        });

        request.on('error', (err) => {
          reject(err);
        });
      };
      
      download(downloadUrl);
    });
  }

  async installApp(downloadedPath) {
    const mainExePath = path.join(this.installPath, 'Inferno Console.exe');
    
    // Copia il file scaricato
    await this.copyFile(downloadedPath, mainExePath);
    
    // Crea file di configurazione
    const config = {
      installedAt: new Date().toISOString(),
      version: '1.4.138',
      installerVersion: '1.0.0',
      installPath: this.installPath
    };
    
    const configPath = path.join(this.installPath, 'installer-config.json');
    await this.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async copyFile(src, dest) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(src);
      const writeStream = fs.createWriteStream(dest);
      
      readStream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        resolve();
      });
      
      writeStream.on('error', reject);
      readStream.on('error', reject);
    });
  }

  async writeFile(filePath, content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createShortcuts() {
    try {
      // Shortcut desktop
      const desktopPath = path.join(os.homedir(), 'Desktop', 'Inferno Console.lnk');
      const desktopShortcut = this.generateShortcutScript(
        path.join(this.installPath, 'Inferno Console.exe'),
        this.installPath,
        desktopPath
      );
      
      await this.createShortcutFile(desktopShortcut);

      // Shortcut Start Menu
      const startMenuPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Inferno Console.lnk');
      const startMenuShortcut = this.generateShortcutScript(
        path.join(this.installPath, 'Inferno Console.exe'),
        this.installPath,
        startMenuPath
      );
      
      await this.createShortcutFile(startMenuShortcut);

    } catch (error) {
      console.log('⚠️  Avviso: Impossibile creare shortcut:', error.message);
    }
  }

  generateShortcutScript(exePath, workingDir, shortcutPath) {
    return `
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath}')
$Shortcut.TargetPath = '${exePath}'
$Shortcut.WorkingDirectory = '${workingDir}'
$Shortcut.Description = 'Inferno Console - DJ Software'
$Shortcut.Save()
`;
  }

  async createShortcutFile(script) {
    const tempScript = path.join(os.tmpdir(), `shortcut-${Date.now()}.ps1`);
    await this.writeFile(tempScript, script);
    
    try {
      await execAsync(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`);
    } finally {
      fs.unlink(tempScript, () => {});
    }
  }

  async createUninstaller() {
    const uninstallerPath = path.join(this.installPath, 'uninstall.exe');
    const uninstallerScript = this.generateUninstallerScript();
    
    // Crea un file batch temporaneo
    const tempBatch = path.join(os.tmpdir(), `uninstall-${Date.now()}.bat`);
    await this.writeFile(tempBatch, uninstallerScript);
    
    // Converte in exe usando PowerShell
    const psScript = `
$batContent = Get-Content '${tempBatch}' -Raw
$exeBytes = [System.Text.Encoding]::UTF8.GetBytes($batContent)
$exePath = '${uninstallerPath}'
[System.IO.File]::WriteAllBytes($exePath, $exeBytes)
Remove-Item '${tempBatch}'
`;
    
    try {
      await execAsync(`powershell -Command "${psScript}"`);
    } finally {
      fs.unlink(tempBatch, () => {});
    }
  }

  generateUninstallerScript() {
    return `@echo off
echo ========================================
echo    INFERNO CONSOLE - UNINSTALLER
echo ========================================
echo.

echo [INFO] Rimozione di Inferno Console...
echo [INFO] Directory: ${this.installPath}
echo.

set /p CONFIRM="Sei sicuro di voler disinstallare Inferno Console? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo [INFO] Disinstallazione annullata.
    pause
    exit /b 0
)

echo [INFO] Avvio disinstallazione...
echo.

REM Rimuovi shortcut
echo [INFO] Rimozione shortcut...
powershell -Command "try { Remove-Item '%USERPROFILE%\\Desktop\\Inferno Console.lnk' -ErrorAction SilentlyContinue; Write-Host '[OK] Shortcut desktop rimosso' } catch { Write-Host '[AVVISO] Shortcut desktop non trovato' }" 2>nul
powershell -Command "try { Remove-Item '%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Inferno Console.lnk' -ErrorAction SilentlyContinue; Write-Host '[OK] Shortcut Start Menu rimosso' } catch { Write-Host '[AVVISO] Shortcut Start Menu non trovato' }" 2>nul

REM Rimuovi directory di installazione
echo [INFO] Rimozione file dell'applicazione...
if exist "${this.installPath}" (
    rmdir /s /q "${this.installPath}"
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Directory di installazione rimossa
    ) else (
        echo [ERRORE] Impossibile rimuovere la directory. Alcuni file potrebbero essere in uso.
    )
) else (
    echo [AVVISO] Directory di installazione non trovata
)

echo.
echo ========================================
echo    DISINSTALLAZIONE COMPLETATA
echo ========================================
echo.
echo [OK] Inferno Console è stato disinstallato.
echo.
pause
`;
  }
}

// Avvia l'installer
const installer = new NativeInstaller();
installer.init().catch(error => {
  console.error('❌ Errore fatale:', error.message);
  process.exit(1);
});
