const { autoUpdater } = require('electron-updater')
const { dialog, app } = require('electron')

class AppUpdater {
  constructor() {
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
    })

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Velocità download: " + progressObj.bytesPerSecond
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')'
      console.log('📥 Download aggiornamento:', log_message)
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
}

module.exports = AppUpdater
