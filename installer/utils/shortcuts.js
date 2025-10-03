const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const os = require('os');

const execAsync = promisify(exec);

class ShortcutManager {
  constructor() {
    this.desktopPath = path.join(os.homedir(), 'Desktop');
    this.startMenuPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  }

  async createShortcut(installPath) {
    try {
      console.log(chalk.yellow('🔗 Creazione shortcut...'));

      const mainExe = path.join(installPath, 'Inferno Console.exe');
      
      if (!await fs.pathExists(mainExe)) {
        throw new Error('File eseguibile principale non trovato');
      }

      // Crea shortcut desktop
      await this.createDesktopShortcut(mainExe, installPath);
      
      // Crea shortcut Start Menu
      await this.createStartMenuShortcut(mainExe, installPath);

      console.log(chalk.green('✅ Shortcut creati con successo!'));

    } catch (error) {
      throw new Error(`Errore durante la creazione degli shortcut: ${error.message}`);
    }
  }

  async createDesktopShortcut(exePath, installPath) {
    try {
      const shortcutPath = path.join(this.desktopPath, 'Inferno Console.lnk');
      
      const psCommand = `
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath}')
$Shortcut.TargetPath = '${exePath}'
$Shortcut.WorkingDirectory = '${installPath}'
$Shortcut.Description = 'Inferno Console - DJ Software'
$Shortcut.IconLocation = '${exePath},0'
$Shortcut.Save()
Write-Host 'Shortcut desktop creato: ${shortcutPath}'
`;

      await execAsync(`powershell -Command "${psCommand}"`);
      console.log(chalk.green('✅ Shortcut desktop creato'));

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Impossibile creare shortcut desktop: ${error.message}`));
    }
  }

  async createStartMenuShortcut(exePath, installPath) {
    try {
      // Assicurati che la directory Start Menu esista
      await fs.ensureDir(this.startMenuPath);
      
      const shortcutPath = path.join(this.startMenuPath, 'Inferno Console.lnk');
      
      const psCommand = `
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath}')
$Shortcut.TargetPath = '${exePath}'
$Shortcut.WorkingDirectory = '${installPath}'
$Shortcut.Description = 'Inferno Console - DJ Software'
$Shortcut.IconLocation = '${exePath},0'
$Shortcut.Save()
Write-Host 'Shortcut Start Menu creato: ${shortcutPath}'
`;

      await execAsync(`powershell -Command "${psCommand}"`);
      console.log(chalk.green('✅ Shortcut Start Menu creato'));

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Impossibile creare shortcut Start Menu: ${error.message}`));
    }
  }

  async removeShortcut() {
    try {
      console.log(chalk.yellow('🗑️  Rimozione shortcut...'));

      // Rimuovi shortcut desktop
      await this.removeDesktopShortcut();
      
      // Rimuovi shortcut Start Menu
      await this.removeStartMenuShortcut();

      console.log(chalk.green('✅ Shortcut rimossi con successo!'));

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Errore durante la rimozione degli shortcut: ${error.message}`));
    }
  }

  async removeDesktopShortcut() {
    try {
      const shortcutPath = path.join(this.desktopPath, 'Inferno Console.lnk');
      
      if (await fs.pathExists(shortcutPath)) {
        await fs.remove(shortcutPath);
        console.log(chalk.green('✅ Shortcut desktop rimosso'));
      } else {
        console.log(chalk.blue('ℹ️  Shortcut desktop non trovato'));
      }

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Impossibile rimuovere shortcut desktop: ${error.message}`));
    }
  }

  async removeStartMenuShortcut() {
    try {
      const shortcutPath = path.join(this.startMenuPath, 'Inferno Console.lnk');
      
      if (await fs.pathExists(shortcutPath)) {
        await fs.remove(shortcutPath);
        console.log(chalk.green('✅ Shortcut Start Menu rimosso'));
      } else {
        console.log(chalk.blue('ℹ️  Shortcut Start Menu non trovato'));
      }

    } catch (error) {
      console.log(chalk.yellow(`⚠️  Avviso: Impossibile rimuovere shortcut Start Menu: ${error.message}`));
    }
  }

  async checkShortcuts(installPath) {
    try {
      const mainExe = path.join(installPath, 'Inferno Console.exe');
      const desktopShortcut = path.join(this.desktopPath, 'Inferno Console.lnk');
      const startMenuShortcut = path.join(this.startMenuPath, 'Inferno Console.lnk');

      const desktopExists = await fs.pathExists(desktopShortcut);
      const startMenuExists = await fs.pathExists(startMenuShortcut);

      return {
        desktop: {
          exists: desktopExists,
          path: desktopShortcut
        },
        startMenu: {
          exists: startMenuExists,
          path: startMenuShortcut
        },
        allExist: desktopExists && startMenuExists
      };

    } catch (error) {
      return {
        error: error.message,
        allExist: false
      };
    }
  }

  async repairShortcuts(installPath) {
    try {
      console.log(chalk.yellow('🔧 Riparazione shortcut...'));

      const mainExe = path.join(installPath, 'Inferno Console.exe');
      
      if (!await fs.pathExists(mainExe)) {
        throw new Error('File eseguibile principale non trovato');
      }

      // Rimuovi shortcut esistenti
      await this.removeShortcut();
      
      // Ricrea shortcut
      await this.createShortcut(installPath);

      console.log(chalk.green('✅ Shortcut riparati con successo!'));
      return true;

    } catch (error) {
      console.error(chalk.red(`❌ Errore durante la riparazione degli shortcut: ${error.message}`));
      return false;
    }
  }

  async createAdvancedShortcut(exePath, installPath, options = {}) {
    try {
      const {
        name = 'Inferno Console',
        description = 'Inferno Console - DJ Software',
        iconPath = exePath,
        args = '',
        workingDirectory = installPath
      } = options;

      const psCommand = `
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${options.shortcutPath}')
$Shortcut.TargetPath = '${exePath}'
$Shortcut.Arguments = '${args}'
$Shortcut.WorkingDirectory = '${workingDirectory}'
$Shortcut.Description = '${description}'
$Shortcut.IconLocation = '${iconPath},0'
$Shortcut.Save()
Write-Host 'Shortcut avanzato creato: ${options.shortcutPath}'
`;

      await execAsync(`powershell -Command "${psCommand}"`);
      console.log(chalk.green(`✅ Shortcut avanzato creato: ${options.shortcutPath}`));

    } catch (error) {
      throw new Error(`Errore durante la creazione dello shortcut avanzato: ${error.message}`);
    }
  }
}

// Funzioni di esportazione per compatibilità
async function createShortcut(installPath) {
  const manager = new ShortcutManager();
  return await manager.createShortcut(installPath);
}

async function removeShortcut() {
  const manager = new ShortcutManager();
  return await manager.removeShortcut();
}

module.exports = {
  ShortcutManager,
  createShortcut,
  removeShortcut
};
