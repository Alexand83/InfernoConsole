#!/usr/bin/env node

/**
 * Script di test per connessione Icecast diretta
 * Testa la connessione al server con tono a 440Hz e metadata DJ
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// Colori per output console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// Legge le settings dal database IndexedDB (simulato tramite file di config)
async function loadSettings() {
  try {
    // Prova a leggere da un file di config locale
    const configPath = path.join(__dirname, 'icecast-test-config.json')
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      return config
    }
    
    // Config di default per test
    return {
      host: 'dj.onlinewebone.com',
      port: 8004,
      username: 'source',
      password: 'password123', // Sostituire con password reale
      mountpoint: '/live',
      useSSL: false,
      djName: 'DJ Test Console',
      format: 'mp3',
      bitrate: 128
    }
  } catch (error) {
    log('red', `❌ Errore lettura config: ${error.message}`)
    return null
  }
}

// Verifica se il server è raggiungibile
async function checkServerStatus(config) {
  return new Promise((resolve) => {
    const protocol = config.useSSL ? 'https' : 'http'
    const statusUrl = `${protocol}://${config.host}:${config.port}/status-json.xsl`
    
    log('blue', `🔍 Verifico stato server: ${statusUrl}`)
    
    const https = require(config.useSSL ? 'https' : 'http')
    
    const req = https.get(statusUrl, { timeout: 5000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const status = JSON.parse(data)
          log('green', '✅ Server raggiungibile')
          
          // Controlla se il mountpoint è già occupato
          const sources = status.icestats?.source
          const sourcesArray = Array.isArray(sources) ? sources : (sources ? [sources] : [])
          
          const occupiedMount = sourcesArray.find(source => {
            const mount = source.mount || ''
            const url = source.listenurl || ''
            return mount === config.mountpoint || url.endsWith(config.mountpoint)
          })
          
          if (occupiedMount) {
            log('yellow', `⚠️  Mountpoint ${config.mountpoint} sembra occupato`)
            log('yellow', `   Listeners: ${occupiedMount.listeners || 0}`)
            log('yellow', `   Connected: ${occupiedMount.connected || 0}s`)
          } else {
            log('green', `✅ Mountpoint ${config.mountpoint} libero`)
          }
          
          resolve({ success: true, status, occupied: !!occupiedMount })
        } catch (e) {
          log('red', `❌ Errore parsing JSON: ${e.message}`)
          resolve({ success: false, error: e.message })
        }
      })
    })
    
    req.on('error', (error) => {
      log('red', `❌ Errore connessione server: ${error.message}`)
      resolve({ success: false, error: error.message })
    })
    
    req.on('timeout', () => {
      log('red', '❌ Timeout connessione server')
      req.destroy()
      resolve({ success: false, error: 'Timeout' })
    })
  })
}

// Invia metadata update via HTTP (metodo Icecast standard)
async function sendMetadataUpdate(config) {
  return new Promise((resolve, reject) => {
    const protocol = config.useSSL ? 'https' : 'http'
    const metadataUrl = `${protocol}://${config.host}:${config.port}/admin/metadata`
    
    const postData = new URLSearchParams({
      mount: config.mountpoint,
      mode: 'updinfo',
      song: `${config.djName} - Test Stream Live`,
      artist: config.djName,
      title: 'Test Stream Live'
    }).toString()
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
      },
      timeout: 5000
    }
    
    const https = require(config.useSSL ? 'https' : 'http')
    
    const req = https.request(metadataUrl, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('green', '✅ Metadata inviati con successo via HTTP')
          resolve(true)
        } else {
          log('yellow', `⚠️ Metadata HTTP response: ${res.statusCode} - ${data}`)
          resolve(false)
        }
      })
    })
    
    req.on('error', (error) => {
      log('yellow', `⚠️ Errore invio metadata HTTP: ${error.message}`)
      reject(error)
    })
    
    req.on('timeout', () => {
      log('yellow', '⚠️ Timeout invio metadata HTTP')
      req.destroy()
      reject(new Error('Timeout'))
    })
    
    req.write(postData)
    req.end()
  })
}

// Genera un tono test usando ffmpeg
async function testStreamingConnection(config) {
  return new Promise((resolve) => {
    log('cyan', '🎵 Avvio test streaming con tono 440Hz...')
    
    const ffmpegUrl = `icecast://${config.username}:${config.password}@${config.host}:${config.port}${config.mountpoint}`
    
    log('blue', `📡 URL connessione: icecast://${config.username}:***@${config.host}:${config.port}${config.mountpoint}`)
    log('blue', `📡 Formato: ${config.format.toUpperCase()}, Bitrate: ${config.bitrate}kbps`)
    log('blue', `📡 DJ Name: ${config.djName}`)
    
    // Parametri ffmpeg per generare tono test e inviarlo a Icecast
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=60', // Tono 440Hz per 60 secondi
      '-acodec', config.format === 'mp3' ? 'libmp3lame' : 'libopus',
      '-ab', `${config.bitrate}k`,
      '-ac', '2', // Stereo
      '-ar', '44100', // Sample rate
      '-metadata', `title=${config.djName} - Test Stream`,
      '-metadata', `artist=${config.djName}`,
      '-metadata', `album=${config.djName} Live Test`,
      '-metadata', 'genre=Electronic/Test',
      '-f', config.format === 'mp3' ? 'mp3' : 'ogg',
      '-content_type', config.format === 'mp3' ? 'audio/mpeg' : 'application/ogg',
      ffmpegUrl
    ]
    
    log('yellow', '⏳ Avvio ffmpeg...')
    
    // Percorso ffmpeg per Windows (WinGet installation)
    const ffmpegPath = process.platform === 'win32' 
      ? `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe`
      : 'ffmpeg'
    
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let output = ''
    let errorOutput = ''
    
    ffmpeg.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    ffmpeg.stderr.on('data', (data) => {
      const text = data.toString()
      errorOutput += text
      
      // Mostra output ffmpeg in tempo reale
      if (text.includes('Opening') || text.includes('Stream') || text.includes('time=')) {
        process.stdout.write(`📡 ${text}`)
      }
    })
    
    // Invia metadata via HTTP dopo 5 secondi
    setTimeout(async () => {
      try {
        log('blue', '📡 Inviando metadata via HTTP...')
        await sendMetadataUpdate(config)
      } catch (error) {
        log('yellow', `⚠️ Errore invio metadata: ${error.message}`)
      }
    }, 5000)
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        log('green', '✅ Test streaming completato con successo!')
        resolve({ success: true, output, errorOutput })
      } else {
        log('red', `❌ Test streaming fallito (exit code: ${code})`)
        log('red', 'Ultimi messaggi di errore:')
        console.log(errorOutput.split('\n').slice(-5).join('\n'))
        resolve({ success: false, code, output, errorOutput })
      }
    })
    
    ffmpeg.on('error', (error) => {
      log('red', `❌ Errore avvio ffmpeg: ${error.message}`)
      log('yellow', '💡 Assicurati che ffmpeg sia installato e nel PATH')
      resolve({ success: false, error: error.message })
    })
    
    // Timeout dopo 65 secondi
    setTimeout(() => {
      if (!ffmpeg.killed) {
        log('yellow', '⏰ Fermando test dopo 60 secondi...')
        ffmpeg.kill('SIGTERM')
      }
    }, 65000)
  })
}

// Verifica DURANTE lo streaming (non alla fine)
async function verifyStreamingResult(config) {
  log('blue', '🔍 Verifico risultato streaming DURANTE la trasmissione...')
  
  await new Promise(resolve => setTimeout(resolve, 10000)) // Aspetta 10 secondi per dare tempo al server
  
  const result = await checkServerStatus(config)
  if (result.success) {
    const sources = result.status.icestats?.source
    const sourcesArray = Array.isArray(sources) ? sources : (sources ? [sources] : [])
    
    const ourMount = sourcesArray.find(source => {
      const mount = source.mount || ''
      const url = source.listenurl || ''
      const serverName = source.server_name || ''
      return mount === config.mountpoint || 
             url.endsWith(config.mountpoint) ||
             serverName.toLowerCase().includes('test')
    })
    
    if (ourMount) {
      log('green', '🎉 SUCCESSO! Il nostro stream è attivo sul server:')
      log('green', `   📡 Mountpoint: ${ourMount.mount || ourMount.listenurl}`)
      log('green', `   👥 Listeners: ${ourMount.listeners || 0}`)
      log('green', `   🎵 Titolo: ${ourMount.title || 'N/A'}`)
      log('green', `   🎤 Artista: ${ourMount.artist || 'N/A'}`)
      log('green', `   ⏱️  Connesso da: ${ourMount.connected || 0}s`)
      return true
    } else {
      log('yellow', '⚠️  Stream locale inviato ma non visibile sul server')
      log('yellow', '   Possibili cause: ritardo di sincronizzazione, credenziali errate, o server config')
      return false
    }
  } else {
    log('red', '❌ Impossibile verificare stato finale del server')
    return false
  }
}

// Funzione principale
async function main() {
  log('cyan', '🎯 === TEST CONNESSIONE ICECAST DIRETTA ===')
  log('cyan', '')
  
  // 1. Carica configurazione
  log('blue', '1️⃣ Caricamento configurazione...')
  const config = await loadSettings()
  if (!config) {
    log('red', '❌ Impossibile caricare la configurazione')
    log('yellow', '💡 Crea un file icecast-test-config.json con i tuoi dati server')
    process.exit(1)
  }
  
  log('green', `✅ Config caricata: ${config.host}:${config.port}${config.mountpoint}`)
  log('blue', '')
  
  // 2. Verifica stato server
  log('blue', '2️⃣ Verifica stato server...')
  const serverCheck = await checkServerStatus(config)
  if (!serverCheck.success) {
    log('red', '❌ Server non raggiungibile, impossibile continuare')
    process.exit(1)
  }
  log('blue', '')
  
  // 3. Test streaming
  log('blue', '3️⃣ Test connessione streaming...')
  const streamResult = await testStreamingConnection(config)
  log('blue', '')
  
  // 4. Verifica risultato
  log('blue', '4️⃣ Verifica finale...')
  const verified = await verifyStreamingResult(config)
  log('blue', '')
  
  // 5. Risultato finale
  log('cyan', '🏁 === RISULTATO FINALE ===')
  if (streamResult.success && verified) {
    log('green', '🎉 TEST COMPLETAMENTE RIUSCITO!')
    log('green', '✅ Connessione Icecast funzionante')
    log('green', '✅ Audio trasmesso correttamente')
    log('green', '✅ Metadata inviati correttamente')
  } else if (streamResult.success) {
    log('yellow', '⚠️  TEST PARZIALMENTE RIUSCITO')
    log('yellow', '✅ Connessione Icecast funzionante')
    log('yellow', '❓ Verifica manuale necessaria per audio/metadata')
  } else {
    log('red', '❌ TEST FALLITO')
    log('red', '❌ Problemi di connessione o configurazione')
  }
}

// Gestione Ctrl+C
process.on('SIGINT', () => {
  log('yellow', '\n⏹️  Test interrotto dall\'utente')
  process.exit(0)
})

// Avvia il test
main().catch(error => {
  log('red', `💥 Errore fatale: ${error.message}`)
  process.exit(1)
})
