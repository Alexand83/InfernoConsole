import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Disc,
  Clock,
  Activity,
  X
} from 'lucide-react'
import { useAudio } from '../../contexts/AudioContext'
import { useSettings } from '../../contexts/SettingsContext'
import DynamicWaveform from '../DynamicWaveform'
import TimerDisplay from '../TimerDisplay'

interface EnhancedDeckProps {
  side: 'left' | 'right'
  deckId: 'A' | 'B'
  track?: {
    id: string
    title: string
    artist: string
    duration: number
    url: string
  } | null
  onTrackLoad?: (track: any) => void
  onAutoAdvance?: (deck: 'left' | 'right') => void
  onTrackClear?: (deck: 'left' | 'right') => void
}

const EnhancedDeck: React.FC<EnhancedDeckProps> = ({ 
  side, 
  deckId, 
  track,
  onTrackLoad,
  onAutoAdvance,
  onTrackClear
}) => {
  const { 
    state: audioState,
    playLeftTrack, 
    pauseLeftTrack, 
    resumeLeftTrack, 
    stopLeftTrack,
    playRightTrack, 
    pauseRightTrack, 
    resumeRightTrack, 
    stopRightTrack,
    setLeftLocalVolume, 
    setRightLocalVolume, 
    seekLeftTo,
    seekRightTo,
    handlePlayPauseDefinitive,
    clearLeftDeck,
    clearRightDeck
  } = useAudio()
  
  const { settings } = useSettings()
  const [localVolume, setLocalVolume] = useState(0.8)
  const [isProcessing, setIsProcessing] = useState(false)
  const prevTrackRef = useRef<string | null>(null)

  // Stato del deck attuale dal context
  const deckState = side === 'left' ? audioState.leftDeck : audioState.rightDeck
  const currentTrack = deckState.track || track
  const isPlaying = deckState.isPlaying
  const currentTime = deckState.currentTime || 0
  
  // Determina se il deck è ATTIVO (ha una canzone che sta suonando)
  const isActive = !!(currentTrack && isPlaying)

  // ✅ FIX: Genera waveformData una sola volta per traccia
  const waveformData = useMemo(() => {
    if (currentTrack?.waveform) {
      return currentTrack.waveform
    }
    return Array.from({ length: 120 }, () => 0.3 + Math.random() * 0.4)
  }, [currentTrack?.id || 'default'])
  
  // Sincronizza il volume locale con lo stato globale
  useEffect(() => {
    if (side === 'left') {
      setLocalVolume(audioState.leftDeck.localVolume)
    } else {
      setLocalVolume(audioState.rightDeck.localVolume)
    }
  }, [side, audioState.leftDeck.localVolume, audioState.rightDeck.localVolume])

  // ✅ FIX AUTOPLAY: Auto-avanzamento quando la traccia finisce
  useEffect(() => {
    if (!currentTrack || !settings.interface.autoAdvance || !isPlaying) return

    const duration = currentTrack.duration
    if (duration && currentTime >= duration - 0.5 && currentTime > 0) { // ✅ FIX: 0.5 secondi prima della fine per maggiore precisione
      console.log(`🔄 [AUTOPLAY] Track ending in deck ${deckId} (${currentTime.toFixed(1)}s/${duration}s), triggering auto-advance`)
      
      // ✅ FIX: Emetti evento per il sistema di auto-advance
      const event = new CustomEvent('djconsole:request-auto-advance', {
        detail: { deck: side, track: currentTrack }
      })
      window.dispatchEvent(event)
      
      // ✅ FIX: Chiama anche direttamente la funzione
      onAutoAdvance?.(side)
    }
  }, [currentTime, currentTrack, settings.interface.autoAdvance, deckId, side, onAutoAdvance, isPlaying])

  // Gestori per i controlli transport
  const handlePlay = useCallback(() => {
    if (!currentTrack || isProcessing) return
    
    setIsProcessing(true)
    setTimeout(() => setIsProcessing(false), 500)
    
    console.log(`🎮 Enhanced Deck ${deckId} play triggered`)
    
    // Se non c'è traccia nel deck, la carica prima
    if (!deckState.track) {
      console.log(`🎵 Loading track in ${side} deck first`)
      if (side === 'left') {
        playLeftTrack(currentTrack)
      } else {
        playRightTrack(currentTrack)
      }
      // Aspetta che si carichi, poi play
      setTimeout(() => {
        handlePlayPauseDefinitive(side)
      }, 100)
    } else {
      // Usa direttamente la funzione definitiva
      handlePlayPauseDefinitive(side)
    }
  }, [currentTrack, isProcessing, deckState.track, side, playLeftTrack, playRightTrack, handlePlayPauseDefinitive, deckId])

  const handlePause = useCallback(() => {
    if (!isProcessing) {
      handlePlayPauseDefinitive(side)
    }
  }, [isProcessing, side, handlePlayPauseDefinitive])

  const handleStop = useCallback(() => {
    if (side === 'left') {
      stopLeftTrack()
    } else {
      stopRightTrack()
    }
  }, [side, stopLeftTrack, stopRightTrack])

  const handleClearDeck = useCallback(() => {
    console.log(`🗑️ [DECK] Liberando deck ${side}`)
    if (side === 'left') {
      clearLeftDeck()
    } else {
      clearRightDeck()
    }
    
    // ✅ FIX: Notifica il componente padre per aggiornare lo stato locale
    onTrackClear?.(side)
  }, [side, clearLeftDeck, clearRightDeck, onTrackClear])

  const handleSkipBackward = useCallback(() => {
    const audioElement = document.querySelector(`audio[data-deck="${side === 'left' ? 'A' : 'B'}"]`) as HTMLAudioElement
    if (audioElement && audioElement.src) {
      const newTime = Math.max(0, audioElement.currentTime - 10)
      // ✅ FIX: Usa le funzioni seek del context invece di modificare direttamente
      if (side === 'left') {
        seekLeftTo(newTime)
      } else {
        seekRightTo(newTime)
      }
      console.log(`⏪ Deck ${deckId}: Skip backward to ${newTime.toFixed(1)}s`)
    }
  }, [side, deckId, seekLeftTo, seekRightTo])

  const handleSkipForward = useCallback(() => {
    const audioElement = document.querySelector(`audio[data-deck="${side === 'left' ? 'A' : 'B'}"]`) as HTMLAudioElement
    if (audioElement && audioElement.src) {
      const duration = audioElement.duration || 0
      const newTime = Math.min(duration, audioElement.currentTime + 10)
      // ✅ FIX: Usa le funzioni seek del context invece di modificare direttamente
      if (side === 'left') {
        seekLeftTo(newTime)
      } else {
        seekRightTo(newTime)
      }
      console.log(`⏩ Deck ${deckId}: Skip forward to ${newTime.toFixed(1)}s`)
    }
  }, [side, deckId, seekLeftTo, seekRightTo])

  const handleVolumeChange = useCallback((value: number) => {
    setLocalVolume(value)
    
    // ✅ CRITICAL FIX: NON modificare direttamente HTML volume!
    // Lascia che AudioContext gestisca tutto il volume
    if (side === 'left') {
      setLeftLocalVolume(value)
      console.log(`🔊 Deck ${deckId} LOCAL volume: ${Math.round(value * 100)}% (state only)`)
    } else {
      setRightLocalVolume(value)
      console.log(`🔊 Deck ${deckId} LOCAL volume: ${Math.round(value * 100)}% (state only)`)
    }
  }, [side, setLeftLocalVolume, setRightLocalVolume, deckId])

  // Listener per il seek dal waveform
  useEffect(() => {
    const handleWaveformSeek = (e: CustomEvent) => {
      if (isActive) {
        if (side === 'left') {
          seekLeftTo(e.detail.time)
        } else {
          seekRightTo(e.detail.time)
        }
      }
    }

    window.addEventListener('waveform:seek', handleWaveformSeek as EventListener)
    return () => window.removeEventListener('waveform:seek', handleWaveformSeek as EventListener)
  }, [isActive, side, seekLeftTo, seekRightTo])

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${String(s).padStart(2,'0')}`
  }

  return (
    <div className={`
      relative p-4 rounded-xl border-2 transition-all duration-300 ease-in-out
      ${isActive 
        ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20' 
        : 'border-dj-accent/30 bg-dj-primary'
      }
    `}>
      {/* Indicatore di stato attivo */}
      <div className="absolute top-2 right-2 flex items-center space-x-2">
        {isActive && (
          <>
            <Activity className="w-4 h-4 text-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-500 bg-green-500/20 px-2 py-1 rounded-full">
              ATTIVO
            </span>
          </>
        )}
      </div>

      {/* Header del deck */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-dj font-bold text-white flex items-center space-x-2">
          <Disc className="w-5 h-5" />
          <span>Deck {deckId}</span>
        </h3>
      </div>

      {/* Status separato per evitare sovrapposizioni */}
      <div className="mb-3">
        <div className="text-xs text-dj-light/60 text-center">
          {isActive ? 'In riproduzione' : 'Standby'}
        </div>
      </div>

      {/* Informazioni traccia */}
      <div className="bg-dj-secondary rounded-lg p-3 mb-3 border border-dj-accent/20">
        <div className="flex items-center space-x-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white text-sm truncate">
              {currentTrack?.title || 'Nessuna traccia caricata'}
            </h4>
            <p className="text-xs text-dj-light/60 truncate">
              {currentTrack?.artist || 'Artista sconosciuto'}
            </p>
          </div>
        </div>
        
        {currentTrack && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Clock className="w-3 h-3 text-dj-light/60" />
              <span className="text-dj-light">
                {formatTime(currentTime)} / {formatTime(currentTrack.duration)}
              </span>
            </div>
            <div className="text-dj-light/50">
              Rimanenti: {formatTime(currentTrack.duration - currentTime)}
            </div>
          </div>
        )}
      </div>

      {/* Waveform */}
      {currentTrack && (
        <div className="mb-3">
          <DynamicWaveform
            waveformData={waveformData}
            currentTime={currentTime}
            duration={currentTrack.duration || 0}
            isPlaying={isPlaying}
            deck={side}
            className="relative h-16"
          />
        </div>
      )}

      {/* Controlli transport */}
      <div className="flex items-center justify-center space-x-3 mb-3">
        <button
          onClick={handleSkipBackward}
          className="w-8 h-8 bg-dj-secondary hover:bg-dj-accent rounded-md flex items-center justify-center transition-all duration-200"
          title="Salta indietro (-10s)"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className={`w-12 h-12 rounded-md flex items-center justify-center transition-all duration-200 ${
            isPlaying
              ? 'bg-dj-accent hover:bg-dj-highlight' 
              : 'bg-dj-highlight hover:bg-dj-accent'
          }`}
          title={isPlaying ? "Pausa" : "Play"}
          disabled={!currentTrack || isProcessing}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        
        <button
          onClick={handleSkipForward}
          className="w-8 h-8 bg-dj-secondary hover:bg-dj-accent rounded-md flex items-center justify-center transition-all duration-200"
          title="Salta avanti (+10s)"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        
        {/* ✅ NUOVO: Pulsante per liberare il deck */}
        {currentTrack && (
          <button
            onClick={handleClearDeck}
            className="w-8 h-8 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 hover:border-red-500/50 rounded-md flex items-center justify-center transition-all duration-200 group"
            title="Libera deck (rimuovi traccia)"
          >
            <X className="w-4 h-4 text-red-400 group-hover:text-red-300" />
          </button>
        )}
      </div>

      {/* Controllo volume locale */}
      <div className="bg-dj-secondary rounded-lg p-3">
        <div className="flex items-center space-x-3 mb-2">
          <Volume2 className="w-4 h-4 text-dj-accent" />
          <span className="text-xs text-dj-light/80 font-medium">Volume Locale</span>
          <span className="text-xs text-dj-light/60 ml-auto">
            {Math.round(localVolume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={localVolume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="dj-slider w-full h-2"
          aria-label={`Volume locale deck ${deckId}`}
        />
        <div className="text-xs text-dj-light/50 mt-1">
          Solo per monitoring locale - non influenza lo streaming
        </div>
      </div>

      {/* Barra di progresso */}
      {currentTrack && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-dj-light/60 mb-1">
            <TimerDisplay 
              deck={side}
              className="text-xs text-dj-light/60"
            />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(currentTrack.duration || 0, 0.001)}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              if (isActive) {
                if (side === 'left') {
                  seekLeftTo(parseFloat(e.target.value))
                } else {
                  seekRightTo(parseFloat(e.target.value))
                }
              }
            }}
            className="dj-slider w-full h-1"
            aria-label={`Seek control per deck ${deckId}`}
          />
        </div>
      )}
    </div>
  )
}

export default EnhancedDeck
