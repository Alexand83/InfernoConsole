const { autoUpdater } = require('electron-updater')
const { dialog, app } = require('electron')
const path = require('path')

class AppUpdater {
  constructor() {
    // ✅ FIX: Configurazione corretta per auto-updater
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
    } else {
      // Produzione: usa app-update.yml
      autoUpdater.updateConfigPath = path.join(__dirname, 'app-update.yml')
    }
    
    // ✅ NUOVO: Configurazione path di download personalizzato
    const os = require('os')
    const packageJson = require('../package.json')
    
    // Leggi i path personalizzati dal package.json
    let customUpdateDir = packageJson.updater?.downloadPath || '%USERPROFILE%\\Desktop\\Inferno Console\\Updates'
    let customInstallDir = packageJson.updater?.installPath || '%USERPROFILE%\\Desktop\\Inferno Console'
    
    // Espandi le variabili d'ambiente (es. %USERPROFILE%)
    customUpdateDir = customUpdateDir.replace(/%([^%]+)%/g, (match, envVar) => {
      return process.env[envVar] || match
    })
    customInstallDir = customInstallDir.replace(/%([^%]+)%/g, (match, envVar) => {
      return process.env[envVar] || match
    })
    
    // Fallback sicuro se i path non sono validi
    if (!customUpdateDir || customUpdateDir.includes('%')) {
      customUpdateDir = path.join(os.homedir(), 'Desktop', 'Inferno Console', 'Updates')
    }
    if (!customInstallDir || customInstallDir.includes('%')) {
      customInstallDir = path.join(os.homedir(), 'Desktop', 'Inferno Console')
    }
    
    // Salva i path per uso futuro
    this.customInstallDir = customInstallDir
    
    // Crea la directory se non esiste
    const fs = require('fs')
    if (!fs.existsSync(customUpdateDir)) {
      try {
        fs.mkdirSync(customUpdateDir, { recursive: true })
        console.log('📁 Directory aggiornamenti creata:', customUpdateDir)
      } catch (error) {
        console.error('❌ Errore creazione directory aggiornamenti:', error)
        // Fallback al path di default
        console.log('🔄 Usando path di default per aggiornamenti')
      }
    }
    
    // Imposta il path personalizzato
    autoUpdater.downloadPath = customUpdateDir
    console.log('📁 Path download aggiornamenti:', customUpdateDir)
    
    // ✅ NUOVO: Configurazione per delta updates
    autoUpdater.allowDowngrade = false
    autoUpdater.allowPrerelease = false
    autoUpdater.autoDownload = false // Controllo manuale del download
    autoUpdater.autoInstallOnAppQuit = true
    
    // ✅ NUOVO: Configurazione per auto-updater
    if (process.platform === 'win32') {
      // Windows: usa file completo portable
      autoUpdater.disableDifferentialDownload = true // Disabilita delta updates
      autoUpdater.disableWebInstaller = true // Usa file completo
    } else {
      // macOS: usa delta updates
      autoUpdater.disableDifferentialDownload = false // Abilita delta updates
      autoUpdater.disableWebInstaller = true // Usa solo delta, non web installer
    }
    
    // ✅ NUOVO: Stato del download
    this.downloadState = {
      isDownloading: false,
      isDownloaded: false,
      isInstalling: false
    }
    
    // Configura l'auto-updater
    autoUpdater.checkForUpdatesAndNotify()
    
    // Eventi dell'auto-updater
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Controllo aggiornamenti...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('📦 Aggiornamento disponibile:', info.version)
      console.log('📦 Info aggiornamento:', JSON.stringify(info, null, 2))
      console.log('📋 Versione corrente package.json:', require('../package.json').version)
      console.log('📋 Version comparison:', info.version !== require('../package.json').version ? 'DIFFERENT - UPDATE NEEDED' : 'SAME - NO UPDATE NEEDED')
      
      // ✅ FIX: Controllo robusto dei file disponibili
      let fileSizeMB = 'N/A'
      let selectedFile = null
      
