const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const https = require('https')
const fs = require('fs')

// ✅ AUTO-UPDATER: Importa il modulo auto-updater
const AppUpdater = require('./updater')

// ✅ FIX: Gestione globale errori per prevenire popup
process.on('uncaughtException', (error) => {
  // Gestisci errori EPIPE senza popup
  if (error.code === 'EPIPE') {
    console.log('🔧 [MAIN] EPIPE error handled gracefully - server disconnected')
    return
  }
  
  // Log altri errori ma non mostrare popup
  console.error('🔧 [MAIN] Uncaught exception:', error.message)
  writeLog('error', `Uncaught exception: ${error.message}`)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔧 [MAIN] Unhandled rejection at:', promise, 'reason:', reason)
  writeLog('error', `Unhandled rejection: ${reason}`)
})
let ffmpegPathResolved = null
try {
  // Prefer packaged ffmpeg when available
  // Replace app.asar path to the unpacked folder to allow executing the binary
  const ff = require('@ffmpeg-installer/ffmpeg')
  ffmpegPathResolved = ff && ff.path ? ff.path.replace('app.asar', 'app.asar.unpacked') : null
} catch (_) {
  ffmpegPathResolved = null
}

function writeLog(level, message) {
  try {
    const logDir = app ? app.getPath('userData') : process.cwd()
    const logFile = path.join(logDir, 'djconsole.log')
    const line = `[${new Date().toISOString()}] [${String(level).toUpperCase()}] ${message}\n`
    fs.appendFileSync(logFile, line, { encoding: 'utf8' })
    if (process.env.NODE_ENV === 'development') {
      console.log(line.trim())
    }
  } catch {}
}

function isUrlReachable(urlString, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(urlString)
      const client = urlObj.protocol === 'https:' ? https : http
      const req = client.get(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname || '/',
          timeout: timeoutMs,
          headers: { 'User-Agent': 'electron-healthcheck' }
        },
        (res) => {
          // Any response code means the dev server is up enough to load
          res.resume()
          resolve(true)
        }
      )
      req.on('timeout', () => {
        req.destroy(new Error('timeout'))
      })
      req.on('error', () => resolve(false))
    } catch (e) {
      resolve(false)
    }
  })
}

async function waitForFirstReachable(urls, totalTimeoutMs = 30000, intervalMs = 500) {
  const start = Date.now()
  let attemptIdx = 0
  while (Date.now() - start < totalTimeoutMs) {
    const url = urls[attemptIdx % urls.length]
    // eslint-disable-next-line no-await-in-loop
    const ok = await isUrlReachable(url, Math.min(intervalMs, 2500))
    if (ok) return url
    await new Promise((r) => setTimeout(r, intervalMs))
    attemptIdx += 1
  }
  return null
}

async function resolveDevServerUrl() {
  const envUrl = process.env.VITE_DEV_SERVER_URL
  const candidates = []
  if (envUrl) candidates.push(envUrl)
  // Common Vite ports and the ones we saw being used
  candidates.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:5173'
  )
  // Deduplicate preserving order
  const unique = [...new Set(candidates)]
  const found = await waitForFirstReachable(unique)
  return found
}

let mainWindow

// Funzione per ottenere la finestra principale (per l'updater)
function getMainWindow() {
  return mainWindow
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'DJ Console',
    backgroundColor: '#0b1221',
  })

  // Crash/unresponsive diagnostics
  try {
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      writeLog('error', `renderer gone: reason=${details.reason} exitCode=${details.exitCode}`)
    })
    mainWindow.webContents.on('unresponsive', () => {
      writeLog('warn', 'renderer unresponsive')
    })
    mainWindow.webContents.on('crashed', () => {
      writeLog('error', 'renderer crashed')
    })
  } catch {}

  // In dev, wait for Vite; in prod, load built index.html
  if (process.env.NODE_ENV === 'development') {
    resolveDevServerUrl()
      .then((url) => {
        if (url) {
          writeLog('info', `Loading dev URL: ${url}`)
          mainWindow.loadURL(url)
        } else {
          writeLog('warn', 'Dev server not reachable, loading local dist index.html')
          mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
        }
      })
      .catch(() => {
        writeLog('error', 'Failed to resolve dev server, loading local dist index.html')
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
      })
  } else {
    writeLog('info', 'Loading local dist index.html')
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    // no-op
  })
}

