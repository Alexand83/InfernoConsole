const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class InfernoConsoleInstallerGUI {
  constructor() {
    this.mainWindow = null;
    this.installPath = null;
    this.isInstalling = false;
  }

  async init() {
    console.log('🚀 Starting Inferno Console Installer GUI...');
    
    await app.whenReady();
    
    this.createWindow();
    this.setupIPC();
    
    console.log('✅ Installer GUI started!');
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      minWidth: 900,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'assets', 'icon.ico'),
      title: 'Inferno Console Installer',
      resizable: true,
      maximizable: true,
      show: false,
      frame: true,
      titleBarStyle: 'default',
      backgroundColor: '#1a1a1a',
      center: true,
      alwaysOnTop: false,
      autoHideMenuBar: false,
      menuBarVisible: true
    });

    this.mainWindow.loadFile(path.join(__dirname, 'gui', 'index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      // Build a simple menu with DevTools toggle
      const template = [
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { type: 'separator' },
            { label: 'Toggle Developer Tools', role: 'toggleDevTools', accelerator: 'F12' }
          ]
        }
      ];
      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupIPC() {
    // Get install paths
    ipcMain.handle('get-install-paths', () => {
      return {
        documents: path.join(os.homedir(), 'Documents', 'Inferno Console'),
        desktop: path.join(os.homedir(), 'Desktop', 'Inferno Console'),
        localappdata: path.join(os.homedir(), 'AppData', 'Local', 'Inferno Console'),
        programs: 'C:\\Program Files\\Inferno Console'
      };
    });

    // Start installation
    ipcMain.handle('start-installation', async (event, data) => {
      this.installPath = data.installPath;
      return await this.performInstallation();
    });

    // Check admin privileges
    ipcMain.handle('check-admin', () => {
      try {
        execSync('net session', { stdio: 'ignore' });
        return true;
      } catch (error) {
        return false;
      }
    });

    // Select install path
    ipcMain.handle('select-install-path', async () => {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Seleziona Directory di Installazione',
        defaultPath: app.getPath('desktop')
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    });

    // Open path
    ipcMain.handle('open-path', async (event, targetPath) => {
      const { shell } = require('electron');
      try {
        // Check if file exists before trying to open
        if (fs.existsSync(targetPath)) {
          await shell.openPath(targetPath);
          return { success: true };
        } else {
          console.error('File not found:', targetPath);
          return { success: false, message: `File not found: ${targetPath}` };
        }
      } catch (error) {
        console.error('Failed to open path:', error);
        return { success: false, message: error.message };
      }
    });

    // Minimize app
    ipcMain.handle('minimize-app', () => {
      this.mainWindow.minimize();
    });

    // Close app
    ipcMain.handle('close-app', () => {
      app.quit();
    });
  }

  async performInstallation() {
    if (this.isInstalling) {
      throw new Error('Installation already in progress');
    }

    this.isInstalling = true;
    
    try {
      // Send progress to GUI
      this.sendProgress('Installing...', 0);

      // 0. Verify target path is writable
      this.sendProgress('Verifica permessi cartella...', 5);
      await this.verifyWritable(this.installPath);

      // 1. Create installation directory
      this.sendProgress('Creazione directory di installazione...', 10);
      await this.ensureDir(this.installPath);
      this.sendProgress('Directory creata con successo!', 20);

      // 2. Download application
      this.sendProgress('Preparazione download...', 30);
      const downloadPath = await this.downloadAppWithProgress();
      this.sendProgress('Download completato!', 60);

      // 3. Install application
      this.sendProgress('Installazione applicazione...', 70);
      await this.installApp(downloadPath);
      this.sendProgress('Applicazione installata!', 80);

      // 4. Create shortcuts
      this.sendProgress('Creazione shortcut...', 85);
      await this.createShortcuts();
      this.sendProgress('Shortcut creati!', 90);

      // 5. Create uninstaller
      this.sendProgress('Creazione uninstaller...', 95);
      await this.createUninstaller();
      this.sendProgress('Uninstaller creato!', 98);

      // 6. Create installer marker
      this.sendProgress('Creazione marker installer...', 99);
      await this.createInstallerMarker();
      this.sendProgress('Marker creato!', 100);

      this.sendProgress('Installazione completata con successo!', 100, true);

      return { 
        success: true, 
        installPath: this.installPath,
        executablePath: path.join(this.installPath, 'Inferno Console.exe')
      };

    } catch (error) {
      this.sendProgress(`Error: ${error.message}`, 0, false, true);
      throw error;
    } finally {
      this.isInstalling = false;
    }
  }

  async verifyWritable(targetDir) {
    return new Promise((resolve, reject) => {
      try {
        // Check if path requires admin privileges
        const requiresAdmin = targetDir.includes('Program Files') || 
                             targetDir.includes('Program Files (x86)') ||
                             targetDir.includes('C:\\Windows\\') ||
                             targetDir.includes('C:\\ProgramData\\');

        if (requiresAdmin) {
          // Try to write a test file to check if we have admin privileges
          const probeDir = fs.existsSync(targetDir) ? targetDir : path.dirname(targetDir);
          const testFile = path.join(probeDir, `.write-test-${Date.now()}.tmp`);
          
          fs.writeFile(testFile, 'test', (err) => {
            if (err) {
              reject(new Error('REQUIRES_ADMIN: La cartella selezionata richiede privilegi di amministratore. Esegui l\'installer come amministratore oppure scegli una cartella diversa (Documenti, Desktop, AppData).'));
            } else {
              fs.unlink(testFile, () => resolve());
            }
          });
        } else {
          // For non-admin paths, just try to write
          const probeDir = fs.existsSync(targetDir) ? targetDir : path.dirname(targetDir);
          const testFile = path.join(probeDir, `.write-test-${Date.now()}.tmp`);
          
          fs.writeFile(testFile, 'test', (err) => {
            if (err) {
              reject(new Error('Permessi insufficienti sulla cartella scelta. Seleziona una cartella diversa.'));
            } else {
              fs.unlink(testFile, () => resolve());
            }
          });
        }
      } catch (e) {
        reject(new Error('Impossibile verificare i permessi sulla cartella selezionata'));
      }
    });
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

  async downloadAppWithProgress() {
    const outputPath = path.join(this.installPath, 'Inferno-Console-win.exe');

    const getJson = (url) => new Promise((resolve, reject) => {
      console.log('[DL][API] GET', url);
      this.sendProgress(`[DL][API] Connessione a GitHub API...`, 30);
      const req = https.request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'inferno-console-installer',
          'Accept': 'application/vnd.github+json'
        }
      }, (res) => {
        console.log('[DL][API] Status:', res.statusCode, 'CT:', res.headers['content-type']);
        this.sendProgress(`[DL][API] Status: ${res.statusCode}, Content-Type: ${res.headers['content-type']}`, 30);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              const msg = `GitHub API HTTP ${res.statusCode}: ${res.statusMessage}`;
              this.sendProgress(msg, 30, false, true);
              reject(new Error(msg));
            }
          } catch (e) { 
            this.sendProgress('Errore parsing risposta API GitHub', 30, false, true);
            reject(e); 
          }
        });
      });
      req.on('error', (err) => { 
        console.error('[DL][API] Error:', err.message); 
        this.sendProgress(`Errore API GitHub: ${err.message}`, 30, false, true);
        reject(err); 
      });
      req.end();
    });

    const resolveAssetUrl = async () => {
      // Try latest release first
      const apiUrl = 'https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest';
      const release = await getJson(apiUrl);
      if (release && Array.isArray(release.assets)) {
        const asset = release.assets.find(a => a && a.name && a.name.toLowerCase().includes('inferno-console-win.exe'));
        if (asset && asset.browser_download_url) {
          console.log('[DL] Resolved asset URL:', asset.browser_download_url);
          this.sendProgress(`[DL] URL release risolta: ${asset.browser_download_url}`, 31);
          return asset.browser_download_url;
        }
      }
      console.warn('[DL] Asset non trovato via API, uso fallback latest/download');
      this.sendProgress('[DL] Asset non trovato via API, uso URL fallback', 31);
      // Fallback to old static pattern
      return 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe';
    };

    const download = (url) => new Promise((resolve, reject) => {
      console.log('[DL] Download URL:', url);
      this.sendProgress(`[DL] Download URL: ${url}`, 32);
      const file = fs.createWriteStream(outputPath);
      const request = https.get(url, { headers: { 'User-Agent': 'inferno-console-installer', 'Accept': 'application/octet-stream' } }, (response) => {
        console.log('[DL] Status:', response.statusCode, 'CT:', response.headers['content-type'], 'CL:', response.headers['content-length']);
        this.sendProgress(`[DL] Status: ${response.statusCode}, Content-Type: ${response.headers['content-type']}, Content-Length: ${response.headers['content-length']}`, 33);
        // Handle redirects (301, 302, 307, 308)
        if ([301,302,307,308].includes(response.statusCode)) {
          const redirectUrl = response.headers.location;
          console.log('[DL] Redirect ->', redirectUrl);
          this.sendProgress(`[DL] Redirecting to: ${redirectUrl}`, 34);
          if (redirectUrl) {
            this.sendProgress('Redirect download...', 35);
            response.destroy();
            resolve(download(redirectUrl));
            return;
          } else {
            this.sendProgress('Redirect senza location', 35, false, true);
            reject(new Error('Redirect senza location'));
            return;
          }
        }

        // Reject HTML responses (likely error page)
        const contentType = (response.headers['content-type'] || '').toLowerCase();
        if (contentType.includes('text/html')) {
          console.error('[DL] Unexpected HTML response');
          this.sendProgress('[DL] Risposta HTML inattesa dal server (asset non trovato?)', 40, false, true);
          reject(new Error('Risposta non valida (HTML) dal server.')); 
          return;
        }

        if (response.statusCode !== 200) {
          console.error('[DL] HTTP error:', response.statusCode, response.statusMessage);
          this.sendProgress(`[DL] HTTP error: ${response.statusCode} ${response.statusMessage}`, 40, false, true);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const percent = Math.round((downloadedSize / totalSize) * 100);
            const progress = Math.round(30 + (downloadedSize / totalSize) * 30); // 30-60%
            if (percent % 5 === 0) console.log('[DL] Progress:', percent + '%');
            this.sendProgress(`Scaricamento in corso... ${percent}%`, progress);
          } else {
            this.sendProgress('Scaricamento in corso...', 45);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          try {
            const stats = fs.statSync(outputPath);
            console.log('[DL] File size:', stats.size);
            this.sendProgress(`[DL] File scaricato: ${stats.size} bytes`, 55);
            if (!stats || stats.size < 1024 * 1024) {
              // <1MB consider as failed/incomplete
              this.sendProgress('[DL] File scaricato troppo piccolo (<1MB)', 55, false, true);
              fs.unlinkSync(outputPath);
              return reject(new Error('Download incompleto o file troppo piccolo'));
            }
            this.sendProgress('[DL] Download completato con successo!', 60);
          } catch (e) {
            this.sendProgress('[DL] Impossibile validare il file scaricato', 55, false, true);
            return reject(new Error('Impossibile validare il file scaricato'));
          }
          resolve(outputPath);
        });

        file.on('error', (err) => {
          console.error('[DL] File stream error:', err.message);
          this.sendProgress(`[DL] Errore scrittura file: ${err.message}`, 50, false, true);
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      });
      request.on('error', (err) => { 
        console.error('[DL] Request error:', err.message); 
        this.sendProgress(`[DL] Errore richiesta download: ${err.message}`, 35, false, true);
        reject(err); 
      });
    });

    try {
      const assetUrl = await resolveAssetUrl();
      this.sendProgress('[DL] Connessione a GitHub Releases...', 32);
      return await download(assetUrl);
    } catch (e) {
      console.warn('[DL] Primary URL failed:', e.message);
      this.sendProgress(`[DL] Errore URL principale: ${e.message}`, 33, false, true);
      // Last-resort fallback
      const fallback = 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe';
      this.sendProgress('[DL] Tentativo con URL fallback...', 33);
      return await download(fallback);
    }
  }

  async installApp(downloadedPath) {
    const mainExePath = path.join(this.installPath, 'Inferno Console.exe');
    
    // Copy the downloaded file
    await this.copyFile(downloadedPath, mainExePath);
    
    // Create config file
    const config = {
      installedAt: new Date().toISOString(),
      version: '1.4.118',
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
      // Desktop shortcut
      const desktopPath = path.join(os.homedir(), 'Desktop', 'Inferno Console.lnk');
      const desktopShortcut = this.generateShortcutScript(
        path.join(this.installPath, 'Inferno Console.exe'),
        this.installPath,
        desktopPath
      );
      
      await this.createShortcutFile(desktopShortcut);

      // Start Menu shortcut
      const startMenuPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Inferno Console.lnk');
      const startMenuShortcut = this.generateShortcutScript(
        path.join(this.installPath, 'Inferno Console.exe'),
        this.installPath,
        startMenuPath
      );
      
      await this.createShortcutFile(startMenuShortcut);

    } catch (error) {
      console.log('⚠️  Warning: Cannot create shortcuts:', error.message);
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
    
    // Create a temporary batch file
    const tempBatch = path.join(os.tmpdir(), `uninstall-${Date.now()}.bat`);
    await this.writeFile(tempBatch, uninstallerScript);
    
    // Convert to exe using PowerShell
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

  sendProgress(message, percentage, completed = false, error = false) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('installation-progress', {
        message,
        percentage,
        completed,
        error
      });
    }
  }

  // ✅ NUOVO: Crea marker per installer personalizzato
  async createInstallerMarker() {
    try {
      const markerPath = path.join(this.installPath, '..', 'installer-info.json');
      const markerData = {
        installer: 'custom-gui',
        version: '1.4.118',
        installDate: new Date().toISOString(),
        installPath: this.installPath,
        features: [
          'gui-installer',
          'custom-path-selection',
          'progress-tracking',
          'shortcut-creation',
          'uninstaller'
        ]
      };
      
      fs.writeFileSync(markerPath, JSON.stringify(markerData, null, 2));
      console.log('✅ Installer marker created:', markerPath);
    } catch (error) {
      console.error('❌ Failed to create installer marker:', error);
    }
  }
}

// Create installer instance
const installer = new InfernoConsoleInstallerGUI();

// Initialize when app is ready
app.whenReady().then(() => {
  installer.init().catch(error => {
    console.error('❌ Fatal error:', error.message);
    app.quit();
  });
});

// Handle window closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    installer.init();
  }
});

