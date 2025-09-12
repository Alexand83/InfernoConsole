/**
 * Test per verificare se il browser sincronizza elementi audio con lo stesso src
 * Questo è il sospetto finale per il problema di separazione
 */

console.log('🔍 [BROWSER SYNC TEST] Inizio test sincronizzazione browser...')

const testBrowserSync = async () => {
  // Trova un elemento audio esistente
  const originalAudio = document.querySelector('audio[data-deck="A"]') || document.querySelector('audio')
  
  if (!originalAudio || !originalAudio.src) {
    console.error('❌ [BROWSER SYNC TEST] Nessun elemento audio con src trovato')
    return false
  }
  
  console.log('🔍 [BROWSER SYNC TEST] Audio originale trovato:', originalAudio.src)
  
  // Crea due elementi audio con lo stesso src
  const audio1 = document.createElement('audio')
  const audio2 = document.createElement('audio')
  
  audio1.src = originalAudio.src
  audio2.src = originalAudio.src
  
  audio1.volume = 0.5  // 50%
  audio2.volume = 1.0  // 100%
  
  audio1.muted = false
  audio2.muted = true  // Mutato
  
  document.body.appendChild(audio1)
  document.body.appendChild(audio2)
  
  console.log('🔍 [BROWSER SYNC TEST] Elementi creati:', {
    audio1: { volume: audio1.volume, muted: audio1.muted },
    audio2: { volume: audio2.volume, muted: audio2.muted },
    sameSource: audio1.src === audio2.src
  })
  
  // Prova a farli riprodurre
  try {
    await audio1.play()
    console.log('✅ [BROWSER SYNC TEST] Audio1 play() riuscito')
  } catch (e) {
    console.log('❌ [BROWSER SYNC TEST] Audio1 play() fallito:', e.message)
  }
  
  try {
    await audio2.play()
    console.log('✅ [BROWSER SYNC TEST] Audio2 play() riuscito')
  } catch (e) {
    console.log('❌ [BROWSER SYNC TEST] Audio2 play() fallito:', e.message)
  }
  
  // Aspetta un po' e controlla lo stato
  setTimeout(() => {
    console.log('🔍 [BROWSER SYNC TEST] Stato dopo play:', {
      audio1: { 
        currentTime: audio1.currentTime, 
        paused: audio1.paused, 
        volume: audio1.volume, 
        muted: audio1.muted 
      },
      audio2: { 
        currentTime: audio2.currentTime, 
        paused: audio2.paused, 
        volume: audio2.volume, 
        muted: audio2.muted 
      },
      timesSync: Math.abs(audio1.currentTime - audio2.currentTime) < 0.1
    })
    
    // Test controllo indipendente
    console.log('🔍 [BROWSER SYNC TEST] Test controllo indipendente...')
    
    // Cambia volume di audio1
    const originalVol1 = audio1.volume
    audio1.volume = 0.2
    
    // Muta audio2  
    const originalMuted2 = audio2.muted
    audio2.muted = true
    
    setTimeout(() => {
      console.log('🔍 [BROWSER SYNC TEST] Risultato controllo indipendente:', {
        audio1VolumeChanged: audio1.volume === 0.2,
        audio2MutedChanged: audio2.muted === true,
        audio1AffectedByAudio2: audio1.volume !== 0.2 || audio1.muted !== false,
        audio2AffectedByAudio1: audio2.volume !== 1.0,
        independent: audio1.volume === 0.2 && audio2.muted === true && audio1.muted === false
      })
      
      // Cleanup
      document.body.removeChild(audio1)
      document.body.removeChild(audio2)
      
      console.log('✅ [BROWSER SYNC TEST] Test completato e cleanup fatto')
    }, 1000)
    
  }, 2000)
}

// Test Web Audio con stesso src
const testWebAudioSync = async () => {
  console.log('🔍 [WEB AUDIO SYNC TEST] Test Web Audio con stesso src...')
  
  const originalAudio = document.querySelector('audio[data-deck="A"]') || document.querySelector('audio')
  
  if (!originalAudio || !originalAudio.src) {
    console.error('❌ [WEB AUDIO SYNC TEST] Nessun elemento audio con src trovato')
    return false
  }
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Crea due elementi con stesso src
    const webAudio1 = document.createElement('audio')
    const webAudio2 = document.createElement('audio')
    
    webAudio1.src = originalAudio.src
    webAudio2.src = originalAudio.src
    
    document.body.appendChild(webAudio1)
    document.body.appendChild(webAudio2)
    
    // Crea due MediaElementSource
    const source1 = audioContext.createMediaElementSource(webAudio1)
    const source2 = audioContext.createMediaElementSource(webAudio2)
    
    // Crea gain nodes separati
    const gain1 = audioContext.createGain()
    const gain2 = audioContext.createGain()
    
    gain1.gain.value = 0.3  // 30%
    gain2.gain.value = 0.8  // 80%
    
    // Collega ai destination
    source1.connect(gain1)
    gain1.connect(audioContext.destination)
    
    source2.connect(gain2)
    gain2.connect(audioContext.destination)
    
    console.log('🔍 [WEB AUDIO SYNC TEST] Web Audio setup:', {
      gain1Value: gain1.gain.value,
      gain2Value: gain2.gain.value,
      sameSource: webAudio1.src === webAudio2.src
    })
    
    // Avvia riproduzione
    await webAudio1.play()
    await webAudio2.play()
    
    setTimeout(() => {
      console.log('🔍 [WEB AUDIO SYNC TEST] Risultato Web Audio:', {
        webAudio1Playing: !webAudio1.paused,
        webAudio2Playing: !webAudio2.paused,
        gain1Current: gain1.gain.value,
        gain2Current: gain2.gain.value,
        independent: gain1.gain.value === 0.3 && gain2.gain.value === 0.8
      })
      
      // Cleanup
      source1.disconnect()
      source2.disconnect()
      gain1.disconnect()
      gain2.disconnect()
      document.body.removeChild(webAudio1)
      document.body.removeChild(webAudio2)
      
      console.log('✅ [WEB AUDIO SYNC TEST] Test completato e cleanup fatto')
    }, 2000)
    
  } catch (error) {
    console.error('❌ [WEB AUDIO SYNC TEST] Errore:', error)
  }
}

// Esponi le funzioni per uso manuale
window.testBrowserSync = testBrowserSync
window.testWebAudioSync = testWebAudioSync

console.log('🔍 [BROWSER SYNC TEST] Test caricati. Usa:')
console.log('- window.testBrowserSync() per test elementi HTML')
console.log('- window.testWebAudioSync() per test Web Audio')

// Esegui automaticamente se ci sono elementi audio
if (document.querySelector('audio')) {
  setTimeout(() => {
    console.log('🔍 [BROWSER SYNC TEST] Esecuzione automatica test...')
    testBrowserSync()
    setTimeout(testWebAudioSync, 8000)
  }, 1000)
}
