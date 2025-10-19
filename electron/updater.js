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

    // ✅ NUOVO: Rileva se l'app è stata installata con l'installer personalizzato
    this.isCustomInstaller = this.detectCustomInstaller()
    this.customInstallPath = this.getCustomInstallPath()
    
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
    autoUpdater.autoInstallOnAppQuit = false // Disabilitato per gestione manuale
    
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
      
      // ✅ NUOVO: Gestione percorso personalizzato per installer
      if (this.isCustomInstaller && this.customInstallPath) {
        console.log('🔧 Custom installer detected - preparing update for custom path')
        this.prepareCustomUpdate(info)
      }
      
      // Invia notifica di download completato
      const mainWindow = require('./main').getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('download-complete')
      }
      
      // ✅ RIMOSSO: Creazione shortcut dopo download - solo post-update automatico
      
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

  async checkForUpdates() {
    try {
      console.log('🔍 Controllo aggiornamenti tramite API GitHub...')
      
      // Prima prova con l'API GitHub diretta
      try {
        const release = await this.checkGitHubFiles()
        const currentVersion = require('../package.json').version
        const latestVersion = release.tag_name.replace('v', '')
        
        console.log(`📦 Versione corrente: ${currentVersion}`)
        console.log(`📦 Versione più recente: ${latestVersion}`)
        
        if (this.isNewerVersion(latestVersion, currentVersion)) {
          console.log('✅ Nuova versione disponibile!')
          
          // Trova l'installer nell'elenco degli asset
          const installer = release.assets.find(asset => 
            asset.name === 'Inferno-Console-Installer.exe'
          )
          
          if (installer) {
            console.log('📥 Installer trovato:', installer.name)
            console.log('📊 Dimensione:', (installer.size / 1024 / 1024).toFixed(2), 'MB')
            
            // Invia notifica al renderer
            const mainWindow = require('./main').getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('update-available', {
                version: latestVersion,
                installer: installer,
                release: release
              })
            }
          } else {
            console.log('❌ Installer non trovato negli asset')
          }
        } else {
          console.log('✅ App già aggiornata alla versione più recente')
        }
        
      } catch (githubError) {
        console.warn('⚠️ Errore API GitHub, fallback a auto-updater:', githubError.message)
        // Fallback al metodo originale
        autoUpdater.checkForUpdatesAndNotify()
      }
      
    } catch (error) {
      console.error('❌ Errore durante il controllo aggiornamenti:', error)
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
      
      // ✅ NUOVO: Gestione installazione personalizzata per Windows
      if (process.platform === 'win32') {
        this.installUpdateWindows()
      } else {
        // macOS: usa il metodo standard
        console.log('🍎 macOS: Installazione aggiornamento...')
        autoUpdater.quitAndInstall(false, false)
      }
    } else {
      console.log('⚠️ Installazione non possibile:', {
        isDownloaded: this.downloadState.isDownloaded,
        isInstalling: this.downloadState.isInstalling
      })
    }
  }

  // ✅ NUOVO: Metodo per installazione personalizzata su Windows con installer self-extracting
  installUpdateWindows() {
    const fs = require('fs')
    const path = require('path')
    const { app } = require('electron')
    const { spawn } = require('child_process')
    
    try {
      console.log('🪟 Windows: Installazione con installer self-extracting...')
      
      // Path di destinazione (cartella desktop)
      const customInstallDir = this.customInstallDir || path.join(require('os').homedir(), 'Desktop', 'Inferno Console')
      
      console.log('📁 Directory installazione:', customInstallDir)
      
      // Trova l'installer scaricato
      const downloadDir = path.join(customInstallDir, 'Updates')
      const installerFiles = fs.readdirSync(downloadDir).filter(file => 
        file.endsWith('.exe') && file.includes('Installer')
      )
      
      if (installerFiles.length === 0) {
        throw new Error('Nessun installer self-extracting trovato nella cartella Updates')
      }
      
      const installerPath = path.join(downloadDir, installerFiles[0])
      console.log('📁 Installer trovato:', installerPath)
      
      // Esegui l'installer self-extracting
      console.log('🚀 Esecuzione installer self-extracting...')
      const installerProcess = spawn(installerPath, [], {
        cwd: downloadDir,
        detached: true,
        stdio: 'ignore'
      })
      
      installerProcess.unref()
      
      // Invia notifica di successo
      const mainWindow = require('./main').getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('update-installed', {
          path: customInstallDir,
          message: 'Installer self-extracting avviato! L\'app si installerà automaticamente.'
        })
      }
      
      console.log('✅ Installer self-extracting avviato!')
      
      // Chiudi l'app corrente per permettere l'installazione
      setTimeout(() => {
        console.log('🔄 Chiusura app per permettere installazione...')
        app.quit()
      }, 2000)
      
    } catch (error) {
      console.error('❌ Errore durante installazione:', error)
      
      // Invia notifica di errore
      const mainWindow = require('./main').getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('update-error', {
          error: error.message
        })
      }
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

  // ✅ NUOVO: Metodo per confrontare le versioni
  isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number)
    const currentParts = current.split('.').map(Number)
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0
      const currentPart = currentParts[i] || 0
      
      if (latestPart > currentPart) return true
      if (latestPart < currentPart) return false
    }
    
    return false // Stessa versione
  }

  // ✅ NUOVO: Metodo per scaricare l'installer
  async downloadInstaller(installerInfo) {
    try {
      const https = require('https')
      const fs = require('fs')
      const path = require('path')
      
      const downloadPath = path.join(this.customUpdateDir, installerInfo.name)
      
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(downloadPath)
        
        https.get(installerInfo.browser_download_url, {
          headers: {
            'User-Agent': 'DJ-Console-Updater'
          }
        }, (res) => {
          let downloaded = 0
          const total = installerInfo.size
          
          res.on('data', (chunk) => {
            downloaded += chunk.length
            const percent = Math.round((downloaded / total) * 100)
            
            // Invia progresso al renderer
            const mainWindow = require('./main').getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('download-progress', {
                percent: percent,
                bytesPerSecond: 0, // Non disponibile con https.get
                transferred: downloaded,
                total: total
              })
            }
            
            file.write(chunk)
          })
          
          res.on('end', () => {
            file.end()
            console.log('✅ Download installer completato:', downloadPath)
            resolve(downloadPath)
          })
          
          res.on('error', (err) => {
            file.close()
            fs.unlink(downloadPath, () => {}) // Rimuovi file parziale
            reject(err)
          })
        }).on('error', (err) => {
          file.close()
          fs.unlink(downloadPath, () => {}) // Rimuovi file parziale
          reject(err)
        })
      })
    } catch (error) {
      console.error('❌ Errore download installer:', error)
      throw error
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

  // ✅ RIMOSSO: Metodo createDesktopShortcut - solo post-update automatico

  // ✅ RIMOSSO: Metodo findTargetExePath - solo post-update automatico

  // ✅ RIMOSSO: Tutti i metodi di creazione shortcut - solo post-update automatico

  // ✅ NUOVO: Rileva se l'app è stata installata con l'installer personalizzato
  detectCustomInstaller() {
    try {
      const fs = require('fs')
      const appPath = process.execPath
      const appDir = path.dirname(appPath)
      
      // Controlla se esiste un file di marker dell'installer personalizzato
      const installerMarker = path.join(appDir, '..', 'installer-info.json')
      if (fs.existsSync(installerMarker)) {
        console.log('🔍 Custom installer detected')
        return true
      }
      
      // Controlla se l'app è in Program Files (installazione standard)
      if (appPath.includes('Program Files') || appPath.includes('Program Files (x86)')) {
        console.log('🔍 Standard installation detected')
        return false
      }
      
      // Controlla se l'app è portabile (temp directory)
      if (appPath.includes('AppData\\Local\\Temp')) {
        console.log('🔍 Portable app detected')
        return false
      }
      
      console.log('🔍 Unknown installation type')
      return false
    } catch (error) {
      console.error('Error detecting installer type:', error)
      return false
    }
  }

  // ✅ NUOVO: Ottiene il percorso di installazione personalizzato
  getCustomInstallPath() {
    try {
      const fs = require('fs')
      const appPath = process.execPath
      const appDir = path.dirname(appPath)
      
      // Leggi il marker dell'installer personalizzato
      const installerMarker = path.join(appDir, '..', 'installer-info.json')
      if (fs.existsSync(installerMarker)) {
        const markerData = JSON.parse(fs.readFileSync(installerMarker, 'utf8'))
        const customPath = markerData.installPath
        
        if (customPath && fs.existsSync(customPath)) {
          console.log('📍 Custom install path found:', customPath)
          return customPath
        }
      }
      
      console.log('📍 No custom install path found, using default')
      return null
    } catch (error) {
      console.error('Error getting custom install path:', error)
      return null
    }
  }

  // ✅ NUOVO: Prepara l'aggiornamento per il percorso personalizzato
  prepareCustomUpdate(info) {
    try {
      const fs = require('fs')
      const os = require('os')
      
      // Trova il file scaricato
      const updateCacheDir = path.join(os.tmpdir(), 'inferno-console-updater')
      const downloadedFiles = fs.readdirSync(updateCacheDir)
      
      // Cerca il file .exe scaricato
      const exeFile = downloadedFiles.find(file => file.endsWith('.exe'))
      if (!exeFile) {
        console.error('❌ No .exe file found in update cache')
        return
      }
      
      const sourcePath = path.join(updateCacheDir, exeFile)
      const targetPath = path.join(this.customInstallPath, 'Inferno Console.exe')
      
      console.log('🔄 Preparing custom update...')
      console.log('📁 Source:', sourcePath)
      console.log('📁 Target:', targetPath)
      
      // Crea backup del file esistente
      const backupPath = path.join(this.customInstallPath, 'Inferno Console.exe.backup')
      if (fs.existsSync(targetPath)) {
        fs.copyFileSync(targetPath, backupPath)
        console.log('💾 Backup created:', backupPath)
      }
      
      // Copia il nuovo file
      fs.copyFileSync(sourcePath, targetPath)
      console.log('✅ Update file copied to custom path')
      
      // Aggiorna il marker dell'installer
      this.updateInstallerMarker(info.version)
      
    } catch (error) {
      console.error('❌ Error preparing custom update:', error)
    }
  }

  // ✅ NUOVO: Aggiorna il marker dell'installer con la nuova versione
  updateInstallerMarker(version) {
    try {
      const fs = require('fs')
      const appPath = process.execPath
      const appDir = path.dirname(appPath)
      const installerMarker = path.join(appDir, '..', 'installer-info.json')
      
      if (fs.existsSync(installerMarker)) {
        const markerData = JSON.parse(fs.readFileSync(installerMarker, 'utf8'))
        markerData.version = version
        markerData.lastUpdate = new Date().toISOString()
        
        fs.writeFileSync(installerMarker, JSON.stringify(markerData, null, 2))
        console.log('✅ Installer marker updated with version:', version)
      }
    } catch (error) {
      console.error('❌ Error updating installer marker:', error)
    }
  }
}

module.exports = AppUpdater
