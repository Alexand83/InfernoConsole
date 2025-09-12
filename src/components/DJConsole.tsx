import React, { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useAudio } from '../contexts/AudioContext'
import { usePlaylist } from '../contexts/PlaylistContext'
import AudioDeck from './AudioDeck'
import Crossfader from './Crossfader'
import { localDatabase } from '../database/LocalDatabase'
import StreamingControl from './StreamingControl'

const DJConsole = memo(() => {
  // Sistema di stabilità forzata - evita re-mount COMPLETAMENTE
  const componentId = useRef(`djconsole-${Math.random().toString(36).substr(2, 9)}`)
  const isStable = useRef(false)
  const hasStabilized = useRef(false)
  
  // Stabilizza il componente SOLO UNA VOLTA - MAI PIÙ
  useEffect(() => {
    if (hasStabilized.current) {
      console.log('🔄 DJConsole already permanently stabilized, preventing ANY re-mount')
      return
    }
    
    console.log('🎯 DJConsole permanently stabilizing component:', componentId.current)
    isStable.current = true
    hasStabilized.current = true
    
    // Forza la stabilità permanente
    Object.freeze(componentId.current)
    Object.freeze(isStable.current)
    Object.freeze(hasStabilized.current)
  }, [])

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
    setCrossfader,
    toggleMicrophone,
    setStreamDucking
  } = useAudio()
  

  const { state: playlistState, reorderPlaylist } = usePlaylist()
  const [leftTrack, setLeftTrack] = useState<any>(null)
  const [rightTrack, setRightTrack] = useState<any>(null)
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [activeDeck, setActiveDeck] = useState<'left' | 'right'>('left')
  // RIMOSSE: Variabili locali non più necessarie - ora usa AudioContext
  const [showMicrophone, setShowMicrophone] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const pttActiveRef = useRef(false)
  const micWasActiveBeforePTTRef = useRef(false)
  const originalVolumeRef = useRef<number | null>(null)

  const loadInProgressRef = useRef(false)
  
  // Memoizza le funzioni per evitare re-render
  const memoizedOnLoad = useCallback((deck: 'left' | 'right', track: any) => {
    console.log('📥 [DJConsole] memoizedOnLoad called:', {
      deck,
      track: { id: track.id, title: track.title, artist: track.artist },
      timestamp: new Date().toISOString()
    })
    
    if (loadInProgressRef.current) {
      console.log('⚠️ [DJConsole] Load already in progress, skipping')
      return
    }
    loadInProgressRef.current = true
    
    try {
      const trackToPlay = track
      
      if (deck === 'left') {
        console.log('🎵 [DJConsole] Loading track in LEFT deck')
        setLeftTrack(trackToPlay)
        if (trackToPlay?.url) {
          playLeftTrack({ 
            id: trackToPlay.id, 
            title: trackToPlay.title, 
            artist: trackToPlay.artist, 
            duration: trackToPlay.duration, 
            url: trackToPlay.url 
          })
        }
      } else {
        console.log('🎵 [DJConsole] Loading track in RIGHT deck')
        setRightTrack(trackToPlay)
        if (trackToPlay?.url) {
          playRightTrack({ 
            id: trackToPlay.id, 
            title: trackToPlay.title, 
            artist: trackToPlay.artist, 
            duration: trackToPlay.duration, 
            url: trackToPlay.url 
          })
        }
      }
      
      console.log('🎯 [DJConsole] Activating deck:', deck)
      setActiveDeck(deck) // Mantieni per compatibilità
    } catch (error) {
      console.warn('Errore nel caricamento traccia:', error)
    } finally {
      loadInProgressRef.current = false
    }
  }, [playLeftTrack, playRightTrack, setLeftTrack, setRightTrack, setActiveDeck])

  // Log per tracciare il ciclo di vita del componente
  useEffect(() => {
    console.log('🎛️ [DJConsole] Component mounted')
    console.log('🎛️ [DJConsole] Component ID:', Math.random().toString(36).substr(2, 9))
    console.log('🎛️ [DJConsole] Initial state:', {
      leftDeck: {
        track: audioState.leftDeck.track,
        isPlaying: audioState.leftDeck.isPlaying,
        isActive: audioState.leftDeck.isActive
        // currentTime: RIMOSSO - ora gestito dal TimerContext
      },
      rightDeck: {
        track: audioState.rightDeck.track,
        isPlaying: audioState.rightDeck.isPlaying,
        isActive: audioState.rightDeck.isActive
        // currentTime: RIMOSSO - ora gestito dal TimerContext
      }
    })
    
    // NOTIFICA che la console è stata montata per ripristinare i controlli audio
    window.dispatchEvent(new CustomEvent('djconsole:console-mounted'))
    
    return () => {
      console.log('🎛️ [DJConsole] Component unmounting')
      console.log('🎛️ [DJConsole] Component ID:', Math.random().toString(36).substr(2, 9))
      
      // NOTIFICA che la console è stata smontata per preservare lo stato audio
      window.dispatchEvent(new CustomEvent('djconsole:console-unmounted'))
    }
  }, [])

  // Log per tracciare i cambiamenti di stato (solo quando cambiano i track)
  useEffect(() => {
    console.log('🔄 [DJConsole] Track changed:', {
      leftDeck: {
        track: audioState.leftDeck.track?.title,
        isPlaying: audioState.leftDeck.isPlaying,
        isActive: audioState.leftDeck.isActive
      },
      rightDeck: {
        track: audioState.rightDeck.track?.title,
        isPlaying: audioState.rightDeck.isPlaying,
        isActive: audioState.rightDeck.isActive
      }
    })
  }, [audioState.leftDeck.track?.id, audioState.rightDeck.track?.id, audioState.leftDeck.isPlaying, audioState.rightDeck.isPlaying])

  // Log per tracciare i re-render (senza re-mount)
  useEffect(() => {
    console.log('🔄 [DJConsole] Component re-rendered (no unmount)')
  })

  // Auto-advance listener (simplified for now)
  useEffect(() => {
    const onRequestNext = (event: CustomEvent) => {
      const { deck } = event.detail
      console.log('🔄 Auto-advance requested for deck:', deck)
      
      // Trova la prossima traccia nella playlist attiva
      if (activePlaylistId && playlistState.library.playlists.length > 0) {
        const activePlaylist = playlistState.library.playlists.find(pl => pl.id === activePlaylistId)
        if (activePlaylist && activePlaylist.tracks.length > 0) {
          // Trova la traccia corrente nel deck specificato
          const currentTrack = deck === 'left' ? leftTrack : rightTrack
          if (currentTrack) {
            const currentIndex = activePlaylist.tracks.findIndex(t => t.id === currentTrack.id)
            if (currentIndex !== -1 && currentIndex < activePlaylist.tracks.length - 1) {
              const nextTrack = activePlaylist.tracks[currentIndex + 1]
              
              // Carica immediatamente nel deck libero e AVVIA la riproduzione
              if (!audioState.leftDeck.track) {
                console.log('🔄 Auto-loading and playing next track in left deck (free):', nextTrack.title)
                memoizedOnLoad('left', nextTrack)
                // Avvia automaticamente la riproduzione
                setTimeout(() => {
                  if (audioState.leftDeck.track?.id === nextTrack.id) {
                    console.log('▶️ Auto-starting left deck')
                    playLeftTrack(nextTrack)
                  }
                }, 100)
              } else if (!audioState.rightDeck.track) {
                console.log('🔄 Auto-loading and playing next track in right deck (free):', nextTrack.title)
                memoizedOnLoad('right', nextTrack)
                // Avvia automaticamente la riproduzione
                setTimeout(() => {
                  if (audioState.rightDeck.track?.id === nextTrack.id) {
                    console.log('▶️ Auto-starting right deck')
                    playRightTrack(nextTrack)
                  }
                }, 100)
              } else {
                // Entrambi i deck sono occupati, trova quello che ha meno tempo rimanente
                const leftTimeLeft = audioState.leftDeck.track ? 
                  (audioState.leftDeck.track.duration - audioState.leftDeck.currentTime) : 0
                const rightTimeLeft = audioState.rightDeck.track ? 
                  (audioState.rightDeck.track.duration - audioState.rightDeck.currentTime) : 0
                
                if (leftTimeLeft < rightTimeLeft) {
                  console.log('🔄 Auto-loading next track in left deck (less time left):', nextTrack.title)
                  memoizedOnLoad('left', nextTrack)
                  // Avvia automaticamente la riproduzione
                  setTimeout(() => {
                    if (audioState.leftDeck.track?.id === nextTrack.id) {
                      console.log('▶️ Auto-starting left deck')
                      playLeftTrack(nextTrack)
                    }
                  }, 100)
                } else {
                  console.log('🔄 Auto-loading next track in right deck (less time left):', nextTrack.title)
                  memoizedOnLoad('right', nextTrack)
                  // Avvia automaticamente la riproduzione
                  setTimeout(() => {
                    if (audioState.rightDeck.track?.id === nextTrack.id) {
                      console.log('▶️ Auto-starting right deck')
                      playRightTrack(nextTrack)
                    }
                  }, 100)
                }
              }
            }
          }
        }
      }
    }
    
    window.addEventListener('djconsole:request-next-track', onRequestNext as EventListener)
    return () => window.removeEventListener('djconsole:request-next-track', onRequestNext as EventListener)
  }, [activePlaylistId, playlistState.library.playlists, leftTrack, rightTrack, audioState.leftDeck, audioState.rightDeck, memoizedOnLoad])

  // Select first playlist by default (no Library tab here)
  useEffect(() => {
    if (activePlaylistId === null && playlistState.library.playlists.length > 0) {
      setActivePlaylistId(playlistState.library.playlists[0].id)
    }
  }, [activePlaylistId, playlistState.library.playlists])

  // Load PTT settings (simplified for now)
  useEffect(() => {
    (async () => {
      try {
        await localDatabase.waitForInitialization()
        const s = await localDatabase.getSettings()
        // init auto-advance from DB
        setAutoAdvance(!!s.interface.autoAdvance)
      } catch {}
    })()
  }, [])

  // Persist auto-advance to DB when toggled
  useEffect(() => {
    (async () => {
      try {
        await localDatabase.waitForInitialization()
        const s = await localDatabase.getSettings()
        await localDatabase.updateSettings({ interface: { ...s.interface, autoAdvance: autoAdvance } })
      } catch {}
    })()
  }, [autoAdvance])

  // Push-to-talk handlers (keyboard) - restored functionality
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.code === 'Space' ? 'Space' : e.key
      if (key !== 'KeyM' || pttActiveRef.current) return
      pttActiveRef.current = true
      console.log('🎤 PTT started (keyboard)')
      
      // Attiva microfono se non è già attivo
      if (!audioState.microphone?.isEnabled) {
        console.log('🎤 Activating microphone for PTT')
        toggleMicrophone() // Attiva automaticamente il microfono per il PTT
      }
      
      // Salva volume originale e applica ducking
      if (originalVolumeRef.current === null) {
        // Calcola volume medio dei deck attivi
        let totalVolume = 0
        let activeDecks = 0
        if (audioState.leftDeck.isPlaying) {
          totalVolume += audioState.leftDeck.localVolume
          activeDecks++
        }
        if (audioState.rightDeck.isPlaying) {
          totalVolume += audioState.rightDeck.localVolume
          activeDecks++
        }
        originalVolumeRef.current = activeDecks > 0 ? totalVolume / activeDecks : 1
      }
      
      // Applica ducking (abbassa volume canzoni)
      const duckedVolume = Math.max(0, originalVolumeRef.current * 0.3) // Abbassa al 30%
      if (audioState.leftDeck.isPlaying) {
        setLeftLocalVolume(duckedVolume)
      }
      if (audioState.rightDeck.isPlaying) {
        setRightLocalVolume(duckedVolume)
      }
      
      // Attiva ducking per lo streaming
      setStreamDucking(true)
    }
    
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.code === 'Space' ? 'Space' : e.key
      if (key !== 'KeyM') return
      pttActiveRef.current = false
      console.log('🎤 PTT stopped (keyboard)')
      
      // Ripristina volume originale
      if (originalVolumeRef.current !== null) {
        if (audioState.leftDeck.isPlaying) {
          setLeftLocalVolume(originalVolumeRef.current)
        }
        if (audioState.rightDeck.isPlaying) {
          setRightLocalVolume(originalVolumeRef.current)
        }
        originalVolumeRef.current = null
      }
      
      // Disattiva ducking per lo streaming
      setStreamDucking(false)
    }
    
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [audioState.leftDeck, audioState.rightDeck, setLeftLocalVolume, setRightLocalVolume, setStreamDucking, toggleMicrophone])

  // Gestisce il mount del componente - SOLO UNA VOLTA
  const hasMounted = useRef(false)
  useEffect(() => {
    if (!hasStabilized.current) {
      console.log('🔄 DJConsole not yet permanently stabilized, skipping mount logic')
      return
    }
    
    if (hasMounted.current) {
      console.log('🔄 DJConsole already mounted, preventing re-mount')
      return
    }
    
    console.log('🔄 DJConsole mounted, current audio state:', audioState)
    
    // Dispatch dell'evento solo se non è già stato fatto
    if (!hasMounted.current) {
      hasMounted.current = true
      const event = new CustomEvent('djconsole:console-mounted')
      window.dispatchEvent(event)
    } else {
      // Se è già stato montato, NON fare nulla - i controlli globali gestiscono tutto
      console.log('🔄 DJConsole re-mounted - global controls handle everything')
    }
  }, [audioState])

  // Gestisce l'unmount del componente - NON FARE NULLA
  useEffect(() => {
    return () => {
      console.log('🔄 [DJConsole] Component re-rendered (no unmount)')
      // NON dispatchare eventi di unmount - i controlli globali rimangono attivi
      // NON resettare hasMounted - mantieni lo stato
      // NON resettare isStable - mantieni la stabilità
      // NON resettare hasStabilized - mantieni la stabilità PERMANENTE
    }
  }, [])

  // NUOVO: Listener per il ripristino dei controlli audio
  useEffect(() => {
    const handleAudioControlsRestored = () => {
      console.log('🔄 Audio controls restored event received - ensuring UI controls work')
      
      // Forza il refresh dello stato per garantire che i controlli UI funzionino
      if (leftTrack) {
        console.log('🔄 Refreshing left deck state after controls restoration')
        // Forza un re-render per sincronizzare i controlli UI
        setLeftTrack({ ...leftTrack })
      }
      
      if (rightTrack) {
        console.log('🔄 Refreshing right deck state after controls restoration')
        // Forza un re-render per sincronizzare i controlli UI
        setRightTrack({ ...rightTrack })
      }
      
      // Forza anche il refresh dello stato attivo
      // RIMOSSO: setLeftDeckActive(audioState.leftDeck.isActive)
      // RIMOSSO: setRightDeckActive(audioState.rightDeck.isActive)
    }

    // NUOVO: Listener per il ripristino del database
    const handleDatabaseRestored = () => {
      console.log('🔄 Database restored event received - refreshing console state')
      
      // Forza il refresh dello stato della console
      if (leftTrack) {
        setLeftTrack({ ...leftTrack })
      }
      if (rightTrack) {
        setRightTrack({ ...rightTrack })
      }
      
      // Forza anche il refresh dello stato attivo
      // RIMOSSO: setLeftDeckActive(audioState.leftDeck.isActive)
      // RIMOSSO: setRightDeckActive(audioState.rightDeck.isActive)
    }

    // NUOVO: Listener per la sincronizzazione quando una traccia viene eliminata
    const handleTrackDeleted = (event: CustomEvent) => {
      const { trackId, updatedPlaylists } = event.detail
      console.log('🔄 Track deleted event received - syncing console state', { trackId })
      
      // Se la traccia eliminata è attualmente caricata in uno dei deck, rimuovila
      if (leftTrack && leftTrack.id === trackId) {
        console.log('🔄 Left deck track was deleted - clearing deck')
        setLeftTrack(null)
        // Forza anche la rimozione dal deck audio
        window.dispatchEvent(new CustomEvent('djconsole:force-audio-recreation'))
      }
      
      if (rightTrack && rightTrack.id === trackId) {
        console.log('🔄 Right deck track was deleted - clearing deck')
        setRightTrack(null)
        // Forza anche la rimozione dal deck audio
        window.dispatchEvent(new CustomEvent('djconsole:force-audio-recreation'))
      }
      
      // Aggiorna anche lo stato delle playlist se necessario
      if (updatedPlaylists) {
        console.log('🔄 Updating playlist state after track deletion')
        // Forza un refresh delle playlist
        window.dispatchEvent(new CustomEvent('djconsole:playlists-updated', { 
          detail: { updatedPlaylists } 
        }))
      }
    }

    window.addEventListener('djconsole:audio-controls-restored', handleAudioControlsRestored)
    window.addEventListener('djconsole:db-restored', handleDatabaseRestored)
    window.addEventListener('djconsole:track-deleted', handleTrackDeleted as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:audio-controls-restored', handleAudioControlsRestored)
      window.removeEventListener('djconsole:db-restored', handleDatabaseRestored)
      window.removeEventListener('djconsole:track-deleted', handleTrackDeleted as EventListener)
    }
  }, [leftTrack, rightTrack, audioState.leftDeck.isActive, audioState.rightDeck.isActive])

  // Mouse/touch push-to-talk on mic button - HOLD ONLY
  const startPTT = (e: React.MouseEvent) => {
    pttActiveRef.current = true
    console.log('🎤 PTT activated (hold)')
    
    // Salva lo stato del microfono prima del PTT
    micWasActiveBeforePTTRef.current = audioState.microphone?.isEnabled || false
    console.log('🎤 Microphone was active before PTT:', micWasActiveBeforePTTRef.current)
    
    // Attiva microfono se non è già attivo
    if (!audioState.microphone?.isEnabled) {
      console.log('🎤 Activating microphone for PTT')
      if (typeof toggleMicrophone === 'function') {
        toggleMicrophone()
      } else {
        console.error('🚨 toggleMicrophone is not a function!', typeof toggleMicrophone)
      }
    }
    
    // Applica ducking durante PTT
    applyDucking()
  }
  
  const applyDucking = () => {
    
    // Salva volume originale e applica ducking
    if (originalVolumeRef.current === null) {
      // Calcola volume medio dei deck attivi
      let totalVolume = 0
      let activeDecks = 0
      if (audioState.leftDeck.isPlaying) {
        totalVolume += audioState.leftDeck.localVolume
        activeDecks++
      }
      if (audioState.rightDeck.isPlaying) {
        totalVolume += audioState.rightDeck.localVolume
        activeDecks++
      }
      originalVolumeRef.current = activeDecks > 0 ? totalVolume / activeDecks : 1
    }
    
    // Applica ducking (abbassa volume canzoni)
    const duckedVolume = Math.max(0, originalVolumeRef.current * 0.3) // Abbassa al 30%
    if (audioState.leftDeck.isPlaying) {
      setLeftLocalVolume(duckedVolume)
    }
    if (audioState.rightDeck.isPlaying) {
      setRightLocalVolume(duckedVolume)
    }
    
    // Attiva ducking per lo streaming
    setStreamDucking(true)
  }
  
  const stopPTT = () => {
    if (!pttActiveRef.current) return // Evita chiamate multiple
    
    pttActiveRef.current = false
    console.log('🎤 PTT deactivated (release)')
    
    // Disattiva microfono SOLO se non era attivo prima del PTT
    // Se era già attivo prima del PTT, lo lasciamo attivo
    const shouldDeactivateMic = audioState.microphone?.isEnabled && !micWasActiveBeforePTTRef.current
    console.log('🎤 Should deactivate mic:', shouldDeactivateMic, {
      micCurrentlyEnabled: audioState.microphone?.isEnabled,
      wasActiveBeforePTT: micWasActiveBeforePTTRef.current
    })
    
    if (shouldDeactivateMic) {
      console.log('🎤 Deactivating microphone after PTT')
      if (typeof toggleMicrophone === 'function') {
        toggleMicrophone()
      } else {
        console.error('🚨 toggleMicrophone is not a function!', typeof toggleMicrophone)
      }
    }
    
    // Ripristina volume originale
    if (originalVolumeRef.current !== null) {
      if (audioState.leftDeck.isPlaying) {
        setLeftLocalVolume(originalVolumeRef.current)
      }
      if (audioState.rightDeck.isPlaying) {
        setRightLocalVolume(originalVolumeRef.current)
      }
      originalVolumeRef.current = null
    }
    
    // Disattiva ducking per lo streaming
    setStreamDucking(false)
  }

  // NUOVO: Funzione per rimuovere tracce dalle playlist e sincronizzare
  const removeTrackFromPlaylist = useCallback(async (trackId: string, playlistId: string) => {
    try {
      console.log('🔄 Removing track from playlist:', { trackId, playlistId })
      
      // Rimuovi la traccia dalla playlist nel database
      const playlist = playlistState.library.playlists.find(p => p.id === playlistId)
      if (playlist) {
        const updatedTracks = playlist.tracks.filter(t => t.id !== trackId)
        await localDatabase.updatePlaylist(playlistId, { tracks: updatedTracks.map(t => t.id) })
        
        // Aggiorna anche lo stato locale delle playlist
        const updatedPlaylists = playlistState.library.playlists.map(p => 
          p.id === playlistId ? { ...p, tracks: updatedTracks } : p
        )
        
        // Dispatch evento per aggiornare le playlist
        window.dispatchEvent(new CustomEvent('djconsole:playlist-updated', { 
          detail: { playlistId, updatedTracks, updatedPlaylists } 
        }))
        
        console.log('✅ Track removed from playlist and synchronized')
      }
    } catch (error) {
      console.error('❌ Error removing track from playlist:', error)
    }
  }, [playlistState.library.playlists])

  // NUOVO: Funzione per sincronizzare le playlist quando vengono aggiornate
  useEffect(() => {
    const handlePlaylistUpdated = (event: CustomEvent) => {
      const { playlistId, updatedTracks, updatedPlaylists } = event.detail
      console.log('🔄 Playlist updated event received:', { playlistId, trackCount: updatedTracks.length })
      
      // Forza il refresh dello stato delle playlist
      if (updatedPlaylists) {
        // Dispatch evento per aggiornare il context delle playlist
        window.dispatchEvent(new CustomEvent('djconsole:force-playlist-refresh', { 
          detail: { updatedPlaylists } 
        }))
      }
    }

    const handlePlaylistsUpdated = (event: CustomEvent) => {
      const { updatedPlaylists } = event.detail
      console.log('🔄 Playlists updated event received:', { count: updatedPlaylists.length })
      
      // Forza il refresh globale delle playlist
      window.dispatchEvent(new CustomEvent('djconsole:force-playlist-refresh', { 
        detail: { updatedPlaylists } 
      }))
    }

    window.addEventListener('djconsole:playlist-updated', handlePlaylistUpdated as EventListener)
    window.addEventListener('djconsole:playlists-updated', handlePlaylistsUpdated as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:playlist-updated', handlePlaylistUpdated as EventListener)
      window.removeEventListener('djconsole:playlists-updated', handlePlaylistsUpdated as EventListener)
    }
  }, [])

  // NUOVO: Sincronizzazione completa con le playlist della libreria
  useEffect(() => {
    // Listener per aggiornamenti playlist dalla libreria
    const handleLibraryPlaylistUpdated = (event: CustomEvent) => {
      const { playlistId, updatedTracks, updatedPlaylists } = event.detail
      console.log('🔄 Library playlist updated - syncing console:', { playlistId, trackCount: updatedTracks.length })
      
      // Aggiorna lo stato delle playlist nella console
      if (updatedPlaylists) {
        // Forza il refresh delle playlist
        window.dispatchEvent(new CustomEvent('djconsole:force-playlist-refresh', { 
          detail: { updatedPlaylists } 
        }))
      }
    }

    // Listener per richieste di sincronizzazione dalla libreria
    const handleLibraryPlaylistsSync = (event: CustomEvent) => {
      const { playlists } = event.detail
      console.log('🔄 Library playlists sync request - updating console state:', { count: playlists.length })
      
      // Aggiorna lo stato delle playlist nella console
      window.dispatchEvent(new CustomEvent('djconsole:force-playlist-refresh', { 
        detail: { updatedPlaylists: playlists } 
      }))
    }

    // Listener per cambiamenti nelle playlist della libreria
    const handleLibraryPlaylistsChanged = (event: CustomEvent) => {
      const { playlists } = event.detail
      console.log('🔄 Library playlists changed - syncing console:', { count: playlists.length })
      
      // Aggiorna lo stato delle playlist nella console
      window.dispatchEvent(new CustomEvent('djconsole:force-playlist-refresh', { 
        detail: { updatedPlaylists: playlists } 
      }))
    }

    // Richiedi sincronizzazione iniziale con la libreria
    const requestInitialSync = () => {
      console.log('🔄 Requesting initial sync with library playlists')
      window.dispatchEvent(new CustomEvent('djconsole:request-playlists-sync'))
    }

    // Richiedi sincronizzazione dopo un breve delay
    setTimeout(requestInitialSync, 1000)

    window.addEventListener('djconsole:library-playlist-updated', handleLibraryPlaylistUpdated as EventListener)
    window.addEventListener('djconsole:library-playlists-sync', handleLibraryPlaylistsSync as EventListener)
    window.addEventListener('djconsole:library-playlists-changed', handleLibraryPlaylistsChanged as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:library-playlist-updated', handleLibraryPlaylistUpdated as EventListener)
      window.removeEventListener('djconsole:library-playlists-sync', handleLibraryPlaylistsSync as EventListener)
      window.removeEventListener('djconsole:library-playlists-changed', handleLibraryPlaylistsChanged as EventListener)
    }
  }, [])

  // NUOVO: Funzione per forzare la sincronizzazione con la libreria
  const forceLibrarySync = useCallback(() => {
    console.log('🔄 Forcing library sync from console')
    window.dispatchEvent(new CustomEvent('djconsole:request-playlists-sync'))
  }, [])

  // RIMOSSA: Funzione locale non più necessaria - ora usa AudioContext definitivo

  // SOLUZIONE SEMPLICE: Sincronizzazione base con libreria
  useEffect(() => {
    const syncWithLibrary = () => {
      console.log('🔄 Syncing with library playlists')
      // Richiedi sincronizzazione semplice
      window.dispatchEvent(new CustomEvent('djconsole:simple-sync-request'))
    }

    // Sincronizza ogni 30 secondi (ridotto per evitare loop)
    const syncInterval = setInterval(syncWithLibrary, 30000)
    
    // Sincronizza anche all'avvio
    setTimeout(syncWithLibrary, 2000)
    
    return () => clearInterval(syncInterval)
  }, [])

  return (
    <div className="min-h-screen bg-dj-dark text-white overflow-y-auto dj-console" data-djconsole="true">
      {/* Header semplificato, nessuna icona di navigazione */}
      <header className="bg-dj-primary border-b border-dj-accent/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-dj font-bold text-white">DJ Console</h1>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-dj-success rounded-full animate-pulse"></div>
              <span className="text-sm text-dj-light/60">Live Ready</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Pulsante Toggle Microfono */}
            <button
              onClick={() => {
                console.log('🎤 Mic toggle clicked')
                if (typeof toggleMicrophone === 'function') {
                  toggleMicrophone()
                } else {
                  console.error('🚨 toggleMicrophone is not a function!', typeof toggleMicrophone)
                }
              }}
              className={`p-2 rounded-lg transition-all duration-200 ${
                audioState.microphone?.isEnabled
                  ? 'bg-dj-success text-white'
                  : 'bg-dj-secondary text-dj-light hover:bg-dj-accent'
              }`}
              title="Toggle Microfono ON/OFF"
            >
              {audioState.microphone?.isEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            
            {/* Pulsante Push-to-Talk */}
            <button
              onMouseDown={startPTT}
              onMouseUp={stopPTT}
              onMouseLeave={stopPTT}
              onTouchStart={(e) => { e.preventDefault(); startPTT(e as any) }}
              onTouchEnd={(e) => { e.preventDefault(); stopPTT() }}
              className={`relative p-2 rounded-lg transition-all duration-200 ${
                pttActiveRef.current
                  ? 'bg-dj-error text-white'
                  : 'bg-dj-secondary text-dj-light hover:bg-dj-accent'
              }`}
              title="Push-to-Talk (Hold)"
            >
              <Mic className="w-5 h-5" />
            </button>
            
            {/* Pulsante di test per i controlli audio */}
            <button
              onClick={() => {
                console.log('🔄 Manual audio controls restoration requested')
                window.dispatchEvent(new CustomEvent('djconsole:force-audio-recreation'))
              }}
              className="p-2 bg-dj-accent/20 hover:bg-dj-accent/30 rounded transition-all"
              title="Ripristina Controlli Audio"
            >
              🔄
            </button>

            {/* NUOVO: Pulsante per forzare la sincronizzazione con la libreria */}
            <button
              onClick={forceLibrarySync}
              className="p-2 bg-green-600/20 hover:bg-green-600/30 rounded transition-all"
              title="Sincronizza con Libreria"
            >
              📚
            </button>
            <span
              className={`ml-2 px-2 py-1 rounded border text-[11px] font-semibold transition-opacity ${
                audioState.microphone?.isEnabled || pttActiveRef.current
                  ? 'bg-dj-error/15 text-dj-error border-dj-error/40 opacity-100 visible'
                  : 'opacity-0 invisible'
              }`}
            >
              MIC ON AIR
            </span>
            <label className="flex items-center space-x-2 text-sm text-dj-light/80">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="rounded bg-dj-primary border-dj-accent/30"
              />
              <span>Auto-advance</span>
            </label>
          </div>
        </div>
      </header>

      {/* Main Area ridisegnata: due deck compatti sopra, crossfader, playlist grande in basso */}
      <div className="p-4">
        {/* RIGA DECKS */}
        <div className="grid grid-cols-12 gap-3 mb-3">
          <div className="col-span-12 md:col-span-6">
            <AudioDeck
              side="left"
              isActive={audioState.leftDeck.isPlaying}
              onActivate={() => console.log('Left deck activated')}
              track={leftTrack}
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <AudioDeck
              side="right"
              isActive={audioState.rightDeck.isPlaying}
              onActivate={() => console.log('Right deck activated')}
              track={rightTrack}
            />
          </div>
        </div>

        {/* RIGA CROSSFADER */}
        <div className="bg-dj-primary border border-dj-accent/30 rounded-xl p-3 mb-3">
          <Crossfader 
            leftVolume={audioState.leftDeck.localVolume}
            rightVolume={audioState.rightDeck.localVolume}
            onLeftVolumeChange={setLeftLocalVolume}
            onRightVolumeChange={setRightLocalVolume}
            crossfadeValue={audioState.crossfader}
            onCrossfadeChange={setCrossfader}
          />
        </div>

        {/* PLAYLIST GRANDE CON TABS + LIVE BTN */}
        <div className="bg-dj-secondary rounded-xl border border-dj-accent/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-dj-light/60">Playlist</div>
            <a href="#live" className="px-3 py-2 bg-dj-highlight hover:bg-dj-accent text-white rounded-lg text-sm transition-colors">Go Live</a>
          </div>
          <div className="flex items-center space-x-2 mb-4 overflow-x-auto">
            {playlistState.library.playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setActivePlaylistId(pl.id)}
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  activePlaylistId === pl.id ? 'bg-dj-accent text-white' : 'bg-dj-primary text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
                }`}
              >
                {pl.name}
              </button>
            ))}
          </div>
          <div className="max-h-[40vh] md:max-h-[52vh] overflow-y-auto divide-y divide-dj-accent/10">
            {activePlaylistId === null && (
              <div className="py-6 text-center text-dj-light/60">
                Seleziona una playlist
              </div>
            )}
            {(playlistState.library.playlists.find(pl => pl.id === activePlaylistId)?.tracks || []).map((t, idx, arr) => {
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(idx))
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const fromIndexStr = e.dataTransfer.getData('text/plain')
                    const fromIndex = Number(fromIndexStr)
                    if (Number.isNaN(fromIndex) || fromIndex === idx || activePlaylistId === null) return
                    const newOrder = [...arr]
                    const [moved] = newOrder.splice(fromIndex, 1)
                    newOrder.splice(idx, 0, moved)
                    reorderPlaylist(activePlaylistId, newOrder.map(tr => tr.id))
                  }}
                  onDoubleClick={() => {
                    // Doppio click: carica automaticamente nel deck libero
                    if (!audioState.leftDeck.track || !audioState.leftDeck.isPlaying) {
                      memoizedOnLoad('left', t) // Deck A libero
                    } else if (!audioState.rightDeck.track || !audioState.rightDeck.isPlaying) {
                      memoizedOnLoad('right', t) // Deck B libero
                    } else {
                      memoizedOnLoad('left', t) // Default a deck A se entrambi occupati
                    }
                  }}
                  className="flex items-center justify-between py-2 px-2 hover:bg-dj-accent/10 cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-dj-highlight rounded-full" />
                    <div className="text-white text-sm">{t.title}</div>
                    <div className="text-xs text-dj-light/60">{t.artist}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); memoizedOnLoad('left', t) }}
                      className="px-2 py-1 bg-dj-primary hover:bg-dj-accent/30 rounded text-xs text-white"
                    >
                      {activeDeck === 'left' && audioState.leftDeck.isPlaying ? 'Pause A' : 'Load A'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); memoizedOnLoad('right', t) }}
                      className="px-2 py-1 bg-dj-primary hover:bg-dj-accent/30 rounded text-xs text-white"
                    >
                      {activeDeck === 'right' && audioState.rightDeck.isPlaying ? 'Pause B' : 'Load B'}
                    </button>
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        // Rimuovi dalla playlist
                        if (activePlaylistId) {
                          removeTrackFromPlaylist(t.id, activePlaylistId)
                        }
                      }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
                      title="Rimuovi dalla playlist"
                    >
                      ×
                    </button>
                    <div className="text-xs text-dj-light/60">{Math.floor(t.duration/60)}:{String(Math.floor(t.duration%60)).padStart(2,'0')}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-right text-xs text-dj-light/70">
            Totale: {
              (() => {
                const pl = playlistState.library.playlists.find(pl => pl.id === activePlaylistId)
                const total = (pl?.tracks || []).reduce((s, tr) => s + tr.duration, 0)
                const m = Math.floor(total/60)
                const s = Math.floor(total%60)
                return `${m}:${String(s).padStart(2,'0')}`
              })()
            }
          </div>
        </div>
        {/* LIVE SECTION */}
        <div id="live" className="mt-4">
          <StreamingControl />
        </div>
      </div>

      {/* Nessun pannello inferiore: layout semplificato come richiesto */}
    </div>
  )
})

DJConsole.displayName = 'DJConsole'

export default DJConsole
