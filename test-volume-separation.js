/**
 * Test per verificare la separazione dell'audio locale da quello streaming
 * Questo script testa che:
 * 1. Durante lo streaming, i controlli volume locale non influenzino il volume dello stream
 * 2. I controlli volume locale influenzino solo l'audio che sente l'utente localmente
 * 3. I controlli volume streaming influenzino solo l'audio che va in onda
 */

console.log('🧪 [TEST] Inizio test separazione audio locale/streaming...')

// Simula l'avvio dello streaming
window.isCurrentlyStreaming = true

// Test 1: Verifica che esistano elementi HTML separati per monitoring e streaming
console.log('\n🧪 [TEST 1] Verifica elementi HTML separati per monitoring/streaming...')
const testMonitorNodes = () => {
  const hasLeftMonitor = !!(window.leftMonitorAudio)
  const hasRightMonitor = !!(window.rightMonitorAudio)
  const hasLeftStream = !!(window.leftStreamAudio)
  const hasRightStream = !!(window.rightStreamAudio)
  const leftElementsSeparate = window.leftMonitorAudio !== window.leftStreamAudio
  const rightElementsSeparate = window.rightMonitorAudio !== window.rightStreamAudio
  
  console.log('📊 [TEST 1] Risultati:', {
    leftMonitorAudio: hasLeftMonitor,
    rightMonitorAudio: hasRightMonitor,
    leftStreamAudio: hasLeftStream,
    rightStreamAudio: hasRightStream,
    leftElementsSeparate: leftElementsSeparate,
    rightElementsSeparate: rightElementsSeparate,
    allPresent: hasLeftMonitor && hasRightMonitor && hasLeftStream && hasRightStream && leftElementsSeparate && rightElementsSeparate
  })
  
  return hasLeftMonitor && hasRightMonitor && hasLeftStream && hasRightStream && leftElementsSeparate && rightElementsSeparate
}

// Test 2: Verifica che i volumi locali siano indipendenti dallo streaming
console.log('\n🧪 [TEST 2] Test indipendenza volumi locale/streaming...')
const testVolumeIndependence = () => {
  // Simula cambiamento volume locale a 0%
  console.log('🔧 [TEST 2] Impostazione volume locale sinistro a 0%...')
  
  // Test con i nuovi elementi monitor HTML separati
  if (window.leftMonitorAudio && window.leftStreamAudio) {
    const originalMonitorVolume = window.leftMonitorAudio.volume
    const streamVolume = window.leftStreamAudio.volume
    
    // Imposta monitor HTML a 0% 
    window.leftMonitorAudio.volume = 0.0
    window.leftMonitorAudio.muted = true
    
    console.log('📊 [TEST 2] Controllo stato dopo volume locale = 0%:', {
      monitorVolume: window.leftMonitorAudio.volume,
      monitorMuted: window.leftMonitorAudio.muted,
      streamVolume: window.leftStreamAudio.volume,
      streamMuted: window.leftStreamAudio.muted,
      originalMonitorVolume: originalMonitorVolume,
      separateElements: window.leftMonitorAudio !== window.leftStreamAudio,
      streamingStillActive: window.isCurrentlyStreaming
    })
    
    // Il monitoring locale dovrebbe essere a 0, ma lo streaming dovrebbe rimanere al 100%
    return (
      window.leftMonitorAudio.volume === 0.0 && 
      window.leftMonitorAudio.muted === true &&
      window.leftStreamAudio.volume === 1.0 && 
      window.leftStreamAudio.muted === false &&
      window.leftMonitorAudio !== window.leftStreamAudio && // Elementi diversi!
      window.isCurrentlyStreaming
    )
  }
  
  return false
}

// Test 3: Verifica che i controlli HTML siano sempre al 100% durante streaming
console.log('\n🧪 [TEST 3] Test elementi HTML durante streaming...')
const testHTMLElementsOptimal = () => {
  const audioElements = document.querySelectorAll('audio')
  let allOptimal = true
  
  audioElements.forEach((audio, index) => {
    if (!audio.style.display === 'none') { // Skip elementi streaming nascosti
      const isOptimal = audio.volume === 1.0 && !audio.muted
      console.log(`📊 [TEST 3] Audio ${index}:`, {
        volume: audio.volume,
        muted: audio.muted,
        optimal: isOptimal,
        src: audio.src.substring(0, 50) + '...'
      })
      
      if (!isOptimal) allOptimal = false
    }
  })
  
  return allOptimal
}

// Esegui i test
const runTests = () => {
  console.log('\n🚀 [TEST] Esecuzione test...')
  
  const test1Result = testMonitorNodes()
  const test2Result = testVolumeIndependence()
  const test3Result = testHTMLElementsOptimal()
  
  console.log('\n📋 [TEST] Risultati finali:')
  console.log(`✅ Test 1 (Nodi Monitor): ${test1Result ? 'PASSED' : 'FAILED'}`)
  console.log(`✅ Test 2 (Indipendenza Volume): ${test2Result ? 'PASSED' : 'FAILED'}`)  
  console.log(`✅ Test 3 (HTML Ottimale): ${test3Result ? 'PASSED' : 'FAILED'}`)
  
  const allPassed = test1Result && test2Result && test3Result
  console.log(`\n🎯 [TEST] Risultato generale: ${allPassed ? '✅ TUTTI I TEST PASSATI' : '❌ ALCUNI TEST FALLITI'}`)
  
  if (allPassed) {
    console.log('🎉 [TEST] La separazione audio locale/streaming funziona correttamente!')
  } else {
    console.log('⚠️ [TEST] Ci sono problemi nella separazione audio locale/streaming')
  }
  
  return allPassed
}

// Esporta la funzione per uso manuale
window.testVolumeSeparation = runTests

// Esegui automaticamente se siamo in streaming
if (window.isCurrentlyStreaming) {
  setTimeout(runTests, 1000) // Aspetta che il sistema si stabilizzi
} else {
  console.log('ℹ️ [TEST] Per eseguire il test, avvia prima lo streaming e poi chiama window.testVolumeSeparation()')
}
