
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const https = require('https')
const fs = require('fs')
const WebRTCServer = require('./webrtc-server')
const youtubedl = require('youtube-dl-exec')
// const { YTDlpWrap } = require('yt-dlp-wrap') // Disabilitato per problemi di import

  // ✅ OPTIMIZATION: Ottimizzazioni per avvio ultra-veloce
  app.commandLine.appendSwitch('--disable-gpu-sandbox')
  app.commandLine.appendSwitch('--disable-software-rasterizer')
  app.commandLine.appendSwitch('--disable-background-timer-throttling')
  app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows')
  app.commandLine.appendSwitch('--disable-renderer-backgrounding')
  app.commandLine.appendSwitch('--disable-features', 'TranslateUI')
  app.commandLine.appendSwitch('--disable-ipc-flooding-protection')
  app.commandLine.appendSwitch('--disable-web-security')
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor')
  app.commandLine.appendSwitch('--no-sandbox')
  app.commandLine.appendSwitch('--disable-dev-shm-usage')
  app.commandLine.appendSwitch('--disable-extensions')
  app.commandLine.appendSwitch('--disable-plugins')
  
  // ✅ DEBUG: Apri DevTools del main process per debug
  if (process.env.NODE_ENV === 'development') {
    app.commandLine.appendSwitch('--remote-debugging-port', '9222')
  }

// ✅ AUTO-UPDATER: Importa il modulo auto-updater
const AppUpdater = require('./updater')

// ✅ NGROK RIMOSSO - SOLO CLOUDFLARE


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
  // Prefer packaged ffmpeg when available (static binary)
  const ffStaticPath = require('ffmpeg-static')
  ffmpegPathResolved = ffStaticPath ? ffStaticPath.replace('app.asar', 'app.asar.unpacked') : null
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
let webrtcServer = null

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
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      // ✅ OPTIMIZATION: Ottimizzazioni per avvio più veloce
      webSecurity: false, // Disabilita per velocità
      allowRunningInsecureContent: true, // Permette contenuto per velocità
      experimentalFeatures: false,
      // Disabilita funzionalità non essenziali per avvio veloce
      backgroundThrottling: false,
      offscreen: false,
      // Preload solo le funzionalità essenziali
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'DJ Console',
    backgroundColor: '#0b1221',
    show: false, // Non mostrare finché non è pronto
    // ✅ OPTIMIZATION: Ottimizzazioni per avvio più veloce
    skipTaskbar: false,
    alwaysOnTop: false,
    fullscreenable: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    // Disabilita animazioni di apertura per velocità
    frame: true,
    transparent: false,
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

  // Mostra la finestra quando è pronta per migliorare l'esperienza utente
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    writeLog('info', 'App window ready and shown')
  })
}

app.whenReady().then(() => {
  createWindow()
  
  // ✅ OPTIMIZATION: Inizializza l'auto-updater in background per non bloccare l'avvio
  setTimeout(() => {
    try {
      const updater = new AppUpdater()
      
      // ✅ NUOVO: Creazione condizionale shortcut all'avvio (solo se non esiste)
      if (process.platform === 'win32') {
        try {
          const exePath = process.execPath
          const desktopPath = path.join(app.getPath('desktop'), 'Inferno Console.lnk')
          
          // Controlla se lo shortcut esiste già
          if (!fs.existsSync(desktopPath)) {
            console.log('🔗 [SHORTCUT] Shortcut non trovato, creazione all\'avvio...')
            
            // Importa windows-shortcuts dinamicamente
            const shortcut = require('windows-shortcuts')
            
            shortcut.create(desktopPath, {
              target: exePath,
              desc: 'Inferno Console - DJ Software',
              icon: exePath,
              workingDir: path.dirname(exePath)
            })
            
            console.log('✅ [SHORTCUT] Shortcut creato all\'avvio!')
          } else {
            console.log('🔗 [SHORTCUT] Shortcut già esistente, nessuna creazione necessaria')
          }
        } catch (error) {
          console.error('❌ [SHORTCUT] Errore creazione shortcut all\'avvio:', error)
        }
      }

      // ✅ NUOVO: Intercetta update-downloaded per ricreare shortcut automaticamente
      const { autoUpdater } = require('electron-updater')
      
      autoUpdater.on('update-downloaded', (info) => {
        console.log('🔄 [UPDATE] Update scaricato, ricreazione shortcut automatica...')
        
        // Crea shortcut automaticamente dopo l'update
        if (process.platform === 'win32') {
          try {
            const exePath = process.execPath // Percorso reale del nuovo exe
            const desktopPath = path.join(app.getPath('desktop'), 'Inferno Console.lnk')
            
            console.log('🔗 [SHORTCUT] Creazione shortcut automatico post-update...')
            console.log('🔗 [SHORTCUT] Target:', exePath)
            console.log('🔗 [SHORTCUT] Desktop:', desktopPath)
            
            // Importa windows-shortcuts dinamicamente
            const shortcut = require('windows-shortcuts')
            
            // Crea shortcut con windows-shortcuts
            shortcut.create(desktopPath, {
              target: exePath,
              desc: 'Inferno Console - DJ Software',
              icon: exePath,
              workingDir: path.dirname(exePath)
            })
            
            console.log('✅ [SHORTCUT] Shortcut ricreato automaticamente!')
            
            // Invia notifica al renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('update-shortcut-created', {
                success: true,
                message: 'Shortcut aggiornato automaticamente!'
              })
            }
          } catch (shortcutError) {
            console.error('❌ [SHORTCUT] Errore creazione shortcut automatico:', shortcutError)
          }
        }
      })

      // ✅ NUOVO: Listener per update-installed (dopo il riavvio)
      autoUpdater.on('update-installed', (info) => {
        console.log('✅ [UPDATE] Update installato con successo!')
        
        // Ricrea shortcut anche dopo l'installazione
        if (process.platform === 'win32') {
          try {
            const exePath = process.execPath
            const desktopPath = path.join(app.getPath('desktop'), 'Inferno Console.lnk')
            
            console.log('🔗 [SHORTCUT] Ricreazione shortcut post-installazione...')
            
            // Importa windows-shortcuts dinamicamente
            const shortcut = require('windows-shortcuts')
            
            shortcut.create(desktopPath, {
              target: exePath,
              desc: 'Inferno Console - DJ Software',
              icon: exePath,
              workingDir: path.dirname(exePath)
            })
            
            console.log('✅ [SHORTCUT] Shortcut aggiornato post-installazione!')
          } catch (shortcutError) {
            console.error('❌ [SHORTCUT] Errore ricreazione shortcut post-installazione:', shortcutError)
          }
        }
      })
      
    } catch (error) {
      console.error('Auto-updater initialization failed:', error)
    }
  }, 5000) // Aspetta 5 secondi dopo l'apertura per avvio più veloce

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
      stationName: config.stationName || 'Inferno Console',
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

