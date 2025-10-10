#!/usr/bin/env node

/**
 * Script per installare yt-dlp e youtube-dl
 * Supporta Windows, macOS e Linux
 */

const { spawn, exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const platform = os.platform()
const isWindows = platform === 'win32'
const isMac = platform === 'darwin'
const isLinux = platform === 'linux'

console.log(`🔄 [INSTALL] Installazione yt-dlp per ${platform}...`)

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`📦 [INSTALL] Eseguendo: ${command} ${args.join(' ')}`)
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: isWindows,
      ...options
    })

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ [INSTALL] Comando completato con successo`)
        resolve()
      } else {
        console.error(`❌ [INSTALL] Comando fallito con codice ${code}`)
        reject(new Error(`Comando fallito con codice ${code}`))
      }
    })

    process.on('error', (error) => {
      console.error(`❌ [INSTALL] Errore esecuzione comando:`, error)
      reject(error)
    })
  })
}

async function checkCommand(command) {
  return new Promise((resolve) => {
    exec(`${command} --version`, (error, stdout) => {
      if (error) {
        resolve(false)
      } else {
        console.log(`✅ [CHECK] ${command} trovato: ${stdout.trim()}`)
        resolve(true)
      }
    })
  })
}

async function installPython() {
  if (isWindows) {
    console.log(`🐍 [PYTHON] Verifico Python su Windows...`)
    const hasPython = await checkCommand('python')
    if (!hasPython) {
      console.log(`❌ [PYTHON] Python non trovato. Installa Python da https://python.org`)
      console.log(`📋 [PYTHON] Assicurati di selezionare "Add Python to PATH" durante l'installazione`)
      throw new Error('Python richiesto per yt-dlp')
    }
  } else {
    console.log(`🐍 [PYTHON] Verifico Python su ${platform}...`)
    const hasPython = await checkCommand('python3')
    if (!hasPython) {
      console.log(`❌ [PYTHON] Python3 non trovato. Installa con: sudo apt install python3-pip (Ubuntu/Debian) o brew install python3 (macOS)`)
      throw new Error('Python3 richiesto per yt-dlp')
    }
  }
}

async function installYtDlp() {
  console.log(`📥 [YT-DLP] Installazione yt-dlp...`)
  
  try {
    if (isWindows) {
      await runCommand('pip', ['install', '--upgrade', 'yt-dlp'])
    } else {
      await runCommand('pip3', ['install', '--upgrade', 'yt-dlp'])
    }
    
    console.log(`✅ [YT-DLP] yt-dlp installato con successo`)
  } catch (error) {
    console.error(`❌ [YT-DLP] Errore installazione yt-dlp:`, error.message)
    throw error
  }
}

async function installYoutubeDl() {
  console.log(`📥 [YOUTUBE-DL] Installazione youtube-dl...`)
  
  try {
    if (isWindows) {
      await runCommand('pip', ['install', '--upgrade', 'youtube-dl'])
    } else {
      await runCommand('pip3', ['install', '--upgrade', 'youtube-dl'])
    }
    
    console.log(`✅ [YOUTUBE-DL] youtube-dl installato con successo`)
  } catch (error) {
    console.warn(`⚠️ [YOUTUBE-DL] Errore installazione youtube-dl (opzionale):`, error.message)
  }
}

async function installFFmpeg() {
  console.log(`🎬 [FFMPEG] Verifico FFmpeg...`)
  
  const hasFFmpeg = await checkCommand('ffmpeg')
  if (!hasFFmpeg) {
    console.log(`❌ [FFMPEG] FFmpeg non trovato`)
    
    if (isWindows) {
      console.log(`📋 [FFMPEG] Per Windows: scarica da https://ffmpeg.org/download.html`)
      console.log(`📋 [FFMPEG] Oppure usa: winget install ffmpeg`)
    } else if (isMac) {
      console.log(`📋 [FFMPEG] Per macOS: brew install ffmpeg`)
    } else if (isLinux) {
      console.log(`📋 [FFMPEG] Per Linux: sudo apt install ffmpeg (Ubuntu/Debian)`)
    }
    
    throw new Error('FFmpeg richiesto per la conversione audio')
  }
}

async function createBatchFiles() {
  if (isWindows) {
    console.log(`📝 [BATCH] Creazione file batch per Windows...`)
    
    const ytdlpBatch = `@echo off
echo 🎵 [YT-DLP] Avvio yt-dlp...
python -m yt_dlp %*
pause`
    
    const youtubeDlBatch = `@echo off
echo 🎵 [YOUTUBE-DL] Avvio youtube-dl...
python -m youtube_dl %*
pause`
    
    fs.writeFileSync('yt-dlp.bat', ytdlpBatch)
    fs.writeFileSync('youtube-dl.bat', youtubeDlBatch)
    
    console.log(`✅ [BATCH] File batch creati: yt-dlp.bat, youtube-dl.bat`)
  }
}

async function testInstallation() {
  console.log(`🧪 [TEST] Test installazione...`)
  
  try {
    await runCommand('yt-dlp', ['--version'])
    console.log(`✅ [TEST] yt-dlp funziona correttamente`)
  } catch (error) {
    console.error(`❌ [TEST] yt-dlp non funziona:`, error.message)
    throw error
  }
  
  try {
    await runCommand('youtube-dl', ['--version'])
    console.log(`✅ [TEST] youtube-dl funziona correttamente`)
  } catch (error) {
    console.warn(`⚠️ [TEST] youtube-dl non funziona (opzionale):`, error.message)
  }
}

async function main() {
  try {
    console.log(`🚀 [INSTALL] Inizio installazione dipendenze YouTube Downloader...`)
    
    // 1. Verifica Python
    await installPython()
    
    // 2. Installa yt-dlp
    await installYtDlp()
    
    // 3. Installa youtube-dl (opzionale)
    try {
      await installYoutubeDl()
    } catch (error) {
      console.warn(`⚠️ [INSTALL] youtube-dl non installato (opzionale)`)
    }
    
    // 4. Verifica FFmpeg
    await installFFmpeg()
    
    // 5. Crea file batch per Windows
    await createBatchFiles()
    
    // 6. Test installazione
    await testInstallation()
    
    console.log(`🎉 [INSTALL] Installazione completata con successo!`)
    console.log(`📋 [INSTALL] Ora puoi usare il sistema avanzato di download YouTube`)
    
  } catch (error) {
    console.error(`❌ [INSTALL] Errore durante l'installazione:`, error.message)
    console.log(`💡 [INSTALL] Suggerimenti:`)
    console.log(`   - Assicurati di avere Python installato`)
    console.log(`   - Verifica la connessione internet`)
    console.log(`   - Prova ad eseguire come amministratore (Windows)`)
    console.log(`   - Su Linux/macOS, usa sudo se necessario`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { main }
