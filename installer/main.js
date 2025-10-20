#!/usr/bin/env node

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { createShortcut, removeShortcut } = require('./utils/shortcuts');
const { downloadApp, installApp, createUninstaller } = require('./utils/installer');
const { resolveVersion } = require('./utils/version');

class InfernoConsoleInstaller {
  constructor() {
    this.mainWindow = null;
    this.installPath = null;
    this.isInstalling = false;
  }

  async init() {
    console.log(chalk.blue.bold('\n🚀 INFERNO CONSOLE INSTALLER v1.0.0\n'));
    
    // Controlla se siamo in modalità GUI o CLI
    const args = process.argv.slice(2);
    const guiMode = args.includes('--gui') || args.includes('-g');
    
    if (guiMode) {
      await this.initGUI();
    } else {
      await this.initCLI();
    }
  }

  async initGUI() {
    console.log(chalk.yellow('🖥️  Avvio interfaccia grafica...'));
    
    await app.whenReady();
    
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, 'assets', 'icon.ico'),
      title: 'Inferno Console Installer',
      resizable: false,
      maximizable: false
    });

    await this.mainWindow.loadFile(path.join(__dirname, 'gui', 'index.html'));
    
    // Setup IPC handlers
    this.setupIPC();
    
    console.log(chalk.green('✅ Interfaccia grafica avviata!'));
  }

  async initCLI() {
    console.log(chalk.yellow('💻 Modalità interfaccia a riga di comando\n'));
    
    try {
      // Selezione directory di installazione
      const { installPath } = await inquirer.prompt([
        {
          type: 'list',
          name: 'installPath',
          message: 'Seleziona directory di installazione:',
          choices: [
            { name: 'Desktop (Raccomandato)', value: path.join(require('os').homedir(), 'Desktop', 'Inferno Console') },
            { name: 'Programmi', value: 'C:\\Program Files\\Inferno Console' },
            { name: 'Documenti', value: path.join(require('os').homedir(), 'Documents', 'Inferno Console') },
            { name: 'Directory personalizzata', value: 'custom' }
          ]
        }
      ]);

      if (installPath === 'custom') {
        const { customPath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customPath',
            message: 'Inserisci il percorso completo:',
            validate: (input) => {
              if (!input.trim()) return 'Percorso non valido';
              return true;
            }
          }
        ]);
        this.installPath = customPath;
      } else {
        this.installPath = installPath;
      }

      console.log(chalk.blue(`📁 Directory selezionata: ${this.installPath}`));

      // Conferma installazione
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Procedere con l\'installazione?',
          default: true
        }
      ]);

      if (!confirm) {
        console.log(chalk.red('❌ Installazione annullata.'));
        process.exit(0);
      }

      // Avvia installazione
      await this.performInstallation();

    } catch (error) {
      console.error(chalk.red('❌ Errore durante l\'installazione:'), error.message);
      process.exit(1);
    }
  }

  setupIPC() {
    ipcMain.handle('get-install-paths', () => {
      const os = require('os');
      return {
        desktop: path.join(os.homedir(), 'Desktop', 'Inferno Console'),
        programs: 'C:\\Program Files\\Inferno Console',
        documents: path.join(os.homedir(), 'Documents', 'Inferno Console')
      };
    });

    ipcMain.handle('start-installation', async (event, data) => {
      this.installPath = data.installPath;
      return await this.performInstallation();
    });

    ipcMain.handle('check-admin', () => {
      return require('child_process').execSync('net session', { stdio: 'ignore' }).length > 0;
    });
  }

  async performInstallation() {
    if (this.isInstalling) {
      throw new Error('Installazione già in corso');
    }

    this.isInstalling = true;
    
    try {
      console.log(chalk.blue('\n🔧 Avvio installazione...\n'));

      // 1. Crea directory di installazione
      console.log(chalk.yellow('📁 Creazione directory di installazione...'));
      await fs.ensureDir(this.installPath);
      console.log(chalk.green(`✅ Directory creata: ${this.installPath}`));

      // 2. Download dell'applicazione
      console.log(chalk.yellow('\n🌐 Download dell\'applicazione da GitHub...'));
      const downloadPath = await downloadApp(this.installPath);
      console.log(chalk.green(`✅ Download completato: ${downloadPath}`));

      // 3. Installazione dell'applicazione
      console.log(chalk.yellow('\n📦 Installazione dell\'applicazione...'));
      await installApp(downloadPath, this.installPath);
      console.log(chalk.green('✅ Applicazione installata con successo!'));

      // 4. Creazione shortcut
      console.log(chalk.yellow('\n🔗 Creazione shortcut...'));
      await createShortcut(this.installPath);
      console.log(chalk.green('✅ Shortcut creati con successo!'));

      // 5. Creazione uninstaller
      console.log(chalk.yellow('\n🗑️  Creazione uninstaller...'));
      await createUninstaller(this.installPath);
      console.log(chalk.green('✅ Uninstaller creato!'));

      // 6. Registrazione nel registro di sistema
      console.log(chalk.yellow('\n📝 Registrazione nel sistema...'));
      await this.registerApp();
      console.log(chalk.green('✅ App registrata nel sistema!'));

      console.log(chalk.green.bold('\n🎉 INSTALLAZIONE COMPLETATA CON SUCCESSO!\n'));
      console.log(chalk.blue(`📁 Installato in: ${this.installPath}`));
      console.log(chalk.blue('🔗 Shortcut creati su Desktop e Start Menu'));
      console.log(chalk.blue('🗑️  Uninstaller disponibile nella directory di installazione'));

      // Invio notifica alla GUI se disponibile
      if (this.mainWindow) {
        this.mainWindow.webContents.send('installation-complete', {
          installPath: this.installPath,
          success: true
        });
      }

      return { success: true, installPath: this.installPath };

    } catch (error) {
      console.error(chalk.red('\n❌ ERRORE DURANTE L\'INSTALLAZIONE:'), error.message);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('installation-error', {
          error: error.message
        });
      }
      
      throw error;
    } finally {
      this.isInstalling = false;
    }
  }

  async registerApp() {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      // Registra l'app nel registro di Windows
      const regPath = `HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\InfernoConsole`;
      const uninstallerPath = path.join(this.installPath, 'uninstall.exe');
      
      const regCommands = [
        `reg add "${regPath}" /v "DisplayName" /t REG_SZ /d "Inferno Console" /f`,
        `reg add "${regPath}" /v "DisplayVersion" /t REG_SZ /d "${resolveVersion()}" /f`,
        `reg add "${regPath}" /v "Publisher" /t REG_SZ /d "Inferno Console Team" /f`,
        `reg add "${regPath}" /v "InstallLocation" /t REG_SZ /d "${this.installPath}" /f`,
        `reg add "${regPath}" /v "UninstallString" /t REG_SZ /d "${uninstallerPath}" /f`,
        `reg add "${regPath}" /v "DisplayIcon" /t REG_SZ /d "${path.join(this.installPath, 'Inferno Console.exe')}" /f`
      ];

      for (const cmd of regCommands) {
        try {
          await execAsync(cmd);
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Avviso: ${cmd} fallito (normale se non si hanno privilegi di amministratore)`));
        }
      }

    } catch (error) {
      console.log(chalk.yellow('⚠️  Avviso: Registrazione nel sistema fallita (normale se non si hanno privilegi di amministratore)'));
    }
  }
}

// Avvia l'installer
const installer = new InfernoConsoleInstaller();
installer.init().catch(error => {
  console.error(chalk.red('❌ Errore fatale:'), error.message);
  process.exit(1);
});

// Gestione chiusura app
if (app) {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
