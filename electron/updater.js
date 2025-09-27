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
      
      // ✅ FIX: Calcola la dimensione del file in base alla piattaforma
      let fileSizeMB = 'N/A'
      if (info.files && info.files.length > 0) {
        if (process.platform === 'win32') {
          // Windows: usa il file completo portable
          const portableFile = info.files.find(file => 
            file.url && file.url.includes('.exe')
          )
          if (portableFile && portableFile.size) {
            fileSizeMB = (portableFile.size / (1024 * 1024)).toFixed(1)
          } else {
            fileSizeMB = (info.files[0].size / (1024 * 1024)).toFixed(1)
          }
        } else {
          // macOS: cerca il file delta (.nupkg)
          const deltaFile = info.files.find(file => 
            file.url && (file.url.includes('.nupkg') || file.url.includes('delta'))
          )
          if (deltaFile && deltaFile.size) {
            fileSizeMB = (deltaFile.size / (1024 * 1024)).toFixed(1)
          } else {
            fileSizeMB = (info.files[0].size / (1024 * 1024)).toFixed(1)
          }
        }
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
        dialog.showMessageBox({
          type: 'info',
          title: 'Download in Corso',
          message: `L'aggiornamento alla versione ${info.version} è già in download.\nDimensione: ${fileSizeMB} MB\n\nAttendi il completamento del download.`,
          buttons: ['OK']
        })
        return
      }
      
      dialog.showMessageBox({
        type: 'info',
        title: 'Aggiornamento Disponibile',
        message: `È disponibile una nuova versione (${info.version}).\nDimensione download: ${fileSizeMB} MB\n\nVuoi scaricare l'aggiornamento?`,
        buttons: ['Scarica', 'Annulla']
      }).then((result) => {
        if (result.response === 0) {
          // Avvia il download
          this.downloadState.isDownloading = true
          autoUpdater.downloadUpdate()
        }
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ App aggiornata alla versione più recente')
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
      
      dialog.showMessageBox({
        type: 'info',
        title: 'Aggiornamento Pronto',
        message: `L'aggiornamento alla versione ${info.version} è stato scaricato.\nTipo: ${downloadType}\n\nL'app verrà chiusa e riavviata per applicare l'aggiornamento.`,
        buttons: ['Installa e Riavvia', 'Installa Dopo']
      }).then((result) => {
        if (result.response === 0) {
          // Installa e riavvia immediatamente
          console.log('🚀 Installazione aggiornamento e riavvio...')
          this.downloadState.isInstalling = true
          this.installUpdate()
        } else {
          // L'utente può installare dopo
          console.log('⏰ Installazione rinviata dall\'utente')
        }
      })
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
      // Pulisce la cache dell'auto-updater
      autoUpdater.clearCache()
      console.log('✅ Cache auto-updater pulita')
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

  // Metodo per installare l'aggiornamento scaricato
  installUpdate() {
    if (this.downloadState.isDownloaded && !this.downloadState.isInstalling) {
      console.log('🚀 Installazione aggiornamento...')
      this.downloadState.isInstalling = true
      
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
}

module.exports = AppUpdater
