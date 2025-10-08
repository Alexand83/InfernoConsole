const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const { execSync } = require('child_process');

const execAsync = promisify(exec);

class InfernoConsoleUninstallerGUI {
  constructor() {
    this.mainWindow = null;
    this.installPath = null;
    this.isUninstalling = false;
    this.deletedNow = [];
    this.scheduledAtReboot = [];
    this.allowClose = false;
  }

  // Schedula la cancellazione di file/cartelle al riavvio di Windows (MoveFileEx/MOVEFILE_DELAY_UNTIL_REBOOT)
  scheduleDeleteOnReboot(targetPath) {
    try {
      if (!targetPath) return;
      const p = targetPath.replace(/"/g, '""');
      const ps = `
        $sig = @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport(\"kernel32.dll\", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, int dwFlags);
}
"@;
        Add-Type -TypeDefinition $sig -PassThru | Out-Null;
        [NativeMethods]::MoveFileEx("${p}", $null, 0x4) | Out-Null;
      `;
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, { stdio: 'ignore' });
      this.sendProgress('⏳ Programmata la rimozione al riavvio: ' + targetPath, 98);
      this.scheduledAtReboot.push(targetPath);
    } catch (_) {
      // ignora errori: se fallisce, l'utente potrà rimuovere manualmente
    }
  }

