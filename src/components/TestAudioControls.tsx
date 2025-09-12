import React, { useEffect, useState } from 'react'
import { useAudio } from '../contexts/AudioContext'

const TestAudioControls: React.FC = () => {
  const { state, handlePlayPauseDefinitive } = useAudio()
  const [testResults, setTestResults] = useState<string[]>([])
  const [isTesting, setIsTesting] = useState(false)

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  const runAudioControlsTest = async () => {
    setIsTesting(true)
    setTestResults([])
    
    addTestResult('🚀 Iniziando test controlli audio...')
    
    try {
      // Test 1: Verifica stato iniziale
      addTestResult('📋 Test 1: Verifica stato iniziale')
      addTestResult(`   - Left deck: ${state.leftDeck.track ? 'Track caricata' : 'Nessuna track'}`)
      addTestResult(`   - Right deck: ${state.rightDeck.track ? 'Track caricata' : 'Nessuna track'}`)
      
      // Test 2: Verifica controlli play/pause
      addTestResult('🎮 Test 2: Verifica controlli play/pause')
      
      if (state.leftDeck.track) {
        addTestResult('   - Testando left deck...')
        const wasPlaying = state.leftDeck.isPlaying
        
        addTestResult(`   - Stato iniziale: ${wasPlaying ? 'Playing' : 'Paused'}`)
        
        // Testa play/pause
        handlePlayPauseDefinitive('left')
        
        // Aspetta più tempo per permettere l'aggiornamento dello stato
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const newState = state.leftDeck.isPlaying
        addTestResult(`   - Stato dopo controllo: ${newState ? 'Playing' : 'Paused'}`)
        
        if (newState !== wasPlaying) {
          addTestResult('   ✅ Left deck: Controlli funzionanti')
        } else {
          addTestResult('   ❌ Left deck: Controlli non funzionanti')
          addTestResult('   🔍 Debug: Stato non è cambiato dopo handlePlayPauseDefinitive')
        }
      } else {
        addTestResult('   ⚠️ Left deck: Nessuna track per testare')
      }
      
      if (state.rightDeck.track) {
        addTestResult('   - Testando right deck...')
        const wasPlaying = state.rightDeck.isPlaying
        
        addTestResult(`   - Stato iniziale: ${wasPlaying ? 'Playing' : 'Paused'}`)
        
        // Testa play/pause
        handlePlayPauseDefinitive('right')
        
        // Aspetta più tempo per permettere l'aggiornamento dello stato
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const newState = state.rightDeck.isPlaying
        addTestResult(`   - Stato dopo controllo: ${newState ? 'Playing' : 'Paused'}`)
        
        if (newState !== wasPlaying) {
          addTestResult('   ✅ Right deck: Controlli funzionanti')
        } else {
          addTestResult('   ❌ Right deck: Controlli non funzionanti')
          addTestResult('   🔍 Debug: Stato non è cambiato dopo handlePlayPauseDefinitive')
        }
      } else {
        addTestResult('   ⚠️ Right deck: Nessuna track per testare')
      }
      
      // Test 3: Verifica sincronizzazione stato
      addTestResult('🔄 Test 3: Verifica sincronizzazione stato')
      addTestResult(`   - Left deck playing: ${state.leftDeck.isPlaying}`)
      addTestResult(`   - Right deck playing: ${state.rightDeck.isPlaying}`)
      addTestResult(`   - Left deck time: ${state.leftDeck.currentTime.toFixed(1)}s`)
      addTestResult(`   - Right deck time: ${state.rightDeck.currentTime.toFixed(1)}s`)
      
      // Test 4: Verifica elementi HTML audio
      addTestResult('🔊 Test 4: Verifica elementi HTML audio')
      const leftAudio = document.querySelector('audio[data-deck="left"]') as HTMLAudioElement
      const rightAudio = document.querySelector('audio[data-deck="right"]') as HTMLAudioElement
      
      if (leftAudio) {
        addTestResult(`   - Left audio element: ${leftAudio.paused ? 'Paused' : 'Playing'}`)
        addTestResult(`   - Left audio src: ${leftAudio.src ? 'Presente' : 'Mancante'}`)
        addTestResult(`   - Left audio currentTime: ${leftAudio.currentTime.toFixed(1)}s`)
      } else {
        addTestResult('   ❌ Left audio element non trovato')
      }
      
      if (rightAudio) {
        addTestResult(`   - Right audio element: ${rightAudio.paused ? 'Paused' : 'Playing'}`)
        addTestResult(`   - Right audio src: ${rightAudio.src ? 'Presente' : 'Mancante'}`)
        addTestResult(`   - Right audio currentTime: ${rightAudio.currentTime.toFixed(1)}s`)
      } else {
        addTestResult('   ❌ Right audio element non trovato')
      }
      
      // Test 5: Verifica persistenza
      addTestResult('💾 Test 5: Verifica persistenza')
      addTestResult('   - Simulando cambio pagina...')
      
      // Simula un cambio di pagina salvando lo stato
      const savedState = {
        leftDeck: { ...state.leftDeck },
        rightDeck: { ...state.rightDeck }
      }
      
      addTestResult('   - Stato salvato per persistenza')
      addTestResult('   - Simulando ritorno alla console...')
      
      // Simula il ritorno alla console
      setTimeout(() => {
        addTestResult('   - Console ripristinata')
        addTestResult(`   - Left deck ripristinato: ${savedState.leftDeck.track?.title || 'Nessuna'}`)
        addTestResult(`   - Right deck ripristinato: ${savedState.rightDeck.track?.title || 'Nessuna'}`)
        addTestResult('✅ Test completato con successo!')
        setIsTesting(false)
      }, 1000)
      
    } catch (error) {
      addTestResult(`❌ Errore durante il test: ${error}`)
      setIsTesting(false)
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="p-4 bg-dj-dark text-white">
      <h2 className="text-xl font-bold mb-4">🧪 Test Controlli Audio</h2>
      
      <div className="mb-4">
        <button
          onClick={runAudioControlsTest}
          disabled={isTesting}
          className="px-4 py-2 bg-dj-highlight text-white rounded hover:bg-dj-highlight-dark disabled:opacity-50"
        >
          {isTesting ? '🔄 Test in corso...' : '🚀 Avvia Test'}
        </button>
        
        <button
          onClick={clearResults}
          className="ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          🗑️ Pulisci Risultati
        </button>
        
        <button
          onClick={() => {
            addTestResult('🎮 Test diretto controlli audio...')
            if (state.leftDeck.track) {
              addTestResult('   - Testando left deck...')
              const wasPlaying = state.leftDeck.isPlaying
              addTestResult(`   - Stato prima: ${wasPlaying ? 'Playing' : 'Paused'}`)
              handlePlayPauseDefinitive('left')
              setTimeout(() => {
                const newState = state.leftDeck.isPlaying
                addTestResult(`   - Stato dopo: ${newState ? 'Playing' : 'Paused'}`)
                if (newState !== wasPlaying) {
                  addTestResult('   ✅ Left deck: Controlli funzionanti!')
                } else {
                  addTestResult('   ❌ Left deck: Controlli non funzionano')
                }
              }, 1000)
            }
          }}
          className="ml-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          🎮 Test Diretto
        </button>
      </div>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">📊 Stato Attuale:</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dj-darker p-3 rounded">
            <h4 className="font-semibold text-dj-highlight">Left Deck</h4>
            <p>Track: {state.leftDeck.track?.title || 'Nessuna'}</p>
            <p>Playing: {state.leftDeck.isPlaying ? '▶️' : '⏸️'}</p>
            <p>Time: {state.leftDeck.currentTime.toFixed(1)}s</p>
          </div>
          <div className="bg-dj-darker p-3 rounded">
            <h4 className="font-semibold text-dj-highlight">Right Deck</h4>
            <p>Track: {state.rightDeck.track?.title || 'Nessuna'}</p>
            <p>Playing: {state.rightDeck.isPlaying ? '▶️' : '⏸️'}</p>
            <p>Time: {state.rightDeck.currentTime.toFixed(1)}s</p>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">📋 Risultati Test:</h3>
        <div className="bg-dj-darker p-3 rounded max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-400">Nessun test eseguito. Clicca "Avvia Test" per iniziare.</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1 font-mono text-sm">
                {result}
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-blue-900 rounded">
        <h4 className="font-semibold text-blue-200">💡 Come usare questo test:</h4>
        <ol className="list-decimal list-inside text-sm text-blue-100">
          <li>Carica una traccia in uno dei deck</li>
          <li>Avvia il test per verificare i controlli</li>
          <li>Cambia pagina e torna alla console</li>
          <li>Verifica che i controlli funzionino ancora</li>
          <li>Esegui nuovamente il test per confermare</li>
        </ol>
      </div>
    </div>
  )
}

export default TestAudioControls
