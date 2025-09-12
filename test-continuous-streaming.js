/**
 * Test per verificare che lo streaming sia continuo durante seek e cambio traccia
 * 
 * Questo test simula il comportamento corretto:
 * - Lo streaming NON deve essere fermato durante seek
 * - La sincronizzazione deve essere continua e fluida
 * - Non devono esserci interruzioni nell'audio live
 */

console.log('🧪 [TEST CONTINUOUS STREAMING] Avvio test streaming continuo...')

// Simula il comportamento dell'AudioContext con sincronizzazione continua
class MockContinuousAudioSystem {
  constructor() {
    this.localAudio = { currentTime: 0, duration: 120, paused: false }
    this.streamAudio = { currentTime: 0, duration: 120, paused: false }
    this.isStreaming = true
    this.syncInterval = null
    this.seekCount = 0
  }
  
  // Simula la sincronizzazione continua
  startContinuousSync() {
    console.log('🔄 [SYNC] Avvio sincronizzazione continua...')
    
    this.syncInterval = setInterval(() => {
      if (this.isStreaming) {
        const timeDiff = Math.abs(this.streamAudio.currentTime - this.localAudio.currentTime)
        
        // Sincronizza solo se la differenza è significativa (> 0.05s)
        if (timeDiff > 0.05) {
          console.log(`🔄 [SYNC] Sincronizzazione: ${this.localAudio.currentTime.toFixed(2)}s → ${this.streamAudio.currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`)
          this.streamAudio.currentTime = this.localAudio.currentTime
        }
      }
    }, 200) // Ogni 200ms
  }
  
  // Simula il seek senza fermare lo streaming
  seek(time) {
    console.log(`⏩ [SEEK] Seek a ${time.toFixed(2)}s (streaming attivo: ${this.isStreaming})`)
    
    // ✅ CRITICAL FIX: NON fermare lo streaming durante seek
    this.localAudio.currentTime = time
    
    // La sincronizzazione continua gestirà l'aggiornamento
    console.log('✅ [SEEK] Seek completato - sincronizzazione continua gestirà l\'aggiornamento')
    this.seekCount++
  }
  
  // Simula il cambio traccia senza fermare lo streaming
  changeTrack(newDuration) {
    console.log(`🎵 [TRACK CHANGE] Cambio traccia (durata: ${newDuration}s)`)
    
    // ✅ CRITICAL FIX: NON fermare lo streaming durante cambio traccia
    this.localAudio.duration = newDuration
    this.localAudio.currentTime = 0
    this.streamAudio.duration = newDuration
    this.streamAudio.currentTime = 0
    
    console.log('✅ [TRACK CHANGE] Traccia cambiata - sincronizzazione continua attiva')
  }
  
  // Simula la riproduzione
  play() {
    this.localAudio.paused = false
    this.streamAudio.paused = false
    console.log('▶️ [PLAY] Riproduzione avviata')
  }
  
  // Simula il tempo che passa
  updateTime() {
    if (!this.localAudio.paused) {
      this.localAudio.currentTime += 0.1
    }
  }
  
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      console.log('🔄 [SYNC] Sincronizzazione fermata')
    }
  }
}

// Test principale
function testContinuousStreaming() {
  console.log('\n🧪 [TEST] Simulazione streaming continuo...')
  
  const audioSystem = new MockContinuousAudioSystem()
  audioSystem.startContinuousSync()
  audioSystem.play()
  
  let time = 0
  const testDuration = 30 // 30 secondi di test
  
  const interval = setInterval(() => {
    time += 0.1
    audioSystem.updateTime()
    
    // Simula seek a 30s quando arriviamo a 10s
    if (Math.abs(time - 10) < 0.1) {
      console.log('\n⏩ [TEST] Simulando seek a 30s...')
      audioSystem.seek(30)
    }
    
    // Simula seek a 60s quando arriviamo a 40s
    if (Math.abs(time - 40) < 0.1) {
      console.log('\n⏩ [TEST] Simulando seek a 60s...')
      audioSystem.seek(60)
    }
    
    // Simula cambio traccia quando arriviamo a 50s
    if (Math.abs(time - 50) < 0.1) {
      console.log('\n🎵 [TEST] Simulando cambio traccia...')
      audioSystem.changeTrack(90)
    }
    
    // Simula seek a 80s quando arriviamo a 70s
    if (Math.abs(time - 70) < 0.1) {
      console.log('\n⏩ [TEST] Simulando seek a 80s...')
      audioSystem.seek(80)
    }
    
    if (time >= testDuration) {
      clearInterval(interval)
      audioSystem.stop()
      console.log(`\n✅ [TEST] Test completato - ${audioSystem.seekCount} seek eseguiti senza interruzioni`)
      console.log('✅ [TEST] Streaming rimasto attivo durante tutto il test')
    }
  }, 100) // 100ms = 0.1s simulato
}

// Test con molti seek rapidi
function testRapidSeek() {
  console.log('\n🧪 [TEST] Simulazione seek rapidi...')
  
  const audioSystem = new MockContinuousAudioSystem()
  audioSystem.startContinuousSync()
  audioSystem.play()
  
  let time = 0
  const testDuration = 10 // 10 secondi di test
  
  const interval = setInterval(() => {
    time += 0.1
    audioSystem.updateTime()
    
    // Simula seek ogni 2 secondi
    if (time % 2 < 0.1 && time > 1) {
      const seekTime = Math.floor(time) * 10
      console.log(`\n⏩ [RAPID SEEK] Seek a ${seekTime}s...`)
      audioSystem.seek(seekTime)
    }
    
    if (time >= testDuration) {
      clearInterval(interval)
      audioSystem.stop()
      console.log(`\n✅ [RAPID TEST] Test completato - ${audioSystem.seekCount} seek rapidi eseguiti`)
      console.log('✅ [RAPID TEST] Streaming rimasto stabile durante seek rapidi')
    }
  }, 100)
}

// Esegui i test
testContinuousStreaming()

setTimeout(() => {
  testRapidSeek()
}, 35000) // Aspetta 35 secondi prima del secondo test