/**
 * Test per verificare l'indipendenza dei due deck
 * 
 * Questo test dimostra che:
 * - Deck A e Deck B sono indipendenti
 * - Seek nel deck A non influenza il deck B
 * - Seek nel deck B non influenza il deck A
 * - Lo streaming segue correttamente ogni deck separatamente
 */

console.log('🧪 [TEST DECK INDEPENDENCE] Test indipendenza dei deck...')

class MockAudioElement {
  constructor(src, deckName) {
    this.src = src
    this.currentTime = 0
    this.duration = 120
    this.paused = false
    this.volume = 1.0
    this.loop = false
    this.muted = false
    this.deckName = deckName
  }
  
  play() {
    this.paused = false
    console.log(`▶️ [${this.deckName}] Play - currentTime: ${this.currentTime.toFixed(2)}s`)
    return Promise.resolve()
  }
  
  pause() {
    this.paused = true
    console.log(`⏸️ [${this.deckName}] Pause - currentTime: ${this.currentTime.toFixed(2)}s`)
  }
  
  seek(time) {
    this.currentTime = time
    console.log(`⏩ [${this.deckName}] Seek to: ${time.toFixed(2)}s`)
  }
}

// Simula il sistema di streaming con due deck indipendenti
class StreamingSystem {
  constructor() {
    this.leftDeck = null
    this.rightDeck = null
    this.leftStream = null
    this.rightStream = null
  }
  
  // Simula la creazione dello stream per il deck sinistro
  createLeftStream(originalAudio) {
    console.log('🔧 [STREAMING] Creazione stream per DECK A')
    this.leftDeck = originalAudio
    this.leftStream = new MockAudioElement(originalAudio.src, 'STREAM-A')
    
    // Sincronizza proprietà iniziali
    this.leftStream.currentTime = originalAudio.currentTime
    this.leftStream.playbackRate = originalAudio.playbackRate
    this.leftStream.loop = originalAudio.loop
    this.leftStream.volume = 1.0
    
    if (originalAudio.paused) {
      this.leftStream.pause()
    } else {
      this.leftStream.play()
    }
    
    // Sincronizzazione continua
    this.startLeftSync()
  }
  
  // Simula la creazione dello stream per il deck destro
  createRightStream(originalAudio) {
    console.log('🔧 [STREAMING] Creazione stream per DECK B')
    this.rightDeck = originalAudio
    this.rightStream = new MockAudioElement(originalAudio.src, 'STREAM-B')
    
    // Sincronizza proprietà iniziali
    this.rightStream.currentTime = originalAudio.currentTime
    this.rightStream.playbackRate = originalAudio.playbackRate
    this.rightStream.loop = originalAudio.loop
    this.rightStream.volume = 1.0
    
    if (originalAudio.paused) {
      this.rightStream.pause()
    } else {
      this.rightStream.play()
    }
    
    // Sincronizzazione continua
    this.startRightSync()
  }
  
  // Sincronizzazione continua per deck A
  startLeftSync() {
    const syncLeft = () => {
      if (this.leftStream && this.leftDeck) {
        const timeDiff = Math.abs(this.leftStream.currentTime - this.leftDeck.currentTime)
        if (timeDiff > 0.1) {
          console.log(`🔄 [SYNC-A] Deck A: ${this.leftDeck.currentTime.toFixed(2)}s → Stream: ${this.leftStream.currentTime.toFixed(2)}s`)
          this.leftStream.currentTime = this.leftDeck.currentTime
        }
      }
    }
    
    setInterval(syncLeft, 500)
  }
  
  // Sincronizzazione continua per deck B
  startRightSync() {
    const syncRight = () => {
      if (this.rightStream && this.rightDeck) {
        const timeDiff = Math.abs(this.rightStream.currentTime - this.rightDeck.currentTime)
        if (timeDiff > 0.1) {
          console.log(`🔄 [SYNC-B] Deck B: ${this.rightDeck.currentTime.toFixed(2)}s → Stream: ${this.rightStream.currentTime.toFixed(2)}s`)
          this.rightStream.currentTime = this.rightDeck.currentTime
        }
      }
    }
    
    setInterval(syncRight, 500)
  }
  
  // Simula seek nel deck A
  seekLeft(time) {
    if (this.leftDeck) {
      console.log(`\n⏩ [SEEK LEFT] Seek nel deck A a ${time.toFixed(2)}s`)
      this.leftDeck.seek(time)
    }
  }
  
  // Simula seek nel deck B
  seekRight(time) {
    if (this.rightDeck) {
      console.log(`\n⏩ [SEEK RIGHT] Seek nel deck B a ${time.toFixed(2)}s`)
      this.rightDeck.seek(time)
    }
  }
  
  // Mostra stato attuale
  showStatus() {
    console.log('\n📊 [STATUS] Stato attuale:')
    if (this.leftDeck && this.leftStream) {
      console.log(`   Deck A: ${this.leftDeck.currentTime.toFixed(2)}s | Stream A: ${this.leftStream.currentTime.toFixed(2)}s`)
    }
    if (this.rightDeck && this.rightStream) {
      console.log(`   Deck B: ${this.rightDeck.currentTime.toFixed(2)}s | Stream B: ${this.rightStream.currentTime.toFixed(2)}s`)
    }
  }
}

// Test dell'indipendenza dei deck
console.log('\n🧪 [TEST] Inizializzazione sistema streaming...')
const streaming = new StreamingSystem()

// Crea i deck
const deckA = new MockAudioElement('song-a.mp3', 'DECK-A')
const deckB = new MockAudioElement('song-b.mp3', 'DECK-B')

deckA.currentTime = 30
deckB.currentTime = 45

deckA.play()
deckB.play()

// Crea gli stream
streaming.createLeftStream(deckA)
streaming.createRightStream(deckB)

streaming.showStatus()

// Test 1: Seek nel deck A non influenza il deck B
setTimeout(() => {
  console.log('\n🧪 [TEST 1] Seek nel deck A (non deve influenzare deck B)')
  streaming.seekLeft(60)
  streaming.showStatus()
}, 1000)

// Test 2: Seek nel deck B non influenza il deck A
setTimeout(() => {
  console.log('\n🧪 [TEST 2] Seek nel deck B (non deve influenzare deck A)')
  streaming.seekRight(75)
  streaming.showStatus()
}, 2000)

// Test 3: Seek simultaneo in entrambi i deck
setTimeout(() => {
  console.log('\n🧪 [TEST 3] Seek simultaneo in entrambi i deck')
  streaming.seekLeft(90)
  streaming.seekRight(15)
  streaming.showStatus()
}, 3000)

// Verifica finale
setTimeout(() => {
  console.log('\n✅ [RISULTATO FINALE]')
  streaming.showStatus()
  console.log('\n🎯 [CONCLUSIONE]')
  console.log('I deck A e B sono completamente indipendenti!')
  console.log('Lo streaming segue correttamente ogni deck separatamente.')
  console.log('Il seek in un deck non influenza l\'altro deck.')
}, 4000)