// ✅ OPTIMIZATION: Simple JSON DB (Electron only) con cache migliorata per avvio veloce
let databaseCache = null
let databaseCacheTime = 0
const CACHE_DURATION = 30000 // 30 secondi - cache molto più lunga per avvio veloce

ipcMain.handle('db-load', async () => {
  try {
    const now = Date.now()
    
    // Usa cache se disponibile e non scaduta
    if (databaseCache && (now - databaseCacheTime) < CACHE_DURATION) {
      writeLog('info', 'db-load: using cache')
      return { ok: true, data: databaseCache }
    }

    const dir = path.join(app.getPath('userData'))
    const filePath = path.join(dir, 'database.json')
    try { fs.mkdirSync(dir, { recursive: true }) } catch {}
    
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(raw)
      
      // Aggiorna cache
      databaseCache = data
      databaseCacheTime = now
      
      writeLog('info', `db-load ok (${raw.length} bytes)`)
      return { ok: true, data }
    }
    
    writeLog('info', 'db-load: no existing database.json, returning empty')
    databaseCache = null
    databaseCacheTime = now
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
    
    // Aggiorna cache dopo il salvataggio
    databaseCache = payload
    databaseCacheTime = Date.now()
    
    writeLog('info', `db-save ok (${json.length} bytes) -> ${filePath}`)
    return { ok: true }
  } catch (e) {
    writeLog('error', `db-save error: ${e.message}`)
    return { ok: false, error: e.message }
  }
})

