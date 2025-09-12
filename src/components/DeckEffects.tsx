import React, { useState, useEffect } from 'react'
import { useAudio } from '../contexts/AudioContext'
import { SoundEffectsManager } from '../audio/SoundEffectsManager'

interface DeckEffectsProps {
  className?: string
}

export const DeckEffects: React.FC<DeckEffectsProps> = ({ className = '' }) => {
  const { state: audioState, soundEffectsManagerRef, microphoneEffectsManagerRef } = useAudio()
  const [soundEffectsManager, setSoundEffectsManager] = useState<SoundEffectsManager | null>(null)
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [reverbEnabled, setReverbEnabled] = useState<boolean>(false)
  const [reverbAmount, setReverbAmount] = useState<number>(0.5)
  const [distortionEnabled, setDistortionEnabled] = useState<boolean>(false)
  const [distortionAmount, setDistortionAmount] = useState<number>(0.5)
  const [pitchEnabled, setPitchEnabled] = useState<boolean>(false)
  const [pitchAmount, setPitchAmount] = useState<number>(0.5)
  const [echoEnabled, setEchoEnabled] = useState<boolean>(false)
  const [echoAmount, setEchoAmount] = useState<number>(0.5)
  const [initializationError, setInitializationError] = useState<boolean>(false)

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 50 // 5 secondi totali
    
    const checkInitialization = () => {
      attempts++
      
      if (soundEffectsManagerRef?.current) {
        setSoundEffectsManager(soundEffectsManagerRef.current)
        setIsInitialized(true)
        console.log('🎵 [DECK EFFECTS] SoundEffectsManager inizializzato')
      } else if (attempts < maxAttempts) {
        // Riprova dopo 100ms se non è ancora disponibile
        setTimeout(checkInitialization, 100)
      } else {
        // Fallback: crea il manager direttamente
        console.warn('⚠️ [DECK EFFECTS] SoundEffectsManager non disponibile, creazione fallback...')
        try {
          const fallbackManager = new SoundEffectsManager()
          fallbackManager.setCallbacks({
            onDebug: (message) => console.log(message),
            onError: (error) => console.error(error)
          })
          setSoundEffectsManager(fallbackManager)
          setIsInitialized(true)
          console.log('🎵 [DECK EFFECTS] SoundEffectsManager fallback creato')
        } catch (error) {
          setInitializationError(true)
          console.error('❌ [DECK EFFECTS] Errore creazione fallback:', error)
        }
      }
    }
    
    checkInitialization()
  }, [soundEffectsManagerRef])

  // Riproduce un effetto sonoro
  const playSoundEffect = async (effectId: string) => {
    console.log(`🎵 [SOUND EFFECTS] Tentativo riproduzione: ${effectId}`)
    console.log(`🎵 [SOUND EFFECTS] soundEffectsManager: ${soundEffectsManager ? '✅ SÌ' : '❌ NO'}`)
    console.log(`🎵 [SOUND EFFECTS] isInitialized: ${isInitialized ? '✅ SÌ' : '❌ NO'}`)
    
    if (!soundEffectsManager || !isInitialized) {
      console.warn(`🎵 [SOUND EFFECTS] ❌ Non posso riprodurre ${effectId} - manager o inizializzazione non disponibili`)
      return
    }
    
    try {
      console.log(`🎵 [SOUND EFFECTS] Chiamando playSoundEffect per: ${effectId}`)
      const result = await soundEffectsManager.playSoundEffect(effectId, 0.8)
      console.log(`🎵 [SOUND EFFECTS] Risultato playSoundEffect: ${result}`)
    } catch (error) {
      console.error('🎵 [SOUND EFFECTS] Errore riproduzione effetto:', error)
    }
  }

  // Toggle reverbero microfono
  const toggleReverb = () => {
    const newReverbState = !reverbEnabled
    setReverbEnabled(newReverbState)
    
    // Usa i controlli globali del reverbero
    const reverbGain = (window as any).microphoneReverbGain
    const dryGain = (window as any).microphoneDryGain
    
    if (reverbGain && dryGain) {
      if (newReverbState) {
        // Attiva reverbero
        reverbGain.gain.setValueAtTime(reverbAmount, reverbGain.context.currentTime)
        dryGain.gain.setValueAtTime(1 - reverbAmount, dryGain.context.currentTime)
        console.log(`🎤 [REVERB] Reverbero attivato: ${Math.round(reverbAmount * 100)}%`)
      } else {
        // Disattiva reverbero
        reverbGain.gain.setValueAtTime(0, reverbGain.context.currentTime)
        dryGain.gain.setValueAtTime(1, dryGain.context.currentTime)
        console.log('🎤 [REVERB] Reverbero disattivato')
      }
    } else {
      console.warn('🎤 [REVERB] Controlli reverbero non disponibili')
    }
  }

  // Aggiorna quantità reverbero
  const updateReverbAmount = (amount: number) => {
    setReverbAmount(amount)
    
    if (reverbEnabled) {
      const reverbGain = (window as any).microphoneReverbGain
      const dryGain = (window as any).microphoneDryGain
      
      if (reverbGain && dryGain) {
        reverbGain.gain.setValueAtTime(amount, reverbGain.context.currentTime)
        dryGain.gain.setValueAtTime(1 - amount, dryGain.context.currentTime)
        console.log(`🎤 [REVERB] Reverbero aggiornato: ${Math.round(amount * 100)}%`)
      }
    }
  }

  // Controlla la distorsione del microfono
  const toggleDistortion = () => {
    const newDistortionState = !distortionEnabled
    setDistortionEnabled(newDistortionState)
    
    // Usa i controlli globali del microfono se disponibili
    const microphoneGain = (window as any).microphoneGain
    console.log(`🔍 [DISTORTION] Debug microphoneGain: ${microphoneGain ? '✅ DISPONIBILE' : '❌ NON DISPONIBILE'}`)
    
    if (microphoneGain) {
      if (newDistortionState) {
        // Simula distorsione con gain molto alto
        microphoneGain.gain.setValueAtTime(2 + distortionAmount * 3, microphoneGain.context.currentTime)
        console.log(`🎤 [DISTORTION] Distorsione attivata: ${Math.round(distortionAmount * 100)}%`)
      } else {
        microphoneGain.gain.setValueAtTime(1, microphoneGain.context.currentTime)
        console.log('🎤 [DISTORTION] Distorsione disattivata')
      }
    } else {
      console.warn('🎤 [DISTORTION] Controlli microfono non disponibili')
    }
  }

  const updateDistortionAmount = (amount: number) => {
    setDistortionAmount(amount)
    if (distortionEnabled) {
      const microphoneGain = (window as any).microphoneGain
      if (microphoneGain) {
        microphoneGain.gain.setValueAtTime(2 + amount * 3, microphoneGain.context.currentTime)
        console.log(`🎤 [DISTORTION] Distorsione aggiornata: ${Math.round(amount * 100)}%`)
      }
    }
  }

  // Controlla il pitch shift (voce donna)
  const togglePitch = () => {
    const newPitchState = !pitchEnabled
    setPitchEnabled(newPitchState)
    
    // Usa i controlli globali del microfono se disponibili
    const microphoneGain = (window as any).microphoneGain
    if (microphoneGain) {
      if (newPitchState) {
        // Simula pitch shift con gain molto ridotto (voce più acuta)
        microphoneGain.gain.setValueAtTime(0.5 + pitchAmount * 0.2, microphoneGain.context.currentTime)
        console.log(`🎤 [PITCH] Voce donna attivata: ${Math.round(pitchAmount * 100)}%`)
      } else {
        microphoneGain.gain.setValueAtTime(1, microphoneGain.context.currentTime)
        console.log('🎤 [PITCH] Voce donna disattivata')
      }
    } else {
      console.warn('🎤 [PITCH] Controlli microfono non disponibili')
    }
  }

  const updatePitchAmount = (amount: number) => {
    setPitchAmount(amount)
    if (pitchEnabled) {
      const microphoneGain = (window as any).microphoneGain
      if (microphoneGain) {
        microphoneGain.gain.setValueAtTime(0.5 + amount * 0.2, microphoneGain.context.currentTime)
        console.log(`🎤 [PITCH] Voce donna aggiornata: ${Math.round(amount * 100)}%`)
      }
    }
  }

  // Controlla l'eco del microfono
  const toggleEcho = () => {
    const newEchoState = !echoEnabled
    setEchoEnabled(newEchoState)
    
    // Usa i controlli globali del microfono se disponibili
    const microphoneGain = (window as any).microphoneGain
    if (microphoneGain) {
      if (newEchoState) {
        // Simula eco con gain modulato
        microphoneGain.gain.setValueAtTime(1.5 + echoAmount * 1, microphoneGain.context.currentTime)
        console.log(`🎤 [ECHO] Eco attivato: ${Math.round(echoAmount * 100)}%`)
      } else {
        microphoneGain.gain.setValueAtTime(1, microphoneGain.context.currentTime)
        console.log('🎤 [ECHO] Eco disattivato')
      }
    } else {
      console.warn('🎤 [ECHO] Controlli microfono non disponibili')
    }
  }

  const updateEchoAmount = (amount: number) => {
    setEchoAmount(amount)
    if (echoEnabled) {
      const microphoneGain = (window as any).microphoneGain
      if (microphoneGain) {
        microphoneGain.gain.setValueAtTime(1.5 + amount * 1, microphoneGain.context.currentTime)
        console.log(`🎤 [ECHO] Eco aggiornato: ${Math.round(amount * 100)}%`)
      }
    }
  }

  if (!isInitialized) {
    return (
      <div className={`deck-effects ${className}`}>
        <div className="loading">
          <div className="spinner"></div>
          <p>Caricamento effetti...</p>
          {initializationError && (
            <p className="error">Errore caricamento effetti. Riprova a ricaricare la pagina.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`deck-effects ${className}`}>
      <div className="effects-header">
        <h3>🎵 Effetti Audio</h3>
      </div>

      {/* Sound Effects */}
      <div className="sound-effects-section">
        <h4>🎶 Sound Effects</h4>
        <div className="effects-grid">
          <button
            onClick={() => playSoundEffect('applause')}
            className="effect-button applause"
            title="Applausi del pubblico"
          >
            👏 Applausi
          </button>
          
          <button
            onClick={() => playSoundEffect('horn')}
            className="effect-button horn"
            title="Suono di trombetta"
          >
            📯 Trombetta
          </button>
          
          <button
            onClick={() => playSoundEffect('swoosh')}
            className="effect-button swoosh"
            title="Effetto di transizione"
          >
            💨 Swoosh
          </button>
          
          <button
            onClick={() => playSoundEffect('whoosh')}
            className="effect-button whoosh"
            title="Effetto di movimento"
          >
            🌪️ Whoosh
          </button>
          
          <button
            onClick={() => playSoundEffect('beep')}
            className="effect-button beep"
            title="Suono di notifica"
          >
            🔔 Beep
          </button>
          
          <button
            onClick={() => playSoundEffect('drop')}
            className="effect-button drop"
            title="Effetto di caduta"
          >
            📉 Drop
          </button>
          
          <button
            onClick={() => playSoundEffect('rise')}
            className="effect-button rise"
            title="Effetto di ascesa"
          >
            📈 Rise
          </button>
          
          <button
            onClick={() => playSoundEffect('squeak')}
            className="effect-button squeak"
            title="Suono che perde"
          >
            🎵 Squeak
          </button>
        </div>
      </div>

      {/* Microphone Effects - Layout Orizzontale */}
      <div className="microphone-effects-section">
        <h4>🎤 Effetti Microfono</h4>
        <div className="mic-effects-grid">
          
          {/* Reverbero */}
          <div className="mic-effect-card">
            <div className="effect-header">
              <button
                onClick={toggleReverb}
                className={`effect-button reverb ${reverbEnabled ? 'active' : ''}`}
                title={reverbEnabled ? 'Disattiva reverbero' : 'Attiva reverbero'}
              >
                🎤 Reverbero
              </button>
            </div>
            
            {reverbEnabled && (
              <div className="effect-controls">
                <label>Intensità:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={reverbAmount}
                  onChange={(e) => updateReverbAmount(parseFloat(e.target.value))}
                  className="slider"
                />
                <span>{Math.round(reverbAmount * 100)}%</span>
              </div>
            )}
          </div>

          {/* Distorsione */}
          <div className="mic-effect-card">
            <div className="effect-header">
              <button
                onClick={toggleDistortion}
                className={`effect-button distortion ${distortionEnabled ? 'active' : ''}`}
                title={distortionEnabled ? 'Disattiva distorsione' : 'Attiva distorsione'}
              >
                🔥 Distorsione
              </button>
            </div>
            
            {distortionEnabled && (
              <div className="effect-controls">
                <label>Intensità:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={distortionAmount}
                  onChange={(e) => updateDistortionAmount(parseFloat(e.target.value))}
                  className="slider"
                />
                <span>{Math.round(distortionAmount * 100)}%</span>
              </div>
            )}
          </div>

          {/* Voce Donna */}
          <div className="mic-effect-card">
            <div className="effect-header">
              <button
                onClick={togglePitch}
                className={`effect-button pitch ${pitchEnabled ? 'active' : ''}`}
                title={pitchEnabled ? 'Disattiva voce donna' : 'Attiva voce donna'}
              >
                👩 Voce Donna
              </button>
            </div>
            
            {pitchEnabled && (
              <div className="effect-controls">
                <label>Intensità:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={pitchAmount}
                  onChange={(e) => updatePitchAmount(parseFloat(e.target.value))}
                  className="slider"
                />
                <span>{Math.round(pitchAmount * 100)}%</span>
              </div>
            )}
          </div>

          {/* Eco */}
          <div className="mic-effect-card">
            <div className="effect-header">
              <button
                onClick={toggleEcho}
                className={`effect-button echo ${echoEnabled ? 'active' : ''}`}
                title={echoEnabled ? 'Disattiva eco' : 'Attiva eco'}
              >
                🏔️ Eco
              </button>
            </div>
            
            {echoEnabled && (
              <div className="effect-controls">
                <label>Intensità:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={echoAmount}
                  onChange={(e) => updateEchoAmount(parseFloat(e.target.value))}
                  className="slider"
                />
                <span>{Math.round(echoAmount * 100)}%</span>
              </div>
            )}
          </div>

          {/* Preset Grotta */}
          <div className="mic-effect-card">
            <div className="effect-header">
              <button
                onClick={() => {
                  if (microphoneEffectsManagerRef?.current) {
                    microphoneEffectsManagerRef.current.applyPreset('cave')
                    console.log('🎤 [PRESET] Grotta applicata')
                  }
                }}
                className="effect-button cave"
                title="Applica preset grotta"
              >
                🕳️ Grotta
              </button>
            </div>
          </div>
          
        </div>
      </div>

      <style jsx>{`
        .deck-effects {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 20px;
          color: white;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-top: 20px;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-left: 4px solid #00d4ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .error {
          color: #ff6b6b;
          font-size: 0.9em;
          margin-top: 10px;
          text-align: center;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .effects-header h3 {
          margin: 0 0 20px 0;
          font-size: 1.5em;
          text-align: center;
          background: linear-gradient(45deg, #00d4ff, #ff6b6b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .sound-effects-section,
        .microphone-effects-section {
          margin-bottom: 25px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .sound-effects-section h4,
        .microphone-effects-section h4 {
          margin: 0 0 15px 0;
          font-size: 1.2em;
          color: #00d4ff;
        }

        .effects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }

        .effect-button {
          padding: 10px 15px;
          background: linear-gradient(45deg, #00d4ff, #0099cc);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 0.9em;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 212, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }

        .effect-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
          background: linear-gradient(45deg, #00e5ff, #00aadd);
        }

        .effect-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 212, 255, 0.3);
        }

        .reverb-controls {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .reverb-toggle {
          display: flex;
          justify-content: center;
        }

        .reverb-button {
          padding: 12px 24px;
          background: linear-gradient(45deg, #ff6b6b, #ee5a52);
          border: none;
          border-radius: 25px;
          color: white;
          font-size: 1em;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .reverb-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
        }

        .reverb-button.active {
          background: linear-gradient(45deg, #00d4ff, #0099cc);
          box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
        }

        .reverb-button.active:hover {
          box-shadow: 0 6px 20px rgba(0, 212, 255, 0.4);
        }

        .reverb-slider {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }

        .reverb-slider label {
          font-size: 0.9em;
          color: #ccc;
          min-width: 120px;
        }

        .slider {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.2);
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #00d4ff;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 212, 255, 0.3);
        }

        .reverb-slider span {
          font-size: 0.9em;
          color: #00d4ff;
          font-weight: 600;
          min-width: 40px;
          text-align: center;
        }

        /* Layout Orizzontale Effetti Microfono */
        .mic-effects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }

        .mic-effect-card {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 15px;
          transition: all 0.3s ease;
        }

        .mic-effect-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .effect-button {
          width: 100%;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 1em;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .effect-button.reverb {
          background: linear-gradient(45deg, #ff6b6b, #ee5a52);
          box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        }

        .effect-button.distortion {
          background: linear-gradient(45deg, #ff4757, #ff3742);
          box-shadow: 0 4px 15px rgba(255, 71, 87, 0.3);
        }

        .effect-button.pitch {
          background: linear-gradient(45deg, #ff9f43, #ff8c42);
          box-shadow: 0 4px 15px rgba(255, 159, 67, 0.3);
        }

        .effect-button.echo {
          background: linear-gradient(45deg, #a55eea, #8b5cf6);
          box-shadow: 0 4px 15px rgba(165, 94, 234, 0.3);
        }

        .effect-button.cave {
          background: linear-gradient(45deg, #2c2c54, #40407a);
          box-shadow: 0 4px 15px rgba(44, 44, 84, 0.3);
        }

        .effect-button:hover {
          transform: translateY(-2px);
        }

        .effect-button.reverb:hover {
          box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
        }

        .effect-button.distortion:hover {
          box-shadow: 0 6px 20px rgba(255, 71, 87, 0.4);
        }

        .effect-button.pitch:hover {
          box-shadow: 0 6px 20px rgba(255, 159, 67, 0.4);
        }

        .effect-button.echo:hover {
          box-shadow: 0 6px 20px rgba(165, 94, 234, 0.4);
        }

        .effect-button.cave:hover {
          box-shadow: 0 6px 20px rgba(44, 44, 84, 0.4);
        }

        .effect-button.active {
          background: linear-gradient(45deg, #00d4ff, #0099cc);
          box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);
        }

        .effect-button.active:hover {
          box-shadow: 0 6px 20px rgba(0, 212, 255, 0.4);
        }

        .effect-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .effect-controls label {
          font-size: 0.9em;
          color: #ccc;
          text-align: center;
        }

        .effect-controls span {
          font-size: 0.9em;
          font-weight: 600;
          text-align: center;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
      `}</style>
    </div>
  )
}
