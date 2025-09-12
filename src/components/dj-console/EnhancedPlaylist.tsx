import React, { useState, useCallback, useEffect } from 'react'
import { Play, SkipForward, Trash2, Clock, Music } from 'lucide-react'
import { usePlaylist } from '../../contexts/PlaylistContext'
import { useAudio } from '../../contexts/AudioContext'
import { useSettings } from '../../contexts/SettingsContext'

interface EnhancedPlaylistProps {
  activePlaylistId: string | null
  onPlaylistChange: (playlistId: string) => void
  onTrackLoad: (deck: 'left' | 'right', track: any) => void
  leftDeckActive: boolean
  rightDeckActive: boolean
}

const EnhancedPlaylist: React.FC<EnhancedPlaylistProps> = ({
  activePlaylistId,
  onPlaylistChange,
  onTrackLoad,
  leftDeckActive,
  rightDeckActive
}) => {
  const { state: playlistState, reorderPlaylist } = usePlaylist()
  const { state: audioState } = useAudio()
  const { settings } = useSettings()
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [highlightedTrack, setHighlightedTrack] = useState<string | null>(null)

  // Trova la playlist attiva
  const activePlaylist = playlistState.library.playlists.find(pl => pl.id === activePlaylistId)
  const tracks = activePlaylist?.tracks || []

  // Calcola il tempo totale della playlist
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0)
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  // Determina il deck migliore per il caricamento automatico
  const getBestDeckForLoad = useCallback((): 'left' | 'right' => {
    // Se auto-avanzamento è attivo, usa la logica intelligente
    if (settings.interface.autoAdvance) {
      // Se un deck è libero, usa quello
      if (!audioState.leftDeck.track || !audioState.leftDeck.isPlaying) {
        return 'left'
      }
      if (!audioState.rightDeck.track || !audioState.rightDeck.isPlaying) {
        return 'right'
      }
      
      // Se entrambi sono occupati, usa quello con meno tempo rimanente
      const leftTimeLeft = audioState.leftDeck.track ? 
        (audioState.leftDeck.track.duration - audioState.leftDeck.currentTime) : 0
      const rightTimeLeft = audioState.rightDeck.track ? 
        (audioState.rightDeck.track.duration - audioState.rightDeck.currentTime) : 0
      
      return leftTimeLeft < rightTimeLeft ? 'left' : 'right'
    }
    
    // Logica semplice: usa il primo deck libero, altrimenti il sinistro
    if (!audioState.leftDeck.track || !audioState.leftDeck.isPlaying) {
      return 'left'
    }
    if (!audioState.rightDeck.track || !audioState.rightDeck.isPlaying) {
      return 'right'
    }
    return 'left' // Default al sinistro
  }, [settings.interface.autoAdvance, audioState.leftDeck, audioState.rightDeck])

  // Gestisce il doppio click su una traccia
  const handleTrackDoubleClick = useCallback((track: any) => {
    const targetDeck = getBestDeckForLoad()
    console.log(`🎵 Doppio click su "${track.title}" - caricamento in deck ${targetDeck.toUpperCase()}`)
    
    // Evidenzia la traccia per feedback visivo
    setHighlightedTrack(track.id)
    setTimeout(() => setHighlightedTrack(null), 1000)
    
    onTrackLoad(targetDeck, track)
  }, [getBestDeckForLoad, onTrackLoad])

  // Gestisce il caricamento manuale in un deck specifico
  const handleLoadInDeck = useCallback((track: any, deck: 'left' | 'right') => {
    console.log(`🎵 Caricamento manuale di "${track.title}" in deck ${deck.toUpperCase()}`)
    onTrackLoad(deck, track)
  }, [onTrackLoad])

  // Gestisce il drag and drop per riordinare
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndexStr = e.dataTransfer.getData('text/plain')
    const dragIndex = parseInt(dragIndexStr)
    
    if (isNaN(dragIndex) || dragIndex === dropIndex || !activePlaylistId) {
      setDraggedIndex(null)
      return
    }
    
    try {
      const newOrder = [...tracks]
      if (dragIndex >= 0 && dragIndex < newOrder.length && dropIndex >= 0 && dropIndex < newOrder.length) {
        const [movedTrack] = newOrder.splice(dragIndex, 1)
        newOrder.splice(dropIndex, 0, movedTrack)
        
        reorderPlaylist(activePlaylistId, newOrder.map(t => t.id))
      }
    } catch (error) {
      console.error('Errore nel drag & drop:', error)
    }
    
    setDraggedIndex(null)
  }

  // Verifica se una traccia è attualmente in riproduzione
  const isTrackPlaying = useCallback((track: any): { isPlaying: boolean, deck: 'left' | 'right' | null } => {
    if (audioState.leftDeck.track?.id === track.id && audioState.leftDeck.isPlaying) {
      return { isPlaying: true, deck: 'left' }
    }
    if (audioState.rightDeck.track?.id === track.id && audioState.rightDeck.isPlaying) {
      return { isPlaying: true, deck: 'right' }
    }
    return { isPlaying: false, deck: null }
  }, [audioState.leftDeck, audioState.rightDeck])

  // Verifica se una traccia è caricata (ma non necessariamente in riproduzione)
  const isTrackLoaded = useCallback((track: any): { isLoaded: boolean, deck: 'left' | 'right' | null } => {
    if (audioState.leftDeck.track?.id === track.id) {
      return { isLoaded: true, deck: 'left' }
    }
    if (audioState.rightDeck.track?.id === track.id) {
      return { isLoaded: true, deck: 'right' }
    }
    return { isLoaded: false, deck: null }
  }, [audioState.leftDeck, audioState.rightDeck])

  return (
    <div className="bg-dj-secondary rounded-xl border border-dj-accent/20 overflow-hidden">
      {/* Header della playlist */}
      <div className="bg-dj-primary p-4 border-b border-dj-accent/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Music className="w-5 h-5 text-dj-highlight" />
            <h3 className="text-lg font-bold text-white">Playlist</h3>
          </div>
          <div className="flex items-center space-x-4 text-sm text-dj-light/60">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{formatTime(totalDuration)}</span>
            </div>
            <div>{tracks.length} tracce</div>
          </div>
        </div>

        {/* Tabs delle playlist */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          {playlistState.library.playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => onPlaylistChange(playlist.id)}
              className={`px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
                activePlaylistId === playlist.id 
                  ? 'bg-dj-accent text-white' 
                  : 'bg-dj-secondary text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
              }`}
            >
              {playlist.name}
              <span className="ml-2 text-xs opacity-60">({playlist.tracks.length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista tracce */}
      <div className="max-h-96 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="p-8 text-center text-dj-light/60">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nessuna traccia nella playlist</p>
            <p className="text-xs mt-1">Aggiungi tracce dalla libreria</p>
          </div>
        ) : (
          <div className="divide-y divide-dj-accent/10">
            {tracks.map((track, index) => {
              const playingStatus = isTrackPlaying(track)
              const loadedStatus = isTrackLoaded(track)
              const isHighlighted = highlightedTrack === track.id
              
              return (
                <div
                  key={track.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onDoubleClick={() => handleTrackDoubleClick(track)}
                  className={`
                    flex items-center p-3 cursor-pointer transition-all duration-200
                    ${draggedIndex === index ? 'opacity-50' : ''}
                    ${isHighlighted ? 'bg-dj-highlight/20 scale-105' : 'hover:bg-dj-accent/10'}
                    ${playingStatus.isPlaying ? 'bg-green-500/10 border-l-2 border-green-500' : ''}
                    ${loadedStatus.isLoaded && !playingStatus.isPlaying ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : ''}
                  `}
                >
                  {/* Numero traccia */}
                  <div className="w-8 text-xs text-dj-light/60 text-center">
                    {index + 1}
                  </div>

                  {/* Indicatore stato */}
                  <div className="w-6 flex justify-center">
                    {playingStatus.isPlaying ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    ) : loadedStatus.isLoaded ? (
                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    ) : (
                      <div className="w-2 h-2 bg-gray-500 rounded-full" />
                    )}
                  </div>

                  {/* Informazioni traccia */}
                  <div className="flex-1 min-w-0 px-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-white truncate">
                          {track.title}
                        </h4>
                        <p className="text-xs text-dj-light/60 truncate">
                          {track.artist}
                        </p>
                      </div>
                      <div className="text-xs text-dj-light/60 ml-2">
                        {formatTime(track.duration)}
                      </div>
                    </div>
                    
                    {/* Stato e deck */}
                    {(playingStatus.isPlaying || loadedStatus.isLoaded) && (
                      <div className="text-xs mt-1">
                        <span className={`px-2 py-0.5 rounded-full ${
                          playingStatus.isPlaying 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          Deck {playingStatus.deck?.toUpperCase() || loadedStatus.deck?.toUpperCase()} - {playingStatus.isPlaying ? 'In riproduzione' : 'Caricata'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Pulsanti azione */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLoadInDeck(track, 'left') }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        loadedStatus.deck === 'left'
                          ? 'bg-dj-accent text-white'
                          : 'bg-dj-primary hover:bg-dj-accent/30 text-dj-light'
                      }`}
                      title="Carica in Deck A"
                    >
                      A
                    </button>
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLoadInDeck(track, 'right') }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        loadedStatus.deck === 'right'
                          ? 'bg-dj-accent text-white'
                          : 'bg-dj-primary hover:bg-dj-accent/30 text-dj-light'
                      }`}
                      title="Carica in Deck B"
                    >
                      B
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer con informazioni */}
      <div className="bg-dj-primary p-3 border-t border-dj-accent/20">
        <div className="flex items-center justify-between text-xs text-dj-light/60">
          <div>
            💡 Doppio click per caricare automaticamente
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>In riproduzione</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span>Caricata</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full" />
              <span>Disponibile</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedPlaylist
