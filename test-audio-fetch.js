/**
 * Test per verificare che il fetch dei file audio funzioni correttamente
 * Questo script verifica potenziali problemi di CORS o file non trovati
 */

console.log('🧪 [FETCH TEST] Inizio test fetch audio...')

// Test funzione fetch audio
const testAudioFetch = async (audioSrc) => {
  if (!audioSrc) {
    console.error('❌ [FETCH TEST] Nessun src audio fornito')
    return false
  }
  
  console.log(`🧪 [FETCH TEST] Test fetch: ${audioSrc}`)
  
  try {
    // Primo tentativo con CORS
    console.log('🧪 [FETCH TEST] Tentativo con CORS...')
    let response
    try {
      response = await fetch(audioSrc, {
        mode: 'cors',
        cache: 'default'
      })
    } catch (corsError) {
      console.log('🧪 [FETCH TEST] CORS fallito, provo senza mode cors...')
      response = await fetch(audioSrc, {
        cache: 'default'
      })
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    console.log('🧪 [FETCH TEST] Fetch completato, tentativo conversione ArrayBuffer...')
    const arrayBuffer = await response.arrayBuffer()
    
    console.log('🧪 [FETCH TEST] ArrayBuffer ottenuto:', {
      byteLength: arrayBuffer.byteLength,
      success: arrayBuffer.byteLength > 0
    })
    
    // Test decodifica audio se disponibile
    if (window.AudioContext || window.webkitAudioContext) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      console.log('🧪 [FETCH TEST] Tentativo decodifica audio...')
      
      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        console.log('✅ [FETCH TEST] Decodifica audio riuscita:', {
          duration: audioBuffer.duration,
          channels: audioBuffer.numberOfChannels,
          sampleRate: audioBuffer.sampleRate
        })
        return true
      } catch (decodeError) {
        console.error('❌ [FETCH TEST] Errore decodifica audio:', decodeError)
        return false
      }
    } else {
      console.log('✅ [FETCH TEST] ArrayBuffer ottenuto ma AudioContext non disponibile')
      return true
    }
    
  } catch (error) {
    console.error('❌ [FETCH TEST] Errore fetch:', {
      message: error.message,
      type: error.constructor.name,
      src: audioSrc
    })
    return false
  }
}

// Test con i file audio attualmente caricati
const testCurrentAudio = async () => {
  const audioElements = document.querySelectorAll('audio')
  console.log(`🧪 [FETCH TEST] Trovati ${audioElements.length} elementi audio`)
  
  for (let i = 0; i < audioElements.length; i++) {
    const audio = audioElements[i]
    if (audio.src && audio.src.trim() !== '') {
      console.log(`🧪 [FETCH TEST] Test elemento audio ${i}:`)
      const success = await testAudioFetch(audio.src)
      console.log(`🧪 [FETCH TEST] Elemento ${i} risultato: ${success ? 'SUCCESS' : 'FAILED'}`)
    }
  }
}

// Esponi la funzione per uso manuale
window.testAudioFetch = testAudioFetch
window.testCurrentAudio = testCurrentAudio

// Avvia automaticamente il test se ci sono elementi audio
setTimeout(() => {
  testCurrentAudio()
}, 1000)

console.log('🧪 [FETCH TEST] Test caricato. Usa window.testAudioFetch(url) per test manuali.')
