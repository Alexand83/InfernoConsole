import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import { usePlaylist } from '../../contexts/PlaylistContext'
import { useAudio } from '../../contexts/AudioContext'

interface AutoAdvanceManagerProps {
  activePlaylistId?: string | null
  onTrackLoad?: (deck: 'left' | 'right', track: any) => void
  onDuplicateTrackWarning?: (track: any, activeDeck: 'left' | 'right') => void
}

const AutoAdvanceManager: React.FC<AutoAdvanceManagerProps> = ({
  activePlaylistId: propActivePlaylistId,
  onTrackLoad: propOnTrackLoad,
  onDuplicateTrackWarning
}) => {
  const { settings } = useSettings()
  const { state: playlistState } = usePlaylist()
  const { state: audioState, clearLeftDeck, clearRightDeck, dispatch } = useAudio()
  
  const pendingAdvanceRef = useRef<{deck: 'left' | 'right', track: any} | null>(null)
  const generalAdvanceTimeRef = useRef<number>(0)
  const deckAdvanceTimeRef = useRef<{left: number, right: number}>({left: 0, right: 0})
  
  // ✅ FIX AUTOPLAY: Gestione interna della playlist attiva
  const activePlaylistId = propActivePlaylistId || playlistState.currentPlaylist?.id
  
  // ✅ DEBUG: Log per monitorare la playlist attiva (ridotto)
  // console.log(`🔄 [AUTOPLAY] Playlist attiva:`, playlistState.currentPlaylist?.name || 'Nessuna')
  
  // ✅ FIX AUTOPLAY: Gestione interna del caricamento tracce
  const handleTrackLoadInternal = useCallback((deck: 'left' | 'right', track: any) => {
    if (propOnTrackLoad) {
      // Se viene fornita una funzione esterna, usala
      propOnTrackLoad(deck, track)
    } else {
      // Altrimenti, gestisci internamente tramite eventi
      const event = new CustomEvent('djconsole:load-track', {
        detail: { deck, track }
      })
      console.log(`🔄 [AUTOPLAY] Dispatching track load event:`, { deck, track: track.title })
      window.dispatchEvent(event)
      console.log(`🔄 [AUTOPLAY] Track load event dispatched: ${track.title} → ${deck} deck`)
    }
  }, [propOnTrackLoad])

  // Trova la prossima traccia nella playlist
  const getNextTrack = useCallback((currentTrack: any): any | null => {
    console.log(`🔄 [AUTOPLAY] getNextTrack called for:`, currentTrack ? currentTrack.title : 'none')
    console.log(`🔄 [AUTOPLAY] activePlaylistId:`, activePlaylistId)
    console.log(`🔄 [AUTOPLAY] Available playlists:`, playlistState.library.playlists.map(p => ({ id: p.id, name: p.name, tracks: p.tracks.length })))
    
    if (!currentTrack) {
      console.log(`🔄 [AUTOPLAY] No currentTrack`)
      return null
    }
    
    // ✅ FIX: Se non c'è una playlist attiva, usa la prima playlist disponibile
    let targetPlaylistId = activePlaylistId
    if (!targetPlaylistId && playlistState.library.playlists.length > 0) {
      targetPlaylistId = playlistState.library.playlists[0].id
      console.log(`🔄 [AUTOPLAY] No active playlist, using first available:`, targetPlaylistId)
    }
    
    if (!targetPlaylistId) {
      console.log(`🔄 [AUTOPLAY] No playlists available`)
      return null
    }
    
    const playlist = playlistState.library.playlists.find(p => p.id === targetPlaylistId)
    if (!playlist) {
      console.log(`🔄 [AUTOPLAY] Playlist not found for id:`, targetPlaylistId)
      return null
    }
    
    console.log(`🔄 [AUTOPLAY] Found playlist:`, playlist.name, 'with', playlist.tracks.length, 'tracks')
    
    const currentIndex = playlist.tracks.findIndex(t => t.id === currentTrack.id)
    console.log(`🔄 [AUTOPLAY] Current track index:`, currentIndex)
    
    if (currentIndex === -1) {
      console.log(`🔄 [AUTOPLAY] Current track not found in playlist`)
      return null
    }
    
    if (currentIndex >= playlist.tracks.length - 1) {
      console.log(`🔄 [AUTOPLAY] Last track in playlist, loop enabled:`, settings.interface.playlistLoop)
      // ✅ LOOP PLAYLIST: Se abilitato, riparti dalla prima traccia
      if (settings.interface.playlistLoop && playlist.tracks.length > 0) {
        console.log(`🔄 [AUTOPLAY] Looping to first track:`, playlist.tracks[0].title)
        return playlist.tracks[0]
      }
      return null
    }
    
    const nextTrack = playlist.tracks[currentIndex + 1]
    console.log(`🔄 [AUTOPLAY] Next track found:`, nextTrack ? nextTrack.title : 'none')
    return nextTrack
  }, [activePlaylistId, playlistState.library.playlists, settings.interface.playlistLoop])

  // Verifica se un deck è libero
  const isDeckFree = useCallback((deck: 'left' | 'right'): boolean => {
    const deckState = deck === 'left' ? audioState.leftDeck : audioState.rightDeck
    return !deckState.track || !deckState.isPlaying
  }, [audioState.leftDeck, audioState.rightDeck])

  // Trova il deck migliore per l'auto-avanzamento
  const getBestDeckForAutoAdvance = useCallback((fromDeck: 'left' | 'right'): 'left' | 'right' | null => {
    console.log(`🔄 [AUTOPLAY] getBestDeckForAutoAdvance: fromDeck=${fromDeck}`)
    
    // ✅ LOGICA CORRETTA: Se il deck A (left) è libero, usalo sempre
    if (isDeckFree('left')) {
      console.log(`🔄 [AUTOPLAY] Deck A (left) è libero, lo uso`)
      return 'left'
    }
    
    // ✅ LOGICA CORRETTA: Se il deck A è occupato ma il deck B è libero, usa il deck B
    if (isDeckFree('right')) {
      console.log(`🔄 [AUTOPLAY] Deck A occupato, uso deck B`)
      return 'right'
    }
    
    // ✅ LOGICA CORRETTA: Se il deck B ha finito di suonare, svuotalo e usa il deck A (se libero) o B (se A occupato)
    if (fromDeck === 'right' && audioState.rightDeck.track && !audioState.rightDeck.isPlaying) {
      console.log(`🔄 [AUTOPLAY] Deck B ha finito di suonare, lo svuoto`)
      
      // Svuota il deck B usando la funzione identica al bottone X
      clearRightDeck()
      console.log(`✅ [AUTOPLAY] Deck B svuotato con successo`)
      
      // Dopo aver svuotato B, controlla di nuovo A
      if (isDeckFree('left')) {
        console.log(`🔄 [AUTOPLAY] Dopo aver svuotato B, uso deck A`)
        return 'left'
      } else {
        console.log(`🔄 [AUTOPLAY] Dopo aver svuotato B, A ancora occupato, uso B`)
        return 'right'
      }
    }
    
    // Se entrambi sono occupati, usa comunque il deck A (sovrascriverà)
    console.log(`🔄 [AUTOPLAY] Entrambi i deck occupati, uso comunque deck A`)
    return 'left'
  }, [isDeckFree, audioState.rightDeck.track, audioState.rightDeck.isPlaying, clearRightDeck])

  // Verifica se una traccia è duplicata
  const isTrackDuplicate = useCallback((track: any, targetDeck: 'left' | 'right'): boolean => {
    const otherDeck = targetDeck === 'left' ? audioState.rightDeck : audioState.leftDeck
    return otherDeck.track?.id === track.id
  }, [audioState.leftDeck, audioState.rightDeck])

  // Trova la prossima traccia non duplicata
  const getNextNonDuplicateTrack = useCallback((currentTrack: any, targetDeck: 'left' | 'right'): any => {
    console.log(`🔄 [AUTOPLAY] getNextNonDuplicateTrack called for:`, currentTrack ? currentTrack.title : 'none', 'targetDeck:', targetDeck)
    
    let nextTrack = getNextTrack(currentTrack)
    let attempts = 0
    const maxAttempts = 10 // Evita loop infiniti
    
    console.log(`🔄 [AUTOPLAY] Initial nextTrack:`, nextTrack ? nextTrack.title : 'none')
    
    while (nextTrack && attempts < maxAttempts) {
      const isDuplicate = isTrackDuplicate(nextTrack, targetDeck)
      console.log(`🔄 [AUTOPLAY] Track ${nextTrack.title} is duplicate:`, isDuplicate)
      
      if (!isDuplicate) {
        console.log(`🔄 [AUTOPLAY] Found non-duplicate track:`, nextTrack.title)
        return nextTrack
      }
      
      // Se è duplicata, cerca la prossima
      console.log(`🔄 [AUTOPLAY] Track is duplicate, searching next...`)
      nextTrack = getNextTrack(nextTrack)
      attempts++
    }
    
    console.log(`🔄 [AUTOPLAY] No non-duplicate track found after`, attempts, 'attempts')
    return nextTrack
  }, [getNextTrack, isTrackDuplicate])

  // Gestisce l'auto-avanzamento
  const handleAutoAdvance = useCallback((fromDeck: 'left' | 'right') => {
    console.log(`🔄 [AUTOPLAY] handleAutoAdvance called for ${fromDeck} deck`)
    console.log(`🔍 [DEBUG] Stato attuale dei deck:`, {
      leftDeck: {
        track: audioState.leftDeck.track?.title || 'null',
        isPlaying: audioState.leftDeck.isPlaying,
        currentTime: audioState.leftDeck.currentTime,
        duration: audioState.leftDeck.duration
      },
      rightDeck: {
        track: audioState.rightDeck.track?.title || 'null',
        isPlaying: audioState.rightDeck.isPlaying,
        currentTime: audioState.rightDeck.currentTime,
        duration: audioState.rightDeck.duration
      }
    })
    
    if (!settings.interface.autoAdvance) {
      console.log('🔄 [AUTOPLAY] Auto-advance disabilitato nelle impostazioni')
      return
    }

    // Throttling per evitare chiamate multiple
    const now = Date.now()
    if (now - generalAdvanceTimeRef.current < 1000) {
      console.log('🔄 [AUTOPLAY] Throttling: troppo presto per auto-advance')
      return
    }
    generalAdvanceTimeRef.current = now

    const currentTrack = fromDeck === 'left' ? audioState.leftDeck.track : audioState.rightDeck.track
    console.log(`🔄 [AUTOPLAY] Current track:`, currentTrack ? currentTrack.title : 'none')
    
    if (!currentTrack) {
      console.log('🔄 [AUTOPLAY] Nessuna traccia corrente, skip auto-advance')
      return
    }

    // Trova il deck migliore per la prossima traccia
    const targetDeck = getBestDeckForAutoAdvance(fromDeck)
    console.log(`🔄 [AUTOPLAY] Target deck:`, targetDeck)
    
    if (!targetDeck) {
      console.log('🔄 [AUTOPLAY] Nessun deck target disponibile')
      return
    }

    // Cerca la prossima traccia non duplicata
    const nextTrack = getNextNonDuplicateTrack(currentTrack, targetDeck)
    console.log(`🔄 [AUTOPLAY] Next track:`, nextTrack ? nextTrack.title : 'none')
    
    if (!nextTrack) {
      console.log('🔄 [AUTOPLAY] Nessuna prossima traccia disponibile')
      return
    }

    // Se il deck non è libero, aspetta che si liberi
    if (!isDeckFree(targetDeck)) {
      console.log(`🔄 [AUTOPLAY] Deck ${targetDeck} non libero, aspetto...`)
      pendingAdvanceRef.current = { deck: targetDeck, track: nextTrack }
      return
    }

    // ✅ LOGICA CORRETTA: Gestione intelligente della pulizia dei deck usando le funzioni del bottone X
    if (fromDeck === 'right' && audioState.rightDeck.track && !audioState.rightDeck.isPlaying) {
      // Se il deck B ha finito di suonare, svuotalo completamente
      console.log(`🗑️ [AUTOPLAY] Deck B ha finito di suonare, lo svuoto completamente`)
      console.log(`🔍 [DEBUG] Stato deck B prima della pulizia:`, {
        track: audioState.rightDeck.track?.title,
        isPlaying: audioState.rightDeck.isPlaying,
        currentTime: audioState.rightDeck.currentTime,
        duration: audioState.rightDeck.duration
      })
      
      // Svuota il deck B usando la funzione del context
      clearRightDeck()
      console.log(`✅ [AUTOPLAY] Deck B svuotato con successo`)
    } else if (fromDeck !== targetDeck) {
      // Se il deck che ha finito è diverso dal target, pulisci quello che ha finito
      console.log(`🗑️ [AUTOPLAY] Pulizia deck ${fromDeck} che ha finito la traccia`)
      console.log(`🔍 [DEBUG] Chiamando clear${fromDeck === 'left' ? 'Left' : 'Right'}Deck()...`)
      if (fromDeck === 'left') {
        clearLeftDeck()
      } else {
        clearRightDeck()
      }
      console.log(`🔍 [DEBUG] clear${fromDeck === 'left' ? 'Left' : 'Right'}Deck() completata`)
    }

    // Carica la traccia nel deck target
    console.log(`🔄 [AUTOPLAY] ✅ Auto-advance: ${nextTrack.title} → Deck ${targetDeck.toUpperCase()}`)
    console.log(`🔄 [AUTOPLAY] Calling handleTrackLoadInternal with:`, { deck: targetDeck, track: nextTrack.title })
    handleTrackLoadInternal(targetDeck, nextTrack)
    console.log(`🔄 [AUTOPLAY] handleTrackLoadInternal called successfully`)
    
    // Pulisci eventuali avanzamenti pendenti
    pendingAdvanceRef.current = null
  }, [settings.interface.autoAdvance, audioState.leftDeck.track, audioState.rightDeck.track, audioState.rightDeck.isPlaying, getBestDeckForAutoAdvance, getNextNonDuplicateTrack, isDeckFree, handleTrackLoadInternal, clearLeftDeck, clearRightDeck])

  // Gestisce gli avanzamenti pendenti quando un deck si libera
  useEffect(() => {
    if (!pendingAdvanceRef.current) return

    const { deck: targetDeck, track } = pendingAdvanceRef.current
    
    if (isDeckFree(targetDeck)) {
      handleTrackLoadInternal(targetDeck, track)
      pendingAdvanceRef.current = null
    }
  }, [audioState.leftDeck.isPlaying, audioState.rightDeck.isPlaying, isDeckFree, handleTrackLoadInternal])

  // Listener per eventi di auto-avanzamento
  useEffect(() => {
    const handleAutoAdvanceRequest = (event: CustomEvent) => {
      const { deck } = event.detail
      console.log(`🔄 [AUTOPLAY] Auto-advance request received for ${deck} deck`)
      handleAutoAdvance(deck)
    }

    const handleTrackEnded = (event: CustomEvent) => {
      const { deckId } = event.detail
      const deck = deckId === 'A' ? 'left' : 'right'
      console.log(`🔄 [AUTOPLAY] ✅ Track ended event received for ${deck} deck (deckId: ${deckId})`)
      console.log(`🔍 [DEBUG] Evento track-ended ricevuto:`, event.detail)
      console.log(`🔄 [AUTOPLAY] ✅ AutoAdvanceManager gestisce l'auto-advance (conflitto risolto)`)
      handleAutoAdvance(deck)
    }

    window.addEventListener('djconsole:request-auto-advance', handleAutoAdvanceRequest as EventListener)
    window.addEventListener('djconsole:track-ended', handleTrackEnded as EventListener)
    return () => {
      window.removeEventListener('djconsole:request-auto-advance', handleAutoAdvanceRequest as EventListener)
      window.removeEventListener('djconsole:track-ended', handleTrackEnded as EventListener)
    }
  }, [handleAutoAdvance])

  // Monitoraggio del tempo rimanente per attivare l'auto-avanzamento
  useEffect(() => {
    if (!settings.interface.autoAdvance) {
      console.log('🔄 [AUTOPLAY] Auto-advance disabilitato nelle impostazioni')
      return
    }
    
    // console.log('🔄 [AUTOPLAY] Auto-advance abilitato, monitoraggio attivo')

    const checkAutoAdvance = () => {
      const now = Date.now()

      // Verifica deck sinistro
      const leftTrack = audioState.leftDeck.track
      if (leftTrack && audioState.leftDeck.isPlaying && audioState.leftDeck.currentTime > 0) {
        const timeLeft = leftTrack.duration - audioState.leftDeck.currentTime
        
        // ✅ FIX AUTOPLAY: Attiva auto-avanzamento quando mancano meno di 1 secondo
        if (timeLeft <= 1 && timeLeft > 0 && (now - deckAdvanceTimeRef.current.left) > 3000) {
          deckAdvanceTimeRef.current.left = now
          console.log(`🔄 [AUTOPLAY] Left deck auto-advance triggered (${timeLeft.toFixed(1)}s remaining)`)
          handleAutoAdvance('left')
        }
      }

      // Verifica deck destro
      const rightTrack = audioState.rightDeck.track
      if (rightTrack && audioState.rightDeck.isPlaying && audioState.rightDeck.currentTime > 0) {
        const timeLeft = rightTrack.duration - audioState.rightDeck.currentTime
        
        // ✅ FIX AUTOPLAY: Attiva auto-avanzamento quando mancano meno di 1 secondo
        if (timeLeft <= 1 && timeLeft > 0 && (now - deckAdvanceTimeRef.current.right) > 3000) {
          deckAdvanceTimeRef.current.right = now
          console.log(`🔄 [AUTOPLAY] Right deck auto-advance triggered (${timeLeft.toFixed(1)}s remaining)`)
          handleAutoAdvance('right')
        }
      }
    }

    const interval = setInterval(checkAutoAdvance, 5000) // ✅ PERFORMANCE: Ridotto da 2000ms a 5000ms per ridurre CPU
    return () => clearInterval(interval)
  }, [settings.interface.autoAdvance, audioState.leftDeck.track, audioState.rightDeck.track, audioState.leftDeck.isPlaying, audioState.rightDeck.isPlaying, handleAutoAdvance])

  // Questo componente non ha UI, gestisce solo la logica
  return null
}

export default AutoAdvanceManager
