import DynamicWaveform from './DynamicWaveform'
import TimerDisplay from './TimerDisplay'
import React, { useState, useMemo } from 'react'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Disc,
  Clock
} from 'lucide-react'
import { useAudio } from '../contexts/AudioContext'

interface AudioDeckProps {
  side: 'left' | 'right'
  isActive: boolean
  onActivate: () => void
  track?: {
    id: string
    title: string
    artist: string
    duration: number
    url: string
  } | null
}

const AudioDeck: React.FC<AudioDeckProps> = ({ side, isActive, onActivate, track }) => {
  const { 
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
    state: audioState 
  } = useAudio()
  
  const [deckVolume, setDeckVolume] = useState(0.8)
  const [cuePoints, setCuePoints] = useState<number[]>([])
  const [currentCue, setCurrentCue] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false) // Prevenire click multipli

  // Sincronizza il volume locale con lo stato globale
  React.useEffect(() => {
    if (side === 'left') {
      setDeckVolume(audioState.leftDeck.localVolume)
    } else {
      setDeckVolume(audioState.rightDeck.localVolume)
    }
  }, [side, audioState.leftDeck.localVolume, audioState.rightDeck.localVolume])

  // Listener per il seek dal waveform
  React.useEffect(() => {
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

  // FIX DEFINITIVO: Usa la funzione play/pause che funziona SEMPRE
  const handlePlay = () => {
    if (track && !isProcessing) {
      setIsProcessing(true)
      // Reset dopo 500ms per prevenire spam
      setTimeout(() => setIsProcessing(false), 500)
      
      console.log(`🎮 AudioDeck ${side} handlePlay called with DEFINITIVE function`)
      
      // Se non c'è traccia nel deck, la carica prima
      if (side === 'left' && !audioState.leftDeck.track) {
        console.log('🎵 Loading track in left deck first')
        playLeftTrack(track)
        // Aspetta un attimo che si carichi, poi play
        setTimeout(() => {
          handlePlayPauseDefinitive('left')
        }, 100)
      } else if (side === 'right' && !audioState.rightDeck.track) {
        console.log('🎵 Loading track in right deck first')
        playRightTrack(track)
        // Aspetta un attimo che si carichi, poi play
        setTimeout(() => {
          handlePlayPauseDefinitive('right')
        }, 100)
      } else {
        // Usa direttamente la funzione definitiva
        handlePlayPauseDefinitive(side)
      }
    }
  }

  // FIX DEFINITIVO: Usa la funzione definitiva anche per pause
  const handlePause = () => {
    handlePlayPauseDefinitive(side)
  }

  // FIX DEFINITIVO: Usa le funzioni specifiche per stop
  const handleStop = () => {
    if (side === 'left') {
      stopLeftTrack()
    } else {
      stopRightTrack()
    }
  }

  const handleSkipBackward = () => {
    const audioElement = document.querySelector(`audio[data-deck="${side}"]`) as HTMLAudioElement
    if (audioElement && audioElement.src) {
      const currentTime = audioElement.currentTime
      const newTime = Math.max(0, currentTime - 10)
      audioElement.currentTime = newTime
      console.log(`⏪ [SKIP] Deck ${side}: Skip backward to ${newTime.toFixed(1)}s`)
    }
  }

  const handleSkipForward = () => {
    const audioElement = document.querySelector(`audio[data-deck="${side}"]`) as HTMLAudioElement
    if (audioElement && audioElement.src) {
      const currentTime = audioElement.currentTime
      const duration = audioElement.duration || 0
      const newTime = Math.min(duration, currentTime + 10)
      audioElement.currentTime = newTime
      console.log(`⏩ [SKIP] Deck ${side}: Skip forward to ${newTime.toFixed(1)}s`)
    }
  }

  const handleVolumeChange = (value: number) => {
    setDeckVolume(value)
    
    // Imposta il volume locale per il deck specifico
    if (side === 'left') {
      setLeftLocalVolume(value)
    } else {
      setRightLocalVolume(value)
    }
    
    // Applica il volume direttamente all'audio element
    const audioElement = document.querySelector(`audio[data-deck="${side}"]`) as HTMLAudioElement
    if (audioElement) {
      audioElement.volume = value
      console.log(`🔊 [VOLUME] Deck ${side}: ${Math.round(value * 100)}%`)
    }
  }

  // Pitch control not implemented in AudioContext; placeholder removed

  const addCuePoint = () => {
    if (currentTrack) {
      const newCuePoint = Math.random() * 100 // Simulate current position
      setCuePoints([...cuePoints, newCuePoint])
    }
  }

  const jumpToCue = (index: number) => {
    setCurrentCue(index)
    // In a real implementation, this would seek to the cue point
  }

  // Il track corrente è sempre quello del deck, indipendentemente da isActive
  const currentTrack = (side === 'left' ? audioState.leftDeck.track : audioState.rightDeck.track) || track

  // ✅ FIX: Genera waveformData una sola volta per traccia
  const waveformData = useMemo(() => {
    if ((currentTrack as any)?.waveform) {
      return (currentTrack as any).waveform
    }
    return Array.from({ length: 120 }, () => 0.3 + Math.random() * 0.4)
  }, [currentTrack?.id || 'default'])

  // Il deck sta suonando se ha una traccia caricata ed è in playing, indipendentemente da isActive
  const isThisTrackPlaying = (side === 'left' ? 
    audioState.leftDeck.track?.id === currentTrack?.id && audioState.leftDeck.isPlaying :
    audioState.rightDeck.track?.id === currentTrack?.id && audioState.rightDeck.isPlaying)
  
  // const deckCurrentTime = isThisTrackPlaying ? 
  //   (side === 'left' ? audioState.leftDeck.currentTime : audioState.rightDeck.currentTime) : 0
  // Ottieni il currentTime corretto dal deck
  const deckCurrentTime = side === 'left' 
    ? audioState.leftDeck.currentTime || 0
    : audioState.rightDeck.currentTime || 0
  
  const deckDuration = currentTrack?.duration || (isThisTrackPlaying ? 
    (side === 'left' ? audioState.leftDeck.track?.duration : audioState.rightDeck.track?.duration) : 0)

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${String(s).padStart(2,'0')}`
  }

  return (
    <div className={`deck-container p-2 md:p-3 ${isActive ? 'ring-2 ring-dj-highlight' : ''}`}>
      {/* Deck Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm md:text-base font-dj font-bold text-white">Deck {side === 'left' ? 'A' : 'B'}</h3>
        <button
          onClick={onActivate}
          className={`px-2 py-0.5 rounded text-[11px] md:text-xs font-medium transition-all duration-200 ${
            isActive 
              ? 'bg-dj-highlight text-white' 
              : 'bg-dj-secondary text-dj-light hover:bg-dj-accent'
          }`}
        >
          {isActive ? 'Active' : 'Activate'}
        </button>
      </div>

      {/* Track Info */}
      <div className="bg-dj-primary rounded-lg p-2 md:p-3 mb-2 border border-dj-accent/20">
        <div className="flex items-center space-x-2 mb-1.5">
          <Disc className="w-5 h-5 md:w-6 md:h-6 text-dj-highlight" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white text-sm md:text-base truncate">{currentTrack?.title || 'No Track Loaded'}</h4>
            <p className="text-[11px] md:text-xs text-dj-light/60 truncate">{currentTrack?.artist || 'Unknown Artist'}</p>
          </div>
        </div>
        {currentTrack && (
          <div className="flex items-center justify-between text-[11px] md:text-xs">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-dj-light/60" />
              <span className="text-dj-light">{typeof currentTrack.duration === 'number' ? `${Math.floor(currentTrack.duration/60)}:${String(Math.floor(currentTrack.duration%60)).padStart(2,'0')}` : currentTrack.duration}</span>
            </div>
            <div className="text-dj-light/50 hidden md:block">BPM —</div>
          </div>
        )}
      </div>

      {/* Waveform dinamico per ogni deck che ha una traccia */}
      {currentTrack && (
        <div className="mb-2">
          <DynamicWaveform
            waveformData={waveformData}
            currentTime={deckCurrentTime}
            duration={deckDuration || 0}
            isPlaying={true} // ← SEMPRE TRUE: ora la waveform controlla autonomamente l'audio
            deck={side} // ← Specifica quale deck
            className="relative"
          />
        </div>
      )}

      {/* Transport Controls */}
      <div className="flex items-center justify-center space-x-2 mb-2">
        <button
          onClick={handleSkipBackward}
          className="w-8 h-8 md:w-9 md:h-9 bg-dj-secondary hover:bg-dj-accent rounded-md flex items-center justify-center transition-all duration-200"
          title="Skip Backward (-10s)"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        
        <button
          onClick={isActive && isThisTrackPlaying ? handlePause : handlePlay}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-md flex items-center justify-center transition-all duration-200 ${
            isActive && isThisTrackPlaying
              ? 'bg-dj-accent hover:bg-dj-highlight' 
              : 'bg-dj-highlight hover:bg-dj-accent'
          }`}
          title={isActive && isThisTrackPlaying ? "Pausa" : "Play"}
        >
          {isActive && isThisTrackPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
        </button>
        
        <button
          onClick={handleSkipForward}
          className="w-8 h-8 md:w-9 md:h-9 bg-dj-secondary hover:bg-dj-accent rounded-md flex items-center justify-center transition-all duration-200"
          title="Skip Forward (+10s)"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Cue Points rimossi in versione ultra-compatta */}

      {/* Volume and Pitch Controls */}
      <div className="grid grid-cols-2 gap-2">
        {/* Volume Control */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 mb-0.5">
            <Volume2 className="w-3.5 h-3.5 text-dj-light/60" />
            <span className="text-[11px] md:text-xs text-dj-light">Vol</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={deckVolume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="dj-slider w-full h-1"
            aria-label={`Volume control for ${side} deck`}
          />
          <span className="text-[10px] md:text-xs text-dj-light/60">{Math.round(deckVolume * 100)}%</span>
        </div>

        {/* Placeholder for future pitch control */}
        <div className="text-center text-[11px] md:text-xs text-dj-light/60">Pitch: n/a</div>
      </div>

      {/* Progress Bar and Timer */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[11px] md:text-xs text-dj-light/60 mb-1">
          <TimerDisplay 
            deck={side}
            className="text-[11px] md:text-xs text-dj-light/60"
          />
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(deckDuration || 0, 0.001)}
          step={0.1}
          value={deckCurrentTime}
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
          aria-label={`Seek control for ${side} deck`}
        />
      </div>
    </div>
  )
}

export default AudioDeck
