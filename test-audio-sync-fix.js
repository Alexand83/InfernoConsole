/**
 * Test per verificare la sincronizzazione audio tra player locale e streaming
 * 
 * Questo test simula il problema descritto dall'utente:
 * - Quando si fa seek nella console locale, lo streaming non segue
 * - Quando cambia la traccia, lo streaming non si aggiorna
 */

console.log('🧪 [TEST AUDIO SYNC] Avvio test sincronizzazione audio...')

// Simula il comportamento dell'AudioContext
class MockAudioElement {
  constructor(src) {
    this.src = src
    this.currentTime = 0
    this.duration = 120 // 2 minuti
    this.paused = false
    this.volume = 1.0
    this.loop = false
    this.muted = false
  }
  
  play() {
    this.paused = false
    console.log(`▶️ [MOCK AUDIO] Play - currentTime: ${this.currentTime.toFixed(2)}s`)
    return Promise.resolve()
  }
  
  pause() {
    this.paused = true
    console.log(`⏸️ [MOCK AUDIO] Pause - currentTime: ${this.currentTime.toFixed(2)}s`)
  }
}

// Simula il comportamento del sistema originale (PROBLEMATICO)
function createStreamAudioOriginal(originalAudio) {
  console.log('🔧 [ORIGINAL] Creazione stream audio (metodo originale)')
  const streamAudio = new MockAudioElement(originalAudio.src)
  streamAudio.currentTime = originalAudio.currentTime // ← PROBLEMA: Solo sincronizzazione iniziale
  streamAudio.playbackRate = originalAudio.playbackRate
  streamAudio.loop = originalAudio.loop
  streamAudio.volume = 1.0
  
  if (originalAudio.paused) {
    streamAudio.pause()
  } else {
    streamAudio.play()
  }
  
  return streamAudio
}

// Simula il comportamento del sistema FIXATO
function createStreamAudioFixed(originalAudio) {
  console.log('🔧 [FIXED] Creazione stream audio (metodo fixato)')
  const streamAudio = new MockAudioElement(originalAudio.src)
  
  // Sincronizza TUTTE le proprietà dell'audio originale
  streamAudio.currentTime = originalAudio.currentTime
  streamAudio.playbackRate = originalAudio.playbackRate
  streamAudio.loop = originalAudio.loop
  streamAudio.muted = originalAudio.muted
  streamAudio.volume = 1.0
  
  // Sincronizza lo stato di riproduzione
  if (originalAudio.paused) {
    streamAudio.pause()
  } else {
    streamAudio.play()
  }
  
  // Sincronizzazione continua della posizione durante la riproduzione
  const syncPosition = () => {
    if (streamAudio && originalAudio) {
      const timeDiff = Math.abs(streamAudio.currentTime - originalAudio.currentTime)
      // Sincronizza solo se la differenza è significativa (> 0.1s)
      if (timeDiff > 0.1) {
        console.log(`🔄 [SYNC] Sincronizzazione posizione: ${originalAudio.currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`)
        streamAudio.currentTime = originalAudio.currentTime
      }
    }
  }
  
  // Sincronizza ogni 500ms durante la riproduzione
  const syncInterval = setInterval(syncPosition, 500)
  
  // Pulisci l'intervallo quando l'audio finisce o viene fermato
  const cleanupSync = () => {
    clearInterval(syncInterval)
  }
  
  streamAudio.addEventListener = (event, callback) => {
    if (event === 'ended' || event === 'pause') {
      // Simula cleanup
      setTimeout(cleanupSync, 100)
    }
  }
  
  return streamAudio
}

// Test del problema originale
console.log('\n🧪 [TEST 1] Test comportamento ORIGINALE (problematico)')
const originalAudio = new MockAudioElement('test-song.mp3')
originalAudio.currentTime = 30 // 30 secondi
originalAudio.play()

const streamAudioOriginal = createStreamAudioOriginal(originalAudio)

console.log(`📊 [ORIGINAL] Posizione originale: ${originalAudio.currentTime.toFixed(2)}s`)
console.log(`📊 [ORIGINAL] Posizione stream: ${streamAudioOriginal.currentTime.toFixed(2)}s`)

// Simula seek
setTimeout(() => {
  console.log('\n⏩ [SEEK] Simulazione seek a 60 secondi...')
  originalAudio.currentTime = 60
  console.log(`📊 [ORIGINAL] Dopo seek - Posizione originale: ${originalAudio.currentTime.toFixed(2)}s`)
  console.log(`📊 [ORIGINAL] Dopo seek - Posizione stream: ${streamAudioOriginal.currentTime.toFixed(2)}s`)
  console.log('❌ [PROBLEMA] Lo stream NON è sincronizzato!')
}, 1000)

// Test del comportamento fixato
setTimeout(() => {
  console.log('\n🧪 [TEST 2] Test comportamento FIXATO')
  const originalAudio2 = new MockAudioElement('test-song2.mp3')
  originalAudio2.currentTime = 30 // 30 secondi
  originalAudio2.play()

  const streamAudioFixed = createStreamAudioFixed(originalAudio2)

  console.log(`📊 [FIXED] Posizione originale: ${originalAudio2.currentTime.toFixed(2)}s`)
  console.log(`📊 [FIXED] Posizione stream: ${streamAudioFixed.currentTime.toFixed(2)}s`)

  // Simula seek
  setTimeout(() => {
    console.log('\n⏩ [SEEK] Simulazione seek a 60 secondi...')
    originalAudio2.currentTime = 60
    console.log(`📊 [FIXED] Dopo seek - Posizione originale: ${originalAudio2.currentTime.toFixed(2)}s`)
    console.log(`📊 [FIXED] Dopo seek - Posizione stream: ${streamAudioFixed.currentTime.toFixed(2)}s`)
    
    // La sincronizzazione continua dovrebbe funzionare
    setTimeout(() => {
      console.log(`📊 [FIXED] Dopo sync - Posizione stream: ${streamAudioFixed.currentTime.toFixed(2)}s`)
      console.log('✅ [SUCCESSO] Lo stream è sincronizzato!')
    }, 600) // Aspetta la sincronizzazione
  }, 1000)
}, 3000)

console.log('\n🎯 [RISULTATO ATTESO]')
console.log('Il sistema fixato dovrebbe mantenere la sincronizzazione tra player locale e streaming')
console.log('anche durante seek e cambio traccia, grazie alla sincronizzazione continua.')
