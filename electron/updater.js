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
        
        const cacheDir = path.join(os.tmpdir(), 'dj-console-updater')
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
        
        const cacheDir = path.join(os.tmpdir(), 'dj-console-updater')
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
        // Windows: force=true, isSilent=true per installazione silenziosa
        console.log('🪟 Windows: Installazione aggiornamento...')
        autoUpdater.quitAndInstall(true, true)
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
updaterCacheDirName: dj-console-updater`
      
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
      const { app } = require('electron')
      const path = require('path')
      const fs = require('fs')
      
      if (process.platform === 'win32') {
        const desktopPath = path.join(require('os').homedir(), 'Desktop')
        const shortcutPath = path.join(desktopPath, 'Inferno Console.lnk')
        
        console.log('🔗 Creazione collegamento desktop...')
        console.log('📁 Percorso collegamento:', shortcutPath)
        
        // ✅ FIX: Usa sempre il percorso corrente per ora
        // Il collegamento verrà aggiornato dopo l'installazione
        const currentAppPath = app.getPath('exe')
        console.log('📁 Percorso app corrente:', currentAppPath)
        
        // Crea il collegamento con il percorso corrente
        this.createShortcutWithPath(shortcutPath, currentAppPath)
      }
    } catch (error) {
      console.error('❌ Errore nella creazione del collegamento:', error)
    }
  }

  // ✅ NUOVO: Metodo separato per creare il collegamento
  createShortcutWithPath(shortcutPath, appPath) {
    const path = require('path')
    
    const psCommand = `
      try {
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
        $Shortcut.TargetPath = "${appPath}"
        $Shortcut.WorkingDirectory = "${path.dirname(appPath)}"
        $Shortcut.Description = "Inferno Console - Console DJ professionale"
        $Shortcut.IconLocation = "${appPath},0"
        $Shortcut.Save()
        Write-Host "SUCCESS: Collegamento creato in ${shortcutPath}"
      } catch {
        Write-Host "ERROR: $($_.Exception.Message)"
        exit 1
      }
    `
    
    require('child_process').exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Errore creazione collegamento:', error)
        console.error('❌ Stderr:', stderr)
        
        // ✅ FALLBACK: Crea collegamento con percorso fisso di aggiornamento
        this.createFallbackShortcut(shortcutPath)
      } else {
        console.log('✅ Collegamento desktop creato con successo')
        console.log('📋 Output:', stdout)
      }
    })
  }

  // ✅ FALLBACK: Crea collegamento con percorso fisso di aggiornamento
  createFallbackShortcut(shortcutPath) {
    const path = require('path')
    
    // Percorso fisso dove electron-builder installa sempre l'app
    const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local')
    const fallbackAppPath = path.join(localAppData, 'Programs', 'Inferno Console', 'Inferno Console.exe')
    
    console.log('🔄 FALLBACK: Creazione collegamento con percorso fisso')
    console.log('📁 Percorso fallback:', fallbackAppPath)
    
    const psCommand = `
      try {
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
        $Shortcut.TargetPath = "${fallbackAppPath}"
        $Shortcut.WorkingDirectory = "${path.dirname(fallbackAppPath)}"
        $Shortcut.Description = "Inferno Console - Console DJ professionale (Aggiornato)"
        $Shortcut.IconLocation = "${fallbackAppPath},0"
        $Shortcut.Save()
        Write-Host "FALLBACK SUCCESS: Collegamento creato con percorso fisso"
      } catch {
        Write-Host "FALLBACK ERROR: $($_.Exception.Message)"
        # Ultimo tentativo: crea collegamento che apre la cartella
        $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
        $Shortcut.TargetPath = "explorer.exe"
        $Shortcut.Arguments = "/select,`"${fallbackAppPath}`""
        $Shortcut.Description = "Inferno Console - Apri cartella installazione"
        $Shortcut.Save()
        Write-Host "EXPLORER FALLBACK: Collegamento che apre cartella"
      }
    `
    
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

module.exports = AppUpdater
