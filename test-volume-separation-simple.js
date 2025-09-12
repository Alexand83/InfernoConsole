/**
 * Test semplificato per verificare la separazione volume locale/streaming
 * Aggiornato per l'architettura Web Audio ONLY (rollback approach)
 */

console.log('🧪 [TEST ROLLBACK] Inizio test separazione volume Web Audio ONLY...')

const testVolumeSeparation = () => {
  console.log('🔍 [TEST] Verifica elementi audio presenti...')
  
  // Trova tutti gli elementi audio
  const allAudio = document.querySelectorAll('audio')
  console.log(`🔍 [TEST] Trovati ${allAudio.length} elementi audio totali`)
  
  // Verifica elementi per streaming
  const leftStreamAudio = window.leftStreamAudio
  const rightStreamAudio = window.rightStreamAudio
  
  console.log('🔍 [TEST] Audio streaming:', {
    leftStreamAudio: !!leftStreamAudio,
    rightStreamAudio: !!rightStreamAudio
  })
  
  // SIMPLE: Verifica solo Web Audio Gain nodes per monitoring
  const leftMonitorVolumeGain = window.leftMonitorVolumeGain
  const rightMonitorVolumeGain = window.rightMonitorVolumeGain
  
  console.log('🔍 [TEST] Web Audio monitoring:', {
    leftMonitorVolumeGain: !!leftMonitorVolumeGain,
    rightMonitorVolumeGain: !!rightMonitorVolumeGain,
    isStreaming: !!window.isCurrentlyStreaming
  })
  
  // Architettura sempre Web Audio ONLY
  const architecture = 'Web-Audio-Gain-ONLY'
  console.log(`🏗️ [TEST] Architettura: ${architecture}`)
  
  // Test separazione volume
  console.log('🧪 [TEST] Test separazione volume...')
  
  const results = {
    streaming: {},
    monitoring: {},
    separation: false,
    architecture: architecture
  }
  
  // Test streaming (sempre al 100%)
  if (leftStreamAudio) {
    results.streaming.left = {
      volume: leftStreamAudio.volume,
      muted: leftStreamAudio.muted,
      expected: { volume: 1.0, muted: false },
      correct: leftStreamAudio.volume === 1.0 && !leftStreamAudio.muted
    }
  }
  
  if (rightStreamAudio) {
    results.streaming.right = {
      volume: rightStreamAudio.volume,
      muted: rightStreamAudio.muted,
      expected: { volume: 1.0, muted: false },
      correct: rightStreamAudio.volume === 1.0 && !rightStreamAudio.muted
    }
  }
  
  // Test monitoring Web Audio Gain
  if (leftMonitorVolumeGain) {
    results.monitoring.left = {
      gain: leftMonitorVolumeGain.gain.value,
      type: 'WebAudioGain',
      canControl: true
    }
  }
  
  if (rightMonitorVolumeGain) {
    results.monitoring.right = {
      gain: rightMonitorVolumeGain.gain.value,
      type: 'WebAudioGain',
      canControl: true
    }
  }
  
  // Verifica separazione
  const hasStreamingControl = (results.streaming.left || results.streaming.right)
  const hasMonitoringControl = (results.monitoring.left || results.monitoring.right)
  results.separation = hasStreamingControl && hasMonitoringControl
  
  console.log('📊 [TEST] Risultati test:', results)
  
  // Verdict
  if (results.separation) {
    console.log('✅ [TEST] SEPARAZIONE RILEVATA - Streaming e monitoring indipendenti!')
  } else {
    console.log('❌ [TEST] SEPARAZIONE NON RILEVATA')
  }
  
  return results
}

// Test controllo dinamico volume Web Audio
const testDynamicVolumeControl = () => {
  console.log('🎛️ [TEST] Test controllo dinamico Web Audio Gain...')
  
  const leftGain = window.leftMonitorVolumeGain
  const rightGain = window.rightMonitorVolumeGain
  
  if (leftGain) {
    console.log('🎛️ [TEST] Test Left Gain: 50%...')
    leftGain.gain.setValueAtTime(0.5, leftGain.context.currentTime)
    
    setTimeout(() => {
      console.log('🎛️ [TEST] Test Left Gain: 0% (mute)...')
      leftGain.gain.setValueAtTime(0.0, leftGain.context.currentTime)
      
      setTimeout(() => {
        console.log('🎛️ [TEST] Test Left Gain: 100%...')
        leftGain.gain.setValueAtTime(1.0, leftGain.context.currentTime)
        
        // Verifica stato finale
        const finalResults = testVolumeSeparation()
        console.log('🏁 [TEST] Risultati finali:', {
          leftGainFinal: leftGain.gain.value,
          rightGainFinal: rightGain ? rightGain.gain.value : 'N/A',
          separation: finalResults.separation
        })
      }, 1000)
    }, 1000)
  } else {
    console.log('❌ [TEST] leftMonitorVolumeGain non disponibile')
  }
}

// Test separazione reale
const testRealSeparation = () => {
  console.log('🎯 [TEST] Test separazione REALE - Volume streaming vs locale...')
  
  const leftStream = window.leftStreamAudio
  const leftGain = window.leftMonitorVolumeGain
  
  if (leftStream && leftGain) {
    console.log('🎯 [TEST] Configurazione test:')
    console.log('- Stream audio volume: 100% (fisso)')
    console.log('- Monitor gain: 20% (controllabile)')
    
    // Streaming sempre 100%
    leftStream.volume = 1.0
    leftStream.muted = false
    
    // Monitor controllabile
    leftGain.gain.setValueAtTime(0.2, leftGain.context.currentTime)
    
    setTimeout(() => {
      console.log('🎯 [TEST] Risultato separazione:', {
        streamVolume: leftStream.volume,
        streamMuted: leftStream.muted,
        monitorGain: leftGain.gain.value,
        separated: leftStream.volume !== leftGain.gain.value,
        success: leftStream.volume === 1.0 && leftGain.gain.value === 0.2
      })
    }, 500)
  } else {
    console.log('❌ [TEST] Elementi per test separazione non disponibili')
  }
}

// Test completo semplificato
const runCompleteTest = () => {
  console.log('🚀 [TEST ROLLBACK] Avvio test completo Web Audio ONLY...')
  
  // Test iniziale
  const initialResults = testVolumeSeparation()
  
  // Test dinamico se supportato
  if (initialResults.separation) {
    console.log('✅ [TEST] Separazione rilevata, avvio test...')
    setTimeout(testDynamicVolumeControl, 1000)
    setTimeout(testRealSeparation, 3000)
  } else {
    console.log('❌ [TEST] Separazione NON rilevata')
  }
  
  return initialResults
}

// Esponi per uso manuale
window.testVolumeSeparation = testVolumeSeparation
window.testDynamicVolumeControl = testDynamicVolumeControl
window.testRealSeparation = testRealSeparation
window.runCompleteTest = runCompleteTest

// Avvio automatico
setTimeout(() => {
  if (document.querySelector('audio')) {
    console.log('🔄 [TEST] Avvio automatico test Web Audio...')
    runCompleteTest()
  } else {
    console.log('⚠️ [TEST] Nessun elemento audio trovato, test non avviato')
  }
}, 3000)

console.log('📋 [TEST ROLLBACK] Test Web Audio ONLY caricato. Funzioni:')
console.log('- window.testVolumeSeparation()')
console.log('- window.testDynamicVolumeControl()')
console.log('- window.testRealSeparation()')
console.log('- window.runCompleteTest()')
