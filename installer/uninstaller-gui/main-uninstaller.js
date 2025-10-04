const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class InfernoConsoleUninstallerGUI {
  constructor() {
    this.mainWindow = null;
    this.installPath = null;
    this.isUninstalling = false;
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

    // Close app
    ipcMain.handle('close-app', () => {
      app.quit();
    });
  }

  detectInstallation() {
    const possiblePaths = [
      path.join(os.homedir(), 'Desktop', 'Inferno Console'),
      'C:\\Program Files\\Inferno Console',
      path.join(os.homedir(), 'Documents', 'Inferno Console'),
      path.join(os.homedir(), 'AppData', 'Local', 'Inferno Console')
    ];

    for (const installPath of possiblePaths) {
      if (fs.existsSync(installPath)) {
        const exePath = path.join(installPath, 'Inferno-Console-win.exe');
        if (fs.existsSync(exePath)) {
          return {
            found: true,
            installPath: installPath,
            exePath: exePath,
            size: this.getDirectorySize(installPath)
          };
        }
      }
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
      this.sendProgress('Registro pulito!', 100);

      this.sendProgress('Disinstallazione completata con successo!', 100, true);

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
    return new Promise((resolve, reject) => {
      if (fs.existsSync(this.installPath)) {
        // Use PowerShell to force remove directory
        const psScript = `Remove-Item -Path "${this.installPath}" -Recurse -Force -ErrorAction SilentlyContinue`;
        exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
          if (error) {
            console.log('⚠️ Warning: Cannot remove directory:', error.message);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async removeInstallerMarker() {
    try {
      const markerPath = path.join(this.installPath, '..', 'installer-info.json');
      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath);
      }
    } catch (error) {
      console.log('⚠️ Warning: Cannot remove installer marker:', error.message);
    }
  }

  async cleanupRegistry() {
    try {
      // Remove any registry entries if they exist
      const regScript = `
        try {
          Remove-ItemProperty -Path "HKCU:\\Software\\Inferno Console" -Name "*" -ErrorAction SilentlyContinue
          Remove-Item -Path "HKCU:\\Software\\Inferno Console" -ErrorAction SilentlyContinue
        } catch {
          # Ignore errors
        }
      `;
      await execAsync(`powershell -Command "${regScript}"`);
    } catch (error) {
      console.log('⚠️ Warning: Cannot cleanup registry:', error.message);
    }
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
    uninstaller.init();
  }
});
