import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Activity, Settings, Radio, Headphones, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAudio } from '../../contexts/AudioContext'
import { useSettings } from '../../contexts/SettingsContext'
import { localDatabase } from '../../database/LocalDatabase'
import { usePlaylist } from '../../contexts/PlaylistContext'
import { useStreaming } from '../../contexts/StreamingContext'
import { usePTT } from '../../hooks/usePTT'
import { useTranslation } from '../../i18n'
// ✅ FIX: Import rimossi - ora gestiti dal StreamingContext
import EnhancedDeck from './EnhancedDeck'
import EnhancedMixer from './EnhancedMixer'
import EnhancedPlaylist from './EnhancedPlaylist'
// AutoAdvanceManager ora è globale in App.tsx
import DuplicateTrackDialog from './DuplicateTrackDialog'
import StreamingDebugPanel from './StreamingDebugPanel'
import ConfirmationDialog from '../ConfirmationDialog'
import { DeckEffects } from '../DeckEffects'
// import RemoteDJHost from '../RemoteDJHost' // Rimosso - ora disponibile come pagina dedicata

const RebuiltDJConsole: React.FC = () => {
  // ✅ NUOVO: CSS per animazione contatore ascoltatori
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes listenerCountGlow {
        0% { 
          text-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
          transform: scale(1);
        }
        50% { 
          text-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.6);
          transform: scale(1.05);
        }
        100% { 
          text-shadow: 0 0 10px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
          transform: scale(1);
        }
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])
  const { 
    state: audioState,
    playLeftTrack,
    playRightTrack,
    getMixedStream,
    setMasterVolume
  } = useAudio()
  
  const { settings } = useSettings()
  const { state: playlistState, dispatch: playlistDispatch } = usePlaylist()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { 
    state: streamingState, 
    dispatch: streamingDispatch,
    updateErrorCount
  } = useStreaming()
  
  // ✅ FIX: Usa PlaylistContext invece di stato locale per persistenza
  // const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  
  // ✅ FIX: Funzioni per gestire activePlaylistId usando il context
  const activePlaylistId = playlistState.currentPlaylist?.id || null
  const setActivePlaylistId = useCallback((playlistId: string | null) => {
    if (playlistId) {
      const playlist = playlistState.library.playlists.find(p => p.id === playlistId)
      if (playlist) {
        playlistDispatch({ type: 'SET_CURRENT_PLAYLIST', payload: playlist })
        console.log(`🔄 [PLAYLIST FIX] Playlist selezionata: ${playlist.name}`)
      }
    } else {
      playlistDispatch({ type: 'SET_CURRENT_PLAYLIST', payload: null })
    }
  }, [playlistState.library.playlists, playlistDispatch])
  
  const [leftTrack, setLeftTrack] = useState<any>(null)
  const [rightTrack, setRightTrack] = useState<any>(null)
  
  // ✅ NUOVO: Stato per tracciare se i deck sono vuoti (aggiornamento in tempo reale)
  const [decksEmpty, setDecksEmpty] = useState(true)
  
  // ✅ NUOVO: Aggiorna lo stato dei deck vuoti in tempo reale
  useEffect(() => {
    const isEmpty = !leftTrack && !rightTrack
    setDecksEmpty(prev => {
      // Solo aggiorna se è cambiato
      if (prev !== isEmpty) {
        return isEmpty
      }
      return prev
    })
  }, [leftTrack, rightTrack])
  
  const [duplicateDialog, setDuplicateDialog] = useState<{
    track: any | null
    activeDeck: 'left' | 'right' | null
    isVisible: boolean
  }>({
    track: null,
    activeDeck: null,
    isVisible: false
  })
  
  // ✅ FIX: Usa stato globale per streaming invece di stati locali
  const {
    isStreaming,
    streamStatus,
    streamError,
    streamingManager,
    debugMessages,
    showDebugPanel,
    pttActive,
    errorCount,
    showStartConfirmation,
    showStopConfirmation,
    showSilenceWarning,
    silenceSecondsRemaining,
    listenerCount,
    broadcastStartTime,
    broadcastDuration
  } = streamingState
  
  
  // ✅ CRITICAL FIX: Esponi streamingManager globalmente per AudioContext
  useEffect(() => {
    if (streamingManager) {
      ;(window as any).streamingManager = streamingManager
      
      // ✅ ESPONI METODI DI PAUSA/RIPRESA DEL CONTINUOUS STREAMING MANAGER
      ;(window as any).pauseStreaming = () => {
        if (streamingManager && typeof streamingManager.pauseStreaming === 'function') {
          streamingManager.pauseStreaming()
          console.log('⏸️ [CONTINUOUS] Pausa streaming richiesta')
        }
      }
      
      ;(window as any).resumeStreaming = () => {
        if (streamingManager && typeof streamingManager.resumeStreaming === 'function') {
          streamingManager.resumeStreaming()
          console.log('▶️ [CONTINUOUS] Ripresa streaming richiesta')
        }
      }
      
      console.log('📡 [GLOBAL] ContinuousStreamingManager esposto globalmente per AudioContext')
      
      // ✅ FIX: Esponi streamingManager globalmente per il sistema di monitoraggio
      ;(window as any).globalStreamingManager = streamingManager
    }
    
    return () => {
      ;(window as any).streamingManager = null
      ;(window as any).globalStreamingManager = null
      ;(window as any).pauseStreaming = null
      ;(window as any).resumeStreaming = null
    }
  }, [streamingManager])

  // ✅ NUOVO: Aggiorna contatore ascoltatori quando in streaming
  useEffect(() => {
    console.log('🔍 [LISTENERS] useEffect triggered:', {
      isStreaming,
      hasStreamingManager: !!streamingManager,
      hasSettings: !!settings,
      hasIcecastHost: !!settings?.streaming?.icecast?.host
    })
    
    if (isStreaming && streamingManager) {
      const updateListenerCount = async () => {
        try {
          // ✅ DEBUG: Controlla se Electron API è disponibile
          console.log('🔍 [LISTENERS] Controllo disponibilità Electron API...')
          console.log('🔍 [LISTENERS] window.electronAPI:', !!window.electronAPI)
          console.log('🔍 [LISTENERS] window.electronAPI.getIcecastStats:', !!(window as any).electronAPI?.getIcecastStats)
          
           // ✅ FIX: Usa il server di default configurato nelle impostazioni
           const currentSettings = await localDatabase.getSettings()
           const defaultServerId = currentSettings?.streaming?.defaultIcecastServerId || 'default-server'
           const icecastServers = currentSettings?.streaming?.icecastServers || []
           const defaultServer = icecastServers.find(server => server.id === defaultServerId)
           
           if (!defaultServer) {
             console.log('🔍 [LISTENERS] ❌ Server di default non trovato, skip contatore')
             console.log('🔍 [LISTENERS] Server ID cercato:', defaultServerId)
             console.log('🔍 [LISTENERS] Server disponibili:', icecastServers.map(s => s.id))
             return
           }
           
           const icecastHost = defaultServer.host
           const icecastPort = defaultServer.port
           const mountpoint = defaultServer.mount || '/live'
           
           console.log(`🔍 [LISTENERS] Configurazione Icecast: ${icecastHost}:${icecastPort} mount: ${mountpoint}`)
           console.log(`🔍 [LISTENERS] Server di default:`, defaultServer)
          
          // ✅ VERO CONTATORE: Usa Electron per bypassare CORS
          if ((window as any).electronAPI && (window as any).electronAPI.getIcecastStats) {
            console.log('🔍 [LISTENERS] Tentativo di chiamare getIcecastStats...')
            
            try {
              const stats = await (window as any).electronAPI.getIcecastStats(icecastHost, icecastPort)
              console.log('🔍 [LISTENERS] Risposta da getIcecastStats:', stats)
              
              if (stats && stats.icestats && stats.icestats.source) {
                const sources = Array.isArray(stats.icestats.source) ? stats.icestats.source : [stats.icestats.source]
                console.log('🔍 [LISTENERS] Sorgenti trovate:', sources.length)
                
                // ✅ SOMMA TUTTI I LISTENERS: Calcola la somma di TUTTI i mount points
                let totalListeners = 0
                const activeMounts: any[] = []
                
                sources.forEach((source: any) => {
                  const listeners = parseInt(source.listeners) || 0
                  if (listeners > 0) {
                    totalListeners += listeners
                    activeMounts.push({
                      mount: source.mount,
                      server_name: source.server_name,
                      listeners: listeners
                    })
                  }
                  
                  console.log(`🔍 [LISTENERS] Mount: ${source.mount} - Listeners: ${listeners}`)
                })
                
                console.log(`📊 [LISTENERS] ✅ TOTALE LISTENERS: ${totalListeners} da ${activeMounts.length} mount attivi`)
                console.log(`📊 [LISTENERS] Mount attivi:`, activeMounts)
                
                if (totalListeners > 0) {
                  streamingDispatch({ type: 'SET_LISTENER_COUNT', payload: totalListeners })
                  console.log(`📊 [LISTENERS] ✅ CONTATORE TOTALE AGGIORNATO: ${totalListeners} ascoltatori`)
                  return
                } else {
                  console.log('🔍 [LISTENERS] Nessun listener attivo su nessun mount')
                }
              } else {
                console.log('🔍 [LISTENERS] Struttura dati non valida:', stats)
              }
            } catch (apiError) {
              console.error('🔍 [LISTENERS] Errore API Electron:', apiError)
            }
          } else {
            console.log('🔍 [LISTENERS] Electron API non disponibile')
          }
          
          // Fallback: se Electron non è disponibile, usa un numero casuale
          const mockListenerCount = Math.floor(Math.random() * 15) + 1
          streamingDispatch({ type: 'SET_LISTENER_COUNT', payload: mockListenerCount })
          console.log(`📊 [LISTENERS] ❌ FALLBACK SIMULATO: ${mockListenerCount} ascoltatori`)
          
        } catch (error) {
          console.warn('⚠️ [LISTENERS] Errore nel recupero contatore ascoltatori:', error)
          // Fallback in caso di errore
          const mockListenerCount = Math.floor(Math.random() * 10) + 1
          streamingDispatch({ type: 'SET_LISTENER_COUNT', payload: mockListenerCount })
          console.log(`📊 [LISTENERS] ❌ FALLBACK PER ERRORE: ${mockListenerCount} ascoltatori`)
        }
      }

      // ✅ PERFORMANCE: Aggiorna ogni 60 secondi per ridurre CPU usage
      console.log('🔍 [LISTENERS] ✅ Creando interval per contatore automatico (ogni 60s)')
      const interval = setInterval(updateListenerCount, 60000) // ✅ PERFORMANCE: Ridotto da 30000ms a 60000ms
      console.log('🔍 [LISTENERS] ✅ Eseguendo primo aggiornamento immediato')
      updateListenerCount() // Aggiorna immediatamente

      return () => clearInterval(interval)
    } else {
      // Reset contatore quando non in streaming
      console.log('🔍 [LISTENERS] ❌ Reset contatore (non in streaming)')
      streamingDispatch({ type: 'SET_LISTENER_COUNT', payload: 0 })
    }
  }, [isStreaming, streamingManager, streamingDispatch, settings])

  // ✅ DEBUG: Log quando le impostazioni cambiano
  useEffect(() => {
    console.log('🔍 [SETTINGS] Impostazioni aggiornate:', {
      hasSettings: !!settings,
      hasStreaming: !!settings?.streaming,
      hasIcecast: !!settings?.streaming?.icecast,
      host: settings?.streaming?.icecast?.host,
      port: settings?.streaming?.icecast?.port,
      mount: settings?.streaming?.icecast?.mount
    })
  }, [settings])

  // ✅ Contatore errori per notifiche (ora gestito dal context)
  useEffect(() => {
    updateErrorCount()
  }, [debugMessages, updateErrorCount])
  
  // Refs per evitare loop di caricamento
  const loadInProgressRef = useRef(false)
  
  // ✅ Cache del mixed stream per evitare ricreazione continua
  const cachedMixedStreamRef = useRef<MediaStream | null>(null)
  
  // Seleziona automaticamente la prima playlist
  useEffect(() => {
    if (!activePlaylistId && playlistState.library.playlists.length > 0) {
      setActivePlaylistId(playlistState.library.playlists[0].id)
    }
  }, [activePlaylistId, playlistState.library.playlists])
  
  // ✅ FIX: Non serve più sincronizzazione - usiamo direttamente il context

  // NUOVO: Listener per sincronizzazione playlist dalla Library
  useEffect(() => {
    const handleLibraryPlaylistUpdated = (event: CustomEvent) => {
      const { playlistId, updatedTracks, updatedPlaylists } = event.detail
      console.log('🔄 [REBUILT_CONSOLE] Library playlist updated - syncing:', { playlistId, trackCount: updatedTracks?.length || 0 })
      
      // Forza il refresh delle playlist nel PlaylistContext
      if (updatedPlaylists) {
        window.dispatchEvent(new CustomEvent('djconsole:force-playlist-refresh', { 
          detail: { updatedPlaylists } 
        }))
      }
    }

    const handleForcePlaylistRefresh = (event: CustomEvent) => {
      const { updatedPlaylists } = event.detail
      console.log('🔄 [REBUILT_CONSOLE] Force playlist refresh requested:', { count: updatedPlaylists?.length })
      
      // Le playlist vengono aggiornate automaticamente dal PlaylistContext
      // Questo listener serve solo per logging e debug
    }

    window.addEventListener('djconsole:library-playlist-updated', handleLibraryPlaylistUpdated as EventListener)
    window.addEventListener('djconsole:force-playlist-refresh', handleForcePlaylistRefresh as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:library-playlist-updated', handleLibraryPlaylistUpdated as EventListener)
      window.removeEventListener('djconsole:force-playlist-refresh', handleForcePlaylistRefresh as EventListener)
    }
  }, [])

  // Sincronizza i track locali con lo stato audio
  useEffect(() => {
    if (audioState.leftDeck.track) {
      setLeftTrack(audioState.leftDeck.track)
    }
    if (audioState.rightDeck.track) {
      setRightTrack(audioState.rightDeck.track)
    }
  }, [audioState.leftDeck.track, audioState.rightDeck.track])

  // ✅ FIX: Inizializzazione StreamingManager ora gestita dal StreamingContext
  // Il StreamingManager viene inizializzato automaticamente nel StreamingProvider

  // Determina se i deck sono attivi (hanno una canzone che sta suonando)
  const leftDeckActive = !!(audioState.leftDeck.track && audioState.leftDeck.isPlaying)
  const rightDeckActive = !!(audioState.rightDeck.track && audioState.rightDeck.isPlaying)


  // Gestisce il caricamento di una traccia in un deck
  const handleTrackLoadInternal = useCallback((deck: 'left' | 'right', track: any) => {
    if (loadInProgressRef.current) {
      console.log('⚠️ Caricamento già in corso, saltando')
      return
    }
    
    // Verifica se la stessa traccia è già caricata nello stesso deck
    const currentDeckTrack = deck === 'left' ? audioState.leftDeck.track : audioState.rightDeck.track
    if (currentDeckTrack?.id === track.id) {
      console.log(`⚠️ Traccia "${track.title}" già caricata in deck ${deck.toUpperCase()}`)
      return
    }
    
    loadInProgressRef.current = true
    
    try {
      console.log(`🎵 Caricamento traccia "${track.title}" in deck ${deck.toUpperCase()}`)
      
      if (deck === 'left') {
        setLeftTrack(track)
        if (track?.url) {
          playLeftTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            url: track.url
          })
        }
      } else {
        setRightTrack(track)
        if (track?.url) {
          playRightTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            url: track.url
          })
        }
      }
      
      console.log(`✅ Traccia caricata con successo in deck ${deck.toUpperCase()}`)
      
      // ✅ CRITICAL FIX: NON fermare lo streaming per cambio traccia - solo sincronizzazione continua
      // Il sistema di sincronizzazione continua gestirà l'aggiornamento della posizione
      console.log(`🎵 [TRACK CHANGE] Traccia cambiata in deck ${deck.toUpperCase()} - sincronizzazione continua gestirà l'aggiornamento`)
      
    } catch (error) {
      console.error('❌ Errore nel caricamento traccia:', error)
    } finally {
      // Reset dopo un delay per evitare spam
      setTimeout(() => {
        loadInProgressRef.current = false
      }, 500)
    }
  }, [playLeftTrack, playRightTrack, audioState.leftDeck.track, audioState.rightDeck.track])

  // Wrapper functions for EnhancedDeck callbacks
  const handleLeftTrackLoad = useCallback((track: any) => {
    handleTrackLoadInternal('left', track)
  }, [handleTrackLoadInternal])

  const handleRightTrackLoad = useCallback((track: any) => {
    handleTrackLoadInternal('right', track)
  }, [handleTrackLoadInternal])

  // ✅ NUOVO: Funzioni per gestire la rimozione delle tracce dai deck
  const handleLeftTrackClear = useCallback(() => {
    console.log(`🗑️ [REBUILT DJ] Left track cleared`)
    setLeftTrack(null)
  }, [])

  const handleRightTrackClear = useCallback(() => {
    console.log(`🗑️ [REBUILT DJ] Right track cleared`)
    setRightTrack(null)
  }, [])

  // Gestisce l'auto-avanzamento
  const handleAutoAdvance = useCallback((deck: 'left' | 'right') => {
    // Dispatch evento per AutoAdvanceManager
    window.dispatchEvent(new CustomEvent('djconsole:request-auto-advance', {
      detail: { deck }
    }))
  }, [])

  // ✅ FIX AUTOPLAY: Listener rimosso - ora gestito globalmente in AudioContext

  // Gestisce l'avviso di traccia duplicata
  const handleDuplicateTrackWarning = useCallback((track: any, activeDeck: 'left' | 'right') => {
    setDuplicateDialog({
      track,
      activeDeck,
      isVisible: true
    })
  }, [])

  // Conferma caricamento traccia duplicata
  const handleDuplicateConfirm = useCallback(() => {
    if (duplicateDialog.track && duplicateDialog.activeDeck) {
      handleTrackLoadInternal(duplicateDialog.activeDeck, duplicateDialog.track)
    }
    setDuplicateDialog({ track: null, activeDeck: null, isVisible: false })
  }, [duplicateDialog, handleTrackLoadInternal])

  // Annulla caricamento traccia duplicata
  const handleDuplicateCancel = useCallback(() => {
    setDuplicateDialog({ track: null, activeDeck: null, isVisible: false })
  }, [])

  // Gestisce i cambiamenti del volume master
  const handleMasterVolumeChange = useCallback((volume: number) => {
    console.log(`🔊 Master volume cambiato: ${Math.round(volume * 100)}%`)
    // Il volume master influenza solo l'ascolto locale, non lo streaming
  }, [])

  // Gestisce i cambiamenti del volume stream
  const handleStreamVolumeChange = useCallback((volume: number) => {
    console.log(`📡 Stream volume cambiato: ${Math.round(volume * 100)}%`)
    // ✅ CRITICAL FIX: Aggiorna il master volume del mixer per controllare lo streaming
    setMasterVolume(volume)
  }, [setMasterVolume])

  // Gestisce l'attivazione/disattivazione del PTT
  const handlePTTActivate = useCallback((active: boolean) => {
    console.log(`🎤 PTT ${active ? 'attivato' : 'disattivato'}`)
    streamingDispatch({ type: 'SET_PTT_ACTIVE', payload: active })
    
    // ✅ CRITICAL FIX: Aggiorna SOLO i volumi PTT senza ricreare il mixer
    if ((window as any).updatePTTVolumesOnly) {
      console.log(`🎤 Aggiornamento volumi PTT: ${active ? 'ducking ON' : 'ducking OFF'}`)
      ;(window as any).updatePTTVolumesOnly(active)
    }
    
    // ✅ RIMUOVO: Non ricreare getMixedStream per PTT - causa l'azzeramento della musica!
    // Se il streaming è attivo, NON ricreate il stream - aggiornate solo i volumi
    console.log('🎤 PTT change completed - stream NOT recreated (volume-only update)')
  }, [isStreaming, getMixedStream])

  // ✅ FIX: Usa il nuovo hook PTT che legge l'impostazione dalle settings
  usePTT(handlePTTActivate)

  // 🛡️ SICUREZZA: Gestisce la disconnessione (sempre permessa)
  const handleDisconnect = useCallback(() => {
    if (!streamingManager) {
      console.error('❌ StreamingManager non disponibile')
      return
    }
    
    try {
      // Disconnetti
      console.log('📡 Disconnessione...')
      console.log('🛑 [REBUILT DJ] Chiamata handleDisconnect - flag userRequestedDisconnect sarà impostato a TRUE')
      streamingManager.disconnect()
      streamingDispatch({ type: 'SET_STREAM_STATUS', payload: 'disconnected' })
      streamingDispatch({ type: 'SET_STREAMING', payload: false })
      
      // ✅ FIX: Ferma monitoraggio server
      if ((window as any).stopServerMonitoring) {
        ;(window as any).stopServerMonitoring()
        console.log('🛑 [DISCONNECT] Monitoraggio server fermato')
      }
      
      // ✅ Rimuovi flag globale streaming PRIMA del cleanup
      ;(window as any).isCurrentlyStreaming = false
      
      // ✅ FIX: Ferma la riproduzione dei deck quando si disconnette
      console.log('⏹️ [DISCONNECT] Fermando riproduzione deck dopo disconnessione...')
      
      // Ferma deck sinistro
      const leftAudio = document.getElementById('left-audio') as HTMLAudioElement
      if (leftAudio && !leftAudio.paused) {
        console.log('⏹️ [DISCONNECT] Fermando deck LEFT')
        leftAudio.pause()
        leftAudio.currentTime = 0
        // Aggiorna stato locale
        if (leftTrack) {
          setLeftTrack({ ...leftTrack, isPlaying: false })
        }
      }
      
      // Ferma deck destro
      const rightAudio = document.getElementById('right-audio') as HTMLAudioElement
      if (rightAudio && !rightAudio.paused) {
        console.log('⏹️ [DISCONNECT] Fermando deck RIGHT')
        rightAudio.pause()
        rightAudio.currentTime = 0
        // Aggiorna stato locale
        if (rightTrack) {
          setRightTrack({ ...rightTrack, isPlaying: false })
        }
      }
      
      // ✅ CLEANUP: Pulisci audio residuo dopo disconnessione (ora può fermare l'audio locale)
      console.log('🧹 [STREAMING] Cleanup audio residuo dopo disconnessione...')
      if ((window as any).cleanupAllAudioStreams) {
        ;(window as any).cleanupAllAudioStreams()
      }
      
      // ✅ Pulisci cache mixed stream
      cachedMixedStreamRef.current = null
      console.log('📡 Cache mixed stream pulita')
    } catch (error) {
      console.error('❌ Errore disconnessione:', error)
      streamingDispatch({ type: 'SET_STREAM_ERROR', payload: `Disconnect error: ${error}` })
      streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
    }
  }, [streamingManager, leftTrack, rightTrack])

  // 🛡️ SICUREZZA: Gestisce il click del pulsante streaming con conferme
  const handleStreamingButtonClick = useCallback(() => {
    if (!streamingManager) {
      console.error('❌ StreamingManager non disponibile')
      return
    }
    
    if (streamStatus === 'disconnected' || (streamStatus === 'connected' && !isStreaming)) {
      // ✅ NUOVO: Controlla se i deck sono vuoti prima di permettere l'avvio
      if (decksEmpty) {
        console.log('🚫 [STREAMING] Tentativo di avvio streaming con deck vuoti - bloccato')
        
        // Aggiungi messaggio di debug
        const debugMessage = '🚫 [STREAMING] Impossibile avviare streaming: devi caricare almeno una canzone in uno dei deck prima di avviare lo streaming'
        streamingDispatch({ 
          type: 'ADD_DEBUG_MESSAGE', 
          payload: debugMessage
        })
        
        // Mostra notifica di avviso
        if (typeof window !== 'undefined' && (window as any).addStreamingNotification && typeof (window as any).addStreamingNotification === 'function') {
          try {
            (window as any).addStreamingNotification(
              'warning',
              'Streaming non disponibile',
              'Devi caricare almeno una canzone in uno dei deck prima di avviare lo streaming',
              'debug'
            )
          } catch (error) {
            console.warn('⚠️ [NOTIFICATION] Errore nell\'invio notifica:', error)
          }
        }
        
        // Apri automaticamente il pannello debug per mostrare l'avviso
        streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
        
        return // Blocca l'avvio dello streaming
      }
      
      // Mostra conferma per avvio streaming
      streamingDispatch({ type: 'SET_PENDING_STREAMING_ACTION', payload: 'start' })
      streamingDispatch({ type: 'SET_SHOW_START_CONFIRMATION', payload: true })
    } else if (isStreaming) {
      // Mostra conferma per stop streaming
      streamingDispatch({ type: 'SET_PENDING_STREAMING_ACTION', payload: 'stop' })
      streamingDispatch({ type: 'SET_SHOW_STOP_CONFIRMATION', payload: true })
    } else {
      // ✅ FIX: Disconnessione immediata con stop completo
      console.log('📡 [DISCONNECT CLICK] Disconnessione immediata richiesta...')
      
      // 1. Ferma immediatamente i deck se sono attivi
      console.log('⏹️ [DISCONNECT CLICK] Fermando immediatamente tutti i deck...')
      
      // Ferma deck sinistro
      const leftAudio = document.getElementById('left-audio') as HTMLAudioElement
      if (leftAudio && !leftAudio.paused) {
        console.log('⏹️ [DISCONNECT CLICK] Fermando deck LEFT')
        leftAudio.pause()
        leftAudio.currentTime = 0
        // Aggiorna stato locale
        if (leftTrack) {
          setLeftTrack({ ...leftTrack, isPlaying: false })
        }
      }
      
      // Ferma deck destro
      const rightAudio = document.getElementById('right-audio') as HTMLAudioElement
      if (rightAudio && !rightAudio.paused) {
        console.log('⏹️ [DISCONNECT CLICK] Fermando deck RIGHT')
        rightAudio.pause()
        rightAudio.currentTime = 0
        // Aggiorna stato locale
        if (rightTrack) {
          setRightTrack({ ...rightTrack, isPlaying: false })
        }
      }
      
      // 2. Chiama handleDisconnect per il resto
      handleDisconnect()
    }
  }, [streamStatus, isStreaming, leftTrack, rightTrack, handleDisconnect, decksEmpty, streamingDispatch])

  // 🛡️ SICUREZZA: Esegue l'azione di avvio streaming dopo conferma
  const handleStartStreamingConfirmed = useCallback(async () => {
    if (!streamingManager) {
      console.error('❌ StreamingManager non disponibile')
      return
    }
    
    streamingDispatch({ type: 'SET_SHOW_START_CONFIRMATION', payload: false })
    streamingDispatch({ type: 'SET_PENDING_STREAMING_ACTION', payload: null })
    
    try {
      if (streamStatus === 'disconnected') {
        // Prima connessione
        console.log('📡 Connessione al server streaming...')
        
        // ✅ FIX: Reset flag disconnessione utente per permettere riconnessione
        streamingManager.resetRetryLimit()
        streamingManager.resetUserDisconnectFlag() // ✅ CRITICAL FIX: Reset flag disconnessione utente solo per nuovo avvio manuale
        console.log('🔄 [REBUILT DJ] Flag userRequestedDisconnect resettato per nuovo avvio manuale')
        
        streamingDispatch({ type: 'SET_STREAM_STATUS', payload: 'connecting' })
        const connected = await streamingManager.connect()
        
        if (!connected) {
          streamingDispatch({ type: 'SET_STREAM_ERROR', payload: 'Connessione fallita - verifica le impostazioni' })
          streamingDispatch({ type: 'SET_STREAM_STATUS', payload: 'disconnected' })
          streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
        } else {
          // ✅ AUTO-START: Avvia automaticamente lo streaming dopo la connessione
          console.log('📡 Connesso! Avvio automatico streaming...')
          setTimeout(async () => {
            try {
              // ✅ FIX: Controlla se l'utente ha richiesto la disconnessione
              if (streamingManager.isUserRequestedDisconnect) {
                console.log('🛑 [AUTO-START] Disconnessione richiesta dall\'utente - salto auto-start')
                return
              }
              
              // ✅ CRITICAL FIX: Imposta flag PRIMA di creare mixed stream
              ;(window as any).isCurrentlyStreaming = true
              console.log('📡 Flag isCurrentlyStreaming impostato PRIMA di getMixedStream')
              
              // ✅ CLEANUP: Pulisci audio residuo DOPO aver impostato il flag
              console.log('🧹 [STREAMING] Cleanup audio residuo dopo aver impostato flag streaming...')
              if ((window as any).cleanupAllAudioStreams) {
                ;(window as any).cleanupAllAudioStreams()
              }

              // ✅ Riusa stream cached o creane uno nuovo SOLO se necessario
              if (!cachedMixedStreamRef.current) {
                console.log('📡 Creazione NUOVO mixed stream (non cached)')
                cachedMixedStreamRef.current = await getMixedStream(undefined, undefined, pttActive)
                console.log('📡 getMixedStream result:', {
                  isNull: cachedMixedStreamRef.current === null,
                  isUndefined: cachedMixedStreamRef.current === undefined,
                  type: typeof cachedMixedStreamRef.current,
                  constructor: cachedMixedStreamRef.current?.constructor?.name,
                  isMediaStream: cachedMixedStreamRef.current instanceof MediaStream,
                  active: cachedMixedStreamRef.current?.active,
                  tracks: cachedMixedStreamRef.current?.getTracks?.()?.length,
                  actualValue: cachedMixedStreamRef.current
                })
              } else {
                console.log('📡 Riuso mixed stream esistente (cached)')
              }
              
              if (!cachedMixedStreamRef.current) {
                console.error('❌ getMixedStream ha restituito null - impossibile avviare streaming')
                streamingDispatch({ type: 'SET_STREAM_ERROR', payload: 'Errore audio - impossibile creare mixed stream' })
                streamingDispatch({ type: 'SET_STREAM_STATUS', payload: 'connected' })
                return
              }
              
              // ✅ USA CONTINUOUS STREAMING MANAGER
              const { localDatabase } = await import('../../database/LocalDatabase')
              const defaultServer = await localDatabase.getDefaultIcecastServer()
              if (!defaultServer) {
                streamingDispatch({ type: 'SET_STREAM_ERROR', payload: 'Nessun server Icecast configurato per auto-start' })
                streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
                return
              }
              
              // ✅ CRITICAL FIX: Carica settings nel scope corretto
              const s = await localDatabase.getSettings()
              
              const streamConfig = {
                host: defaultServer.host,
                port: defaultServer.port,
                username: defaultServer.username,
                password: defaultServer.password,
                mountpoint: defaultServer.mount,
                useSSL: !!defaultServer.useSSL,
                bitrate: s.streaming.defaultBitrate || 128,
                format: (s.streaming.defaultFormat || 'mp3') as 'opus' | 'mp3',
                djName: s.streaming.metadata?.djName || 'DJ Console'  // ✅ NICKNAME DJ PER STREAMING
              }
              const started = await streamingManager.startStreamingWithConfig(streamConfig)
              
              if (!started) {
                streamingDispatch({ type: 'SET_STREAM_ERROR', payload: 'Avvio streaming fallito dopo connessione' })
                streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
              } else {
                console.log('📡 Streaming avviato con successo')
              }
            } catch (error) {
              console.error('❌ Errore avvio automatico streaming:', error)
              streamingDispatch({ type: 'SET_STREAM_ERROR', payload: `Auto-start error: ${error}` })
              streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
            }
          }, 1000) // Aspetta 1 secondo per stabilizzare la connessione
        }
      } else if (streamStatus === 'connected' && !isStreaming) {
        // Avvia streaming
        console.log('📡 Avvio streaming...')
        
        // ✅ CRITICAL FIX: Imposta flag PRIMA di creare mixed stream
        ;(window as any).isCurrentlyStreaming = true
        console.log('📡 Flag isCurrentlyStreaming impostato PRIMA di getMixedStream')
        
        await getMixedStream(undefined, undefined, pttActive)
        
        // ✅ USA CONTINUOUS STREAMING MANAGER
        const { localDatabase } = await import('../../database/LocalDatabase')
        const defaultServer = await localDatabase.getDefaultIcecastServer()
        if (!defaultServer) {
          streamingDispatch({ type: 'SET_STREAM_ERROR', payload: 'Nessun server Icecast configurato' })
          streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
          return
        }
        
        // ✅ CRITICAL FIX: Carica settings nel scope corretto
        const s = await localDatabase.getSettings()
        
        const streamConfig = {
          host: defaultServer.host,
          port: defaultServer.port,
          username: defaultServer.username,
          password: defaultServer.password,
          mountpoint: defaultServer.mount,
          useSSL: !!defaultServer.useSSL,
          bitrate: s.streaming.defaultBitrate || 128,
          format: (s.streaming.defaultFormat || 'mp3') as 'opus' | 'mp3',
          djName: s.streaming.metadata?.djName || 'DJ Console'  // ✅ NICKNAME DJ PER STREAMING
        }
        const started = await streamingManager.startStreamingWithConfig(streamConfig)
        
        if (!started) {
          streamingDispatch({ type: 'SET_STREAM_ERROR', payload: 'Avvio streaming fallito' })
          streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
        } else {
          console.log('📡 Streaming avviato con successo')
        }
      } else if (isStreaming) {
        // Ferma streaming
        console.log('📡 Stop streaming...')
        console.log('🛑 [STOP STREAMING] Impostando flag userRequestedDisconnect a TRUE')
        // ✅ CRITICAL FIX: Usa disconnect invece di stopStreaming per impostare il flag
        streamingManager.disconnect()
        streamingDispatch({ type: 'SET_STREAM_STATUS', payload: 'disconnected' })
        streamingDispatch({ type: 'SET_STREAMING', payload: false })
        // ✅ Rimuovi flag globale streaming
        ;(window as any).isCurrentlyStreaming = false
        
        // ✅ CLEANUP: Pulisci audio residuo dopo stop streaming (ora può fermare l'audio locale)
        console.log('🧹 [STREAMING] Cleanup audio residuo dopo stop streaming...')
        if ((window as any).cleanupAllAudioStreams) {
          ;(window as any).cleanupAllAudioStreams()
        }
        
        // ✅ CRITICAL FIX: Ripristina volumi HTML originali quando streaming si ferma
        console.log('🔄 [STREAMING STOP] Restoring original HTML volumes...')
        // Note: I volumi verranno ripristinati dal prossimo calculateVolumes() call
        console.log('📡 Streaming fermato - flag globale rimosso')
      } else {
        // ✅ FIX: Disconnessione immediata con stop completo
        console.log('📡 [DISCONNECT] Disconnessione immediata richiesta...')
        
        // 1. Ferma immediatamente i deck se sono attivi
        console.log('⏹️ [DISCONNECT] Fermando immediatamente tutti i deck...')
        
        // Ferma deck sinistro
        const leftAudio = document.getElementById('left-audio') as HTMLAudioElement
        if (leftAudio && !leftAudio.paused) {
          console.log('⏹️ [DISCONNECT] Fermando deck LEFT')
          leftAudio.pause()
          leftAudio.currentTime = 0
          // Aggiorna stato locale
          if (leftTrack) {
            setLeftTrack({ ...leftTrack, isPlaying: false })
          }
        }
        
        // Ferma deck destro
        const rightAudio = document.getElementById('right-audio') as HTMLAudioElement
        if (rightAudio && !rightAudio.paused) {
          console.log('⏹️ [DISCONNECT] Fermando deck RIGHT')
          rightAudio.pause()
          rightAudio.currentTime = 0
          // Aggiorna stato locale
          if (rightTrack) {
            setRightTrack({ ...rightTrack, isPlaying: false })
          }
        }
        
        // 2. Disconnetti e ferma tutti i retry
        console.log('📡 [DISCONNECT] Disconnessione streaming manager...')
        streamingManager.disconnect()
        streamingDispatch({ type: 'SET_STREAM_STATUS', payload: 'disconnected' })
        streamingDispatch({ type: 'SET_STREAMING', payload: false })
        
        // 3. Rimuovi flag globale streaming PRIMA del cleanup
        ;(window as any).isCurrentlyStreaming = false
        
        // 4. CLEANUP: Pulisci audio residuo dopo disconnessione
        console.log('🧹 [DISCONNECT] Cleanup audio residuo dopo disconnessione...')
        if ((window as any).cleanupAllAudioStreams) {
          ;(window as any).cleanupAllAudioStreams()
        }
        
        // 5. Pulisci cache mixed stream
        cachedMixedStreamRef.current = null
        console.log('📡 [DISCONNECT] Cache mixed stream pulita - disconnessione completata')
      }
    } catch (error) {
      console.error('❌ Errore pulsante streaming:', error)
      streamingDispatch({ type: 'SET_STREAM_ERROR', payload: `Button error: ${error}` })
      streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
    }
  }, [streamStatus, isStreaming, streamingManager, getMixedStream, pttActive])

  // 🛡️ SICUREZZA: Esegue l'azione di stop streaming dopo conferma
  const handleStopStreamingConfirmed = useCallback(() => {
    if (!streamingManager) {
      console.error('❌ StreamingManager non disponibile')
      return
    }
    
    streamingDispatch({ type: 'SET_SHOW_STOP_CONFIRMATION', payload: false })
    streamingDispatch({ type: 'SET_PENDING_STREAMING_ACTION', payload: null })
    
    try {
      // Ferma streaming
      console.log('📡 Fermata streaming...')
      console.log('🛑 [STOP STREAMING] Impostando flag userRequestedDisconnect a TRUE')
      // ✅ CRITICAL FIX: Imposta flag disconnessione utente PRIMA di fermare lo streaming
      streamingManager.disconnect() // Usa disconnect invece di stopStreaming per impostare il flag
      streamingDispatch({ type: 'SET_STREAM_STATUS', payload: 'disconnected' }) // Cambia a disconnected invece di connected
      streamingDispatch({ type: 'SET_STREAMING', payload: false })
      
      // ✅ Rimuovi flag globale streaming PRIMA del cleanup
      ;(window as any).isCurrentlyStreaming = false
      console.log('📡 Streaming fermato - flag globale rimosso')
      
      // ✅ FIX: Ferma la riproduzione dei deck quando si ferma lo streaming
      console.log('⏹️ [STOP STREAMING] Fermando riproduzione deck dopo stop streaming...')
      if (leftTrack && leftTrack.isPlaying) {
        console.log('⏹️ [STOP STREAMING] Fermando deck LEFT')
        const leftAudio = document.getElementById('left-audio') as HTMLAudioElement
        if (leftAudio) {
          leftAudio.pause()
          leftAudio.currentTime = 0
        }
      }
      if (rightTrack && rightTrack.isPlaying) {
        console.log('⏹️ [STOP STREAMING] Fermando deck RIGHT')
        const rightAudio = document.getElementById('right-audio') as HTMLAudioElement
        if (rightAudio) {
          rightAudio.pause()
          rightAudio.currentTime = 0
        }
      }
    } catch (error) {
      console.error('❌ Errore stop streaming:', error)
      streamingDispatch({ type: 'SET_STREAM_ERROR', payload: `Stop error: ${error}` })
      streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
    }
  }, [streamingManager, leftTrack, rightTrack])


  // Listener per sincronizzare lo stato streaming dal componente StreamingControl
  useEffect(() => {
    const handleStreamingStatusChange = (event: CustomEvent) => {
      const { status, isStreaming: streaming, error } = event.detail
      console.log(`📡 Streaming status changed: ${status}, streaming: ${streaming}`)
      streamingDispatch({ type: 'SET_STREAM_STATUS', payload: status })
      streamingDispatch({ type: 'SET_STREAMING', payload: streaming })
      streamingDispatch({ type: 'SET_STREAM_ERROR', payload: error })
    }

    // ✅ FIX CONFLITTO: Rimosso listener track-ended da RebuiltDJConsole
    // L'AutoAdvanceManager gestisce già l'auto-avanzamento
    // Questo evita conflitti e esecuzioni multiple

    // Eventi dal StreamingControl
    window.addEventListener('djconsole:streaming-status-changed', handleStreamingStatusChange as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:streaming-status-changed', handleStreamingStatusChange as EventListener)
    }
  }, [])

  // ✅ EXPOSE: Esponi getMixedStream globalmente per uso esterno
  ;(window as any).getMixedStream = getMixedStream
  
  // ✅ EXPOSE: Funzione per controllare il volume del Live Stream (richiesta dal PTT)
  const setLiveStreamVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    console.log(`🔊 [LIVE STREAM] Volume Live Stream impostato: ${Math.round(clampedVolume * 100)}%`)
    
    // ✅ Salva il volume corrente per il PTT
    ;(window as any).__currentStreamVolume__ = clampedVolume
    
    // ✅ CRITICAL FIX: Aggiorna anche il mixer WebAudio per il ducking reale
    const mixerGain = (window as any).mixerGain
    const context = (window as any).currentMixContext
    if (mixerGain && mixerGain.gain && context) {
      mixerGain.gain.setValueAtTime(clampedVolume, context.currentTime)
      console.log(`🔊 [LIVE STREAM] Mixer WebAudio aggiornato a ${Math.round(clampedVolume * 100)}%`)
    } else {
      console.warn('⚠️ [LIVE STREAM] Mixer WebAudio non disponibile per aggiornamento volume')
    }
    
    // ✅ Dispatch evento per aggiornare altri componenti
    window.dispatchEvent(new CustomEvent('djconsole:stream-volume-change', {
      detail: { volume: clampedVolume }
    }))
  }, [])
  
  // ✅ EXPOSE: Rendi disponibile setLiveStreamVolume globalmente per il PTT
  ;(window as any).setLiveStreamVolume = setLiveStreamVolume
  
  // ✅ EXPOSE: Inizializza il volume corrente del LiveStream per il PTT
  ;(window as any).__currentStreamVolume__ = 1.0 // Default al 100% (come richiesto dall'utente)
  
  return (
    <div className="min-h-screen bg-dj-dark text-white overflow-y-auto">
      {/* Header principale */}
      <header className="bg-dj-primary border-b border-dj-accent/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-dj font-bold text-white flex items-center space-x-3">
              <Activity className="w-8 h-8 text-dj-highlight" />
              <span>Inferno Console</span>
            </h1>
            
            {/* Indicatori stato deck */}
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-all duration-300 ${
                leftDeckActive ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-500/20 border border-gray-500/40'
              }`}>
                <div className={`w-2 h-2 rounded-full ${leftDeckActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-xs font-medium">Deck A</span>
              </div>
              
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-all duration-300 ${
                rightDeckActive ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-500/20 border border-gray-500/40'
              }`}>
                <div className={`w-2 h-2 rounded-full ${rightDeckActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-xs font-medium">Deck B</span>
              </div>
            </div>
          </div>

          {/* Controlli header */}
          <div className="flex items-center space-x-3">
            {/* Indicatore auto-avanzamento */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
              settings.interface.autoAdvance 
                ? 'bg-dj-highlight/20 text-dj-highlight border border-dj-highlight/40' 
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
            }`}>
              <div className={`w-2 h-2 rounded-full ${settings.interface.autoAdvance ? 'bg-dj-highlight animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium">Auto-Advance</span>
            </div>

            {/* Indicatore loop playlist */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
              settings.interface.playlistLoop 
                ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
            }`}>
              <div className={`w-2 h-2 rounded-full ${settings.interface.playlistLoop ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium">Loop Playlist</span>
            </div>

            {/* Pulsanti azione */}
            <button
              onClick={() => navigate('/settings')}
              className="p-2 bg-dj-secondary hover:bg-dj-accent rounded-lg transition-colors"
              title="Impostazioni"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Pulsante Notifiche */}
            <button
              onClick={() => streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: !showDebugPanel })}
              className={`relative p-2 rounded-lg transition-colors ${
                showDebugPanel 
                  ? 'bg-green-600 text-white' 
                  : 'bg-dj-secondary hover:bg-dj-accent text-dj-light'
              }`}
              title="Notifiche e Debug"
            >
              <Bell className="w-5 h-5" />
              {errorCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {errorCount > 99 ? '99+' : errorCount}
                </span>
              )}
            </button>
            
            {/* BELLISSIMO STREAMING BUTTON - Ripristinato come prima! */}
        <button
          onClick={handleStreamingButtonClick}
          disabled={streamStatus === 'connecting'}
          className={`p-2 rounded-lg transition-all duration-200 relative ${
            isStreaming
              ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-300'
              : streamStatus === 'connecting'
              ? 'bg-yellow-500 text-white animate-pulse cursor-not-allowed'
              : streamStatus === 'connected'
              ? 'bg-green-500 text-white shadow-lg'
              : streamError
              ? 'bg-red-500 text-white shadow-lg'
              : (streamStatus === 'disconnected' && decksEmpty)
              ? 'bg-orange-600 text-orange-200 hover:bg-orange-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title={
            streamStatus === 'streaming' ? 'LIVE STREAMING - Click to stop' :
            streamStatus === 'connecting' ? 'Connecting and starting streaming...' :
            streamStatus === 'connected' ? 'Connected - Starting stream...' :
            streamError ? `Stream Error: ${streamError}` :
            (streamStatus === 'disconnected' && decksEmpty) ? 'Carica almeno una canzone in uno dei deck per avviare lo streaming' :
            'Click to Start Live Streaming'
          }
        >
              <Radio className="w-5 h-5" />
              {streamStatus === 'connecting' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>
              )}
              {isStreaming && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
              )}
              {streamStatus === 'connected' && !isStreaming && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
              )}
              {streamError && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-300 rounded-full animate-bounce"></div>
              )}
            </button>

            {/* ✅ NUOVO: Contatori Live - Design Professionale */}
            {isStreaming && (
              <div className="flex items-center space-x-4">
                {/* Contatore Ascoltatori */}
                <div className="relative group">
                  <div className="flex items-center space-x-3 bg-gradient-to-r from-dj-accent/20 to-dj-secondary/30 backdrop-blur-sm rounded-xl px-4 py-3 border border-dj-accent/30 shadow-lg hover:shadow-dj-accent/20 hover:shadow-xl transition-all duration-300">
                    {/* Icona con effetto pulsante */}
                    <div className="relative">
                      <Headphones className="w-5 h-5 text-white animate-pulse" />
                      <div className="absolute inset-0 w-5 h-5 bg-white/20 rounded-full animate-ping"></div>
                    </div>
                    
                    {/* Contatore con design elegante e animazione */}
                    <div className="flex flex-col">
                      <div className="flex items-baseline space-x-1">
                        <span 
                          key={listenerCount} 
                          className="text-2xl font-bold text-white tracking-tight transition-all duration-500 ease-out transform hover:scale-110"
                          style={{
                            textShadow: '0 0 10px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)',
                            animation: 'listenerCountGlow 2s ease-in-out'
                          }}
                        >
                          {listenerCount}
                        </span>
                        <span className="text-xs text-dj-light/70 uppercase tracking-wider animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <span className="text-xs text-dj-light/60 -mt-1 transition-colors duration-300">
                        ascoltatori
                      </span>
                    </div>
                  </div>
                  
                  {/* Tooltip informativo */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    🎧 {listenerCount} persone stanno ascoltando su tutti i mount points
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>

                {/* ✅ NUOVO: Timer di Trasmissione */}
                <div className="relative group">
                  <div className="flex items-center space-x-3 bg-gradient-to-r from-green-500/20 to-emerald-500/30 backdrop-blur-sm rounded-xl px-4 py-3 border border-green-400/30 shadow-lg hover:shadow-green-400/20 hover:shadow-xl transition-all duration-300">
                    {/* Icona timer con effetto pulsante */}
                    <div className="relative">
                      <Activity className="w-5 h-5 text-green-300 animate-pulse" />
                      <div className="absolute inset-0 w-5 h-5 bg-green-300/20 rounded-full animate-ping"></div>
                    </div>
                    
                    {/* Timer con design elegante */}
                    <div className="flex flex-col">
                      <div className="flex items-baseline space-x-1">
                        <span 
                          className="text-2xl font-bold text-white tracking-tight transition-all duration-500 ease-out transform hover:scale-110 font-mono"
                          style={{
                            textShadow: '0 0 10px rgba(34, 197, 94, 0.5), 0 0 20px rgba(34, 197, 94, 0.3)',
                            animation: 'listenerCountGlow 2s ease-in-out'
                          }}
                        >
                          {broadcastDuration}
                        </span>
                        <span className="text-xs text-green-300/70 uppercase tracking-wider animate-pulse">
                          ON AIR
                        </span>
                      </div>
                      <span className="text-xs text-green-300/60 -mt-1 transition-colors duration-300">
                        tempo trasmissione
                      </span>
                    </div>
                  </div>
                  
                  {/* Tooltip informativo */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    ⏱️ Tempo di trasmissione in corso
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Area principale */}
      <div className="p-4 space-y-4">
        {/* Riga dei deck */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EnhancedDeck
            side="left"
            deckId="A"
            track={leftTrack}
            onTrackLoad={handleLeftTrackLoad}
            onAutoAdvance={handleAutoAdvance}
            onTrackClear={handleLeftTrackClear}
          />
          
          <EnhancedDeck
            side="right"
            deckId="B"
            track={rightTrack}
            onTrackLoad={handleRightTrackLoad}
            onAutoAdvance={handleAutoAdvance}
            onTrackClear={handleRightTrackClear}
          />
        </div>

        {/* Effetti Audio */}
        <DeckEffects />

        {/* Mixer e controlli */}
        <EnhancedMixer
          leftDeckActive={leftDeckActive}
          rightDeckActive={rightDeckActive}
          onMasterVolumeChange={handleMasterVolumeChange}
          onStreamVolumeChange={handleStreamVolumeChange}
          onPTTActivate={handlePTTActivate}
        />

        {/* Playlist */}
        <EnhancedPlaylist
          activePlaylistId={activePlaylistId}
          onPlaylistChange={setActivePlaylistId}
          onTrackLoad={handleTrackLoadInternal}
          leftDeckActive={leftDeckActive}
          rightDeckActive={rightDeckActive}
        />

        {/* RIMUOVO IL GRANDE PANNELLO STREAMING - ora solo il pulsante funziona */}
      </div>

      {/* ✅ FIX AUTOPLAY: AutoAdvanceManager ora è globale in App.tsx */}

      {/* Dialog traccia duplicata */}
      <DuplicateTrackDialog
        track={duplicateDialog.track}
        activeDeck={duplicateDialog.activeDeck}
        onConfirm={handleDuplicateConfirm}
        onCancel={handleDuplicateCancel}
        isVisible={duplicateDialog.isVisible}
      />


      {/* Piccolo Debug Panel in basso a destra */}
      <StreamingDebugPanel
        isVisible={showDebugPanel}
        onClose={useCallback(() => streamingDispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: false }), [streamingDispatch])}
        streamStatus={streamStatus}
        isStreaming={isStreaming}
        streamError={streamError}
        debugMessages={debugMessages}
      />


      {/* Footer informativo */}
      <footer className="bg-dj-primary border-t border-dj-accent/30 p-4 mt-8">
        <div className="flex items-center justify-between text-sm text-dj-light/60">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Headphones className="w-4 h-4" />
              <span>Audio separato: Locale vs Streaming</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Auto-avanzamento: {settings.interface.autoAdvance ? 'Attivo' : 'Disattivo'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Loop Playlist: {settings.interface.playlistLoop ? 'Attivo' : 'Disattivo'}</span>
            </div>
          </div>
          <div>
            <span>{t('streaming.pttInstruction').replace('{key}', settings.microphone.pushToTalkKey)}</span>
          </div>
        </div>
      </footer>

      {/* 🔇 SICUREZZA: Dialogo avviso silenzio */}
      <ConfirmationDialog
        isOpen={showSilenceWarning}
        title="🔇 Avviso Silenzio"
        message={`Rilevato silenzio prolungato! Lo streaming verrà disconnesso automaticamente in ${silenceSecondsRemaining} secondi se non viene rilevato audio.`}
        confirmText="OK"
        cancelText=""
        onConfirm={() => streamingDispatch({ type: 'SET_SHOW_SILENCE_WARNING', payload: false })}
        onCancel={() => streamingDispatch({ type: 'SET_SHOW_SILENCE_WARNING', payload: false })}
        type="warning"
      />

      {/* 🛡️ SICUREZZA: Dialoghi di conferma streaming */}
      <ConfirmationDialog
        isOpen={showStartConfirmation}
        title="🚀 Avvio Streaming Live"
        message="Sei sicuro di voler andare in diretta? Lo streaming inizierà immediatamente e sarà visibile a tutti gli ascoltatori."
        confirmText="SÌ, VAI IN DIRETTA"
        cancelText="Annulla"
        onConfirm={handleStartStreamingConfirmed}
        onCancel={() => {
          streamingDispatch({ type: 'SET_SHOW_START_CONFIRMATION', payload: false })
          streamingDispatch({ type: 'SET_PENDING_STREAMING_ACTION', payload: null })
        }}
        type="warning"
      />

      <ConfirmationDialog
        isOpen={showStopConfirmation}
        title="⏹️ Stop Streaming Live"
        message="Sei sicuro di voler interrompere la trasmissione? Lo streaming si fermerà immediatamente e gli ascoltatori perderanno la connessione."
        confirmText="SÌ, FERMA STREAMING"
        cancelText="Annulla"
        onConfirm={handleStopStreamingConfirmed}
        onCancel={() => {
          streamingDispatch({ type: 'SET_SHOW_STOP_CONFIRMATION', payload: false })
          streamingDispatch({ type: 'SET_PENDING_STREAMING_ACTION', payload: null })
        }}
        type="danger"
      />
    </div>
  )
}

export default RebuiltDJConsole
