// 🎯 LOG MONITOR AUTOMATICO - Salva logs e monitora ArrayBuffer size
console.log('🔍 [LOG MONITOR] Avvio monitoring automatico...')

// Array per salvare tutti i logs
let logHistory = []
let arrayBufferSizes = []
let streamingElementLogs = []

// Intercetta console.log originale
const originalLog = console.log
const originalError = console.error

console.log = function(...args) {
  const timestamp = new Date().toLocaleTimeString()
  const logEntry = `[${timestamp}] ${args.join(' ')}`
  
  // Salva il log
  logHistory.push(logEntry)
  
  // Controlla se è un log di streaming elements
  if (args[0] && args[0].includes('[LEFT STREAMING]') || args[0].includes('[RIGHT STREAMING]')) {
    streamingElementLogs.push(logEntry)
  }
  
  // Controlla ArrayBuffer size
  if (args[0] && args[0].includes('ArrayBuffer size:')) {
    const sizeMatch = args.join(' ').match(/ArrayBuffer size: (\d+)/)
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1])
      arrayBufferSizes.push({timestamp, size})
      
      // 🚨 ALERT se size > 60!
      if (size > 60) {
        alert('🎉 FUNZIONA! ArrayBuffer size: ' + size + ' bytes!')
        console.log('🎉🎉🎉 FUNZIONA! ArrayBuffer size maggiore di 60!')
      }
    }
  }
  
  // Mantieni solo ultimi 500 logs per performance
  if (logHistory.length > 500) {
    logHistory = logHistory.slice(-500)
  }
  
  // Chiama console.log originale
  originalLog.apply(console, args)
}

console.error = function(...args) {
  const timestamp = new Date().toLocaleTimeString()
  const logEntry = `[${timestamp}] ERROR: ${args.join(' ')}`
  logHistory.push(logEntry)
  
  // Mantieni solo ultimi 500 logs
  if (logHistory.length > 500) {
    logHistory = logHistory.slice(-500)
  }
  
  originalError.apply(console, args)
}

// Funzione per salvare logs nel localStorage
function saveLogs() {
  try {
    localStorage.setItem('djconsole_debug_logs', JSON.stringify({
      timestamp: new Date().toISOString(),
      logHistory: logHistory.slice(-200), // Ultimi 200 logs
      streamingElementLogs: streamingElementLogs,
      arrayBufferSizes: arrayBufferSizes.slice(-50), // Ultimi 50 sizes
      summary: {
        totalLogs: logHistory.length,
        streamingLogs: streamingElementLogs.length,
        latestArrayBufferSize: arrayBufferSizes.length > 0 ? arrayBufferSizes[arrayBufferSizes.length - 1] : null,
        maxArrayBufferSize: Math.max(...arrayBufferSizes.map(s => s.size), 0)
      }
    }))
    console.log('💾 [LOG MONITOR] Logs salvati nel localStorage')
  } catch (error) {
    console.error('❌ [LOG MONITOR] Errore salvataggio logs:', error)
  }
}

// Funzione per esportare logs come testo
function exportLogs() {
  const summary = `
=== DJCONSOLE DEBUG LOGS ===
Timestamp: ${new Date().toISOString()}
Total logs: ${logHistory.length}
Streaming element logs: ${streamingElementLogs.length}
ArrayBuffer sizes recorded: ${arrayBufferSizes.length}
Latest ArrayBuffer size: ${arrayBufferSizes.length > 0 ? arrayBufferSizes[arrayBufferSizes.length - 1].size : 'N/A'}
Max ArrayBuffer size: ${Math.max(...arrayBufferSizes.map(s => s.size), 0)}

=== STREAMING ELEMENT LOGS ===
${streamingElementLogs.join('\n')}

=== ARRAYBUFFER SIZES ===
${arrayBufferSizes.map(s => `${s.timestamp}: ${s.size} bytes`).join('\n')}

=== ALL LOGS (last 100) ===
${logHistory.slice(-100).join('\n')}
`
  
  // Copia negli appunti se disponibile
  if (navigator.clipboard) {
    navigator.clipboard.writeText(summary).then(() => {
      alert('📋 Logs copiati negli appunti!')
    }).catch(() => {
      console.log('📄 LOGS EXPORT:\n', summary)
    })
  } else {
    console.log('📄 LOGS EXPORT:\n', summary)
  }
  
  return summary
}

// Salva logs ogni 30 secondi
setInterval(saveLogs, 30000)

// Esponi funzioni globalmente
window.exportLogs = exportLogs
window.saveLogs = saveLogs
window.getLogHistory = () => logHistory
window.getStreamingLogs = () => streamingElementLogs
window.getArrayBufferSizes = () => arrayBufferSizes

console.log('✅ [LOG MONITOR] Monitor attivato!')
console.log('💡 [LOG MONITOR] Usa window.exportLogs() per esportare i logs')
console.log('💡 [LOG MONITOR] Alert automatico se ArrayBuffer size > 60!')

// Controllo iniziale se ci sono logs salvati
try {
  const savedLogs = localStorage.getItem('djconsole_debug_logs')
  if (savedLogs) {
    const parsed = JSON.parse(savedLogs)
    console.log('📂 [LOG MONITOR] Logs precedenti trovati:', parsed.summary)
  }
} catch (error) {
  console.log('📂 [LOG MONITOR] Nessun log precedente trovato')
}