      if (info.files && info.files.length > 0) {
        console.log('📁 File disponibili:', info.files.map(f => ({ url: f.url, size: f.size })))
        
        if (process.platform === 'win32') {
          // Windows: cerca file .exe, .msi, o qualsiasi file Windows
          selectedFile = info.files.find(file => 
            file.url && (
              file.url.includes('.exe') || 
              file.url.includes('.msi') ||
              file.url.includes('win') ||
              file.url.includes('windows')
            )
          )
          
          // Se non trova file specifici Windows, usa il primo file disponibile
          if (!selectedFile) {
            selectedFile = info.files[0]
            console.log('⚠️ File Windows specifico non trovato, uso il primo disponibile:', selectedFile.url)
          }
        } else {
          // macOS: cerca file .dmg, .pkg, o qualsiasi file macOS
          selectedFile = info.files.find(file => 
            file.url && (
              file.url.includes('.dmg') || 
              file.url.includes('.pkg') ||
              file.url.includes('mac') ||
              file.url.includes('macos')
            )
          )
          
          // Se non trova file specifici macOS, usa il primo file disponibile
          if (!selectedFile) {
            selectedFile = info.files[0]
            console.log('⚠️ File macOS specifico non trovato, uso il primo disponibile:', selectedFile.url)
          }
        }
        
        if (selectedFile && selectedFile.size) {
          fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1)
          console.log('✅ File selezionato per download:', selectedFile.url, `(${fileSizeMB} MB)`)
        } else {
          console.error('❌ Nessun file valido trovato per il download')
          // Mostra errore invece di "Release non ancora disponibile"
          dialog.showErrorBox(
            'Errore Aggiornamento',
            `Nessun file di aggiornamento valido trovato per ${process.platform}.\n\nFile disponibili:\n${info.files.map(f => f.url).join('\n')}`
          )
          return
        }
      } else {
        console.error('❌ Nessun file disponibile per il download')
        dialog.showErrorBox(
          'Errore Aggiornamento',
          'Nessun file di aggiornamento disponibile per il download.'
        )
        return
      }
      
      // Controlla se è già stato scaricato
      if (this.downloadState.isDownloaded) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Aggiornamento Già Scaricato',
          message: `L'aggiornamento alla versione ${info.version} è già stato scaricato.\nDimensione: ${fileSizeMB} MB\n\nVuoi installarlo ora?`,
          buttons: ['Installa Ora', 'Annulla']
        }).then((result) => {
          if (result.response === 0) {
            this.installUpdate()
          }
        })
        return
      }
      
      // Controlla se è in download
      if (this.downloadState.isDownloading) {
        // Invia notifica di download in corso
        const { BrowserWindow } = require('electron')
        const mainWindow = BrowserWindow.getAllWindows()[0]
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', { percent: 0 })
        }
        return
      }
      
      // Invia notifica grafica invece di dialog
      const { BrowserWindow } = require('electron')
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        mainWindow.webContents.send('update-available', {
          version: info.version,
          size: fileSizeMB
        })
      }
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ App aggiornata alla versione più recente')
      console.log('📦 Info versione corrente:', JSON.stringify(info, null, 2))
    })

    autoUpdater.on('error', (err) => {
      console.error('❌ Errore durante il controllo aggiornamenti:', err)
      
      // ✅ FIX: Gestione errore ENOENT per file di configurazione
      if (err.message && err.message.includes('ENOENT')) {
        console.error('❌ File di configurazione aggiornamento non trovato')
        console.log('🔄 Tentativo di ricreare il file di configurazione...')
        this.recreateUpdateConfig()
        return
      }
      
      // Se l'errore è "build in corso", prova a controllare di nuovo dopo un po'
      if (err.message && err.message.includes('build')) {
        console.log('🔄 Build in corso rilevato, riprovo tra 30 secondi...')
        setTimeout(() => {
          this.checkForUpdates()
        }, 30000)
      }
    })

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Velocità download: " + progressObj.bytesPerSecond
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')'
      
      // ✅ NUOVO: Log per verificare se sono delta updates
      const isDeltaUpdate = progressObj.total < 100 * 1024 * 1024 // Meno di 100MB = probabile delta
      if (isDeltaUpdate) {
        log_message += ' [DELTA UPDATE]'
      }
      
      console.log('📥 Download aggiornamento:', log_message)
      
      // Invia il progresso al renderer process
      const mainWindow = require('./main').getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          percent: Math.round(progressObj.percent),
          bytesPerSecond: progressObj.bytesPerSecond,
          transferred: progressObj.transferred,
          total: progressObj.total
        })
      }
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log('✅ Aggiornamento scaricato:', info.version)
      console.log('✅ Info download:', JSON.stringify(info, null, 2))
      
      // Aggiorna lo stato
      this.downloadState.isDownloading = false
      this.downloadState.isDownloaded = true
      
      // Invia notifica di download completato
      const mainWindow = require('./main').getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('download-complete')
      }
      
      // ✅ NUOVO: Crea/aggiorna collegamento desktop dopo download
      this.createDesktopShortcut()
      
      // ✅ FIX: Verifica il tipo di download in base alla piattaforma
      let downloadType = 'completo'
      if (process.platform === 'darwin') {
        // macOS: verifica se è un delta download
        const isDeltaDownload = info.files && info.files.some(file => 
          file.url && (file.url.includes('.nupkg') || file.url.includes('delta'))
        )
        downloadType = isDeltaDownload ? 'delta' : 'completo'
      } else {
        // Windows: sempre file completo portable
        downloadType = 'completo'
      }
      console.log(`📦 Tipo download: ${downloadType}`)
      
      // Non mostrare dialog, l'utente installerà tramite interfaccia grafica
      console.log('✅ Download completato, pronto per installazione tramite UI')
    })

    // Controlla aggiornamenti all'avvio
    this.checkForUpdates()
  }

  checkForUpdates() {
    try {
      autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      console.error('Errore durante il controllo aggiornamenti:', error)
    }
  }

  // Metodo per controllare manualmente gli aggiornamenti
  checkForUpdatesManually() {
    return new Promise((resolve, reject) => {
      autoUpdater.checkForUpdates().then((result) => {
        resolve(result)
      }).catch((error) => {
        reject(error)
      })
    })
  }

  // Metodo per resettare la cache dell'auto-updater
  resetUpdaterCache() {
    try {
      console.log('🧹 Reset cache auto-updater...')
      // ✅ FIX: Controlla se clearCache esiste prima di chiamarlo
      if (typeof autoUpdater.clearCache === 'function') {
        autoUpdater.clearCache()
        console.log('✅ Cache auto-updater pulita')
      } else {
        console.log('⚠️ clearCache non disponibile, pulizia manuale...')
        // Pulizia manuale della cache
        const os = require('os')
        const path = require('path')
        const fs = require('fs')
        
        const cacheDir = path.join(os.tmpdir(), 'inferno-console-updater')
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true, force: true })
          console.log('✅ Cache manuale pulita')
        }
      }
    } catch (error) {
      console.error('❌ Errore durante il reset cache:', error)
    }
  }

  // Metodo per forzare il controllo aggiornamenti (ignora cache)
  forceCheckForUpdates() {
    try {
      console.log('🔄 Controllo forzato aggiornamenti...')
      this.resetUpdaterCache()
      setTimeout(() => {
        this.checkForUpdates()
      }, 1000)
    } catch (error) {
      console.error('❌ Errore durante il controllo forzato:', error)
    }
  }

  // ✅ FIX: Metodo per forzare il controllo aggiornamenti con reset completo
  forceUpdateCheck() {
    try {
      console.log('🔄 Controllo forzato aggiornamenti con reset completo...')
      console.log('📋 Versione corrente package.json:', require('../package.json').version)
      
      if (typeof autoUpdater.currentVersion !== 'undefined') {
        console.log('📋 Versione auto-updater corrente:', autoUpdater.currentVersion)
      }
      
      // ✅ FIX: Reset sicuro della cache
      if (typeof autoUpdater.clearCache === 'function') {
        autoUpdater.clearCache()
        console.log('✅ Cache auto-updater pulita')
      } else {
        console.log('⚠️ clearCache non disponibile, pulizia manuale...')
        // Pulizia manuale della cache
        const os = require('os')
        const path = require('path')
        const fs = require('fs')
        
        const cacheDir = path.join(os.tmpdir(), 'inferno-console-updater')
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true, force: true })
          console.log('✅ Cache manuale pulita')
        }
      }
      
      // Reset dello stato
      this.downloadState = {
        isDownloading: false,
        isDownloaded: false,
        isInstalling: false
      }
      
      // Forza il controllo aggiornamenti
      autoUpdater.checkForUpdates().then((result) => {
        console.log('✅ Controllo forzato completato:', result)
      }).catch((error) => {
        console.error('❌ Errore controllo forzato:', error)
      })
      
    } catch (error) {
      console.error('❌ Errore durante il controllo forzato:', error)
    }
  }

  // Metodo per installare l'aggiornamento scaricato
  installUpdate() {
    if (this.downloadState.isDownloaded && !this.downloadState.isInstalling) {
      console.log('🚀 Installazione aggiornamento...')
      this.downloadState.isInstalling = true
      
      // ✅ NUOVO: Mostra percorso dell'app prima dell'installazione
      const { app } = require('electron')
      const appPath = app.getPath('exe')
      const appDir = require('path').dirname(appPath)
      
      // Invia notifica di installazione in corso
      const mainWindow = require('./main').getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('installing-update')
      }
      
      // ✅ FIX: Crea collegamento desktop DOPO l'installazione
      // Il collegamento verrà creato al prossimo avvio dell'app aggiornata
      console.log('🔗 Collegamento desktop sarà creato al prossimo avvio')
      
      // ✅ FIX: Parametri corretti per macOS e Windows
      if (process.platform === 'darwin') {
        // macOS: force=false, isSilent=false per installazione corretta
        console.log('🍎 macOS: Installazione aggiornamento...')
        autoUpdater.quitAndInstall(false, false)
      } else {
        // Windows: force=true, isSilent=false per mostrare progresso e chiudere correttamente
        console.log('🪟 Windows: Installazione aggiornamento...')
        console.log('🔄 Chiudendo app per installazione...')
        
        // Chiudi l'app prima dell'installazione per evitare EPERM
        setTimeout(() => {
          autoUpdater.quitAndInstall(true, false)
        }, 1000)
      }
    } else {
      console.log('⚠️ Installazione non possibile:', {
        isDownloaded: this.downloadState.isDownloaded,
        isInstalling: this.downloadState.isInstalling
      })
    }
  }

  // Metodo per resettare lo stato del download (utile per test)
  resetDownloadState() {
    this.downloadState = {
      isDownloading: false,
      isDownloaded: false,
      isInstalling: false
    }
    console.log('🔄 Stato download resettato')
  }

  // ✅ FIX: Metodo per ricreare il file di configurazione
  recreateUpdateConfig() {
    try {
      const fs = require('fs')
      const path = require('path')
      
      const configPath = process.env.NODE_ENV === 'development' 
        ? path.join(__dirname, 'dev-app-update.yml')
        : path.join(__dirname, 'app-update.yml')
      
      const configContent = `provider: github
owner: Alexand83
repo: InfernoConsole
updaterCacheDirName: inferno-console-updater`
      
      fs.writeFileSync(configPath, configContent)
      console.log('✅ File di configurazione aggiornamento ricreato:', configPath)
      
      // Riprova il controllo aggiornamenti
      setTimeout(() => {
        this.checkForUpdates()
      }, 1000)
      
    } catch (error) {
      console.error('❌ Errore nel ricreare il file di configurazione:', error)
    }
  }

  // ✅ NUOVO: Metodo per verificare manualmente i file disponibili su GitHub
  async checkGitHubFiles() {
    try {
      const https = require('https')
      const url = 'https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest'
      
      return new Promise((resolve, reject) => {
        https.get(url, {
          headers: {
            'User-Agent': 'DJ-Console-Updater',
            'Accept': 'application/vnd.github.v3+json'
          }
        }, (res) => {
          let data = ''
          res.on('data', (chunk) => data += chunk)
          res.on('end', () => {
            try {
              const release = JSON.parse(data)
              console.log('🔍 Release GitHub trovata:', release.tag_name)
              console.log('📁 Assets disponibili:', release.assets.map(a => ({
                name: a.name,
                size: a.size,
                download_url: a.browser_download_url
              })))
              resolve(release)
            } catch (err) {
              reject(err)
            }
          })
        }).on('error', reject)
      })
    } catch (error) {
      console.error('❌ Errore nel controllo file GitHub:', error)
      throw error
    }
  }

  // ✅ NUOVO: Metodo per creare collegamento sul desktop
  createDesktopShortcut() {
    try {
      console.log('🔧 [UPDATER] createDesktopShortcut chiamato')
      
      const { app } = require('electron')
      const path = require('path')
      const fs = require('fs')
      
      if (process.platform === 'win32') {
        const desktopPath = path.join(require('os').homedir(), 'Desktop')
        const shortcutPath = path.join(desktopPath, 'Inferno Console.lnk')
        
        console.log('🔗 [UPDATER] Creazione collegamento desktop...')
        console.log('📁 [UPDATER] Percorso collegamento:', shortcutPath)
        console.log('📁 [UPDATER] Desktop exists:', fs.existsSync(desktopPath))
        
        // ✅ FIX: Usa sempre il percorso corrente per ora
        // Il collegamento verrà aggiornato dopo l'installazione
        const currentAppPath = app.getPath('exe')
        console.log('📁 [UPDATER] Percorso app corrente:', currentAppPath)
        console.log('📁 [UPDATER] App exists:', fs.existsSync(currentAppPath))
        
        // Crea il collegamento con il percorso corrente
        this.createShortcutWithPath(shortcutPath, currentAppPath)
      } else {
        console.log('⚠️ [UPDATER] Collegamento desktop supportato solo su Windows')
      }
    } catch (error) {
      console.error('❌ [UPDATER] Errore nella creazione del collegamento:', error)
    }
  }

  // ✅ METODO PRINCIPALE: Crea collegamento usando percorso corretto
  createShortcutWithPath(shortcutPath, appPath) {
    const path = require('path')
    const { app } = require('electron')
    const fs = require('fs')
    
    // ✅ NUOVO: Usa il path personalizzato dalla configurazione
    const customInstallDir = this.customInstallDir || path.join(require('os').homedir(), 'Desktop', 'Inferno Console')
    const installedExePath = path.join(customInstallDir, 'Inferno-Console-win.exe')
    
    console.log('🔧 [DESKTOP] Usando percorso installazione desktop:', installedExePath)
    console.log('🔧 [DESKTOP] Percorso exe corrente (ignorato):', app.getPath('exe'))
    console.log('🔧 [DESKTOP] Percorso richiesto (ignorato):', appPath)
    
    // ✅ NUOVO: Verifica che il file installato esista
    if (!fs.existsSync(installedExePath)) {
      console.error('❌ File installato non trovato:', installedExePath)
      console.log('🔄 Tentativo di trovare il file installato...')
      
      // Cerca in percorsi alternativi (prima desktop, poi AppData)
      const alternativePaths = [
        // Percorsi desktop
        path.join(customInstallDir, 'Inferno-Console-win.exe'),
        path.join(customInstallDir, 'Inferno Console.exe'),
        path.join(customInstallDir, 'Inferno Console', 'Inferno-Console-win.exe'),
        path.join(customInstallDir, 'Inferno Console', 'Inferno Console.exe'),
        // Percorsi AppData (fallback)
        path.join(localAppData, 'Programs', 'Inferno Console', 'Inferno-Console-win.exe'),
        path.join(localAppData, 'Programs', 'Inferno Console', 'Inferno Console.exe'),
        path.join(localAppData, 'Programs', 'Inferno Console', 'Inferno Console', 'Inferno-Console-win.exe'),
        path.join(localAppData, 'Programs', 'Inferno Console', 'Inferno Console', 'Inferno Console.exe')
      ]
      
      let foundPath = null
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          foundPath = altPath
          console.log('✅ File installato trovato in:', foundPath)
          break
        }
      }
      
      if (!foundPath) {
        console.error('❌ Nessun file installato trovato, creo shortcut che apre la cartella')
        this.createFallbackShortcut(shortcutPath)
        return
      }
      
      // Usa il path trovato
      this.createShortcutWithPath(shortcutPath, foundPath)
      return
    }
    
    const psCommand = `$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${shortcutPath}'); $Shortcut.TargetPath = '${installedExePath}'; $Shortcut.WorkingDirectory = '${path.dirname(installedExePath)}'; $Shortcut.Description = 'Inferno Console - Console DJ professionale'; $Shortcut.IconLocation = '${installedExePath},0'; $Shortcut.Save(); Write-Host 'SUCCESS: Collegamento creato'`
    
    console.log('🔧 PowerShell command:', psCommand)
    console.log('🔧 Shortcut path:', shortcutPath)
    console.log('🔧 App path (installato):', installedExePath)
    console.log('🔧 Working directory:', path.dirname(installedExePath))
    
    require('child_process').exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Errore creazione collegamento:', error)
        console.error('❌ Stderr:', stderr)
        
        // ✅ FALLBACK: Crea collegamento con percorso fisso di aggiornamento
        this.createFallbackShortcut(shortcutPath)
      } else {
        console.log('✅ Collegamento desktop creato con successo')
        console.log('📋 Output:', stdout)
        
        // ✅ DEBUG: Log di conferma
        console.log('🎯 Collegamento desktop creato con percorso corretto!')
      }
    })
  }

  // ✅ FALLBACK: Crea collegamento con percorso installato fisso
  createFallbackShortcut(shortcutPath) {
    const path = require('path')
    const fs = require('fs')
    const os = require('os')
    
    // ✅ NUOVO: Usa il path personalizzato dalla configurazione
    const customInstallDir = this.customInstallDir || path.join(os.homedir(), 'Desktop', 'Inferno Console')
    const installedExePath = path.join(customInstallDir, 'Inferno-Console-win.exe')
    
    console.log('🔄 FALLBACK: Usando percorso installato fisso')
    console.log('📁 Percorso installato fisso:', installedExePath)
    console.log('📁 App exists:', fs.existsSync(installedExePath))
    console.log('📁 Desktop path:', shortcutPath)
    console.log('📁 Desktop exists:', fs.existsSync(path.dirname(shortcutPath)))
    
    if (fs.existsSync(installedExePath)) {
      // App trovata - crea collegamento diretto
      console.log('✅ App trovata, creo collegamento diretto')
      this.createShortcutWithPath(shortcutPath, installedExePath)
    } else {
      // App non trovata - crea collegamento che apre la cartella desktop
      console.log('⚠️ App non trovata, creo collegamento che apre cartella desktop')
      const desktopDir = customInstallDir
      const psCommand = `$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${shortcutPath}'); $Shortcut.TargetPath = 'explorer.exe'; $Shortcut.Arguments = '/select,${desktopDir}'; $Shortcut.Description = 'Inferno Console - Apri cartella installazione'; $Shortcut.Save(); Write-Host 'EXPLORER FALLBACK: Collegamento creato'`
      
      require('child_process').exec(`powershell -Command "${psCommand}"`, (fallbackError, fallbackStdout, fallbackStderr) => {
        if (fallbackError) {
          console.error('❌ Anche il fallback è fallito:', fallbackError)
          console.error('❌ Fallback Stderr:', fallbackStderr)
        } else {
          console.log('✅ Fallback collegamento creato con successo')
          console.log('📋 Fallback Output:', fallbackStdout)
        }
      })
    }
  }
}

module.exports = AppUpdater