  async init() {
    console.log('🗑️ Starting Inferno Console Uninstaller GUI...');
    
    await app.whenReady();
    
    this.createWindow();
    this.setupIPC();
    
    console.log('✅ Uninstaller GUI started!');
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 600,
      height: 500,
      minWidth: 500,
      minHeight: 400,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'assets', 'icon.ico'),
      title: 'Inferno Console Uninstaller',
      resizable: true,
      maximizable: false,
      show: false,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#1a1a1a',
      center: true,
      alwaysOnTop: false,
      autoHideMenuBar: true,
      menuBarVisible: false
    });

    this.mainWindow.loadFile(path.join(__dirname, 'index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      // Remove menu completely
      this.mainWindow.setMenuBarVisibility(false);
      this.mainWindow.setMenu(null);
      // Open DevTools for debugging
      // this.mainWindow.webContents.openDevTools();
    });

    // Impedisci la chiusura automatica finché non è consentita
    this.mainWindow.on('close', (e) => {
      if (!this.allowClose) {
        e.preventDefault();
        console.log('🚫 Chiusura bloccata - finestra deve rimanere aperta');
        try {
          this.sendProgress('ℹ️ La finestra resta aperta per permettere di copiare il log.', 100, true);
        } catch (_) {}
        return false;
      }
    });

    // Blocca anche beforeunload
    this.mainWindow.webContents.on('before-unload', (e) => {
      if (!this.allowClose) {
        e.preventDefault();
        console.log('🚫 beforeunload bloccato');
        return false;
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupIPC() {
    // Detect installation
    ipcMain.handle('detect-installation', () => {
      return this.detectInstallation();
    });

    // Start uninstallation
    ipcMain.handle('start-uninstallation', async (event, data) => {
      this.installPath = data.installPath;
      return await this.performUninstallation();
    });

    // Minimize app
    ipcMain.handle('minimize-app', () => {
      this.mainWindow.minimize();
    });

    // Close app - ora permette la chiusura solo quando allowClose è true
    ipcMain.handle('close-app', () => {
      if (this.allowClose) {
        console.log('✅ Chiusura consentita - chiudendo applicazione');
        this.mainWindow.close();
        app.quit();
      } else {
        console.log('🚫 Chiusura BLOCCATA - finestra deve rimanere aperta');
      }
    });

    // Consenti la chiusura quando l'utente ha finito
    ipcMain.handle('allow-close', () => {
      this.allowClose = true;
    });
  }

  detectInstallation() {
    // 0) Try to read install path from Windows Registry
    const regPath = this.readInstallPathFromRegistry();
    if (regPath && fs.existsSync(regPath)) {
      const exe1 = path.join(regPath, 'Inferno Console.exe');
      const exe2 = path.join(regPath, 'Inferno-Console-win.exe');
      // Se la cartella esiste la accettiamo comunque, anche se gli exe non ci sono
      return {
        found: true,
        installPath: regPath,
        exePath: fs.existsSync(exe1) ? exe1 : (fs.existsSync(exe2) ? exe2 : null),
        size: this.getDirectorySize(regPath)
      };
    }

    // 1) Use directory of the uninstaller itself
    const uninstallerPath = process.execPath;
    const installPath = path.dirname(uninstallerPath);
    if (fs.existsSync(installPath)) {
      const exePath1 = path.join(installPath, 'Inferno Console.exe');
      const exePath2 = path.join(installPath, 'Inferno-Console-win.exe');
      if (fs.existsSync(exePath1) || fs.existsSync(exePath2)) {
        return {
          found: true,
          installPath: installPath,
          exePath: fs.existsSync(exePath1) ? exePath1 : exePath2,
          size: this.getDirectorySize(installPath)
        };
      }
    }

    // 2) Niente ricerca profonda: manteniamo la logica semplice
    return { found: false };
  }

  readInstallPathFromRegistry() {
    // Primo tentativo: reg.exe (più affidabile su alcune macchine)
    try {
      const out = execSync('reg query HKCU\\Software\\InfernoConsole /v InstallPath', { encoding: 'utf8' });
      const m = out.match(/InstallPath\s+REG_SZ\s+(.*)/i);
      if (m && m[1]) {
        const val = m[1].trim();
        if (val) return val;
      }
    } catch (_) {}
    // Fallback: PowerShell
    try {
      const cmd = 'powershell -NoProfile -Command "(Get-ItemProperty -Path \"HKCU:\\Software\\InfernoConsole\").InstallPath"';
      const result = execSync(cmd, { encoding: 'utf8' });
      const value = (result || '').trim();
      if (value) return value;
    } catch (_) {}
    return null;
  }

  searchForInstallation() {
    try {
      // Search in common directories for Inferno Console
      const searchPaths = [
        os.homedir(),
        'C:\\',
        'D:\\',
        'E:\\'
      ];

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const result = this.searchDirectory(searchPath, 'Inferno Console');
          if (result.found) {
            return result;
          }
        }
      }
    } catch (error) {
      console.log('Error during search:', error.message);
    }

    return { found: false };
  }

  searchDirectory(dirPath, targetDir) {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Check if this is the target directory
          if (item === targetDir) {
            const exePath1 = path.join(fullPath, 'Inferno Console.exe');
            const exePath2 = path.join(fullPath, 'Inferno-Console-win.exe');
            
            if (fs.existsSync(exePath1)) {
              return {
                found: true,
                installPath: fullPath,
                exePath: exePath1,
                size: this.getDirectorySize(fullPath)
              };
            } else if (fs.existsSync(exePath2)) {
              return {
                found: true,
                installPath: fullPath,
                exePath: exePath2,
                size: this.getDirectorySize(fullPath)
              };
            }
          }
          
          // Recursively search subdirectories (but limit depth to avoid infinite loops)
          if (item !== 'node_modules' && item !== '.git' && item !== 'System Volume Information') {
            const result = this.searchDirectory(fullPath, targetDir);
            if (result.found) {
              return result;
            }
          }
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
    }

    return { found: false };
  }

  getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  async performUninstallation() {
    if (this.isUninstalling) {
      throw new Error('Uninstallation already in progress');
    }

    this.isUninstalling = true;
    
    try {
      this.sendProgress('Avvio disinstallazione...', 0);

      // 1. Remove shortcuts
      this.sendProgress('Rimozione shortcut...', 10);
      await this.removeShortcuts();
      this.sendProgress('Shortcut rimossi!', 20);

      // 2. Remove installation directory
      this.sendProgress('Rimozione file applicazione...', 30);
      await this.removeInstallationDirectory();
      this.sendProgress('File rimossi!', 80);

      // 3. Remove installer marker
      this.sendProgress('Pulizia marker installer...', 90);
      await this.removeInstallerMarker();
      this.sendProgress('Marker rimosso!', 95);

      // 4. Cleanup registry entries (if any)
      this.sendProgress('Pulizia registro...', 98);
      await this.cleanupRegistry();
      this.sendProgress('Registro pulito!', 99);

      // 5. Disinstallazione completata - finestra rimane aperta
      this.sendProgress('Disinstallazione completata con successo!', 100, true);
      this.sendProgress('ℹ️ La finestra rimane aperta - clicca "Fine" per chiudere', 100, true);

      return { 
        success: true, 
        message: 'Inferno Console è stato disinstallato completamente.'
      };

    } catch (error) {
      this.sendProgress(`Errore: ${error.message}`, 0, false, true);
      throw error;
    } finally {
      this.isUninstalling = false;
    }
  }

  async removeShortcuts() {
    try {
      // Desktop shortcut
      const desktopShortcut = path.join(os.homedir(), 'Desktop', 'Inferno Console.lnk');
      if (fs.existsSync(desktopShortcut)) {
        fs.unlinkSync(desktopShortcut);
      }

      // Start Menu shortcut
      const startMenuShortcut = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Inferno Console.lnk');
      if (fs.existsSync(startMenuShortcut)) {
        fs.unlinkSync(startMenuShortcut);
      }
    } catch (error) {
      console.log('⚠️ Warning: Cannot remove shortcuts:', error.message);
    }
  }

  async removeInstallationDirectory() {
    return new Promise((resolve) => {
      if (!fs.existsSync(this.installPath)) {
        this.sendProgress('ℹ️ Directory di installazione non trovata', 50);
        return resolve();
      }

      this.sendProgress('Terminazione processi in corso...', 40);
      this.killAllProcesses().then(() => {
        setTimeout(() => {
          try {
            // 1) Raccolta percorsi (file prima, poi directory) per eliminazione progressiva
            const { files, dirs } = this.collectPathsRecursively(this.installPath);
            const totalItems = Math.max(1, files.length + dirs.length);
            let processed = 0;

            // 2) Elimina file uno ad uno con avanzamento (escludi l'uninstaller in esecuzione)
            const runningExe = process.execPath;
            for (const filePath of files) {
              if (filePath === runningExe) { continue; }
              try {
                const rel = path.relative(this.installPath, filePath);
                this.sendProgress('Elimino file: ' + rel, Math.min(40 + Math.round((processed / totalItems) * 50), 90));
                fs.unlinkSync(filePath);
                this.deletedNow.push(filePath);
              } catch (errFile) {
                // Se in uso/bloccato → programma cancellazione al riavvio
                this.scheduleDeleteOnReboot(filePath);
              }
              processed++;
            }

            // 3) Elimina directory (dalla più profonda)
            for (const dirPath of dirs.reverse()) {
              try {
                const rel = path.relative(this.installPath, dirPath);
                this.sendProgress('Elimino cartella: ' + rel, Math.min(40 + Math.round((processed / totalItems) * 50), 95));
                fs.rmdirSync(dirPath, { recursive: false });
                this.deletedNow.push(dirPath);
              } catch (errDir) {
                // Se contiene residui bloccati → programma cancellazione al riavvio
                this.scheduleDeleteOnReboot(dirPath);
              }
              processed++;
            }

            // 4) Prova a rimuovere la root; se l'uninstaller risiede qui, non forzare ora
            try {
              // Se la root contiene ancora l'uninstaller, rimanda a removeUninstaller()
              if (runningExe.startsWith(this.installPath)) {
                this.sendProgress('⏳ Cartella trattenuta finché l\'uninstaller è in esecuzione', 96);
              } else {
                fs.rmdirSync(this.installPath, { recursive: false });
                this.sendProgress('✅ Cartella installazione rimossa', 96);
              }
            } catch (e) {
              const installPathEsc = this.installPath.replace(/"/g, '""');
              const psScript = `Remove-Item -Path "${installPathEsc}" -Recurse -Force -ErrorAction SilentlyContinue`;
              exec(`powershell -NoProfile -Command "${psScript}"`, () => {
                this.sendProgress('✅ Pulizia finale cartella con PowerShell', 97);
              });
              // E in ogni caso, programma la rimozione al riavvio
              this.scheduleDeleteOnReboot(this.installPath);
            }

            this.sendProgress('✅ File e cartelle rimossi', 98);
            const nowList = this.deletedNow.map(p => '• ' + path.basename(p)).slice(0, 30).join('\n');
            const laterList = this.scheduledAtReboot.map(p => '• ' + path.basename(p)).slice(0, 30).join('\n');
            const extraNow = this.deletedNow.length > 30 ? `\n… (+${this.deletedNow.length - 30} altri)` : '';
            const extraLater = this.scheduledAtReboot.length > 30 ? `\n… (+${this.scheduledAtReboot.length - 30} altri)` : '';
            if (this.deletedNow.length > 0) this.sendProgress(`📋 Cancellati ora (${this.deletedNow.length}):\n${nowList}${extraNow}`, 99);
            if (this.scheduledAtReboot.length > 0) this.sendProgress(`⏳ Programmati al riavvio (${this.scheduledAtReboot.length}):\n${laterList}${extraLater}`, 99);
          } catch (err) {
            this.sendProgress('⚠️ Errore durante la rimozione: ' + err.message, 60, false, true);
          } finally {
            resolve();
          }
        }, 1000);
      });
    });
  }

  // Raccoglie tutti i percorsi della cartella: ritorna liste separate di file e directory
  collectPathsRecursively(rootDir) {
    const files = [];
    const dirs = [];
    const stack = [rootDir];
    while (stack.length) {
      const current = stack.pop();
      try {
        const entries = fs.readdirSync(current);
        for (const entry of entries) {
          const fullPath = path.join(current, entry);
          try {
            const st = fs.lstatSync(fullPath);
            if (st.isDirectory()) {
              dirs.push(fullPath);
              stack.push(fullPath);
            } else {
              files.push(fullPath);
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
    return { files, dirs };
  }

  async killAllProcesses() {
    return new Promise((resolve) => {
      const killCommands = [
        'taskkill /f /im "Inferno Console.exe" 2>nul',
        'taskkill /f /im "Inferno-Console-win.exe" 2>nul',
        'taskkill /f /im "Inferno-Console-temp.exe" 2>nul',
        'taskkill /f /im "InfernoConsole.exe" 2>nul'
        // RIMOSSO: wmic che uccideva anche l'uninstaller!
      ];
      
      let completed = 0;
      killCommands.forEach((cmd) => {
        exec(cmd, (error) => {
          completed++;
          if (completed === killCommands.length) {
            resolve();
          }
        });
      });
    });
  }

  async removeInstallerMarker() {
    try {
      const markerPath = path.join(this.installPath, 'installer-info.json');
      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath);
      }
    } catch (error) {
      console.log('⚠️ Warning: Cannot remove installer marker:', error.message);
    }
  }

  async cleanupRegistry() {
    this.sendProgress('🔍 Ricerca chiavi di registro...', 98);
    // Step 1: try with reg.exe (most robust for HKCU)
    try {
      execSync('reg delete HKCU\\Software\\InfernoConsole /v InstallPath /f', { stdio: 'ignore' });
      execSync('reg delete HKCU\\Software\\InfernoConsole /f', { stdio: 'ignore' });
      this.sendProgress('✅ Chiavi di registro rimosse (reg.exe)', 99);
      return;
    } catch (_) { }

    // Step 2: fallback to PowerShell provider
    try {
      const regScript = `
        try {
          Remove-ItemProperty -Path "HKCU:\\Software\\InfernoConsole" -Name "InstallPath" -ErrorAction SilentlyContinue
          Remove-Item -Path "HKCU:\\Software\\InfernoConsole" -ErrorAction SilentlyContinue
        } catch { }
      `;
      await execAsync(`powershell -NoProfile -Command "${regScript}"`);
      this.sendProgress('✅ Chiavi di registro rimosse (PowerShell)', 99);
    } catch (error) {
      console.log('⚠️ Warning: Cannot cleanup registry:', error.message);
      this.sendProgress('⚠️ Impossibile rimuovere chiave Registro: ' + error.message, 99, false, true);
    }
  }

  async removeUninstaller() {
    // Non chiudere/auto-eliminare immediatamente: informiamo soltanto
    this.sendProgress('ℹ️ Puoi chiudere questa finestra quando hai copiato il log.', 100);
    return Promise.resolve();
  }

  sendProgress(message, percentage, completed = false, error = false) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('uninstall-progress', {
        message,
        percentage,
        completed,
        error
      });
    }
  }
}

// Create uninstaller instance
const uninstaller = new InfernoConsoleUninstallerGUI();

// Initialize when app is ready
app.whenReady().then(() => {
  uninstaller.init().catch(error => {
    console.error('❌ Fatal error:', error.message);
    // Non chiudere automaticamente in caso di errore - mostra l'errore all'utente
    console.log('⚠️ Errore fatale - finestra rimane aperta per debug');
  });
});

// Handle window closed - ora permette la chiusura quando allowClose è true
app.on('window-all-closed', (e) => {
  if (uninstaller.allowClose) {
    console.log('✅ window-all-closed - chiusura consentita');
    app.quit();
  } else {
    e.preventDefault();
    console.log('🚫 window-all-closed BLOCCATO - finestra deve rimanere aperta');
    return false;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    uninstaller.init();
  }
});

// Salvaguardie extra: impedisci quit accidentale finché allowClose non è true
app.on('before-quit', (e) => {
  if (!uninstaller.allowClose) {
    e.preventDefault();
    console.log('🚫 before-quit BLOCCATO - allowClose=false');
  }
});

app.on('will-quit', (e) => {
  if (!uninstaller.allowClose) {
    e.preventDefault();
    console.log('🚫 will-quit BLOCCATO - allowClose=false');
  }
});
