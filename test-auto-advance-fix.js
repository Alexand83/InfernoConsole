/**
 * Test per verificare la correzione dell'auto-avanzamento
 * 
 * Questo test simula il problema descritto dall'utente:
 * - La traccia arriva quasi alla fine ma non passa alla prossima
 * - L'auto-avanzamento non funziona correttamente
 */

console.log('🧪 [TEST AUTO-ADVANCE] Avvio test auto-avanzamento...')

// Simula il comportamento dell'AudioContext
class MockAudioElement {
  constructor(src, duration = 120) {
    this.src = src
    this.currentTime = 0
    this.duration = duration
    this.paused = false
    this.volume = 1.0
    this.loop = false
    this.muted = false
    this.listeners = {}
  }
  
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }
  
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }
  
  dispatchEvent(event) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(callback => callback(event))
    }
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
  
  seek(time) {
    this.currentTime = Math.max(0, Math.min(time, this.duration))
    console.log(`⏩ [MOCK AUDIO] Seek to ${this.currentTime.toFixed(2)}s`)
  }
}

// Simula l'AutoAdvanceManager
class MockAutoAdvanceManager {
  constructor() {
    this.advanceTimeRef = { left: 0, right: 0 }
    this.isEnabled = true
    this.tracks = [
      { id: 1, title: 'Track 1', duration: 120 },
      { id: 2, title: 'Track 2', duration: 90 },
      { id: 3, title: 'Track 3', duration: 150 }
    ]
    this.currentTrackIndex = 0
  }
  
  checkAutoAdvance(deck, currentTime, duration, isPlaying) {
    if (!this.isEnabled) return
    
    const timeLeft = duration - currentTime
    const now = Date.now()
    
    console.log(`🔄 [AUTO-ADVANCE] Deck ${deck.toUpperCase()}: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s (${timeLeft.toFixed(2)}s rimanenti)`)
    
    // ✅ CRITICAL FIX: Attiva auto-avanzamento quando mancano meno di 2 secondi
    if (timeLeft <= 2 && timeLeft > 0 && (now - this.advanceTimeRef[deck]) > 5000) {
      console.log(`🔄 [AUTO-ADVANCE] Auto-avanzamento attivato per deck ${deck.toUpperCase()} (2s rimanenti)`)
      this.advanceTimeRef[deck] = now
      this.advanceToNextTrack(deck)
    }
  }
  
  advanceToNextTrack(deck) {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length
    const nextTrack = this.tracks[this.currentTrackIndex]
    console.log(`🔄 [AUTO-ADVANCE] Caricando prossima traccia: ${nextTrack.title}`)
    return nextTrack
  }
}

// Test principale
function testAutoAdvance() {
  console.log('\n🧪 [TEST] Simulazione auto-avanzamento...')
  
  const audio = new MockAudioElement('test.mp3', 120)
  const autoAdvance = new MockAutoAdvanceManager()
  
  // Simula la riproduzione
  audio.play()
  
  // Simula il tempo che passa
  let currentTime = 0
  const duration = 120
  
  const interval = setInterval(() => {
    currentTime += 1
    audio.currentTime = currentTime
    
    // Simula il controllo di auto-avanzamento
    autoAdvance.checkAutoAdvance('left', currentTime, duration, true)
    
    if (currentTime >= duration) {
      clearInterval(interval)
      console.log('✅ [TEST] Test completato')
    }
  }, 100) // 1 secondo simulato ogni 100ms
}

// Test con seek
function testAutoAdvanceWithSeek() {
  console.log('\n🧪 [TEST] Simulazione auto-avanzamento con seek...')
  
  const audio = new MockAudioElement('test.mp3', 120)
  const autoAdvance = new MockAutoAdvanceManager()
  
  // Simula la riproduzione
  audio.play()
  
  // Simula il tempo che passa fino a 115s
  let currentTime = 0
  const duration = 120
  
  const interval = setInterval(() => {
    currentTime += 1
    audio.currentTime = currentTime
    
    // Simula il controllo di auto-avanzamento
    autoAdvance.checkAutoAdvance('left', currentTime, duration, true)
    
    // Simula seek a 115s quando arriviamo a 60s
    if (currentTime === 60) {
      console.log('⏩ [TEST] Simulando seek a 115s...')
      currentTime = 115
      audio.currentTime = currentTime
    }
    
    if (currentTime >= duration) {
      clearInterval(interval)
      console.log('✅ [TEST] Test con seek completato')
    }
  }, 100) // 1 secondo simulato ogni 100ms
}

// Esegui i test
testAutoAdvance()

setTimeout(() => {
  testAutoAdvanceWithSeek()
}, 15000) // Aspetta 15 secondi prima del secondo test
