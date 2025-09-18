import React, { useState, useEffect, useCallback } from 'react'
import { Volume2, Mic, MicOff, Radio, Settings } from 'lucide-react'
import { useAudio } from '../../contexts/AudioContext'
import { useSettings } from '../../contexts/SettingsContext'
import { usePTT } from '../../hooks/usePTT'
import { useTranslation } from '../../i18n'

interface EnhancedMixerProps {
  leftDeckActive: boolean
  rightDeckActive: boolean
  onMasterVolumeChange?: (volume: number) => void
  onStreamVolumeChange?: (volume: number) => void
  onPTTActivate?: (active: boolean) => void
}

const EnhancedMixer: React.FC<EnhancedMixerProps> = ({
  leftDeckActive,
  rightDeckActive,
  onMasterVolumeChange,
  onStreamVolumeChange,
  onPTTActivate
}) => {
  const { 
    state: audioState,
    setStreamDucking,
    setCrossfader
  } = useAudio()
  
  const { settings } = useSettings()
  const { t } = useTranslation()
  
  // Stati locali per i controlli
  const [masterVolume, setMasterVolume] = useState(0.8) // Volume locale
  const [streamVolume, setStreamVolume] = useState(1.0) // ✅ CRITICAL FIX: Volume streaming al 100% di default (come richiesto dall'utente)
  const [pttActive, setPttActive] = useState(false)
  const [crossfaderValue, setCrossfaderValue] = useState(0.5)

  // Sincronizza il crossfader con lo stato globale
  useEffect(() => {
    setCrossfaderValue(audioState.crossfader)
  }, [audioState.crossfader])

  // Log microphone status only when it changes (prevents console spam)
  useEffect(() => {
    const micDevice = settings.microphone?.inputDevice;
    if (micDevice && micDevice !== 'default') {
      if ((window as any).__activeMicrophoneStreams && (window as any).__activeMicrophoneStreams.size > 0) {
        const activeStreams = Array.from((window as any).__activeMicrophoneStreams);
        if (activeStreams.length > 0) {
          const stream = activeStreams[activeStreams.length - 1] as MediaStream;
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            const trackSettings = audioTrack.getSettings();
            const trackDeviceId = trackSettings.deviceId;
            const trackLabel = (trackSettings as any).label || 'Unknown';
            
            if (trackDeviceId === micDevice) {
              console.log('🎯 [PTT] Dispositivo corretto!');
            } else {
              console.log('❌ [PTT] Dispositivo diverso!');
            }
            console.log('🎤 [PTT] Stream attivo:', trackLabel, 'Device:', trackDeviceId?.substring(0, 8) + '...');
          }
        }
      } else {
        console.log('🎤 [PTT] Nessun stream microfono attivo trovato');
      }
    }
  }, [settings.microphone?.inputDevice, audioState.microphone?.isEnabled])

  // Gestione PTT con ducking SOLO WebAudio (non tocca volumi locali)
  const handlePTTActivate = useCallback((active: boolean) => {
    setPttActive(active)
    onPTTActivate?.(active)
    
    // ✅ CRITICAL FIX: PTT gestisce SOLO WebAudio ducking - NON tocca i volumi locali!
    // Il ducking viene gestito da updatePTTVolumesOnly() in AudioContext
    
    if (active) {
      // Attiva ducking per lo streaming (solo WebAudio mixer)
      setStreamDucking(true)
      console.log(`🎤 PTT attivato - ducking WebAudio al ${settings.microphone.duckingPercent}%`)
    } else {
      // Disattiva ducking per lo streaming
      setStreamDucking(false)
      console.log('🎤 PTT disattivato - ducking WebAudio rimosso')
    }
  }, [settings.microphone.duckingPercent, setStreamDucking, onPTTActivate])

  // Gestione crossfader (solo per streaming)
  const handleCrossfaderChange = useCallback((value: number) => {
    setCrossfaderValue(value)
    setCrossfader(value)
    console.log(`🎚️ [CROSSFADER] Crossfader cambiato: ${Math.round(value * 100)}% (A=${Math.round((1-value)*100)}%, B=${Math.round(value*100)}%)`)
  }, [setCrossfader])

  // Gestione volume master (solo locale)
  const handleMasterVolumeChange = useCallback((volume: number) => {
    setMasterVolume(volume)
    onMasterVolumeChange?.(volume)
    
    // ✅ CRITICAL FIX: Il volume master viene gestito dallo stato globale
    // Non serve più applicazione manuale ai volumi HTML
    
    console.log(`🔊 MASTER Volume (locale): ${Math.round(volume * 100)}%`)
  }, [onMasterVolumeChange])

  // Gestione volume stream (solo streaming)
  const handleStreamVolumeChange = useCallback((volume: number) => {
    setStreamVolume(volume)
    onStreamVolumeChange?.(volume)
    
    // ✅ CRITICAL FIX: L'evento viene emesso dal listener esterno (PTT)
    // Non serve più emetterlo qui per evitare duplicazioni
    
    console.log(`📡 STREAM Volume (live): ${Math.round(volume * 100)}%`)
  }, [onStreamVolumeChange])

  // ✅ CRITICAL FIX: Ascolta l'evento per aggiornare il volume del Live Stream dall'esterno (PTT)
  useEffect(() => {
    const handleStreamVolumeChangeEvent = (event: CustomEvent) => {
      const newVolume = event.detail.volume
      console.log(`📡 [EVENT] Volume Live Stream aggiornato da evento: ${Math.round(newVolume * 100)}%`)
      
      // Aggiorna lo stato locale per sincronizzare l'interfaccia
      setStreamVolume(newVolume)
      
      // Notifica il cambiamento
      onStreamVolumeChange?.(newVolume)
    }
    
    // Ascolta l'evento custom per aggiornamenti esterni (PTT)
    window.addEventListener('djconsole:stream-volume-change', handleStreamVolumeChangeEvent as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:stream-volume-change', handleStreamVolumeChangeEvent as EventListener)
    }
  }, [onStreamVolumeChange])

  // ✅ FIX: Usa il nuovo hook PTT che legge l'impostazione dalle settings
  usePTT(handlePTTActivate)

  return (
    <div className="bg-dj-primary rounded-xl border border-dj-accent/30 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-dj font-bold text-white flex items-center space-x-2">
          <Volume2 className="w-5 h-5" />
          <span>Mixer & Controls</span>
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${leftDeckActive ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className="text-xs text-dj-light/60">A</span>
          <div className={`w-2 h-2 rounded-full ${rightDeckActive ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className="text-xs text-dj-light/60">B</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Crossfader */}
        <div className="bg-dj-secondary rounded-lg p-3">
          <div className="text-center mb-3">
            <h4 className="text-sm font-medium text-white mb-1">Crossfader</h4>
            <div className="text-xs text-dj-light/60 mb-2">
              A: {Math.round((1-crossfaderValue)*100)}% | B: {Math.round(crossfaderValue*100)}%
            </div>
            <div className="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-md border border-yellow-400/30 font-medium">
              ⚠️ Solo per streaming
            </div>
          </div>
          
          <div className="relative">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={crossfaderValue}
              onChange={(e) => handleCrossfaderChange(parseFloat(e.target.value))}
              className="dj-slider w-full h-3"
              aria-label="Crossfader"
            />
            <div className="flex justify-between text-xs text-dj-light/60 mt-1">
              <span>A</span>
              <span>CENTER</span>
              <span>B</span>
            </div>
          </div>
        </div>

        {/* Controlli Volume */}
        <div className="bg-dj-secondary rounded-lg p-3">
          <h4 className="text-sm font-medium text-white mb-3 text-center">Volume Controls</h4>
          
          {/* Volume Master (Solo Locale) */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-dj-light/80">Master (Locale)</span>
              <span className="text-xs text-dj-light/60">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
              className="dj-slider w-full h-2"
              aria-label="Volume Master (Locale)"
            />
            <div className="text-xs text-dj-light/50 mt-1">
              Solo per monitoring locale
            </div>
          </div>

          {/* Volume Stream (Solo Streaming) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-1">
                <Radio className="w-3 h-3 text-red-500" />
                <span className="text-xs text-dj-light/80">Live Stream</span>
              </div>
              <span className="text-xs text-dj-light/60">{Math.round(streamVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={streamVolume}
              onChange={(e) => handleStreamVolumeChange(parseFloat(e.target.value))}
              className="dj-slider w-full h-2 accent-red-500"
              aria-label="Volume Live Stream"
            />
            <div className="text-xs text-red-400/70 mt-1">
              Solo per lo streaming live
            </div>
          </div>
        </div>

        {/* Controlli Microfono */}
        <div className="bg-dj-secondary rounded-lg p-3">
          <h4 className="text-sm font-medium text-white mb-3 text-center">Microfono</h4>
          
          {/* Toggle Microfono */}
          {/* ✅ RIMOSSO: Pulsante Microfono OFF - ora gestito automaticamente dal PTT */}

          {/* PTT Button */}
          <div className="mb-3">
            <button
              onMouseDown={() => handlePTTActivate(true)}
              onMouseUp={() => handlePTTActivate(false)}
              onMouseLeave={() => handlePTTActivate(false)}
              onTouchStart={(e) => { e.preventDefault(); handlePTTActivate(true) }}
              onTouchEnd={(e) => { e.preventDefault(); handlePTTActivate(false) }}
              className={`w-full p-2 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                pttActive
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-dj-primary text-dj-light hover:bg-dj-accent'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span className="text-sm font-bold">
                {pttActive ? t('streaming.pttActive') : t('streaming.activatePTT')}
              </span>
            </button>
            
            {/* ✅ INDICATORE MICROFONO IN TEMPO REALE */}
            {pttActive && (
              <div className="mt-2 bg-red-900/80 text-red-100 px-2 py-1 rounded text-xs font-mono border border-red-500/50">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="truncate">
                    {(() => {
                      // Mostra il nome del microfono attualmente in uso
                      const micDevice = settings.microphone?.inputDevice;
                      if (micDevice && micDevice !== 'default') {
                        // Cerca il nome del dispositivo dalle impostazioni
                        const deviceName = micDevice;
                        return `MIC: ${deviceName.length > 25 ? deviceName.substring(0, 25) + '...' : deviceName}`;
                      } else {
                        return 'MIC: Default';
                      }
                    })()}
                  </span>
                </div>
                
                {/* ✅ INDICATORE STATO MICROFONO */}
                <div className="mt-1 text-xs text-red-200/80">
                  {(() => {
                    const micDevice = settings.microphone?.inputDevice;
                    if (micDevice && micDevice !== 'default') {
                      // Verifica se il dispositivo potrebbe essere problematico
                      const label = micDevice.toLowerCase();
                      const problematicPatterns = [
                        'stereo mix', 'what u hear', 'wave out mix', 'speakers', 
                        'headphones', 'output', 'playback', 'monitor', 'loopback',
                        'virtual', 'system', 'desktop', 'screen'
                      ];
                      
                      const isProblematic = problematicPatterns.some(pattern => label.includes(pattern));
                      if (isProblematic) {
                        return '⚠️ ATTENZIONE: Potrebbe catturare audio sistema!';
                      } else {
                        return '✅ Microfono dedicato selezionato';
                      }
                    } else {
                      return 'ℹ️ Usando microfono di default';
                    }
                  })()}
                </div>
                
                {/* ✅ INDICATORE CORRISPONDENZA DISPOSITIVO */}
                <div className="mt-1 text-xs text-red-300/70">
                  {(() => {
                    const micDevice = settings.microphone?.inputDevice;
                    if (micDevice && micDevice !== 'default') {
                      // Verifica se il dispositivo selezionato corrisponde a quello effettivamente in uso
                      if ((window as any).__activeMicrophoneStreams && (window as any).__activeMicrophoneStreams.size > 0) {
                        const activeStreams = Array.from((window as any).__activeMicrophoneStreams);
                        if (activeStreams.length > 0) {
                          const stream = activeStreams[activeStreams.length - 1] as MediaStream;
                          const audioTrack = stream.getAudioTracks()[0];
                          if (audioTrack) {
                            const trackSettings = audioTrack.getSettings();
                            const trackDeviceId = trackSettings.deviceId;
                            
                            if (trackDeviceId === micDevice) {
                              return '🎯 PERFETTO: Dispositivo corrisponde!';
                            } else {
                              return '❌ PROBLEMA: Dispositivo diverso da quello selezionato!';
                            }
                          }
                        }
                      }
                      return '❓ Verifica corrispondenza non disponibile';
                    } else {
                      return 'ℹ️ Usando microfono di default';
                    }
                  })()}
                </div>
                
                {/* ✅ INDICATORE MICROFONO EFFETTIVO DAL BROWSER */}
                <div className="mt-1 text-xs text-red-300/70">
                  {(() => {
                    // Prova a ottenere informazioni dal stream microfono attivo
                    if ((window as any).__activeMicrophoneStreams && (window as any).__activeMicrophoneStreams.size > 0) {
                      const activeStreams = Array.from((window as any).__activeMicrophoneStreams);
                      if (activeStreams.length > 0) {
                        const stream = activeStreams[activeStreams.length - 1] as MediaStream; // Prendi l'ultimo stream
                        const audioTrack = stream.getAudioTracks()[0];
                        if (audioTrack) {
                          const trackSettings = audioTrack.getSettings();
                          const trackLabel = (trackSettings as any).label || 'Unknown';
                          const trackDeviceId = trackSettings.deviceId;
                          
                          return `🔍 Browser: ${trackLabel.length > 20 ? trackLabel.substring(0, 20) + '...' : trackLabel}`;
                        }
                      }
                    }
                    
                    return '🔍 Browser: Stream info non disponibile';
                  })()}
                </div>
              </div>
            )}
            
            <div className="text-xs text-dj-light/50 mt-1 text-center">
              {t('streaming.pttInstruction').replace('{key}', settings.microphone.pushToTalkKey)}
            </div>
          </div>

          {/* Ducking Settings */}
          <div className="text-xs text-dj-light/60 text-center">
            Ducking: {settings.microphone.duckingPercent}%
            <button
              className="ml-2 text-dj-accent hover:text-dj-highlight"
              title="Modifica nelle impostazioni"
            >
              <Settings className="w-3 h-3 inline" />
            </button>
          </div>
        </div>
      </div>

      {/* Stato PTT e Ducking */}
      {(pttActive || audioState.microphone?.isEnabled) && (
        <div className="mt-4 p-2 bg-red-600/20 border border-red-600/40 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <Mic className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-red-500">
              MICROFONO IN ONDA
            </span>
            {pttActive && (
              <span className="text-xs text-red-400">
                (Musica abbassata al {100 - settings.microphone.duckingPercent}%)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedMixer
