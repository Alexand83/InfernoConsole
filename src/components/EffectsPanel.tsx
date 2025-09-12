import React, { useState, useEffect } from 'react'
import { SoundEffectsManager, SoundEffect } from '../audio/SoundEffectsManager'
import { MicrophoneEffectsManager, MicrophoneEffect } from '../audio/MicrophoneEffectsManager'

interface EffectsPanelProps {
  className?: string
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ className = '' }) => {
  const [soundEffectsManager] = useState(() => new SoundEffectsManager())
  const [microphoneEffectsManager] = useState(() => new MicrophoneEffectsManager())
  
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([])
  const [microphoneEffects, setMicrophoneEffects] = useState<MicrophoneEffect[]>([])
  const [microphonePresets, setMicrophonePresets] = useState<Array<{id: string, name: string, description: string}>>([])
  
  const [selectedMicrophonePreset, setSelectedMicrophonePreset] = useState<string>('none')
  const [soundEffectsVolume, setSoundEffectsVolume] = useState<number>(0.8)
  const [microphoneVolume, setMicrophoneVolume] = useState<number>(1.0)
  
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  useEffect(() => {
    // Inizializza i manager
    soundEffectsManager.setCallbacks({
      onDebug: (message) => console.log(message),
      onError: (error) => console.error(error)
    })

    microphoneEffectsManager.setCallbacks({
      onDebug: (message) => console.log(message),
      onError: (error) => console.error(error)
    })

    // Carica effetti disponibili
    const loadEffects = async () => {
      // Aspetta che i manager siano inizializzati
      const checkInitialization = () => {
        if (soundEffectsManager.isReady() && microphoneEffectsManager.isReady()) {
          setSoundEffects(soundEffectsManager.getAvailableEffects())
          setMicrophoneEffects(microphoneEffectsManager.getAvailableEffects())
          setMicrophonePresets(microphoneEffectsManager.getAvailablePresets())
          setIsInitialized(true)
        } else {
          setTimeout(checkInitialization, 100)
        }
      }
      checkInitialization()
    }

    loadEffects()

    return () => {
      // Cleanup
      microphoneEffectsManager.disconnectMicrophone()
    }
  }, [soundEffectsManager, microphoneEffectsManager])

  // Riproduce un effetto sonoro
  const playSoundEffect = async (effectId: string) => {
    if (!isInitialized) return
    
    try {
      await soundEffectsManager.playSoundEffect(effectId, soundEffectsVolume)
    } catch (error) {
      console.error('Errore riproduzione effetto:', error)
    }
  }

  // Applica preset microfono
  const applyMicrophonePreset = (presetId: string) => {
    if (!isInitialized) return
    
    setSelectedMicrophonePreset(presetId)
    microphoneEffectsManager.applyPreset(presetId)
  }

  // Aggiorna volume effetti sonori
  const updateSoundEffectsVolume = (volume: number) => {
    setSoundEffectsVolume(volume)
    soundEffectsManager.setMasterVolume(volume)
  }

  // Aggiorna volume microfono
  const updateMicrophoneVolume = (volume: number) => {
    setMicrophoneVolume(volume)
    microphoneEffectsManager.setOutputVolume(volume)
  }

  // Raggruppa effetti per categoria
  const groupedSoundEffects = soundEffects.reduce((acc, effect) => {
    if (!acc[effect.category]) {
      acc[effect.category] = []
    }
    acc[effect.category].push(effect)
    return acc
  }, {} as Record<string, SoundEffect[]>)

  const categoryNames = {
    applause: 'Applausi',
    horn: 'Trombette',
    transition: 'Transizioni',
    ambient: 'Ambientali',
    comedy: 'Comici'
  }

  if (!isInitialized) {
    return (
      <div className={`effects-panel ${className}`}>
        <div className="loading">
          <div className="spinner"></div>
          <p>Caricamento effetti...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`effects-panel ${className}`}>
      <div className="effects-header">
        <h3>🎵 Effetti Audio</h3>
      </div>

      {/* Sound Effects */}
      <div className="effects-section">
        <div className="section-header">
          <h4>🎶 Sound Effects</h4>
          <div className="volume-control">
            <label>Volume:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={soundEffectsVolume}
              onChange={(e) => updateSoundEffectsVolume(parseFloat(e.target.value))}
              className="volume-slider"
            />
            <span>{Math.round(soundEffectsVolume * 100)}%</span>
          </div>
        </div>

        <div className="effects-grid">
          {Object.entries(groupedSoundEffects).map(([category, effects]) => (
            <div key={category} className="effect-category">
              <h5>{categoryNames[category as keyof typeof categoryNames] || category}</h5>
              <div className="effect-buttons">
                {effects.map((effect) => (
                  <button
                    key={effect.id}
                    onClick={() => playSoundEffect(effect.id)}
                    className="effect-button"
                    title={effect.description}
                  >
                    {effect.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Microphone Effects */}
      <div className="effects-section">
        <div className="section-header">
          <h4>🎤 Effetti Microfono</h4>
          <div className="volume-control">
            <label>Volume:</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={microphoneVolume}
              onChange={(e) => updateMicrophoneVolume(parseFloat(e.target.value))}
              className="volume-slider"
            />
            <span>{Math.round(microphoneVolume * 100)}%</span>
          </div>
        </div>

        <div className="preset-selector">
          <label>Preset:</label>
          <select
            value={selectedMicrophonePreset}
            onChange={(e) => applyMicrophonePreset(e.target.value)}
            className="preset-select"
          >
            {microphonePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} - {preset.description}
              </option>
            ))}
          </select>
        </div>

        <div className="microphone-effects">
          <h5>Effetti Individuali</h5>
          <div className="effect-controls">
            {microphoneEffects.map((effect) => (
              <div key={effect.id} className="effect-control">
                <label>{effect.name}</label>
                <div className="effect-parameters">
                  {Object.entries(effect.parameters).map(([param, value]) => (
                    <div key={param} className="parameter">
                      <label>{param}:</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue={value}
                        onChange={(e) => {
                          // Qui potresti implementare la logica per applicare l'effetto
                          console.log(`Applica ${effect.id}.${param}: ${e.target.value}`)
                        }}
                        className="parameter-slider"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .effects-panel {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 20px;
          color: white;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
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

        .effects-section {
          margin-bottom: 30px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .section-header h4 {
          margin: 0;
          font-size: 1.2em;
          color: #00d4ff;
        }

        .volume-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .volume-control label {
          font-size: 0.9em;
          color: #ccc;
        }

        .volume-slider {
          width: 100px;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.2);
          outline: none;
          -webkit-appearance: none;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #00d4ff;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 212, 255, 0.3);
        }

        .effects-grid {
          display: grid;
          gap: 20px;
        }

        .effect-category h5 {
          margin: 0 0 10px 0;
          font-size: 1em;
          color: #ff6b6b;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .effect-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .effect-button {
          padding: 8px 16px;
          background: linear-gradient(45deg, #00d4ff, #0099cc);
          border: none;
          border-radius: 20px;
          color: white;
          font-size: 0.9em;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 212, 255, 0.2);
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

        .preset-selector {
          margin-bottom: 20px;
        }

        .preset-selector label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.9em;
          color: #ccc;
        }

        .preset-select {
          width: 100%;
          padding: 10px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: white;
          font-size: 0.9em;
        }

        .preset-select option {
          background: #1a1a2e;
          color: white;
        }

        .microphone-effects h5 {
          margin: 0 0 15px 0;
          font-size: 1em;
          color: #ff6b6b;
        }

        .effect-controls {
          display: grid;
          gap: 15px;
        }

        .effect-control {
          padding: 15px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .effect-control label {
          display: block;
          margin-bottom: 10px;
          font-size: 0.9em;
          color: #00d4ff;
          font-weight: 500;
        }

        .effect-parameters {
          display: grid;
          gap: 10px;
        }

        .parameter {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .parameter label {
          min-width: 80px;
          font-size: 0.8em;
          color: #ccc;
          margin: 0;
        }

        .parameter-slider {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.2);
          outline: none;
          -webkit-appearance: none;
        }

        .parameter-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ff6b6b;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}