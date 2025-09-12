// 🔍 DEBUG BRUTALE - Verifica cosa cazzo sta succedendo con l'audio
console.log('🔍 [DEBUG BRUTALE] Inizio debug audio streaming...')

function debugAudioElements() {
  console.log('\n🎵 [DEBUG] === STATO ELEMENTI AUDIO ===')
  
  // Trova tutti gli elementi audio
  const audioElements = document.querySelectorAll('audio')
  console.log(`🎵 [DEBUG] Trovati ${audioElements.length} elementi audio`)
  
  audioElements.forEach((audio, index) => {
    console.log(`\n🎵 [DEBUG] Audio ${index}:`, {
      src: audio.src,
      volume: audio.volume,
      muted: audio.muted,
      paused: audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration,
      className: audio.className,
      dataDeck: audio.getAttribute('data-deck'),
      readyState: audio.readyState,
      networkState: audio.networkState
    })
    
    // Test se l'audio sta davvero riproducendo
    if (!audio.paused && audio.currentTime > 0) {
      console.log(`✅ [DEBUG] Audio ${index} STA RIPRODUCENDO!`)
    } else {
      console.log(`❌ [DEBUG] Audio ${index} NON sta riproducendo`)
    }
  })
  
  // Verifica streaming
  const isStreaming = window.isCurrentlyStreaming
  console.log(`\n📡 [DEBUG] Streaming attivo: ${isStreaming}`)
  
  // Verifica AudioContext
  if (window.audioContext) {
    console.log(`🎧 [DEBUG] AudioContext state: ${window.audioContext.state}`)
  } else {
    console.log(`❌ [DEBUG] AudioContext NON trovato`)
  }
  
  // Verifica StreamingManager
  if (window.streamingManager) {
    console.log(`📡 [DEBUG] StreamingManager presente: true`)
  } else {
    console.log(`❌ [DEBUG] StreamingManager NON presente`)
  }
}

// Esegui debug ogni 5 secondi
setInterval(debugAudioElements, 5000)

// Esegui subito
debugAudioElements()

console.log('🔍 [DEBUG BRUTALE] Debug attivato - controllando ogni 5 secondi...')
