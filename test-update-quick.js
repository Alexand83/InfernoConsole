/**
 * 🚀 TEST RAPIDO AUTO-UPDATER
 * 
 * Questo script modifica automaticamente electron/updater.js per usare il server locale
 * e lo ripristina quando termini
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const UPDATER_FILE = path.join(__dirname, 'electron', 'updater.js')
const GITHUB_API_URL = 'https://api.github.com/repos/Alexand83/InfernoConsole/releases/latest'
const LOCAL_API_URL = 'http://localhost:3456/repos/Alexand83/InfernoConsole/releases/latest'

console.log('🧪 TEST RAPIDO AUTO-UPDATER\n')

// Leggi il file updater.js
let updaterContent = fs.readFileSync(UPDATER_FILE, 'utf8')
const originalContent = updaterContent

// Controlla se è già in modalità test
if (updaterContent.includes(LOCAL_API_URL)) {
  console.log('✅ Updater già in modalità test')
} else {
  // Modifica per usare localhost
  updaterContent = updaterContent.replace(GITHUB_API_URL, LOCAL_API_URL)
  fs.writeFileSync(UPDATER_FILE, updaterContent)
  console.log('✅ Updater modificato per usare server locale')
}

console.log('🚀 Avvio server mock...\n')

// Avvia il server mock
const serverProcess = spawn('node', ['test-update-local.js'], {
  stdio: 'inherit',
  shell: true
})

// Ripristina il file originale quando il processo termina
function cleanup() {
  console.log('\n\n🧹 Ripristino configurazione originale...')
  fs.writeFileSync(UPDATER_FILE, originalContent)
  console.log('✅ Updater ripristinato')
  
  serverProcess.kill()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

serverProcess.on('exit', () => {
  cleanup()
})