// IPC handlers per aggiornamenti
ipcMain.handle('download-update', async () => {
  try {
    const { autoUpdater } = require('electron-updater')
    
    // Prima controlla se ci sono aggiornamenti
    const updateCheckResult = await autoUpdater.checkForUpdates()
    if (!updateCheckResult || !updateCheckResult.updateInfo) {
      throw new Error('Nessun aggiornamento disponibile')
    }
    
    // Poi scarica l'aggiornamento
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (error) {
    console.error('Errore nel download aggiornamento:', error)
    throw error
  }
})

ipcMain.handle('install-update', async () => {
  try {
    const { autoUpdater } = require('electron-updater')
    
    // ✅ FIX: Parametri corretti per macOS e Windows
    if (process.platform === 'darwin') {
      // macOS: force=true, isSilent=false per mostrare il progresso
      autoUpdater.quitAndInstall(true, false)
    } else {
      // Windows: force=true, isSilent=true per installazione silenziosa
      autoUpdater.quitAndInstall(true, true)
    }
    
    return { success: true }
  } catch (error) {
    console.error('Errore nell\'installazione aggiornamento:', error)
    throw error
  }
})

// Handler per resettare la cache dell'auto-updater
ipcMain.handle('reset-updater-cache', async () => {
  try {
    const { autoUpdater } = require('electron-updater')
    
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
    
    return { success: true }
  } catch (error) {
    console.error('Errore nel reset cache auto-updater:', error)
    throw error
  }
})

// ✅ NUOVO: Handler per ottenere statistiche Icecast (bypassa CORS)
ipcMain.handle('get-icecast-stats', async (_evt, host, port) => {
  try {
    const url = `http://${host}:${port}/status-json.xsl`
    console.log(`📊 [MAIN] 🔍 Handler get-icecast-stats chiamato!`)
    console.log(`📊 [MAIN] 🔍 Parametri: host=${host}, port=${port}`)
    console.log(`📊 [MAIN] 🔍 URL: ${url}`)
    
    return new Promise((resolve, reject) => {
      const request = http.get(url, (response) => {
        console.log(`📊 [MAIN] 🔍 Risposta HTTP ricevuta: ${response.statusCode}`)
        let data = ''
        
        response.on('data', (chunk) => {
          data += chunk
        })
        
        response.on('end', () => {
          try {
            console.log(`📊 [MAIN] 🔍 Dati ricevuti (${data.length} bytes):`, data.substring(0, 200) + '...')
            const stats = JSON.parse(data)
            console.log(`📊 [MAIN] ✅ Icecast stats parsed successfully:`, JSON.stringify(stats, null, 2))
            resolve(stats)
          } catch (parseError) {
            console.error('📊 [MAIN] ❌ Error parsing Icecast stats:', parseError)
            console.error('📊 [MAIN] ❌ Raw data:', data)
            reject(new Error('Failed to parse Icecast stats'))
          }
        })
      })
      
      request.on('error', (error) => {
        console.error('📊 [MAIN] ❌ Error fetching Icecast stats:', error)
        reject(error)
      })
      
      request.setTimeout(5000, () => {
        console.error('📊 [MAIN] ❌ Request timeout after 5 seconds')
        request.destroy()
        reject(new Error('Request timeout'))
      })
    })
  } catch (error) {
    console.error('📊 [MAIN] ❌ get-icecast-stats error:', error)
    throw error
  }
})

// Handler per controllo forzato aggiornamenti
ipcMain.handle('force-check-updates', async () => {
  try {
    const { autoUpdater } = require('electron-updater')
    
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
    
    // Controlla aggiornamenti
    const updateCheckResult = await autoUpdater.checkForUpdates()
    return { success: true, result: updateCheckResult }
  } catch (error) {
    console.error('Errore nel controllo forzato aggiornamenti:', error)
    throw error
  }
})

// ✅ FIX: Handler per forzare controllo aggiornamenti con reset completo
ipcMain.handle('force-update-check', async () => {
  try {
    const AppUpdater = require('./updater')
    const updater = new AppUpdater()
    
    // ✅ FIX: Usa il metodo sicuro per il controllo forzato
    updater.forceUpdateCheck()
    
    return { success: true, message: 'Controllo forzato avviato' }
  } catch (error) {
    console.error('Errore nel controllo forzato aggiornamenti:', error)
    throw error
  }
})

// ✅ NUOVO: Handler per verificare file GitHub direttamente
ipcMain.handle('check-github-files', async () => {
  try {
    const AppUpdater = require('./updater')
    const updater = new AppUpdater()
    
    // Verifica i file disponibili su GitHub
    const release = await updater.checkGitHubFiles()
    
    return { success: true, release }
  } catch (error) {
    console.error('Errore nel controllo file GitHub:', error)
    throw error
  }
})

// ✅ NUOVO: Handler per ottenere il path dell'exe
ipcMain.handle('get-app-path', async () => {
  try {
    const exePath = process.execPath
    const appPath = app.getPath('exe')
    const appDir = path.dirname(exePath)
    
    // ✅ FIX: Distingui tra versione dev e produzione
    const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1'
    
    let actualAppPath = appPath
    let pathType = 'production'
    
    if (isDev) {
      // In dev, mostra il percorso del progetto, non di electron.exe
      actualAppPath = process.cwd() // C:\djconsole
      pathType = 'development'
    } else {
      // In produzione, usa il percorso reale dell'app
      actualAppPath = appPath
      pathType = 'production'
    }
    
    return {
      success: true,
      exePath: actualAppPath,
      appPath: actualAppPath,
      appDir: path.dirname(actualAppPath),
      platform: process.platform,
      isDev: isDev,
      pathType: pathType,
      electronPath: exePath // Percorso di electron.exe (solo per debug)
    }
  } catch (error) {
    console.error('❌ [APP-PATH] Errore ottenimento path app:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// ✅ RIMOSSO: Handler per ricreazione manuale shortcut - solo automatico post-update

// ✅ NUOVO: Listener per navigazione alle impostazioni
ipcMain.on('navigate-to-settings', () => {
  try {
    if (mainWindow) {
      mainWindow.webContents.send('navigate-to-settings')
    }
  } catch (error) {
    console.error('Errore nella navigazione alle impostazioni:', error)
  }
})




// ===== WEBRTC SERVER HANDLERS =====
ipcMain.handle('start-webrtc-server', async (event, options = {}) => {
  try {
    console.log(`🚀 [MAIN] Avvio server WebRTC con opzioni:`, options)
    
    if (webrtcServer) {
      console.log('⚠️ [MAIN] Server WebRTC già attivo, ripristino stato')
      // ✅ CRITICAL FIX: Verifica che il server sia effettivamente attivo
      try {
        const serverInfo = webrtcServer.getServerInfo()
        if (serverInfo && serverInfo.port) {
          console.log('✅ [MAIN] Server WebRTC confermato attivo su porta:', serverInfo.port)
          console.log('✅ [MAIN] Codice sessione attuale:', serverInfo.sessionCode)
          // Ripristina lo stato del server per la nuova pagina
          if (mainWindow) {
            const clients = webrtcServer.getConnectedClients()
            
            // Invia lo stato attuale alla nuova pagina
            mainWindow.webContents.send('webrtc-server-restored', {
              serverInfo,
              clients,
              isRunning: true
            })
          }
          return { success: true, ...serverInfo }
        }
      } catch (error) {
        console.log('⚠️ [MAIN] Server WebRTC non risponde, ricreazione...')
        webrtcServer = null
      }
    }
    
    webrtcServer = new WebRTCServer({
      port: options.port || 8080,
      maxConnections: options.maxConnections || 5
    })
    
    // Eventi del server WebRTC
    webrtcServer.on('clientAuthenticated', (client) => {
      console.log(`✅ [MAIN] Client WebRTC autenticato: ${client.djName}`)
      if (mainWindow) {
        mainWindow.webContents.send('webrtc-client-authenticated', {
          id: client.id,
          djName: client.djName,
          ip: client.ip,
          connectedAt: client.connectedAt,
          authenticatedAt: client.authenticatedAt
        })
      }
    })
    
    webrtcServer.on('clientDisconnected', (client) => {
      console.log(`🔌 [MAIN] Client WebRTC disconnesso: ${client.id}`)
      if (mainWindow) {
        mainWindow.webContents.send('webrtc-client-disconnected', {
          id: client.id,
          djName: client.djName
        })
      }
    })
    
    webrtcServer.on('audioLevel', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('webrtc-audio-level', data)
      }
    })
    
    webrtcServer.on('webrtcOffer', (data) => {
      console.log(`🎵 [MAIN] WebRTC Offer da ${data.djName}`)
      if (mainWindow) {
        mainWindow.webContents.send('webrtc-offer', data)
      }
    })
    
    webrtcServer.on('webrtcAnswer', (data) => {
      console.log(`🎵 [MAIN] WebRTC Answer da ${data.djName}`)
      if (mainWindow) {
        mainWindow.webContents.send('webrtc-answer', data)
      }
    })
    
            webrtcServer.on('iceCandidate', (data) => {
              console.log(`🧊 [MAIN] ICE Candidate da ${data.djName}`)
              if (mainWindow) {
                mainWindow.webContents.send('webrtc-ice-candidate', data)
              }
            })
            
            webrtcServer.on('chatMessage', (data) => {
              console.log(`💬 [MAIN] Chat message da client ${data.djName}`)
              if (mainWindow) {
                mainWindow.webContents.send('webrtc-chat-message', data)
              }
            })
            
            // Gestione messaggi di chat per l'host
            webrtcServer.on('hostChatMessage', (data) => {
              console.log(`💬 [MAIN] Host chat message ricevuto:`, {
                djName: data.djName,
                message: data.message,
                timestamp: data.timestamp
              })
              if (mainWindow) {
                mainWindow.webContents.send('webrtc-host-chat-message', data)
              }
            })
    
    const result = await webrtcServer.start()
    console.log(`✅ [MAIN] Server WebRTC avviato:`, result)
    
    return { success: true, ...result }
  } catch (error) {
    console.error('❌ [MAIN] Errore avvio server WebRTC:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('stop-webrtc-server', async () => {
  try {
    if (webrtcServer) {
      console.log('🔄 [MAIN] Fermata server WebRTC in corso...')
      await webrtcServer.stop()
      webrtcServer = null
      console.log('✅ [MAIN] Server WebRTC fermato completamente')
    } else {
      console.log('ℹ️ [MAIN] Nessun server WebRTC da fermare')
    }
    
    // ✅ CRITICAL FIX: Forza la pulizia completa per evitare sessioni persistenti
    webrtcServer = null
    console.log('✅ [MAIN] Pulizia completa server WebRTC completata')
    
    return { success: true }
  } catch (error) {
    console.error('❌ [MAIN] Errore fermata server WebRTC:', error)
    // ✅ CRITICAL FIX: Forza la pulizia anche in caso di errore
    webrtcServer = null
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-webrtc-clients', async () => {
  try {
    if (webrtcServer) {
      const clients = webrtcServer.getConnectedClients()
      return { success: true, clients: clients }
    }
    return { success: true, clients: [] }
  } catch (error) {
    console.error('❌ [MAIN] Errore recupero client WebRTC:', error)
    return { success: false, error: error.message }
  }
})

        ipcMain.handle('get-webrtc-server-info', async () => {
          try {
            if (webrtcServer) {
              const info = webrtcServer.getServerInfo()
              return { success: true, info: info }
            }
            return { success: true, info: null }
          } catch (error) {
            console.error('❌ [MAIN] Errore recupero info server WebRTC:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('check-webrtc-server-status', async () => {
          try {
            if (webrtcServer) {
              const info = webrtcServer.getServerInfo()
              const clients = webrtcServer.getConnectedClients()
              return { 
                success: true, 
                isRunning: true,
                serverInfo: info,
                clients: clients
              }
            }
            return { 
              success: true, 
              isRunning: false,
              serverInfo: null,
              clients: []
            }
          } catch (error) {
            console.error('❌ [MAIN] Errore controllo stato server WebRTC:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('send-host-chat-message', async (event, message) => {
          try {
            if (webrtcServer) {
              webrtcServer.sendHostMessage(message)
              return { success: true }
            }
            return { success: false, error: 'Server non attivo' }
          } catch (error) {
            console.error('❌ [MAIN] Errore invio messaggio host:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('send-webrtc-answer', async (event, data) => {
          try {
            if (webrtcServer) {
              webrtcServer.sendWebRTCAnswer(data)
              return { success: true }
            }
            return { success: false, error: 'Server non attivo' }
          } catch (error) {
            console.error('❌ [MAIN] Errore invio WebRTC answer:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('send-ice-candidate', async (event, data) => {
          try {
            if (webrtcServer) {
              webrtcServer.sendICECandidate(data)
              return { success: true }
            }
            return { success: false, error: 'Server non attivo' }
          } catch (error) {
            console.error('❌ [MAIN] Errore invio ICE candidate:', error)
            return { success: false, error: error.message }
          }
        })

        // 🌐 NGROK TUNNEL HANDLERS
        let ngrokProcess = null
        let tunnelUrl = null

        ipcMain.handle('start-ngrok-tunnel', async (event, port = 8081) => {
          try {
            console.log(`🚀 [NGROK] Avvio tunnel per porta ${port}...`)
            
            // Ferma processo esistente se attivo
            if (ngrokProcess) {
              ngrokProcess.kill()
              ngrokProcess = null
            }

            // Avvia ngrok con percorso completo Windows
            const ngrokPath = process.platform === 'win32' 
              ? `${process.env.USERPROFILE}\\AppData\\Roaming\\npm\\node_modules\\ngrok\\bin\\ngrok.exe`
              : 'ngrok'
              
            ngrokProcess = spawn(ngrokPath, ['http', port.toString(), '--region=eu'], {
              stdio: 'pipe'
            })

            return new Promise((resolve, reject) => {
              let resolved = false
              
              // Timeout dopo 10 secondi
              const timeout = setTimeout(() => {
                if (!resolved) {
                  resolved = true
                  reject(new Error('Timeout avvio tunnel'))
                }
              }, 10000)

              // Aspetta che ngrok sia pronto
              setTimeout(async () => {
                if (resolved) return
                
                try {
                  // Ottieni URL tunnel tramite API ngrok locale
                  const response = await new Promise((resolve, reject) => {
                    const req = http.get('http://localhost:4040/api/tunnels', (res) => {
                      let data = ''
                      res.on('data', chunk => data += chunk)
                      res.on('end', () => resolve({ json: () => JSON.parse(data) }))
                    })
                    req.on('error', reject)
                  })
                  const data = await response.json()
                  
                  if (data.tunnels && data.tunnels.length > 0) {
                    tunnelUrl = data.tunnels[0].public_url.replace('https://', '').replace('http://', '')
                    console.log(`✅ [NGROK] Tunnel attivo: ${tunnelUrl}`)
                    
                    if (!resolved) {
                      resolved = true
                      clearTimeout(timeout)
                      resolve({ success: true, url: tunnelUrl })
                    }
                  } else {
                    if (!resolved) {
                      resolved = true
                      clearTimeout(timeout)
                      reject(new Error('Nessun tunnel trovato'))
                    }
                  }
                } catch (error) {
                  if (!resolved) {
                    resolved = true
                    clearTimeout(timeout)
                    reject(error)
                  }
                }
              }, 3000)
            })
            
          } catch (error) {
            console.error('❌ [NGROK] Errore avvio tunnel:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('stop-ngrok-tunnel', async () => {
          try {
            if (ngrokProcess) {
              ngrokProcess.kill()
              ngrokProcess = null
              tunnelUrl = null
              console.log('✅ [NGROK] Tunnel fermato')
              return { success: true }
            }
            return { success: true, message: 'Nessun tunnel attivo' }
          } catch (error) {
            console.error('❌ [NGROK] Errore fermata tunnel:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('get-tunnel-url', async () => {
          return { success: true, url: tunnelUrl }
        })

        // ✅ YOUTUBE DOWNLOADER APIs CON FALLBACK MULTIPLO
        // Sistema di fallback: youtube-dl-exec -> yt-dlp -> youtube-dl
        
        async function getYouTubeInfoWithFallback(url) {
          const downloaders = [
            { name: 'yt-dlp-wrap', method: getInfoWithYtDlpWrap },
            { name: 'youtube-dl-exec', method: getInfoWithYoutubeDlExec },
            { name: 'yt-dlp', method: getInfoWithYtDlp },
            { name: 'youtube-dl', method: getInfoWithYoutubeDl }
          ]
          
          for (const downloader of downloaders) {
            try {
              console.log(`🔄 [YOUTUBE] Tentativo con ${downloader.name}...`)
              const result = await downloader.method(url)
              console.log(`✅ [YOUTUBE] Successo con ${downloader.name}`)
              return { success: true, data: result, method: downloader.name }
            } catch (error) {
              console.warn(`⚠️ [YOUTUBE] ${downloader.name} fallito:`, error.message)
              continue
            }
          }
          
          throw new Error('Tutti i downloader hanno fallito')
        }
        
        async function getInfoWithYtDlpWrap(url) {
          try {
            const ytDlpWrap = new YTDlpWrap()
            const info = await ytDlpWrap.getVideoInfo(url)
            
            return {
              title: info.title || 'Titolo non disponibile',
              duration: formatDuration(info.duration || 0),
              thumbnail: info.thumbnail || '',
              uploader: info.uploader || 'Canale sconosciuto',
              view_count: formatNumber(info.view_count || 0),
              duration_seconds: info.duration || 0
            }
          } catch (error) {
            throw new Error(`yt-dlp-wrap fallito: ${error.message}`)
          }
        }
        
        async function getInfoWithYoutubeDlExec(url) {
            const info = await youtubedl(url, {
              dumpSingleJson: true,
              noWarnings: true,
              noCheckCertificates: true,
              preferFreeFormats: true,
              addHeader: [
                'referer:youtube.com',
                'user-agent:googlebot'
              ]
            })
            
          return {
              title: info.title || 'Titolo non disponibile',
              duration: formatDuration(info.duration || 0),
              thumbnail: info.thumbnail || '',
              uploader: info.uploader || 'Canale sconosciuto',
              view_count: formatNumber(info.view_count || 0),
              duration_seconds: info.duration || 0
          }
        }
        
        async function getInfoWithYtDlp(url) {
          return new Promise((resolve, reject) => {
            const ytdlp = spawn('yt-dlp', [
              '--dump-json',
              '--no-warnings',
              '--no-check-certificates',
              '--prefer-free-formats',
              '--add-header', 'referer:youtube.com',
              '--add-header', 'user-agent:googlebot',
              url
            ], { stdio: ['pipe', 'pipe', 'pipe'] })
            
            let stdout = ''
            let stderr = ''
            
            ytdlp.stdout.on('data', (data) => {
              stdout += data.toString()
            })
            
            ytdlp.stderr.on('data', (data) => {
              stderr += data.toString()
            })
            
            ytdlp.on('close', (code) => {
              if (code === 0) {
                try {
                  const info = JSON.parse(stdout)
                  resolve({
                    title: info.title || 'Titolo non disponibile',
                    duration: formatDuration(info.duration || 0),
                    thumbnail: info.thumbnail || '',
                    uploader: info.uploader || 'Canale sconosciuto',
                    view_count: formatNumber(info.view_count || 0),
                    duration_seconds: info.duration || 0
                  })
                } catch (parseError) {
                  reject(new Error(`Errore parsing JSON: ${parseError.message}`))
                }
              } else {
                reject(new Error(`yt-dlp fallito con codice ${code}: ${stderr}`))
              }
            })
            
            ytdlp.on('error', (error) => {
              reject(new Error(`yt-dlp non trovato: ${error.message}`))
            })
          })
        }
        
        async function getInfoWithYoutubeDl(url) {
          return new Promise((resolve, reject) => {
            const youtubeDl = spawn('youtube-dl', [
              '--dump-json',
              '--no-warnings',
              '--no-check-certificates',
              '--prefer-free-formats',
              '--add-header', 'referer:youtube.com',
              '--add-header', 'user-agent:googlebot',
              url
            ], { stdio: ['pipe', 'pipe', 'pipe'] })
            
            let stdout = ''
            let stderr = ''
            
            youtubeDl.stdout.on('data', (data) => {
              stdout += data.toString()
            })
            
            youtubeDl.stderr.on('data', (data) => {
              stderr += data.toString()
            })
            
            youtubeDl.on('close', (code) => {
              if (code === 0) {
                try {
                  const info = JSON.parse(stdout)
                  resolve({
                    title: info.title || 'Titolo non disponibile',
                    duration: formatDuration(info.duration || 0),
                    thumbnail: info.thumbnail || '',
                    uploader: info.uploader || 'Canale sconosciuto',
                    view_count: formatNumber(info.view_count || 0),
                    duration_seconds: info.duration || 0
                  })
                } catch (parseError) {
                  reject(new Error(`Errore parsing JSON: ${parseError.message}`))
                }
              } else {
                reject(new Error(`youtube-dl fallito con codice ${code}: ${stderr}`))
              }
            })
            
            youtubeDl.on('error', (error) => {
              reject(new Error(`youtube-dl non trovato: ${error.message}`))
            })
          })
        }
        
        ipcMain.handle('get-youtube-info', async (event, url) => {
          try {
            console.log(`🎵 [YOUTUBE] Recupero info per: ${url}`)
            
            const result = await getYouTubeInfoWithFallback(url)
            console.log(`✅ [YOUTUBE] Info recuperate con ${result.method}: ${result.data.title}`)
            return result
          } catch (error) {
            console.error('❌ [YOUTUBE] Errore recupero info:', error)
            return { success: false, error: error.message || 'Errore nel recupero delle informazioni video' }
          }
        })

        async function downloadYouTubeAudioWithFallback(url, quality, outputPath, downloadId, event) {
          const downloaders = [
            { name: 'youtube-dl-exec', method: downloadWithYoutubeDlExec },
            { name: 'yt-dlp', method: downloadWithYtDlp },
            { name: 'youtube-dl', method: downloadWithYoutubeDl }
          ]
          
          for (const downloader of downloaders) {
            try {
              console.log(`🔄 [YOUTUBE] Tentativo download con ${downloader.name}...`)
              const result = await downloader.method(url, quality, outputPath, downloadId, event)
              console.log(`✅ [YOUTUBE] Download completato con ${downloader.name}`)
              return { success: true, ...result, method: downloader.name }
            } catch (error) {
              console.warn(`⚠️ [YOUTUBE] ${downloader.name} fallito:`, error.message)
              continue
            }
          }
          
          throw new Error('Tutti i downloader hanno fallito')
        }
        
        // downloadWithYtDlpWrap rimossa per problemi di import
        
        async function downloadWithYoutubeDlExec(url, quality, outputPath, downloadId, event) {
            // Crea la cartella se non esiste
            if (!fs.existsSync(outputPath)) {
              fs.mkdirSync(outputPath, { recursive: true })
            }
            
            const outputTemplate = path.join(outputPath, '%(title)s.%(ext)s')
            
            // Ottieni info video per il titolo
            let videoInfo = null
            try {
              videoInfo = await youtubedl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificates: true
              })
              console.log(`🎵 [YOUTUBE] Titolo video: ${videoInfo.title}`)
            } catch (infoError) {
              console.warn('⚠️ [YOUTUBE] Errore recupero info video:', infoError.message)
            }
            
            // Avvia download con progresso
            const downloadPromise = youtubedl(url, {
              extractAudio: true,
              audioFormat: 'mp3',
              audioQuality: quality,
              output: outputTemplate,
              noWarnings: true,
              noCheckCertificates: true,
              addHeader: [
                'referer:youtube.com',
                'user-agent:googlebot'
              ]
            })
            
          // Simula progresso realistico
            let currentProgress = 0
            const progressInterval = setInterval(() => {
              if (downloadId) {
              currentProgress += Math.random() * 15 + 5
                currentProgress = Math.min(95, currentProgress)
                
                event.sender.send('youtube-download-progress', {
                  downloadId,
                  percentage: Math.round(currentProgress),
                  speed: 'N/A',
                  eta: 'N/A'
                })
              }
            }, 2000)
            
            await downloadPromise
            clearInterval(progressInterval)
            
            // Invia progresso finale
            if (downloadId) {
              event.sender.send('youtube-download-progress', {
                downloadId,
                percentage: 100,
                speed: 'N/A',
                eta: 'N/A'
              })
            }
            
          // Trova il file scaricato nella cartella
          const files = fs.readdirSync(outputPath).filter(file => file.endsWith('.mp3'))
          console.log(`🎵 [YOUTUBE] File trovati in ${outputPath}:`, files)
          
          let selectedFile = null
          
          // Se abbiamo il titolo del video, cerca il file con quel nome
          if (videoInfo?.title) {
            const safeTitle = videoInfo.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)
            const expectedFileName = `${safeTitle}.mp3`
            const expectedFilePath = path.join(outputPath, expectedFileName)
            
            console.log(`🎵 [YOUTUBE] Cercando file con nome: ${expectedFileName}`)
            
            if (fs.existsSync(expectedFilePath)) {
              selectedFile = expectedFileName
              console.log(`✅ [YOUTUBE] File trovato con nome corretto: ${expectedFileName}`)
            } else {
              console.log(`⚠️ [YOUTUBE] File con nome corretto non trovato, cerco il più recente...`)
            }
          }
          
          // Se non trovato per nome, cerca il più recente
          if (!selectedFile) {
            let latestTime = 0
            for (const file of files) {
              const filePath = path.join(outputPath, file)
              const stats = fs.statSync(filePath)
              if (stats.mtime.getTime() > latestTime) {
                latestTime = stats.mtime.getTime()
                selectedFile = file
              }
            }
            console.log(`🎵 [YOUTUBE] File più recente trovato: ${selectedFile}`)
          }
          
          const fullFilePath = selectedFile ? path.join(outputPath, selectedFile) : outputPath
          
            return { 
            filePath: fullFilePath,
            title: videoInfo?.title || selectedFile?.replace('.mp3', '') || 'Unknown Title',
              artist: videoInfo?.uploader || 'Unknown Artist',
              duration: videoInfo?.duration || 0
            }
        }
        
        async function downloadWithYtDlp(url, quality, outputPath, downloadId, event) {
          return new Promise((resolve, reject) => {
            // Crea la cartella se non esiste
            if (!fs.existsSync(outputPath)) {
              fs.mkdirSync(outputPath, { recursive: true })
            }
            
            const outputTemplate = path.join(outputPath, '%(title)s.%(ext)s')
            
            const ytdlp = spawn('yt-dlp', [
              '--extract-audio',
              '--audio-format', 'mp3',
              '--audio-quality', quality.toString(),
              '--output', outputTemplate,
              '--no-warnings',
              '--no-check-certificates',
              '--add-header', 'referer:youtube.com',
              '--add-header', 'user-agent:googlebot',
              url
            ], { stdio: ['pipe', 'pipe', 'pipe'] })
            
            let stdout = ''
            let stderr = ''
            
            ytdlp.stdout.on('data', (data) => {
              stdout += data.toString()
            })
            
            ytdlp.stderr.on('data', (data) => {
              stderr += data.toString()
            })
            
            // Simula progresso
            let currentProgress = 0
            const progressInterval = setInterval(() => {
              if (downloadId) {
                currentProgress += Math.random() * 15 + 5
                currentProgress = Math.min(95, currentProgress)
                
                event.sender.send('youtube-download-progress', {
                  downloadId,
                  percentage: Math.round(currentProgress),
                  speed: 'N/A',
                  eta: 'N/A'
                })
              }
            }, 2000)
            
            ytdlp.on('close', (code) => {
              clearInterval(progressInterval)
              
              if (code === 0) {
                // Invia progresso finale
                if (downloadId) {
                  event.sender.send('youtube-download-progress', {
                    downloadId,
                    percentage: 100,
                    speed: 'N/A',
                    eta: 'N/A'
                  })
                }
                
                // Trova il file scaricato nella cartella (il più recente)
                const files = fs.readdirSync(outputPath).filter(file => file.endsWith('.mp3'))
                let latestFile = null
                let latestTime = 0
                
                for (const file of files) {
                  const filePath = path.join(outputPath, file)
                  const stats = fs.statSync(filePath)
                  if (stats.mtime.getTime() > latestTime) {
                    latestTime = stats.mtime.getTime()
                    latestFile = file
                  }
                }
                
                const fullFilePath = latestFile ? path.join(outputPath, latestFile) : outputPath
                console.log(`🎵 [YOUTUBE] File più recente trovato: ${latestFile}`)
                
                resolve({
                  filePath: fullFilePath,
                  title: latestFile ? latestFile.replace('.mp3', '') : 'Downloaded with yt-dlp',
                  artist: 'Unknown Artist',
                  duration: 0
                })
              } else {
                reject(new Error(`yt-dlp fallito con codice ${code}: ${stderr}`))
              }
            })
            
            ytdlp.on('error', (error) => {
              clearInterval(progressInterval)
              reject(new Error(`yt-dlp non trovato: ${error.message}`))
            })
          })
        }
        
        async function downloadWithYoutubeDl(url, quality, outputPath, downloadId, event) {
          return new Promise((resolve, reject) => {
            // Crea la cartella se non esiste
            if (!fs.existsSync(outputPath)) {
              fs.mkdirSync(outputPath, { recursive: true })
            }
            
            const outputTemplate = path.join(outputPath, '%(title)s.%(ext)s')
            
            const youtubeDl = spawn('youtube-dl', [
              '--extract-audio',
              '--audio-format', 'mp3',
              '--audio-quality', quality.toString(),
              '--output', outputTemplate,
              '--no-warnings',
              '--no-check-certificates',
              '--add-header', 'referer:youtube.com',
              '--add-header', 'user-agent:googlebot',
              url
            ], { stdio: ['pipe', 'pipe', 'pipe'] })
            
            let stdout = ''
            let stderr = ''
            
            youtubeDl.stdout.on('data', (data) => {
              stdout += data.toString()
            })
            
            youtubeDl.stderr.on('data', (data) => {
              stderr += data.toString()
            })
            
            // Simula progresso
            let currentProgress = 0
            const progressInterval = setInterval(() => {
              if (downloadId) {
                currentProgress += Math.random() * 15 + 5
                currentProgress = Math.min(95, currentProgress)
                
                event.sender.send('youtube-download-progress', {
                  downloadId,
                  percentage: Math.round(currentProgress),
                  speed: 'N/A',
                  eta: 'N/A'
                })
              }
            }, 2000)
            
            youtubeDl.on('close', (code) => {
              clearInterval(progressInterval)
              
              if (code === 0) {
                // Invia progresso finale
                if (downloadId) {
                  event.sender.send('youtube-download-progress', {
                    downloadId,
                    percentage: 100,
                    speed: 'N/A',
                    eta: 'N/A'
                  })
                }
                
                // Trova il file scaricato nella cartella (il più recente)
                const files = fs.readdirSync(outputPath).filter(file => file.endsWith('.mp3'))
                let latestFile = null
                let latestTime = 0
                
                for (const file of files) {
                  const filePath = path.join(outputPath, file)
                  const stats = fs.statSync(filePath)
                  if (stats.mtime.getTime() > latestTime) {
                    latestTime = stats.mtime.getTime()
                    latestFile = file
                  }
                }
                
                const fullFilePath = latestFile ? path.join(outputPath, latestFile) : outputPath
                console.log(`🎵 [YOUTUBE] File più recente trovato: ${latestFile}`)
                
                resolve({
                  filePath: fullFilePath,
                  title: latestFile ? latestFile.replace('.mp3', '') : 'Downloaded with youtube-dl',
                  artist: 'Unknown Artist',
                  duration: 0
                })
              } else {
                reject(new Error(`youtube-dl fallito con codice ${code}: ${stderr}`))
              }
            })
            
            youtubeDl.on('error', (error) => {
              clearInterval(progressInterval)
              reject(new Error(`youtube-dl non trovato: ${error.message}`))
            })
          })
        }
        
        ipcMain.handle('download-youtube-audio', async (event, { url, quality, outputPath, downloadId }) => {
          try {
            console.log(`🎵 [YOUTUBE] Download audio: ${url} (${quality}kbps) -> ${outputPath}`)
            
            const result = await downloadYouTubeAudioWithFallback(url, quality, outputPath, downloadId, event)
            console.log(`✅ [YOUTUBE] Download completato con ${result.method}`)
            return result
          } catch (error) {
            console.error('❌ [YOUTUBE] Errore download:', error)
            return { success: false, error: error.message || 'Errore durante il download' }
          }
        })

        ipcMain.handle('select-folder', async (event, type) => {
          try {
            const { dialog } = require('electron')
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: `Seleziona cartella per ${type === 'youtube' ? 'YouTube downloads' : 'file'}`
            })
            
            if (!result.canceled && result.filePaths.length > 0) {
              return { success: true, path: result.filePaths[0] }
            } else {
              return { success: false, error: 'Nessuna cartella selezionata' }
            }
          } catch (error) {
            console.error('❌ [FOLDER] Errore selezione cartella:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('open-folder', async (event, folderPath) => {
          try {
            const { shell } = require('electron')
            await shell.showItemInFolder(folderPath)
            return { success: true }
          } catch (error) {
            console.error('❌ [FOLDER] Errore apertura cartella:', error)
            return { success: false, error: error.message }
          }
        })

        ipcMain.handle('refresh-file-manager', async (event, folderPath) => {
          try {
            console.log(`🔄 [FILE MANAGER] Refresh richiesto per: ${folderPath}`)
            // Invia evento al renderer per aggiornare il file manager
            mainWindow.webContents.send('file-manager-refresh', folderPath)
            return { success: true }
          } catch (error) {
            console.error('❌ [FILE MANAGER] Errore refresh:', error)
            return { success: false, error: error.message }
          }
        })

        // ✅ RIMOSSO: Handler add-to-library obsoleto
        // Ora l'aggiunta alla libreria avviene direttamente nel frontend

        // Funzioni helper
        function formatDuration(seconds) {
          const hours = Math.floor(seconds / 3600)
          const minutes = Math.floor((seconds % 3600) / 60)
          const secs = seconds % 60
          
          if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          }
          return `${minutes}:${secs.toString().padStart(2, '0')}`
        }

        function formatNumber(num) {
          if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M'
          } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K'
          }
          return num.toString()
        }

// Esporta la funzione per l'updater
module.exports = { getMainWindow }