app.whenReady().then(() => {
  createWindow()
  
  // ✅ AUTO-UPDATER: Inizializza l'auto-updater
  new AppUpdater()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// --- Native Icecast streaming via ffmpeg ---
let ffmpegProc = null
let lastStartOptions = null

function buildFfmpegArgs(opts) {
  const {
    host,
    port,
    mount = '/live',
    username = 'source',
    password = '',
    bitrateKbps = 128,
    format = 'mp3',
    channels = 2,
    sampleRate = 44100,
    useSSL = false,
    stationName = 'DJ Console',
    stationDescription = 'Live',
    stationGenre = 'Various'
  } = opts

  const safeMount = mount.startsWith('/') ? mount : `/${mount}`
  // Use mount as provided (non forzare estensione). I fallback di estensione sono gestiti a monte
  let mountWithExt = safeMount
  
  // ✅ DEBUG: Log mount point configuration
  console.log('🔍 [FFMPEG] Mount point configuration:', {
    original: mount,
    safeMount: safeMount,
    mountWithExt: mountWithExt,
    host: host,
    port: port,
    username: username,
    password: password ? `[${password.length} chars]` : '[empty]'
  })
  
  const scheme = useSSL ? 'icecast+ssl' : 'icecast'
  const outUrl = `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}${mountWithExt}`
  
  // ✅ DEBUG: Log final URL (without password)
  console.log('🔍 [FFMPEG] Final Icecast URL:', outUrl.replace(/:([^@]+)@/, ':[HIDDEN]@'))

  // ✅ CORREZIONE: Input WebM da MediaRecorder invece di raw audio
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'webm',            // Input: WebM da MediaRecorder
    '-i', 'pipe:0',          // Input da stdin
    
    // ✅ CONFIGURAZIONE ULTRA-LATENZA per streaming continuo
    '-fflags', '+flush_packets',
    '-avoid_negative_ts', 'make_zero',
    '-max_muxing_queue_size', '64',     // Buffer minimo
    '-max_delay', '0',                  // Nessun delay
    '-probesize', '32',                 // Probe minimo
    '-analyzeduration', '0'             // Nessuna analisi
  ]

  // ✅ CONFIGURAZIONE DINAMICA BASATA SUL FORMATO
  let containerFmt = 'mp3'
  let contentType = 'audio/mpeg'
  
  if (format === 'ogg') {
    // ✅ OGG con Vorbis (non OPUS!)
    args.push(
      '-vn', '-map', 'a', 
      '-c:a', 'libvorbis',
      '-b:a', `${bitrateKbps}k`,
      '-ar', `${sampleRate}`,  // ✅ USA SAMPLE RATE DINAMICO
      '-ac', `${channels}`,     // ✅ USA CANALI DINAMICI
      '-q:a', '3'  // Qualità Vorbis
    )
    containerFmt = 'ogg'
    contentType = 'audio/ogg'
    console.log('🎵 [ELECTRON] Configurazione OGG Vorbis:', {
      codec: 'libvorbis',
      bitrate: `${bitrateKbps}k`,
      container: containerFmt,
      sampleRate: `${sampleRate}Hz`,
      channels: channels
    });
  } else if (format === 'aac') {
    args.push(
      '-vn', '-map', 'a', 
      '-c:a', 'aac',
      '-b:a', `${bitrateKbps}k`,
      '-ar', `${sampleRate}`,  // ✅ USA SAMPLE RATE DINAMICO
      '-ac', `${channels}`,     // ✅ USA CANALI DINAMICI
      '-profile:a', 'aac_low'
    )
    containerFmt = 'adts'
    contentType = 'audio/aac'
    console.log('🎵 [ELECTRON] Configurazione AAC:', {
      codec: 'aac',
      bitrate: `${bitrateKbps}k`,
      container: containerFmt,
      sampleRate: `${sampleRate}Hz`,
      channels: channels
    });
  } else if (format === 'opus') {
    // ✅ OPUS ULTRA-LATENZA per streaming continuo
    // OPUS supporta solo: 8000, 12000, 16000, 24000, 48000 Hz
    const opusSampleRate = sampleRate === 44100 ? 48000 : sampleRate
    args.push(
      '-vn', '-map', 'a', 
      '-c:a', 'libopus',
      '-b:a', `${bitrateKbps}k`,
      '-ar', `${opusSampleRate}`,              // ✅ USA SAMPLE RATE COMPATIBILE CON OPUS
      '-ac', `${channels}`,                    // ✅ USA CANALI DINAMICI
      '-application', 'lowdelay',              // ✅ ULTRA-LATENZA: lowdelay per latenza minima
      '-frame_duration', '2.5',                // ✅ ULTRA-LATENZA: 2.5ms frame ultra-corti
      '-compression_level', '0',               // ✅ ULTRA-LATENZA: compressione minima
      '-vbr', 'off',                           // ✅ Bitrate costante
      '-packet_loss', '0',                     // ✅ ULTRA-LATENZA: nessuna tolleranza perdita
      '-dtx', 'off'                            // ✅ Disabilita DTX per continuità
    )
    containerFmt = 'ogg'
    contentType = 'audio/ogg'
    console.log('⚡ [ELECTRON] Configurazione OPUS ULTRA-LATENZA:', {
      codec: 'libopus',
      bitrate: `${bitrateKbps}k`,
      container: containerFmt,
      sampleRate: `${opusSampleRate}Hz`,  // ✅ USA SAMPLE RATE CORRETTO
      channels: channels,
      application: 'lowdelay',
      frame_duration: '2.5ms',
      compression_level: '0',
      packet_loss: '0%',
      max_delay: '0ms'
    });
  } else {
    // default mp3
    args.push(
      '-vn', '-map', 'a', 
      '-c:a', 'libmp3lame',
      '-b:a', `${bitrateKbps}k`,
      '-ar', `${sampleRate}`,  // ✅ USA SAMPLE RATE DINAMICO
      '-ac', `${channels}`,     // ✅ USA CANALI DINAMICI
      '-q:a', '2'  // Qualità VBR
    )
    containerFmt = 'mp3'
    contentType = 'audio/mpeg'
    console.log('🎵 [ELECTRON] Configurazione MP3:', {
      codec: 'libmp3lame',
      bitrate: `${bitrateKbps}k`,
      container: containerFmt,
      sampleRate: `${sampleRate}Hz`,
      channels: channels
    });
  }

  // Icecast metadata fields at connect time
  args.push('-content_type', contentType)
  args.push('-ice_name', stationName)
  args.push('-ice_description', stationDescription)
  args.push('-ice_genre', stationGenre)
  args.push('-ice_public', '1')
  args.push('-legacy_icecast', '1')
  args.push('-f', containerFmt)
  args.push(outUrl)
  return args
}

ipcMain.handle('icecast-start', async (_evt, options) => {
  try {
    if (ffmpegProc) {
      return { ok: false, error: 'Already streaming' }
    }
      // ✅ LOGGING AVANZATO PER DEBUG CONNESSIONE
      console.log('🔍 [ELECTRON] icecast-start chiamato con opzioni:', options);
      
      lastStartOptions = options
      const ffmpegPath = process.env.FFMPEG_PATH || ffmpegPathResolved || 'ffmpeg'
      const args = buildFfmpegArgs(options)
      
      // ✅ LOGGING COMANDO COMPLETO
      console.log('🔍 [ELECTRON] Comando FFmpeg completo:', `${ffmpegPath} ${args.join(' ')}`);
      
      writeLog('info', `Starting ffmpeg: ${ffmpegPath} ${args.join(' ')}`)
      ffmpegProc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      
      // ✅ LOGGING PROCESSO FFMPEG
      console.log('🔍 [ELECTRON] Processo FFmpeg avviato con PID:', ffmpegProc.pid);
      
      // ✅ FIX: Notifica connessione riuscita dopo un breve delay
      setTimeout(() => {
        if (ffmpegProc && !ffmpegProc.killed && BrowserWindow.getAllWindows().length > 0) {
          console.log('✅ [ELECTRON] FFmpeg connesso con successo');
          BrowserWindow.getAllWindows()[0].webContents.send('ffmpeg-connected', {
            message: 'FFmpeg connesso e pronto per streaming'
          })
        }
      }, 2000) // 2 secondi di delay per permettere a FFmpeg di stabilire la connessione
      
      ffmpegProc.on('error', (err) => {
        writeLog('error', `ffmpeg spawn error: ${err.message}`)
        console.log('🔍 [ELECTRON] Errore spawn FFmpeg:', err.message);
        
        // ✅ FIX: Notifica al renderer che FFmpeg ha fallito
        if (BrowserWindow.getAllWindows().length > 0) {
          BrowserWindow.getAllWindows()[0].webContents.send('ffmpeg-error', {
            type: 'spawn_error',
            message: err.message
          })
        }
        
        ffmpegProc = null
      })
      
      ffmpegProc.on('close', (code) => {
        writeLog('warn', `ffmpeg exited with code ${code}`)
        console.log('🔍 [ELECTRON] FFmpeg terminato con codice:', code);
        
        // ✅ FIX: Notifica al renderer che FFmpeg si è disconnesso
        if (BrowserWindow.getAllWindows().length > 0) {
          BrowserWindow.getAllWindows()[0].webContents.send('ffmpeg-disconnected', {
            exitCode: code,
            reason: code === 0 ? 'normal_exit' : 'error_exit'
          })
        }
        
        ffmpegProc = null
      })
      
      // ✅ LOGGING STDOUT/STDERR FFMPEG
      ffmpegProc.stdout.on('data', (d) => {
        writeLog('info', `ffmpeg: ${String(d)}`)
        console.log('🔍 [FFMPEG STDOUT]:', String(d));
      })
      
      ffmpegProc.stderr.on('data', (d) => {
        const errorMsg = String(d)
        writeLog('error', `ffmpeg: ${errorMsg}`)
        console.log('🔍 [FFMPEG STDERR]:', errorMsg);
        
        // ✅ FIX: Analizza errori critici e notifica al renderer
        let criticalError = null
        
        if (errorMsg.includes('400') || errorMsg.includes('Bad Request')) {
          console.error('❌ [FFMPEG] 400 Bad Request detected - possible mount point or authentication issue')
          console.error('❌ [FFMPEG] Check mount point format and server configuration')
          criticalError = {
            type: 'bad_request',
            message: '400 Bad Request - Check mount point or authentication',
            details: errorMsg
          }
        }
        if (errorMsg.includes('Connection refused') || errorMsg.includes('timeout')) {
          console.error('❌ [FFMPEG] Connection issue - check server host/port')
          criticalError = {
            type: 'connection_refused',
            message: 'Connection refused - Check server host/port',
            details: errorMsg
          }
        }
        if (errorMsg.includes('Authentication failed') || errorMsg.includes('401') || errorMsg.includes('403')) {
          console.error('❌ [FFMPEG] Authentication issue - check username/password')
          criticalError = {
            type: 'authentication_failed',
            message: 'Authentication failed - Check username/password',
            details: errorMsg
          }
        }
        if (errorMsg.includes('Connection to tcp://') && errorMsg.includes('failed')) {
          console.error('❌ [FFMPEG] TCP connection failed')
          criticalError = {
            type: 'tcp_connection_failed',
            message: 'TCP connection failed - Server unreachable',
            details: errorMsg
          }
        }
        
        // ✅ FIX: Notifica errori critici al renderer
        if (criticalError && BrowserWindow.getAllWindows().length > 0) {
          BrowserWindow.getAllWindows()[0].webContents.send('ffmpeg-error', criticalError)
        }
      })

    return { ok: true }
  } catch (e) {
    writeLog('error', `icecast-start error: ${e.message}`)
    ffmpegProc = null
    return { ok: false, error: e.message }
  }
})

ipcMain.on('icecast-write', (_evt, chunk) => {
  if (ffmpegProc && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
    try {
      // chunk can be Buffer or ArrayBuffer from renderer
      let buf
      if (Buffer.isBuffer(chunk)) buf = chunk
      else if (chunk && chunk.byteLength !== undefined) buf = Buffer.from(new Uint8Array(chunk))
      else buf = Buffer.from(String(chunk))
      
      ffmpegProc.stdin.write(buf, (err) => {
        if (err) {
          // ✅ FIX: Gestisci EPIPE senza crash
          if (err.code === 'EPIPE') {
            writeLog('warn', 'ffmpeg stdin pipe broken (EPIPE) - server disconnected')
            // Notifica al renderer che la connessione è persa
            if (ffmpegProc) {
              ffmpegProc = null
            }
          } else {
            writeLog('error', `ffmpeg write error: ${err.message}`)
          }
        }
      })
    } catch (e) {
      // ✅ FIX: Gestisci errori di scrittura senza crash
      if (e.code === 'EPIPE') {
        writeLog('warn', 'ffmpeg stdin pipe broken (EPIPE) - server disconnected')
      } else {
        writeLog('error', `ffmpeg write error: ${e.message}`)
      }
    }
  }
})

// ✅ NUOVO: Handler per streaming continuo
ipcMain.on('icecast-write-continuous', (_evt, audioData) => {
  if (ffmpegProc && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
    try {
      // Converte i dati audio in formato raw per FFmpeg
      const buffer = Buffer.from(audioData)
      ffmpegProc.stdin.write(buffer, (err) => {
        if (err) {
          // ✅ FIX: Gestisci EPIPE senza crash
          if (err.code === 'EPIPE') {
            writeLog('warn', 'ffmpeg continuous stdin pipe broken (EPIPE) - server disconnected')
            if (ffmpegProc) {
              ffmpegProc = null
            }
          } else {
            writeLog('error', `ffmpeg continuous write error: ${err.message}`)
          }
        }
      })
    } catch (e) {
      // ✅ FIX: Gestisci errori di scrittura senza crash
      if (e.code === 'EPIPE') {
        writeLog('warn', 'ffmpeg continuous stdin pipe broken (EPIPE) - server disconnected')
      } else {
        writeLog('error', `ffmpeg continuous write error: ${e.message}`)
      }
    }
  }
})

// ✅ NUOVO: Handler per chunk audio dal MediaRecorder
ipcMain.on('icecast-write-chunk', (_evt, chunkData) => {
  if (ffmpegProc && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
    try {
      // Converte i dati del chunk in Buffer per FFmpeg
      const buffer = Buffer.from(chunkData)
      ffmpegProc.stdin.write(buffer, (err) => {
        if (err) {
          // ✅ FIX: Gestisci EPIPE senza crash
          if (err.code === 'EPIPE') {
            writeLog('warn', 'ffmpeg chunk stdin pipe broken (EPIPE) - server disconnected')
            if (ffmpegProc) {
              ffmpegProc = null
            }
          } else {
            writeLog('error', `ffmpeg chunk write error: ${err.message}`)
          }
        } else {
          writeLog('debug', `ffmpeg chunk written: ${buffer.length} bytes`)
        }
      })
    } catch (e) {
      // ✅ FIX: Gestisci errori di scrittura senza crash
      if (e.code === 'EPIPE') {
        writeLog('warn', 'ffmpeg chunk stdin pipe broken (EPIPE) - server disconnected')
      } else {
        writeLog('error', `ffmpeg chunk write error: ${e.message}`)
      }
    }
  }
})

ipcMain.handle('icecast-stop', async () => {
  try {
    if (ffmpegProc) {
      try { ffmpegProc.stdin.end() } catch {}
      try { ffmpegProc.kill('SIGINT') } catch {}
      writeLog('info', 'Stopped ffmpeg via IPC')
      ffmpegProc = null
    }
    return { ok: true }
  } catch (e) {
    writeLog('error', `icecast-stop error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('icecast-metadata', async (_evt, meta) => {
  try {
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ✅ NUOVO: Handler per pausa/ripresa input FFmpeg
ipcMain.handle('icecast-pause-input', async () => {
  try {
    writeLog('info', 'icecast-pause-input: Pausa input FFmpeg')
    
    // ✅ FIX: Pausa l'input di FFmpeg senza fermare il processo
    if (ffmpegProcess && ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
      // Chiudi temporaneamente stdin per pausare l'input
      ffmpegProcess.stdin.pause()
      writeLog('info', 'icecast-pause-input: FFmpeg stdin pausato')
    }
    
    return { ok: true }
  } catch (e) {
    writeLog('error', `icecast-pause-input error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('icecast-resume-input', async () => {
  try {
    writeLog('info', 'icecast-resume-input: Ripresa input FFmpeg')
    
    // ✅ FIX: Riprendi l'input di FFmpeg
    if (ffmpegProcess && ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
      // Riapri stdin per riprendere l'input
      ffmpegProcess.stdin.resume()
      writeLog('info', 'icecast-resume-input: FFmpeg stdin ripreso')
    }
    
    return { ok: true }
  } catch (e) {
    writeLog('error', `icecast-resume-input error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

// ✅ NUOVO: Handler per StreamingManager startStreaming
ipcMain.handle('start-streaming', async (_evt, config) => {
  try {
    console.log('🔍 [MAIN] start-streaming chiamato con config:', config)
    
    // Mappa i parametri del StreamingManager al formato di icecast-start
    const icecastOptions = {
      host: config.host,
      port: config.port,
      mount: config.mountpoint || config.mount, // ✅ USA MOUNTPOINT CORRETTO
      username: config.username,
      password: config.password,
      useSSL: config.useSSL || false,
      bitrateKbps: config.bitrate || 128,
      format: config.format || 'mp3',  // ✅ USA FORMATO DALLE IMPOSTAZIONI
      channels: config.channels || 2,
      sampleRate: config.sampleRate || 44100,
      stationName: config.stationName || 'DJ Console Pro',
      stationDescription: config.stationDescription || 'Live Stream',
      stationGenre: 'Various'
    }
    
    console.log('🔍 [MAIN] Mapping to icecast options:', icecastOptions)
    
    // ✅ CHIAMA DIRETTAMENTE LA LOGICA DI icecast-start
    if (ffmpegProc) {
      return { ok: false, error: 'Already streaming' }
    }
    
    lastStartOptions = icecastOptions
    const ffmpegPath = process.env.FFMPEG_PATH || ffmpegPathResolved || 'ffmpeg'
    const args = buildFfmpegArgs(icecastOptions)
    
    console.log('🔍 [MAIN] Comando FFmpeg completo:', `${ffmpegPath} ${args.join(' ')}`)
    
    writeLog('info', `Starting ffmpeg: ${ffmpegPath} ${args.join(' ')}`)
    ffmpegProc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    
    console.log('🔍 [MAIN] Processo FFmpeg avviato con PID:', ffmpegProc.pid)
    
    ffmpegProc.on('error', (err) => {
      writeLog('error', `ffmpeg spawn error: ${err.message}`)
      console.log('🔍 [MAIN] Errore spawn FFmpeg:', err.message)
      
      // ✅ FIX: Notifica al renderer che FFmpeg ha fallito
      if (BrowserWindow.getAllWindows().length > 0) {
        BrowserWindow.getAllWindows()[0].webContents.send('ffmpeg-error', {
          type: 'spawn_error',
          message: err.message
        })
      }
      
      ffmpegProc = null
    })
    
    ffmpegProc.on('close', (code) => {
      writeLog('warn', `ffmpeg exited with code ${code}`)
      console.log('🔍 [MAIN] FFmpeg terminato con codice:', code)
      
      // ✅ FIX: Notifica al renderer che FFmpeg si è disconnesso
      if (BrowserWindow.getAllWindows().length > 0) {
        BrowserWindow.getAllWindows()[0].webContents.send('ffmpeg-disconnected', {
          exitCode: code,
          reason: code === 0 ? 'normal_exit' : 'error_exit'
        })
      }
      
      ffmpegProc = null
    })
    
    ffmpegProc.stdout.on('data', (d) => {
      writeLog('info', `ffmpeg: ${String(d)}`)
      console.log('🔍 [FFMPEG STDOUT]:', String(d))
    })
    
    ffmpegProc.stderr.on('data', (d) => {
      const errorMsg = String(d)
      writeLog('error', `ffmpeg: ${errorMsg}`)
      console.log('🔍 [FFMPEG STDERR]:', errorMsg)
      
      // ✅ FIX: Analizza errori critici e notifica al renderer
      let criticalError = null
      
      if (errorMsg.includes('400') || errorMsg.includes('Bad Request')) {
        console.error('❌ [FFMPEG] 400 Bad Request detected - possible mount point or authentication issue')
        criticalError = {
          type: 'bad_request',
          message: '400 Bad Request - Check mount point or authentication',
          details: errorMsg
        }
      }
      if (errorMsg.includes('Connection refused') || errorMsg.includes('timeout')) {
        console.error('❌ [FFMPEG] Connection issue - check server host/port')
        criticalError = {
          type: 'connection_refused',
          message: 'Connection refused - Check server host/port',
          details: errorMsg
        }
      }
      if (errorMsg.includes('Authentication failed') || errorMsg.includes('401') || errorMsg.includes('403')) {
        console.error('❌ [FFMPEG] Authentication issue - check username/password')
        criticalError = {
          type: 'authentication_failed',
          message: 'Authentication failed - Check username/password',
          details: errorMsg
        }
      }
      if (errorMsg.includes('Connection to tcp://') && errorMsg.includes('failed')) {
        console.error('❌ [FFMPEG] TCP connection failed')
        criticalError = {
          type: 'tcp_connection_failed',
          message: 'TCP connection failed - Server unreachable',
          details: errorMsg
        }
      }
      if (errorMsg.includes('Invalid data found')) {
        console.error('❌ [FFMPEG] Invalid data - possible format/codec issue')
        criticalError = {
          type: 'invalid_data',
          message: 'Invalid data - Check audio format/codec',
          details: errorMsg
        }
      }
      if (errorMsg.includes('No such file or directory')) {
        console.error('❌ [FFMPEG] File not found - check FFmpeg installation')
        criticalError = {
          type: 'file_not_found',
          message: 'FFmpeg not found - Check installation',
          details: errorMsg
        }
      }
      
      // ✅ FIX: Notifica errori critici al renderer
      if (criticalError && BrowserWindow.getAllWindows().length > 0) {
        BrowserWindow.getAllWindows()[0].webContents.send('ffmpeg-error', criticalError)
      }
    })

    console.log('✅ [MAIN] start-streaming completed successfully')
    return { ok: true }
    
  } catch (e) {
    console.error('❌ [MAIN] start-streaming error:', e.message)
    ffmpegProc = null
    return { ok: false, error: e.message }
  }
})

// ✅ NUOVO: Handler per notificare perdita connessione al renderer
ipcMain.handle('notify-connection-lost', async (_evt, reason) => {
  try {
    writeLog('warn', `Connection lost: ${reason}`)
    console.log('🔧 [MAIN] Connection lost notification:', reason)
    return { ok: true }
  } catch (e) {
    writeLog('error', `notify-connection-lost error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

// Renderer logs bridge
ipcMain.on('log', (_evt, { level, msg }) => {
  writeLog(level || 'info', `renderer: ${msg}`)
})

// Save audio to app data (Electron)
ipcMain.handle('save-audio', async (_evt, { id, name, arrayBuffer }) => {
  try {
    const dir = path.join(app.getPath('userData'), 'audio')
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    const safe = String(name || id).replace(/[^a-z0-9._-]+/gi, '_')
    const filePath = path.join(dir, `${safe}`)
    const buf = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buf)
    writeLog('info', `Saved audio file ${filePath} (${buf.length} bytes)`) 
    return { ok: true, path: filePath }
  } catch (e) {
    writeLog('error', `save-audio error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

// Simple JSON DB (Electron only)
ipcMain.handle('db-load', async () => {
  try {
    const dir = path.join(app.getPath('userData'))
    const filePath = path.join(dir, 'database.json')
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(raw)
      writeLog('info', `db-load ok (${raw.length} bytes)`)
      return { ok: true, data }
    }
    writeLog('info', 'db-load: no existing database.json, returning empty')
    return { ok: true, data: null }
  } catch (e) {
    writeLog('error', `db-load error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('db-save', async (_evt, payload) => {
  try {
    const dir = path.join(app.getPath('userData'))
    const filePath = path.join(dir, 'database.json')
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    const json = JSON.stringify(payload || {}, null, 2)
    fs.writeFileSync(filePath, json, 'utf8')
    writeLog('info', `db-save ok (${json.length} bytes) -> ${filePath}`)
    return { ok: true }
  } catch (e) {
    writeLog('error', `db-save error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

// Esporta la funzione per l'updater
module.exports = { getMainWindow }


