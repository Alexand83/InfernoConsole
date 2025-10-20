const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const { AppDownloader } = require('./downloader');

const execAsync = promisify(exec);

class AppInstaller {
  constructor() {
    this.downloader = new AppDownloader();
  }

  async downloadApp(installPath) {
    console.log(chalk.blue('🌐 Avvio download dell\'applicazione...'));
    return await this.downloader.downloadApp(installPath);
  }

  async installApp(downloadedPath, installPath) {
    try {
      console.log(chalk.yellow('📦 Installazione dell\'applicazione...'));

      // Verifica che il file scaricato esista
      if (!await fs.pathExists(downloadedPath)) {
        throw new Error('File scaricato non trovato');
      }

      // Verifica integrità del file
      await this.downloader.verifyDownload(downloadedPath);

      // Crea la directory di installazione se non esiste
      await fs.ensureDir(installPath);

      // Copia il file principale
      const mainExePath = path.join(installPath, 'Inferno Console.exe');
      await fs.copy(downloadedPath, mainExePath);

      console.log(chalk.green(`✅ Applicazione installata: ${mainExePath}`));

      // Crea file di configurazione
      await this.createConfigFiles(installPath);

      // Crea file di versione
      await this.createVersionFile(installPath);

      return mainExePath;

    } catch (error) {
      throw new Error(`Errore durante l'installazione: ${error.message}`);
    }
  }

  async createConfigFiles(installPath) {
    try {
      // Crea file di configurazione dell'installer
      const configPath = path.join(installPath, 'installer-config.json');
      const config = {
        installedAt: new Date().toISOString(),
        version: '1.4.138',
        installerVersion: '1.0.0',
        installPath: installPath,
        shortcuts: {
          desktop: true,
          startMenu: true
        }
      };

      await fs.writeJson(configPath, config, { spaces: 2 });
      console.log(chalk.green('✅ File di configurazione creato'));

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Impossibile creare file di configurazione: ${error.message}`));
    }
  }

  async createVersionFile(installPath) {
    try {
      const versionPath = path.join(installPath, 'version.txt');
      const versionInfo = `Inferno Console v1.4.138
Installato il: ${new Date().toLocaleString('it-IT')}
Directory: ${installPath}
Installer: v1.0.0
`;

      await fs.writeFile(versionPath, versionInfo);
      console.log(chalk.green('✅ File di versione creato'));

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Impossibile creare file di versione: ${error.message}`));
    }
  }

  async createUninstaller(installPath) {
    try {
      console.log(chalk.yellow('🗑️  Creazione uninstaller...'));

      const uninstallerPath = path.join(installPath, 'uninstall.exe');
      const uninstallerScript = this.generateUninstallerScript(installPath);

      // Crea un file batch temporaneo
      const tempBatchPath = path.join(require('os').tmpdir(), `uninstall-${Date.now()}.bat`);
      await fs.writeFile(tempBatchPath, uninstallerScript);

      // Converte il batch in exe usando PowerShell
      const psScript = `
$batContent = Get-Content '${tempBatchPath}' -Raw
$exeBytes = [System.Text.Encoding]::UTF8.GetBytes($batContent)
$exePath = '${uninstallerPath}'
[System.IO.File]::WriteAllBytes($exePath, $exeBytes)
Remove-Item '${tempBatchPath}'
Write-Host "Uninstaller creato: $exePath"
`;

      await execAsync(`powershell -Command "${psScript}"`);
      await fs.remove(tempBatchPath);

      console.log(chalk.green(`✅ Uninstaller creato: ${uninstallerPath}`));

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Impossibile creare uninstaller: ${error.message}`));
    }
  }

  generateUninstallerScript(installPath) {
    return `@echo off
setlocal enabledelayedexpansion
echo ========================================
echo    INFERNO CONSOLE - UNINSTALLER
echo ========================================
echo.

echo [INFO] Rimozione di Inferno Console...
echo [INFO] Directory: ${installPath}
echo.

REM Chiedi conferma
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

REM Rimuovi dal registro di sistema
echo [INFO] Rimozione dal registro di sistema...
reg delete "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\InfernoConsole" /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Rimosso dal registro di sistema
) else (
    echo [AVVISO] Impossibile rimuovere dal registro (normale se non si hanno privilegi di amministratore)
)

REM Rimuovi directory di installazione
echo [INFO] Rimozione file dell'applicazione...
if exist "${installPath}" (
    rmdir /s /q "${installPath}"
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Directory di installazione rimossa
    ) else (
        echo [ERRORE] Impossibile rimuovere la directory. Alcuni file potrebbero essere in uso.
        echo [INFO] Prova a chiudere l'applicazione e riprova.
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
echo [INFO] Grazie per aver utilizzato Inferno Console!
echo.
pause
`;
  }

  async checkInstallation(installPath) {
    try {
      const mainExe = path.join(installPath, 'Inferno Console.exe');
      const configFile = path.join(installPath, 'installer-config.json');
      
      const exists = await fs.pathExists(mainExe);
      const hasConfig = await fs.pathExists(configFile);
      
      return {
        installed: exists && hasConfig,
        mainExe,
        configFile,
        version: exists ? '1.4.138' : null
      };
      
    } catch (error) {
      return {
        installed: false,
        error: error.message
      };
    }
  }

  async repairInstallation(installPath) {
    try {
      console.log(chalk.yellow('🔧 Riparazione installazione...'));
      
      // Verifica file principali
      const mainExe = path.join(installPath, 'Inferno Console.exe');
      if (!await fs.pathExists(mainExe)) {
        console.log(chalk.yellow('📥 File principale mancante, reinstallazione...'));
        await this.downloadApp(installPath);
        await this.installApp(mainExe, installPath);
      }

      // Ricrea file di configurazione
      await this.createConfigFiles(installPath);
      await this.createVersionFile(installPath);

      console.log(chalk.green('✅ Installazione riparata con successo!'));
      return true;

    } catch (error) {
      console.error(chalk.red(`❌ Errore durante la riparazione: ${error.message}`));
      return false;
    }
  }
}

// Funzioni di esportazione per compatibilità
async function downloadApp(installPath) {
  const installer = new AppInstaller();
  return await installer.downloadApp(installPath);
}

async function installApp(downloadedPath, installPath) {
  const installer = new AppInstaller();
  return await installer.installApp(downloadedPath, installPath);
}

async function createUninstaller(installPath) {
  const installer = new AppInstaller();
  return await installer.createUninstaller(installPath);
}

module.exports = {
  AppInstaller,
  downloadApp,
  installApp,
  createUninstaller
};
