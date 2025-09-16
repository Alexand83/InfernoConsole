const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopStream', {
  start: (options) => ipcRenderer.invoke('icecast-start', options),
  write: (chunk) => ipcRenderer.send('icecast-write', chunk),
  writeContinuous: (chunk) => ipcRenderer.send('icecast-write-continuous', chunk),
  writeChunk: (chunk) => ipcRenderer.send('icecast-write-chunk', chunk),
  stop: () => ipcRenderer.invoke('icecast-stop'),
  updateMetadata: (meta) => ipcRenderer.invoke('icecast-metadata', meta),
  // ✅ NUOVO: Metodi per pausa/ripresa input
  pauseInput: () => ipcRenderer.invoke('icecast-pause-input'),
  resumeInput: () => ipcRenderer.invoke('icecast-resume-input')
})

// ✅ NUOVO: API Electron per StreamingManager
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  send: (channel, data) => ipcRenderer.send(channel, data),
  startStreaming: (config) => ipcRenderer.invoke('start-streaming', config),
  notifyConnectionLost: (reason) => ipcRenderer.invoke('notify-connection-lost', reason),
  // ✅ NUOVO: API per statistiche Icecast (bypassa CORS)
  getIcecastStats: (host, port) => ipcRenderer.invoke('get-icecast-stats', host, port),
  // ✅ FIX: Listener per eventi FFmpeg
  onFFmpegError: (callback) => ipcRenderer.on('ffmpeg-error', callback),
  onFFmpegDisconnected: (callback) => ipcRenderer.on('ffmpeg-disconnected', callback),
  onFFmpegConnected: (callback) => ipcRenderer.on('ffmpeg-connected', callback),
  removeFFmpegListeners: () => {
    ipcRenderer.removeAllListeners('ffmpeg-error')
    ipcRenderer.removeAllListeners('ffmpeg-disconnected')
    ipcRenderer.removeAllListeners('ffmpeg-connected')
  },
  // ✅ NUOVO: Listener per progresso download aggiornamenti
  on: (event, callback) => ipcRenderer.on(event, callback),
  removeListener: (event, callback) => ipcRenderer.removeListener(event, callback)
})

// Expose minimal APIs if needed in future (IPC, fs, etc.)
// For now we keep it empty to use the web app as-is.

// Auto-updater API
contextBridge.exposeInMainWorld('autoUpdater', {
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  resetCache: () => ipcRenderer.invoke('reset-updater-cache'),
  forceCheckUpdates: () => ipcRenderer.invoke('force-check-updates'),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  removeDownloadProgressListener: (callback) => ipcRenderer.removeListener('download-progress', callback)
})

// Simple logger bridge
contextBridge.exposeInMainWorld('log', {
  info: (msg) => ipcRenderer.send('log', { level: 'info', msg }),
  error: (msg) => ipcRenderer.send('log', { level: 'error', msg }),
  warn: (msg) => ipcRenderer.send('log', { level: 'warn', msg })
})

// Mirror console to main log
try {
  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error
  console.log = (...args) => {
    try { ipcRenderer.send('log', { level: 'info', msg: args.map(String).join(' ') }) } catch {}
    origLog.apply(console, args)
  }
  console.warn = (...args) => {
    try { ipcRenderer.send('log', { level: 'warn', msg: args.map(String).join(' ') }) } catch {}
    origWarn.apply(console, args)
  }
  console.error = (...args) => {
    try { ipcRenderer.send('log', { level: 'error', msg: args.map(String).join(' ') }) } catch {}
    origError.apply(console, args)
  }
} catch {}

// File save bridge (Electron only)
contextBridge.exposeInMainWorld('fileStore', {
  saveAudio: (id, name, arrayBuffer) => ipcRenderer.invoke('save-audio', { id, name, arrayBuffer })
})

// JSON DB bridge
try {
  contextBridge.exposeInMainWorld('dbStore', {
    load: () => ipcRenderer.invoke('db-load'),
    save: (data) => ipcRenderer.invoke('db-save', data)
  })
} catch {}


