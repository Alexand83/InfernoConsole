/**
 * Test per verificare se Blob URL separati permettono controllo volume indipendente
 * Questo è l'ultimo tentativo per risolvere il problema di sincronizzazione browser
 */

console.log('🧪 [BLOB TEST] Inizio test separazione con Blob URL...')

const testBlobSeparation = async () => {
  // Trova un elemento audio esistente
  const originalAudio = document.querySelector('audio[data-deck="A"]') || document.querySelector('audio')
  
  if (!originalAudio || !originalAudio.src) {
    console.error('❌ [BLOB TEST] Nessun elemento audio con src trovato')
    return false
  }
  
  console.log('🧪 [BLOB TEST] Audio originale trovato:', originalAudio.src)
  
  try {
    // Crea due Blob URL separati dallo stesso file
    console.log('🧪 [BLOB TEST] Creazione Blob URLs separati...')
    
    const response1 = await fetch(originalAudio.src)
    const blob1 = await response1.blob()
    const blobURL1 = URL.createObjectURL(blob1)
    
    const response2 = await fetch(originalAudio.src)  
    const blob2 = await response2.blob()
    const blobURL2 = URL.createObjectURL(blob2)
    
    console.log('🧪 [BLOB TEST] Blob URLs creati:', {
      blobURL1: blobURL1.substring(0, 50) + '...',
      blobURL2: blobURL2.substring(0, 50) + '...',
      different: blobURL1 !== blobURL2
    })
    
    // Crea elementi audio con Blob URL diversi
    const audio1 = document.createElement('audio')
    const audio2 = document.createElement('audio')
    
    audio1.src = blobURL1
    audio2.src = blobURL2
    
    audio1.volume = 0.2  // 20%
    audio2.volume = 0.8  // 80%
    
    audio1.muted = false
    audio2.muted = true  // Mutato
    
    document.body.appendChild(audio1)
    document.body.appendChild(audio2)
    
    console.log('🧪 [BLOB TEST] Elementi audio creati con Blob URLs:', {
      audio1: { volume: audio1.volume, muted: audio1.muted, src: audio1.src.substring(0, 30) + '...' },
      audio2: { volume: audio2.volume, muted: audio2.muted, src: audio2.src.substring(0, 30) + '...' },
      differentSources: audio1.src !== audio2.src
    })
    
    // Test riproduzione
    console.log('🧪 [BLOB TEST] Test riproduzione...')
    
    try {
      await audio1.play()
      console.log('✅ [BLOB TEST] Audio1 (Blob) play() riuscito')
    } catch (e) {
      console.log('❌ [BLOB TEST] Audio1 (Blob) play() fallito:', e.message)
    }
    
    try {
      await audio2.play()
      console.log('✅ [BLOB TEST] Audio2 (Blob) play() riuscito')
    } catch (e) {
      console.log('❌ [BLOB TEST] Audio2 (Blob) play() fallito:', e.message)
    }
    
    // Aspetta e controlla risultati
    setTimeout(() => {
      console.log('🧪 [BLOB TEST] Risultato test Blob URLs:', {
        audio1: { 
          volume: audio1.volume, 
          muted: audio1.muted, 
          currentTime: audio1.currentTime,
          paused: audio1.paused 
        },
        audio2: { 
          volume: audio2.volume, 
          muted: audio2.muted, 
          currentTime: audio2.currentTime,
          paused: audio2.paused 
        },
        volumeIndependent: audio1.volume !== audio2.volume,
        muteIndependent: audio1.muted !== audio2.muted,
        timeDifference: Math.abs(audio1.currentTime - audio2.currentTime),
        timeSynced: Math.abs(audio1.currentTime - audio2.currentTime) < 0.1,
        success: audio1.volume === 0.2 && audio2.volume === 0.8 && audio1.muted === false && audio2.muted === true
      })
      
      // Test controllo dinamico
      console.log('🧪 [BLOB TEST] Test controllo dinamico volume...')
      
      const oldVol1 = audio1.volume
      const oldVol2 = audio2.volume
      
      // Cambia volumi
      audio1.volume = 0.1  // 10%
      audio2.volume = 0.9  // 90%
      
      setTimeout(() => {
        console.log('🧪 [BLOB TEST] Risultato controllo dinamico:', {
          audio1VolumeChanged: audio1.volume === 0.1,
          audio2VolumeChanged: audio2.volume === 0.9,
          audio1Unaffected: oldVol1 === 0.2,
          audio2Unaffected: oldVol2 === 0.8,
          independentControl: audio1.volume === 0.1 && audio2.volume === 0.9
        })
        
        // Cleanup
        audio1.pause()
        audio2.pause()
        document.body.removeChild(audio1)
        document.body.removeChild(audio2)
        URL.revokeObjectURL(blobURL1)
        URL.revokeObjectURL(blobURL2)
        
        console.log('✅ [BLOB TEST] Test completato e cleanup fatto')
        
        // Risultato finale
        const finalSuccess = audio1.volume === 0.1 && audio2.volume === 0.9
        console.log(`🎯 [BLOB TEST] RISULTATO FINALE: ${finalSuccess ? '✅ BLOB URLs funzionano!' : '❌ Anche Blob URLs falliscono'}`)
        
        return finalSuccess
        
      }, 1000)
      
    }, 2000)
    
  } catch (error) {
    console.error('❌ [BLOB TEST] Errore generale:', error)
    return false
  }
}

