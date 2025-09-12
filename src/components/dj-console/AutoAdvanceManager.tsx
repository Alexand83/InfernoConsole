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
    console.log('🔍 [AUTO-ADVANCE DEBUG] getNextTrack chiamato con:', {
      activePlaylistId,
      currentTrack: currentTrack?.title,
      currentTrackId: currentTrack?.id
    })
    
    if (!activePlaylistId || !currentTrack) {
      console.log('🔍 [AUTO-ADVANCE DEBUG] Mancano activePlaylistId o currentTrack')
      return null
    }
    
    const playlist = playlistState.library.playlists.find(p => p.id === activePlaylistId)
    console.log('🔍 [AUTO-ADVANCE DEBUG] Playlist trovata:', {
      playlistExists: !!playlist,
      playlistId: playlist?.id,
      tracksCount: playlist?.tracks?.length
    })
    
    if (!playlist) {
      console.log('🔍 [AUTO-ADVANCE DEBUG] Playlist non trovata')
      return null
    }
    
    const currentIndex = playlist.tracks.findIndex(t => t.id === currentTrack.id)
    console.log('🔍 [AUTO-ADVANCE DEBUG] Indice traccia corrente:', {
      currentIndex,
      totalTracks: playlist.tracks.length,
      isLastTrack: currentIndex >= playlist.tracks.length - 1
    })
    
    if (currentIndex === -1) {
      console.log('🔍 [AUTO-ADVANCE DEBUG] Traccia corrente non trovata nella playlist')
      return null
    }
    
    if (currentIndex >= playlist.tracks.length - 1) {
      console.log('🔍 [AUTO-ADVANCE DEBUG] È l\'ultima traccia della playlist')
      
      // ✅ LOOP PLAYLIST: Se abilitato, riparti dalla prima traccia
      if (settings.interface.playlistLoop && playlist.tracks.length > 0) {
        console.log('🔄 [AUTO-ADVANCE DEBUG] Loop playlist abilitato - riparto dalla prima traccia')
        return playlist.tracks[0]
      }
      
      return null
    }
    
    const nextTrack = playlist.tracks[currentIndex + 1]
    console.log('🔍 [AUTO-ADVANCE DEBUG] Prossima traccia trovata:', {
      nextTrackTitle: nextTrack?.title,
      nextTrackId: nextTrack?.id
    })
    
    return nextTrack
  }, [activePlaylistId, playlistState.library.playlists])

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
    console.log('🔍 [AUTO-ADVANCE DEBUG] getNextNonDuplicateTrack chiamato con:', {
      currentTrack: currentTrack?.title,
      targetDeck
    })
    
    let nextTrack = getNextTrack(currentTrack)
    let attempts = 0
    const maxAttempts = 10 // Evita loop infiniti
    
    console.log('🔍 [AUTO-ADVANCE DEBUG] Prima traccia trovata:', {
      nextTrack: nextTrack?.title,
      nextTrackId: nextTrack?.id
    })
    
    while (nextTrack && attempts < maxAttempts) {
      const isDuplicate = isTrackDuplicate(nextTrack, targetDeck)
      console.log('🔍 [AUTO-ADVANCE DEBUG] Controllo duplicato:', {
        track: nextTrack.title,
        isDuplicate,
        targetDeck
      })
      
      if (!isDuplicate) {
        console.log(`✅ Trovata traccia non duplicata: ${nextTrack.title} (tentativo ${attempts + 1})`)
        return nextTrack
      }
      
      console.log(`⚠️ Traccia duplicata saltata: ${nextTrack.title} (tentativo ${attempts + 1})`)
      nextTrack = getNextTrack(nextTrack)
      attempts++
    }
    
    if (attempts >= maxAttempts) {
      console.log(`⚠️ Raggiunto limite massimo di tentativi (${maxAttempts}), usando ultima traccia trovata`)
    }
    
    return nextTrack
  }, [getNextTrack, isTrackDuplicate])

  // Gestisce l'auto-avanzamento
  const handleAutoAdvance = useCallback((fromDeck: 'left' | 'right') => {
    if (!settings.interface.autoAdvance) {
      console.log('🔄 Auto-avanzamento disabilitato nelle impostazioni')
      return
    }

    // Throttling per evitare chiamate multiple
    const now = Date.now()
    if (now - generalAdvanceTimeRef.current < 1000) {
      console.log('🔄 Auto-avanzamento throttled (troppo veloce)')
      return
    }
    generalAdvanceTimeRef.current = now

    const currentTrack = fromDeck === 'left' ? audioState.leftDeck.track : audioState.rightDeck.track
    if (!currentTrack) {
      console.log('🔄 Nessuna traccia corrente per auto-avanzamento')
      return
    }

    // Trova il deck migliore per la prossima traccia
    const targetDeck = getBestDeckForAutoAdvance()
    if (!targetDeck) {
      console.log('🔄 Nessun deck disponibile per auto-avanzamento')
      return
    }

    console.log(`🔄 Auto-avanzamento richiesto da deck ${fromDeck.toUpperCase()}`)
    console.log(`🔄 Traccia corrente: ${currentTrack.title}`)

    // Cerca la prossima traccia non duplicata
    const nextTrack = getNextNonDuplicateTrack(currentTrack, targetDeck)
    if (!nextTrack) {
      console.log('🔄 Nessuna traccia successiva trovata per auto-avanzamento')
      return
    }

    console.log(`🔄 Prossima traccia: ${nextTrack.title}`)

    // Se il deck non è libero, aspetta che si liberi
    if (!isDeckFree(targetDeck)) {
      console.log(`🔄 Deck ${targetDeck.toUpperCase()} occupato, auto-avanzamento in attesa`)
      pendingAdvanceRef.current = { deck: targetDeck, track: nextTrack }
      return
    }

    // Carica la traccia nel deck target
    console.log(`🔄 Caricamento auto-avanzamento: ${nextTrack.title} in deck ${targetDeck.toUpperCase()}`)
    onTrackLoad(targetDeck, nextTrack)
    
    // Pulisci eventuali avanzamenti pendenti
    pendingAdvanceRef.current = null
  }, [settings.interface.autoAdvance, audioState.leftDeck.track, audioState.rightDeck.track, getBestDeckForAutoAdvance, getNextNonDuplicateTrack, isDeckFree, onTrackLoad])

  // Gestisce gli avanzamenti pendenti quando un deck si libera
  useEffect(() => {
    if (!pendingAdvanceRef.current) return

    const { deck: targetDeck, track } = pendingAdvanceRef.current
    
    if (isDeckFree(targetDeck)) {
      console.log(`🔄 Deck ${targetDeck.toUpperCase()} ora libero, eseguendo auto-avanzamento pendente`)
      onTrackLoad(targetDeck, track)
      pendingAdvanceRef.current = null
    }
  }, [audioState.leftDeck.isPlaying, audioState.rightDeck.isPlaying, isDeckFree, onTrackLoad])

  // Listener per eventi di auto-avanzamento
  useEffect(() => {
    const handleAutoAdvanceRequest = (event: CustomEvent) => {
      console.log('🔄 [AUTO-ADVANCE] Evento djconsole:request-auto-advance ricevuto:', event.detail)
      const { deck } = event.detail
      handleAutoAdvance(deck)
    }

    console.log('🔄 [AUTO-ADVANCE] Listener registrato per djconsole:request-auto-advance')
    window.addEventListener('djconsole:request-auto-advance', handleAutoAdvanceRequest as EventListener)
    return () => {
      console.log('🔄 [AUTO-ADVANCE] Listener rimosso per djconsole:request-auto-advance')
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
        console.log(`🔄 [AUTO-ADVANCE] Deck LEFT: ${audioState.leftDeck.currentTime.toFixed(2)}s / ${leftTrack.duration.toFixed(2)}s (${timeLeft.toFixed(2)}s rimanenti)`)
        
        // ✅ CRITICAL FIX: Attiva auto-avanzamento quando mancano meno di 2 secondi
        if (timeLeft <= 2 && timeLeft > 0 && (now - deckAdvanceTimeRef.current.left) > 5000) {
          console.log('🔄 [AUTO-ADVANCE] Auto-avanzamento attivato per deck LEFT (2s rimanenti)')
          deckAdvanceTimeRef.current.left = now
          handleAutoAdvance('left')
        }
      }

      // Verifica deck destro
      const rightTrack = audioState.rightDeck.track
      if (rightTrack && audioState.rightDeck.isPlaying && audioState.rightDeck.currentTime > 0) {
        const timeLeft = rightTrack.duration - audioState.rightDeck.currentTime
        console.log(`🔄 [AUTO-ADVANCE] Deck RIGHT: ${audioState.rightDeck.currentTime.toFixed(2)}s / ${rightTrack.duration.toFixed(2)}s (${timeLeft.toFixed(2)}s rimanenti)`)
        
        // ✅ CRITICAL FIX: Attiva auto-avanzamento quando mancano meno di 2 secondi
        if (timeLeft <= 2 && timeLeft > 0 && (now - deckAdvanceTimeRef.current.right) > 5000) {
          console.log('🔄 [AUTO-ADVANCE] Auto-avanzamento attivato per deck RIGHT (2s rimanenti)')
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
