import React, { useEffect, useCallback, useRef } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import { usePlaylist } from '../../contexts/PlaylistContext'
import { useAudio } from '../../contexts/AudioContext'

interface AutoAdvanceManagerProps {
  activePlaylistId: string | null
  onTrackLoad: (deck: 'left' | 'right', track: any) => void
  onDuplicateTrackWarning?: (track: any, activeDeck: 'left' | 'right') => void
}

const AutoAdvanceManager: React.FC<AutoAdvanceManagerProps> = ({
  activePlaylistId,
  onTrackLoad,
  onDuplicateTrackWarning
}) => {
  const { settings } = useSettings()
  const { state: playlistState } = usePlaylist()
  const { state: audioState } = useAudio()
  
  const pendingAdvanceRef = useRef<{deck: 'left' | 'right', track: any} | null>(null)
  const generalAdvanceTimeRef = useRef<number>(0)
  const deckAdvanceTimeRef = useRef<{left: number, right: number}>({left: 0, right: 0})

  // Trova la prossima traccia nella playlist
  const getNextTrack = useCallback((currentTrack: any): any | null => {
    if (!activePlaylistId || !currentTrack) {
      return null
    }
    
    const playlist = playlistState.library.playlists.find(p => p.id === activePlaylistId)
    if (!playlist) {
      return null
    }
    
    const currentIndex = playlist.tracks.findIndex(t => t.id === currentTrack.id)
    if (currentIndex === -1) {
      return null
    }
    
    if (currentIndex >= playlist.tracks.length - 1) {
      // ✅ LOOP PLAYLIST: Se abilitato, riparti dalla prima traccia
      if (settings.interface.playlistLoop && playlist.tracks.length > 0) {
        return playlist.tracks[0]
      }
      return null
    }
    
    return playlist.tracks[currentIndex + 1]
  }, [activePlaylistId, playlistState.library.playlists, settings.interface.playlistLoop])

  // Verifica se un deck è libero
  const isDeckFree = useCallback((deck: 'left' | 'right'): boolean => {
    const deckState = deck === 'left' ? audioState.leftDeck : audioState.rightDeck
    return !deckState.track || !deckState.isPlaying
  }, [audioState.leftDeck, audioState.rightDeck])

  // Trova il deck migliore per l'auto-avanzamento
  const getBestDeckForAutoAdvance = useCallback((): 'left' | 'right' | null => {
    const leftFree = isDeckFree('left')
    const rightFree = isDeckFree('right')
    
    // Se entrambi sono liberi, preferisci il left
    if (leftFree && rightFree) {
      return 'left'
    }
    
    // Se solo uno è libero, usa quello
    if (leftFree) return 'left'
    if (rightFree) return 'right'
    
    // Se entrambi sono occupati, trova quello con meno tempo rimanente
    const leftTimeLeft = audioState.leftDeck.track ? 
      (audioState.leftDeck.track.duration - audioState.leftDeck.currentTime) : 0
    const rightTimeLeft = audioState.rightDeck.track ? 
      (audioState.rightDeck.track.duration - audioState.rightDeck.currentTime) : 0
    
    return leftTimeLeft < rightTimeLeft ? 'left' : 'right'
  }, [isDeckFree, audioState.leftDeck, audioState.rightDeck])

  // Verifica se una traccia è duplicata
  const isTrackDuplicate = useCallback((track: any, targetDeck: 'left' | 'right'): boolean => {
    const otherDeck = targetDeck === 'left' ? audioState.rightDeck : audioState.leftDeck
    return otherDeck.track?.id === track.id
  }, [audioState.leftDeck, audioState.rightDeck])

  // Trova la prossima traccia non duplicata
  const getNextNonDuplicateTrack = useCallback((currentTrack: any, targetDeck: 'left' | 'right'): any => {
    let nextTrack = getNextTrack(currentTrack)
    let attempts = 0
    const maxAttempts = 10 // Evita loop infiniti
    
    while (nextTrack && attempts < maxAttempts) {
      const isDuplicate = isTrackDuplicate(nextTrack, targetDeck)
      
      if (!isDuplicate) {
        return nextTrack
      }
      
      nextTrack = getNextTrack(nextTrack)
      attempts++
    }
    
    return nextTrack
  }, [getNextTrack, isTrackDuplicate])

  // Gestisce l'auto-avanzamento
  const handleAutoAdvance = useCallback((fromDeck: 'left' | 'right') => {
    if (!settings.interface.autoAdvance) {
      return
    }

    // Throttling per evitare chiamate multiple
    const now = Date.now()
    if (now - generalAdvanceTimeRef.current < 1000) {
      return
    }
    generalAdvanceTimeRef.current = now

    const currentTrack = fromDeck === 'left' ? audioState.leftDeck.track : audioState.rightDeck.track
    if (!currentTrack) {
      return
    }

    // Trova il deck migliore per la prossima traccia
    const targetDeck = getBestDeckForAutoAdvance()
    if (!targetDeck) {
      return
    }

    // Cerca la prossima traccia non duplicata
    const nextTrack = getNextNonDuplicateTrack(currentTrack, targetDeck)
    if (!nextTrack) {
      return
    }

    // Se il deck non è libero, aspetta che si liberi
    if (!isDeckFree(targetDeck)) {
      pendingAdvanceRef.current = { deck: targetDeck, track: nextTrack }
      return
    }

    // Carica la traccia nel deck target
    console.log(`🔄 Auto-advance: ${nextTrack.title} → Deck ${targetDeck.toUpperCase()}`)
    onTrackLoad(targetDeck, nextTrack)
    
    // Pulisci eventuali avanzamenti pendenti
    pendingAdvanceRef.current = null
  }, [settings.interface.autoAdvance, audioState.leftDeck.track, audioState.rightDeck.track, getBestDeckForAutoAdvance, getNextNonDuplicateTrack, isDeckFree, onTrackLoad])

  // Gestisce gli avanzamenti pendenti quando un deck si libera
  useEffect(() => {
    if (!pendingAdvanceRef.current) return

    const { deck: targetDeck, track } = pendingAdvanceRef.current
    
    if (isDeckFree(targetDeck)) {
      onTrackLoad(targetDeck, track)
      pendingAdvanceRef.current = null
    }
  }, [audioState.leftDeck.isPlaying, audioState.rightDeck.isPlaying, isDeckFree, onTrackLoad])

  // Listener per eventi di auto-avanzamento
  useEffect(() => {
    const handleAutoAdvanceRequest = (event: CustomEvent) => {
      const { deck } = event.detail
      handleAutoAdvance(deck)
    }

    window.addEventListener('djconsole:request-auto-advance', handleAutoAdvanceRequest as EventListener)
    return () => {
      window.removeEventListener('djconsole:request-auto-advance', handleAutoAdvanceRequest as EventListener)
    }
  }, [handleAutoAdvance])

  // Monitoraggio del tempo rimanente per attivare l'auto-avanzamento
  useEffect(() => {
    if (!settings.interface.autoAdvance) return

    const checkAutoAdvance = () => {
      const now = Date.now()

      // Verifica deck sinistro
      const leftTrack = audioState.leftDeck.track
      if (leftTrack && audioState.leftDeck.isPlaying && audioState.leftDeck.currentTime > 0) {
        const timeLeft = leftTrack.duration - audioState.leftDeck.currentTime
        
        // ✅ CRITICAL FIX: Attiva auto-avanzamento quando mancano meno di 2 secondi
        if (timeLeft <= 2 && timeLeft > 0 && (now - deckAdvanceTimeRef.current.left) > 5000) {
          deckAdvanceTimeRef.current.left = now
          handleAutoAdvance('left')
        }
      }

      // Verifica deck destro
      const rightTrack = audioState.rightDeck.track
      if (rightTrack && audioState.rightDeck.isPlaying && audioState.rightDeck.currentTime > 0) {
        const timeLeft = rightTrack.duration - audioState.rightDeck.currentTime
        
        // ✅ CRITICAL FIX: Attiva auto-avanzamento quando mancano meno di 2 secondi
        if (timeLeft <= 2 && timeLeft > 0 && (now - deckAdvanceTimeRef.current.right) > 5000) {
          deckAdvanceTimeRef.current.right = now
          handleAutoAdvance('right')
        }
      }
    }

    const interval = setInterval(checkAutoAdvance, 1000) // Controlla ogni 1 secondo per maggiore precisione
    return () => clearInterval(interval)
  }, [settings.interface.autoAdvance, audioState.leftDeck.track, audioState.rightDeck.track, audioState.leftDeck.isPlaying, audioState.rightDeck.isPlaying, handleAutoAdvance])

  // Questo componente non ha UI, gestisce solo la logica
  return null
}

export default AutoAdvanceManager
