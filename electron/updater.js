const { autoUpdater } = require('electron-updater')
const { dialog, app } = require('electron')
const path = require('path')

class AppUpdater {
  constructor() {
    // ✅ DEV: Abilita controllo aggiornamenti anche in modalità sviluppo
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
    }
    
    // Configura l'auto-updater
    autoUpdater.checkForUpdatesAndNotify()
    
    // Eventi dell'auto-updater
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Controllo aggiornamenti...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('📦 Aggiornamento disponibile:', info.version)
      dialog.showMessageBox({
        type: 'info',
        title: 'Aggiornamento Disponibile',
        message: `È disponibile una nuova versione (${info.version}). L'aggiornamento verrà scaricato in background.`,
        buttons: ['OK']
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ App aggiornata alla versione più recente')
    })

    autoUpdater.on('error', (err) => {
      console.error('❌ Errore durante il controllo aggiornamenti:', err)
      
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
      
      dialog.showMessageBox({
        type: 'info',
        title: 'Aggiornamento Pronto',
        message: `L'aggiornamento alla versione ${info.version} è stato scaricato. L'app verrà riavviata per applicare l'aggiornamento.`,
        buttons: ['Riavvia Ora', 'Riavvia Dopo']
      }).then((result) => {
        if (result.response === 0) {
          // Riavvia immediatamente
          autoUpdater.quitAndInstall()
        }
        // Altrimenti l'utente può riavviare quando vuole
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
}

module.exports = AppUpdater