// Test Web Audio con Blob URLs
const testWebAudioBlob = async () => {
  console.log('🧪 [WEB AUDIO BLOB TEST] Test Web Audio con Blob URLs...')
  
  const originalAudio = document.querySelector('audio[data-deck="A"]') || document.querySelector('audio')
  
  if (!originalAudio || !originalAudio.src) {
    console.error('❌ [WEB AUDIO BLOB TEST] Nessun elemento audio con src trovato')
    return false
  }
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Crea due Blob URL separati
    const response1 = await fetch(originalAudio.src)
    const blob1 = await response1.blob()
    const blobURL1 = URL.createObjectURL(blob1)
    
    const response2 = await fetch(originalAudio.src)
    const blob2 = await response2.blob()
    const blobURL2 = URL.createObjectURL(blob2)
    
    // Crea elementi con Blob URL diversi
    const webAudio1 = document.createElement('audio')
    const webAudio2 = document.createElement('audio')
    
    webAudio1.src = blobURL1
    webAudio2.src = blobURL2
    
    document.body.appendChild(webAudio1)
    document.body.appendChild(webAudio2)
    
    // Crea Web Audio sources
    const source1 = audioContext.createMediaElementSource(webAudio1)
    const source2 = audioContext.createMediaElementSource(webAudio2)
    
    const gain1 = audioContext.createGain()
    const gain2 = audioContext.createGain()
    
    gain1.gain.value = 0.3
    gain2.gain.value = 0.7
    
    source1.connect(gain1)
    gain1.connect(audioContext.destination)
    
    source2.connect(gain2)
    gain2.connect(audioContext.destination)
    
    console.log('🧪 [WEB AUDIO BLOB TEST] Setup completato:', {
      differentBlobURLs: blobURL1 !== blobURL2,
      gain1: gain1.gain.value,
      gain2: gain2.gain.value
    })
    
    // Test riproduzione
    await webAudio1.play()
    await webAudio2.play()
    
    setTimeout(() => {
      // Test controllo guadagni
      gain1.gain.setValueAtTime(0.1, audioContext.currentTime)
      gain2.gain.setValueAtTime(0.9, audioContext.currentTime)
      
      setTimeout(() => {
        console.log('🧪 [WEB AUDIO BLOB TEST] Risultato:', {
          gain1Final: gain1.gain.value,
          gain2Final: gain2.gain.value,
          independentGains: gain1.gain.value !== gain2.gain.value,
          success: Math.abs(gain1.gain.value - 0.1) < 0.01 && Math.abs(gain2.gain.value - 0.9) < 0.01
        })
        
        // Cleanup
        source1.disconnect()
        source2.disconnect()
        gain1.disconnect()
        gain2.disconnect()
        document.body.removeChild(webAudio1)
        document.body.removeChild(webAudio2)
        URL.revokeObjectURL(blobURL1)
        URL.revokeObjectURL(blobURL2)
        
        console.log('✅ [WEB AUDIO BLOB TEST] Test completato')
      }, 1000)
    }, 2000)
    
  } catch (error) {
    console.error('❌ [WEB AUDIO BLOB TEST] Errore:', error)
  }
}

// Esponi funzioni per uso manuale
window.testBlobSeparation = testBlobSeparation
window.testWebAudioBlob = testWebAudioBlob

console.log('🧪 [BLOB TEST] Test Blob URLs caricati. Usa:')
console.log('- window.testBlobSeparation() per test Blob HTML')
console.log('- window.testWebAudioBlob() per test Blob Web Audio')

// Esegui automaticamente dopo un po'
setTimeout(() => {
  if (document.querySelector('audio')) {
    console.log('🧪 [BLOB TEST] Esecuzione automatica test Blob URLs...')
    testBlobSeparation()
    setTimeout(testWebAudioBlob, 10000)
  }
}, 2000)
