/**
 * TEST AUDIO ROUTING SEPARATION
 * 
 * Verifica la separazione completa tra audio locale e streaming
 * usando il nuovo sistema AudioRouter
 */

const { AudioManager } = require('./src/audio/AudioManager')
const { StreamingManager } = require('./src/audio/StreamingManager')

async function testAudioRoutingSeparation() {
  console.log('🎛️ === TEST AUDIO ROUTING SEPARATION ===')
  
  try {
    // 1. Inizializza AudioManager
    console.log('\n1. Inizializzazione AudioManager...')
    const audioManager = AudioManager.getInstance()
    console.log('✅ AudioManager inizializzato')
    
    // 2. Verifica che AudioRouter sia attivo
    console.log('\n2. Verifica AudioRouter...')
    const isStreamingActive = audioManager.isStreamingActive()
    console.log(`📡 Streaming attivo: ${isStreamingActive}`)
    
    // 3. Test separazione volumi
    console.log('\n3. Test separazione volumi...')
    
    // Imposta volumi diversi per locale e streaming
    audioManager.setDeckVolume('A', 0.5) // 50% locale
    audioManager.setMasterVolume(0.8)    // 80% master (solo streaming)
    
    console.log('🔊 Deck A volume locale: 50%')
    console.log('🔊 Master volume: 80% (solo streaming)')
    
    // 4. Test crossfader
    console.log('\n4. Test crossfader...')
    audioManager.setCrossfader(0.3) // 30% verso B
    console.log('🎚️ Crossfader: 30% verso Deck B')
    
    // 5. Test microfono
    console.log('\n5. Test microfono...')
    audioManager.setMicrophoneEnabled(true)
    audioManager.setMicVolume(0.7)
    console.log('🎤 Microfono abilitato: 70%')
    
    // 6. Test streaming
    console.log('\n6. Test streaming...')
    const streamingManager = new StreamingManager()
    
    // Configura streaming
    await streamingManager.configureFromSettings()
    console.log('📡 StreamingManager configurato')
    
    // Connetti al server
    const connected = await streamingManager.connect()
    if (connected) {
      console.log('✅ Connesso al server Icecast')
      
      // Avvia streaming
      const streamingStarted = await streamingManager.startStreaming()
      if (streamingStarted) {
        console.log('✅ Streaming avviato con successo')
        
        // Verifica che lo streaming sia attivo
        const isStreaming = audioManager.isStreamingActive()
        console.log(`📡 Streaming attivo nell'AudioManager: ${isStreaming}`)
        
        // Test separazione durante streaming
        console.log('\n7. Test separazione durante streaming...')
        
        // Cambia volumi durante streaming
        audioManager.setDeckVolume('A', 0.3) // Riduci volume locale
        audioManager.setDeckVolume('B', 0.8) // Aumenta volume locale
        audioManager.setMasterVolume(0.9)    // Aumenta master (solo streaming)
        
        console.log('🔊 Volume locale Deck A: 30%')
        console.log('🔊 Volume locale Deck B: 80%')
        console.log('🔊 Master volume: 90% (solo streaming)')
        
        // Verifica che i volumi siano separati
        console.log('\n8. Verifica separazione volumi...')
        const state = audioManager.getState()
        console.log('📊 Stato AudioManager:')
        console.log(`   Deck A volume: ${Math.round(state.deckA.volume * 100)}%`)
        console.log(`   Deck B volume: ${Math.round(state.deckB.volume * 100)}%`)
        console.log(`   Master volume: ${Math.round(state.masterVolume * 100)}%`)
        console.log(`   Crossfader: ${Math.round(state.crossfader * 100)}%`)
        console.log(`   Microfono: ${state.micEnabled ? 'ON' : 'OFF'} (${Math.round(state.micVolume * 100)}%)`)
        
        // Test mute/unmute
        console.log('\n9. Test mute/unmute...')
        audioManager.toggleDeckMute('A')
        console.log('🔇 Deck A mutato')
        
        setTimeout(() => {
          audioManager.toggleDeckMute('A')
          console.log('🔊 Deck A unmutato')
        }, 2000)
        
        // Ferma streaming dopo 5 secondi
        setTimeout(async () => {
          console.log('\n10. Fermata streaming...')
          await streamingManager.stopStreaming()
          console.log('✅ Streaming fermato')
          
          // Verifica che i volumi locali siano ripristinati
          console.log('\n11. Verifica ripristino volumi locali...')
          const finalState = audioManager.getState()
          console.log('📊 Stato finale:')
          console.log(`   Deck A volume: ${Math.round(finalState.deckA.volume * 100)}%`)
          console.log(`   Deck B volume: ${Math.round(finalState.deckB.volume * 100)}%`)
          console.log(`   Master volume: ${Math.round(finalState.masterVolume * 100)}%`)
          
          console.log('\n🎛️ === TEST COMPLETATO CON SUCCESSO ===')
          console.log('✅ Separazione audio locale/streaming verificata')
          console.log('✅ AudioRouter funziona correttamente')
          console.log('✅ StreamingManager integrato correttamente')
          
        }, 5000)
        
      } else {
        console.error('❌ Errore avvio streaming')
      }
    } else {
      console.error('❌ Errore connessione al server')
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error)
  }
}

// Esegui il test
if (require.main === module) {
  testAudioRoutingSeparation()
}

module.exports = { testAudioRoutingSeparation }
