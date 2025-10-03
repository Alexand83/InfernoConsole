const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { createShortcut, removeShortcut } = require('./utils/shortcuts');
const { downloadApp, installApp, createUninstaller } = require('./utils/installer');

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
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'assets', 'icon.ico'),
      title: 'Inferno Console Installer',
      resizable: false,
      maximizable: false,
      show: false,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#1a1a1a'
    });

    this.mainWindow.loadFile(path.join(__dirname, 'gui', 'index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupIPC() {
    // Get install paths
    ipcMain.handle('get-install-paths', () => {
      return {
        desktop: path.join(os.homedir(), 'Desktop', 'Inferno Console'),
        programs: 'C:\\Program Files\\Inferno Console',
        documents: path.join(os.homedir(), 'Documents', 'Inferno Console')
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
        require('child_process').execSync('net session', { stdio: 'ignore' });
        return true;
      } catch (error) {
        return false;
      }
    });

    // Close app
    ipcMain.handle('close-app', () => {
      app.quit();
    });

    // Minimize app
    ipcMain.handle('minimize-app', () => {
      this.mainWindow.minimize();
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

      // 1. Create installation directory
      this.sendProgress('Creating installation directory...', 10);
      await fs.ensureDir(this.installPath);
      this.sendProgress('Directory created successfully!', 20);

      // 2. Download application
      this.sendProgress('Downloading application from GitHub...', 30);
      const downloadPath = await this.downloadAppWithProgress();
      this.sendProgress('Download completed!', 60);

      // 3. Install application
      this.sendProgress('Installing application...', 70);
      await installApp(downloadPath, this.installPath);
      this.sendProgress('Application installed!', 80);

      // 4. Create shortcuts
      this.sendProgress('Creating shortcuts...', 85);
      await createShortcut(this.installPath);
      this.sendProgress('Shortcuts created!', 90);

      // 5. Create uninstaller
      this.sendProgress('Creating uninstaller...', 95);
      await createUninstaller(this.installPath);
      this.sendProgress('Uninstaller created!', 100);

      this.sendProgress('Installation completed successfully!', 100, true);

      return { success: true, installPath: this.installPath };

    } catch (error) {
      this.sendProgress(`Error: ${error.message}`, 0, false, true);
      throw error;
    } finally {
      this.isInstalling = false;
    }
  }

  async downloadAppWithProgress() {
    const downloadUrl = 'https://github.com/Alexand83/InfernoConsole/releases/latest/download/Inferno-Console-win.exe';
    const outputPath = path.join(this.installPath, 'Inferno-Console-win.exe');
    
    return new Promise((resolve, reject) => {
      const https = require('https');
      const file = fs.createWriteStream(outputPath);
      
      const download = (url) => {
        const request = https.get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              this.sendProgress(`Redirecting to: ${redirectUrl}`, 35);
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
            const progress = Math.round(30 + (downloadedSize / totalSize) * 30); // 30-60%
            this.sendProgress(`Downloading... ${Math.round((downloadedSize / totalSize) * 100)}%`, progress);
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
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
