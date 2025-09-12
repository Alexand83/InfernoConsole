import React, { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Disc,
  Clock,
  RotateCcw,
  Square
} from 'lucide-react'
import DynamicWaveform from './DynamicWaveform'
import { localDatabase } from '../database/LocalDatabase'
import AudioManager from '../audio/AudioManager'

interface Track {
  id: string
  title: string
  artist: string
  duration: number
  url: string
}

interface DeckPlayerProps {
  deckId: 'A' | 'B'
  track: Track | null
  isActive: boolean
  volume: number
  isMuted: boolean
  onVolumeChange: (volume: number) => void
  onActivate: () => void
  onTrackEnd?: () => void
}

const DeckPlayer: React.FC<DeckPlayerProps> = ({
  deckId,
  track,
  isActive,
  volume,
  isMuted,
  onVolumeChange,
  onActivate,
  onTrackEnd
}) => {
  // Stati locali del deck
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showWaveform, setShowWaveform] = useState(true)
  
  // Riferimenti
  const progressRef = useRef<HTMLInputElement>(null)
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  
  // Audio Manager
  const audioManager = AudioManager.getInstance()
  
  // Formattazione tempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  // Tempo rimanente
  const remainingTime = duration - currentTime
  
  // Aggiorna il tempo corrente
  const updateCurrentTime = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      const newTime = audioRef.current.currentTime
      setCurrentTime(newTime)
      
      // Aggiorna la barra di progresso visualmente
      if (progressRef.current) {
        const progress = duration > 0 ? (newTime / duration) * 100 : 0
        progressRef.current.style.background = `linear-gradient(to right, #10b981 0%, #10b981 ${progress}%, #374151 ${progress}%, #374151 100%)`
      }
    }
  }, [duration])
  
  // Avvia il timer di aggiornamento
  const startTimeUpdate = useCallback(() => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current)
    }
    timeUpdateInterval.current = setInterval(updateCurrentTime, 100)
  }, [updateCurrentTime])
  
  // Ferma il timer di aggiornamento
  const stopTimeUpdate = useCallback(() => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current)
      timeUpdateInterval.current = null
    }
  }, [])
  
  // Sincronizza stato con AudioManager (non usa più elementi audio locali)
  useEffect(() => {
    if (track) {
      console.log(`🎵 [DECK ${deckId}] Track loaded: ${track.title}`)
      setIsLoading(false)
      setDuration(track.duration)
    } else {
      console.log(`🧹 [DECK ${deckId}] No track`)
      setIsLoading(false)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    }
  }, [track, deckId])
  
  // Il DeckPlayer ora è solo UI - la logica audio è gestita dall'AudioManager
  // Sincronizziamo solo lo stato visuale
  
  // Carica settings per il waveform
  useEffect(() => {
    const loadWaveformSettings = async () => {
      try {
        await localDatabase.waitForInitialization()
        const settings = await localDatabase.getSettings()
        setShowWaveform(settings.ui?.showWaveform ?? true)
      } catch (error) {
        console.warn('Could not load waveform settings:', error)
      }
    }
    loadWaveformSettings()
  }, [])
  
  // Cleanup al dismount
  useEffect(() => {
    return () => {
      stopTimeUpdate()
    }
  }, [stopTimeUpdate])
  
  // Volume ora gestito dall'AudioManager
  useEffect(() => {
    console.log(`🔊 [DECK ${deckId}] Volume set to ${Math.round(volume * 100)}%`)
  }, [volume, deckId])
  
  // Sincronizza stato con AudioManager
  useEffect(() => {
    const handleStateChange = () => {
      const deckState = audioManager.getDeck(deckId)
      setIsPlaying(deckState.isPlaying)
      setCurrentTime(deckState.currentTime)
      setDuration(deckState.duration)
      
      // Aggiorna la barra di progresso
      if (progressRef.current && deckState.duration > 0) {
        const progress = (deckState.currentTime / deckState.duration) * 100
        progressRef.current.style.background = `linear-gradient(to right, #10b981 0%, #10b981 ${progress}%, #374151 ${progress}%, #374151 100%)`
      }
    }
    
    audioManager.addEventListener('stateChanged', handleStateChange)
    handleStateChange() // Stato iniziale
    
    return () => {
      audioManager.removeEventListener('stateChanged', handleStateChange)
    }
  }, [audioManager, deckId])
  
  // Controlli di riproduzione - ora comunicano con AudioManager
  const handlePlayPause = useCallback(() => {
    if (!track) return
    
    try {
      if (isPlaying) {
        console.log(`⏸️ [DECK ${deckId}] Pausing via AudioManager...`)
        audioManager.pause(deckId)
      } else {
        console.log(`▶️ [DECK ${deckId}] Playing via AudioManager...`)
        
        // Attiva il deck se non è già attivo
        if (!isActive) {
          onActivate()
        }
        
        audioManager.play(deckId)
      }
    } catch (error) {
      console.error(`❌ [DECK ${deckId}] Play/Pause error:`, error)
    }
  }, [isPlaying, track, deckId, isActive, onActivate, audioManager])
  
  const handleStop = useCallback(() => {
    console.log(`⏹️ [DECK ${deckId}] Stopping via AudioManager...`)
    audioManager.stop(deckId)
  }, [deckId, audioManager])
  
  const handleSkip = useCallback((seconds: number) => {
    if (!track) return
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    audioManager.seek(deckId, newTime)
    
    console.log(`⏩ [DECK ${deckId}] Skipped ${seconds}s to ${formatTime(newTime)}`)
  }, [currentTime, duration, track, deckId, audioManager])
  
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!track) return
    
    const newTime = parseFloat(e.target.value)
    audioManager.seek(deckId, newTime)
    
    // Aggiorna immediatamente la barra di progresso
    const progress = duration > 0 ? (newTime / duration) * 100 : 0
    e.target.style.background = `linear-gradient(to right, #10b981 0%, #10b981 ${progress}%, #374151 ${progress}%, #374151 100%)`
  }, [track, duration, deckId, audioManager])
  
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    onVolumeChange(newVolume)
  }, [onVolumeChange])
  
  // Reset alla posizione 0
  const handleReset = useCallback(() => {
    audioManager.seek(deckId, 0)
    console.log(`🔄 [DECK ${deckId}] Reset to start`)
  }, [deckId, audioManager])
  
  return (
    <div className={`bg-gray-900 rounded-lg p-4 border-2 transition-all duration-200 ${
      isActive 
        ? 'border-green-500 shadow-lg shadow-green-500/20' 
        : 'border-gray-700 hover:border-gray-600'
    }`}>
      
      {/* Header del deck */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-bold text-white">Deck {deckId}</h3>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        
        <button
          onClick={onActivate}
          className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
            isActive 
              ? 'bg-green-500 text-white shadow-lg' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isActive ? 'ACTIVE' : 'ACTIVATE'}
        </button>
      </div>
      
                  {/* Waveform dinamico - SOPRA il titolo */}
            {track && showWaveform && (
              <div className="mb-3">
                <DynamicWaveform
                  waveformData={Array.from({ length: 120 }, () => 0.3 + Math.random() * 0.4)}
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  deck={deckId}
                  className="h-16 bg-gray-800 rounded cursor-pointer"
                  onSeek={handleSeek}
                />
              </div>
            )}
      
      {/* Info traccia */}
      <div className="bg-gray-800 rounded-lg p-3 mb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${isPlaying ? 'bg-green-500/20' : 'bg-gray-700'}`}>
            <Disc className={`w-5 h-5 ${isPlaying ? 'text-green-500 animate-spin' : 'text-gray-400'}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white truncate">
              {track?.title || 'No Track Loaded'}
            </h4>
            <p className="text-sm text-gray-400 truncate">
              {track?.artist || 'Unknown Artist'}
            </p>
          </div>
          
          {track && (
            <div className="text-right">
              <div className="flex items-center space-x-1 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Barra di progresso */}
      {track && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(remainingTime)}</span>
          </div>
          
          <input
            ref={progressRef}
            type="range"
            min={0}
            max={duration || 0.1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            aria-label={`Seek control for Deck ${deckId}`}
            title={`Seek control for Deck ${deckId}`}
            style={{
              background: `linear-gradient(to right, #10b981 0%, #10b981 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #374151 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #374151 100%)`
            }}
          />
        </div>
      )}
      

      
      {/* Controlli di trasporto */}
      <div className="flex items-center justify-center space-x-2 mb-4">
        <button
          onClick={handleReset}
          disabled={!track}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded flex items-center justify-center transition-all duration-200"
          title="Reset to start"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => handleSkip(-10)}
          disabled={!track}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded flex items-center justify-center transition-all duration-200"
          title="Skip backward 10s"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        
        <button
          onClick={handlePlayPause}
          disabled={!track || isLoading}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            isPlaying
              ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
              : 'bg-green-500 hover:bg-green-400 text-white'
          } disabled:bg-gray-800 disabled:text-gray-600`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        
        <button
          onClick={() => handleSkip(10)}
          disabled={!track}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded flex items-center justify-center transition-all duration-200"
          title="Skip forward 10s"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleStop}
          disabled={!track}
          className="w-8 h-8 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-600 rounded flex items-center justify-center transition-all duration-200"
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => audioManager.toggleDeckMute(deckId)}
          disabled={!track}
          className={`w-8 h-8 rounded flex items-center justify-center transition-all duration-200 ${
            isMuted
              ? 'bg-red-500 hover:bg-red-400 text-white' 
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          } disabled:bg-gray-800 disabled:text-gray-600`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* Controllo volume */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Volume</span>
          </div>
          <span className="text-sm text-white font-medium">
            {Math.round(volume * 100)}%
          </span>
        </div>
        
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          aria-label={`Volume control for Deck ${deckId}`}
          title={`Volume control for Deck ${deckId}`}
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
          }}
        />
      </div>
      
      {/* Indicatori di stato */}
      <div className="flex items-center justify-between mt-3 text-xs">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500' : 'bg-gray-600'}`} />
          <span className="text-gray-400">
            {isPlaying ? 'PLAYING' : isLoading ? 'LOADING' : 'READY'}
          </span>
        </div>
        
        {track && (
          <div className="text-gray-400">
            BPM: --
          </div>
        )}
      </div>
    </div>
  )
}

export default DeckPlayer
