import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, MicOff, Settings, Radio, GripVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DeckPlayer from './DeckPlayer'
import MixerControls from './MixerControls'
import AudioManager from '../audio/AudioManager'
import '../audio/GlobalAudioPersistence' // Auto-inizializza la persistenza
import { usePlaylist } from '../contexts/PlaylistContext'
import { useSettings } from '../contexts/SettingsContext'
import { usePTT } from '../hooks/usePTT'
import { useStreaming } from '../contexts/StreamingContext'
import { localDatabase } from '../database/LocalDatabase'
import { getBlob } from '../database/BlobStore'
import { StreamingManager } from '../audio/StreamingManager'
import { useAudio } from '../contexts/AudioContext'

interface Track {
  id: string
  title: string
  artist: string
  duration: number
  url: string
}

const NewDJConsole: React.FC = () => {
  // Navigation
  const navigate = useNavigate()
  
  // Audio Manager instance
  const [audioManager] = useState(() => {
    const manager = AudioManager.getInstance()
    // 🚨 FIX: Make AudioManager globally available for AudioContext
    ;(window as any).audioManager = manager
    return manager
  })
  
  // Streaming Manager instance
  const [streamingManager] = useState(() => new StreamingManager())
  
  // Settings context
  const { settings } = useSettings()
  
  // Streaming context
  const { } = useStreaming()
  
  // Audio context for mixed stream
  const { getMixedStream } = useAudio()
  
  // Stati locali
  const [deckATrack, setDeckATrack] = useState<Track | null>(null)
  const [deckBTrack, setDeckBTrack] = useState<Track | null>(null)
  
  // ✅ NUOVO: Stato per tracciare se i deck sono vuoti (aggiornamento in tempo reale)
  const [decksEmpty, setDecksEmpty] = useState(true)
  
  // ✅ NUOVO: Aggiorna lo stato dei deck vuoti in tempo reale
  useEffect(() => {
    const isEmpty = !deckATrack && !deckBTrack
    setDecksEmpty(prev => {
      // Solo aggiorna se è cambiato
      if (prev !== isEmpty) {
        return isEmpty
      }
      return prev
    })
  }, [deckATrack, deckBTrack])
  
  const [deckAVolume, setDeckAVolume] = useState(0.8)
  const [deckBVolume, setDeckBVolume] = useState(0.8)
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [micEnabled, setMicEnabled] = useState(true)  // 🚨 CRITICAL FIX: Microfono SEMPRE abilitato di default
     const [micVolume, setMicVolume] = useState(() => {
     // 🚨 CRITICAL FIX: Microfono SEMPRE abilitato di default al 10% (udibile ma basso)
     const savedVolume = (window as any).__micVolume__ || 0.1  // 10% di default invece di 70%
     ;(window as any).__micVolume__ = savedVolume // Ensure it's set globally
     console.log('🎤 [INIT] Microphone initialized at', Math.round(savedVolume * 100), '% (always enabled)')
     return savedVolume
   })
  const [cueEnabled, setCueEnabled] = useState(false)
  const [activeDeck, setActiveDeck] = useState<'A' | 'B'>('A')
  
  // Stati streaming reali
  const [isStreaming, setIsStreaming] = useState(false)
  const [isStreamConnected, setIsStreamConnected] = useState(false)
  const [streamStatus, setStreamStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'streaming'>('disconnected')
  const [streamError, setStreamError] = useState<string | null>(null)
  const testOscillatorRef = useRef<OscillatorNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamVerificationInterval = useRef<NodeJS.Timeout | null>(null)
  const settingsLoadedRef = useRef(false)
  
  // Sistema pannello notifiche streaming (sostituisce i toast)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  const [notificationPanelHasNew, setNotificationPanelHasNew] = useState(false)
  
  // Debug log streaming
  const [streamLogs, setStreamLogs] = useState<string[]>([])
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  
  // Stati per i deck attivi e mute
  const [deckAActive, setDeckAActive] = useState(false)
  const [deckBActive, setDeckBActive] = useState(false)
  const [deckAMuted, setDeckAMuted] = useState(false)
  const [deckBMuted, setDeckBMuted] = useState(false)
  
  // Playlist context
  const { state: playlistState, dispatch: playlistDispatch } = usePlaylist()
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  
  // Drag & Drop states
  const [draggedTrack, setDraggedTrack] = useState<number | null>(null)
  const [dragOverTrack, setDragOverTrack] = useState<number | null>(null)
  const [doubleClickTimeout, setDoubleClickTimeout] = useState<NodeJS.Timeout | null>(null)
  const lastClickTimeRef = useRef<number>(0)
  const lastClickedTrackRef = useRef<string | null>(null)
  
  // Dialog per conferma traccia duplicata
  const [duplicateTrackDialog, setDuplicateTrackDialog] = useState<{
    show: boolean
    track: any
    targetDeck: 'A' | 'B'
    sourceDeck: 'A' | 'B'
  } | null>(null)
  
  // 🚨 CRITICAL FIX: Attiva automaticamente il microfono all'avvio
  useEffect(() => {
    audioManager.setMicrophoneEnabled(true)
    audioManager.setMicVolume(micVolume)
  }, [audioManager, micVolume])

  // Sincronizza con Audio Manager
  useEffect(() => {
    const handleStateChange = () => {
      const state = audioManager.getState()
      
      // Aggiorna stati locali
      setDeckATrack(state.deckA.track)
      setDeckBTrack(state.deckB.track)
      setDeckAVolume(state.deckA.volume)
      setDeckBVolume(state.deckB.volume)
      setMasterVolume(state.masterVolume)
      setMicEnabled(state.micEnabled)
      setMicVolume(state.micVolume)
      setCueEnabled(state.cueEnabled)
      
      // Aggiorna stati dei deck attivi e mute
      setDeckAActive(state.deckA.isActive)
      setDeckBActive(state.deckB.isActive)
      setDeckAMuted(state.deckA.isMuted)
      setDeckBMuted(state.deckB.isMuted)
      
      // Determina deck attivo - ora può essere entrambi o nessuno
      // Per la UI principale, mostra quello che suona per ultimo
      if (state.deckA.isPlaying && state.deckB.isPlaying) {
        // Se entrambi suonano, mantieni l'ultimo selezionato
        // oppure usa A come default
        setActiveDeck(activeDeck || 'A')
      } else if (state.deckA.isPlaying) {
        setActiveDeck('A')
      } else if (state.deckB.isPlaying) {
        setActiveDeck('B')
      } else {
        // Nessuno suona - usa il primo attivo o nessuno
        if (state.deckA.isActive) setActiveDeck('A')
        else if (state.deckB.isActive) setActiveDeck('B')
        // Non cambiare se nessuno è attivo
      }
    }
    
    // Listener per cambiamenti di stato
    audioManager.addEventListener('stateChanged', handleStateChange)
    
    // Listener specifico per cambiamenti di volume (per mute/unmute)
    const handleVolumeChange = (event: any) => {
      if (event.deckId) {
        console.log(`🔊 Volume changed for Deck ${event.deckId}: ${Math.round(event.data * 100)}%`)
        // Forza l'aggiornamento dello stato
        handleStateChange()
      }
    }
    
    audioManager.addEventListener('volumeChanged', handleVolumeChange)
    
    // Carica stato iniziale
    handleStateChange()
    
    return () => {
      audioManager.removeEventListener('stateChanged', handleStateChange)
      audioManager.removeEventListener('volumeChanged', handleVolumeChange)
    }
  }, [audioManager, activeDeck])
  
  // Seleziona automaticamente la prima playlist
  useEffect(() => {
    if (!activePlaylistId && playlistState.library.playlists.length > 0) {
      setActivePlaylistId(playlistState.library.playlists[0].id)
    }
  }, [activePlaylistId, playlistState.library.playlists])
  
  // Gestori eventi deck
  const handleDeckAVolumeChange = useCallback((volume: number) => {
    // Only update local AudioManager for monitoring
    audioManager.setDeckVolume('A', volume)
    console.log('🔊 Deck A volume updated to', volume, '(LIVE MIXER COMPLETELY UNAFFECTED)')
    // Note: Live mixer uses fixed 100% volume regardless of this setting
  }, [audioManager])
  
  const handleDeckBVolumeChange = useCallback((volume: number) => {
    // Only update local AudioManager for monitoring
    audioManager.setDeckVolume('B', volume)
    console.log('🔊 Deck B volume updated to', volume, '(LIVE MIXER COMPLETELY UNAFFECTED)')
    // Note: Live mixer uses fixed 100% volume regardless of this setting
  }, [audioManager])
  
  const handleDeckAActivate = useCallback(() => {
    audioManager.setDeckActive('A', true)
  }, [audioManager])
  
  const handleDeckBActivate = useCallback(() => {
    audioManager.setDeckActive('B', true)
  }, [audioManager])
  
  
  const handleMasterVolumeChange = useCallback((volume: number) => {
    console.log(`🔊 [MASTER VOLUME] Changing master volume to ${Math.round(volume * 100)}%`)
    audioManager.setMasterVolume(volume)
    
    // 🚨 FIX: Sempre aggiorna il mixer gain quando cambia il master, anche senza PTT
    if ((window as any).updatePTTVolumesOnly) {
      const currentPTTState = (window as any).__pttActive__ ?? false
      console.log(`🔊 [MASTER VOLUME] Updating mixer gain with PTT state: ${currentPTTState}`)
      // Re-apply current mixer gain based on latest master and PTT (computed inside)
      ;(window as any).updatePTTVolumesOnly(currentPTTState)
    } else {
      console.log(`🔊 [MASTER VOLUME] Warning: updatePTTVolumesOnly function not available yet`)
    }
  }, [audioManager])
  
  const handleMicToggle = useCallback(() => {
    audioManager.toggleMicrophone()
  }, [audioManager])
  

  
  const handleCueToggle = useCallback(() => {
    audioManager.toggleCue()
  }, [audioManager])
  
  // Carica traccia nel deck
  const loadTrackInDeck = useCallback(async (trackData: any, deckId: 'A' | 'B') => {
    try {
      console.log(`🎵 Loading track "${trackData.title}" in Deck ${deckId}`)
      
      // Ottieni il blob della traccia
      const blob = await getBlob(trackData.blobId)
      if (!blob) {
        console.error(`❌ Blob not found for track: ${trackData.title}`)
        return
      }
      
      // Crea URL per l'audio
      const url = URL.createObjectURL(blob)
      
      // Crea oggetto Track
      const track: Track = {
        id: trackData.id,
        title: trackData.title,
        artist: trackData.artist,
        duration: trackData.duration,
        url: url
      }
      
      // Carica nel manager
      audioManager.loadTrack(deckId, track)
      
      console.log(`✅ Track loaded in Deck ${deckId}`)
      
    } catch (error) {
      console.error(`❌ Error loading track in Deck ${deckId}:`, error)
    }
  }, [audioManager])
  
  // Funzione helper per aggiungere notifiche al pannello (no toast)
  const addStreamingNotification = useCallback((
    type: 'success' | 'error' | 'info' | 'warning',
    title: string,
    message: string
  ) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${title} - ${message}`
    
    console.log(`📡 ${logEntry}`)
    
    // Aggiungi al log di debug (mantieni solo gli ultimi 50)
    setStreamLogs(prev => [logEntry, ...prev].slice(0, 50))
    
    // Segnala che ci sono nuove notifiche se il pannello è chiuso
    if (!showNotificationPanel && type === 'error') {
      setNotificationPanelHasNew(true)
    }
    
    // ✅ NUOVO: Usa anche il sistema globale di notifiche se disponibile
    if (typeof window !== 'undefined' && (window as any).addStreamingNotification && typeof (window as any).addStreamingNotification === 'function') {
      try {
        (window as any).addStreamingNotification(type, title, message, 'streaming')
      } catch (error) {
        console.warn('⚠️ [NOTIFICATION] Errore nell\'invio notifica globale:', error)
      }
    }
  }, [showNotificationPanel])
  
  // Inizializza StreamingManager
  useEffect(() => {
    // Setup listeners per lo streaming
    streamingManager.onStatusChange = (status) => {
      console.log(`📡 Stream status changed: ${status}`)
      setStreamStatus(status)
      setIsStreamConnected(status === 'connected' || status === 'streaming')
      setIsStreaming(status === 'streaming')
      
      // Mostra notifiche per i cambi di stato importanti
      switch (status) {
        case 'connected':
          // NON diciamo "Connesso" qui - è solo la modalità diretta locale attiva
          // Il vero successo sarà mostrato dopo la verifica del server Icecast
          console.log('📡 STATUS CHANGE: Connected - Direct mode initialized, waiting for server verification...')
          addStreamingNotification('info', 'Modalità Diretta Attiva', 'ffmpeg inizializzato, verifica connessione server in corso...')
        
        // DIAGNOSTICA PROFONDA: Verifica stato ffmpeg dopo inizializzazione
        console.log('📡 DIAGNOSTIC TIMER: Setting up 3-second diagnostic check...')
        setTimeout(async () => {
          try {
            console.log('🔍 DEEP DIAGNOSTIC: Starting ffmpeg connection status check...')
            addStreamingNotification('info', 'Diagnostica Avviata', 'Verifica stato connessione ffmpeg in corso...')
            
            console.log('🔍 DEEP DIAGNOSTIC: Calling streamingManager methods...')
            
            let isLocallyStreaming = false
            let isConnectedToServer = false
            
            try {
              isLocallyStreaming = streamingManager.isCurrentlyStreaming()
              console.log('🔍 DEEP DIAGNOSTIC: isCurrentlyStreaming() =', isLocallyStreaming)
            } catch (streamingError) {
              console.error('❌ DEEP DIAGNOSTIC: Error calling isCurrentlyStreaming():', streamingError)
              addStreamingNotification('error', 'Errore Diagnostica', 'Errore nel controllo stato streaming locale')
            }
            
            try {
              isConnectedToServer = streamingManager.isConnectedToServer()
              console.log('🔍 DEEP DIAGNOSTIC: isConnectedToServer() =', isConnectedToServer)
            } catch (serverError) {
              console.error('❌ DEEP DIAGNOSTIC: Error calling isConnectedToServer():', serverError)
              addStreamingNotification('error', 'Errore Diagnostica', 'Errore nel controllo connessione server')
            }
            
            console.log('🔍 DEEP DIAGNOSTIC: Final status:', {
              locallyStreaming: isLocallyStreaming,
              connectedToServer: isConnectedToServer
            })
            
            addStreamingNotification('info', 'Status Diagnostica', 
              `Locale: ${isLocallyStreaming ? 'Attivo' : 'Inattivo'}, Server: ${isConnectedToServer ? 'Connesso' : 'Non Connesso'}`)
            
            if (!isLocallyStreaming) {
              console.log('❌ DEEP DIAGNOSTIC: Local streaming process is NOT active!')
              addStreamingNotification('error', 'Processo Locale Inattivo', 
                'Il processo di streaming locale (ffmpeg) non è attivo!')
            }
            
            if (!isConnectedToServer) {
              console.log('❌ DEEP DIAGNOSTIC: NOT connected to Icecast server!')
              addStreamingNotification('error', 'Server Non Connesso', 
                'Non siamo connessi al server Icecast! Possibili cause: credenziali errate, server irraggiungibile.')
              
              // DIAGNOSTICA AVANZATA: Verifica se ffmpeg sta usando parametri sbagliati
              console.log('🔍 DEEP DIAGNOSTIC: Checking if ffmpeg is connecting to wrong server...')
              
              // Test se ffmpeg si sta connettendo a localhost invece del server remoto
              try {
                const localhostTest = await fetch('http://localhost:8000/status-json.xsl', { 
                  signal: AbortSignal.timeout(3000) 
                })
                if (localhostTest.ok) {
                  const localhostData = await localhostTest.json()
                  const localhostSources = localhostData.icestats?.source || []
                  const localhostArray = Array.isArray(localhostSources) ? localhostSources : [localhostSources]
                  
                  console.log('🔍 DEEP DIAGNOSTIC: Localhost Icecast sources:', localhostArray)
                  
                  if (localhostArray.length > 0) {
                    console.log('⚠️ DEEP DIAGNOSTIC: ffmpeg might be connecting to localhost instead of remote server!')
                    addStreamingNotification('warning', 'ffmpeg Misdirected', 
                      'ffmpeg potrebbe essere connesso a localhost invece del server remoto. Verifica configurazione Electron.')
                      
                    // Mostra i mountpoint localhost trovati
                    const localhostMounts = localhostArray.map(s => s.mount || s.listenurl || 'unknown')
                    console.log('🔍 DEEP DIAGNOSTIC: Localhost mountpoints found:', localhostMounts)
                    addStreamingNotification('info', 'Localhost Mountpoints', 
                      `Trovati mountpoint su localhost: ${localhostMounts.join(', ')}`)
                  } else {
                    console.log('✅ DEEP DIAGNOSTIC: Localhost Icecast has no sources (this is expected)')
                  }
                }
              } catch (localhostError) {
                console.log('🔍 DEEP DIAGNOSTIC: No localhost Icecast running (this is normal)')
              }
                
              // Test connessione diretta al server
              const settings = await localDatabase.getSettings()
              const icecast = settings.streaming.icecast
              const protocol = icecast.useSSL ? 'https' : 'http'
              const testUrl = `${protocol}://${icecast.host}:${icecast.port || 8000}/`
              
              try {
                console.log(`🔍 DEEP DIAGNOSTIC: Testing direct connection to ${testUrl}`)
                const testResponse = await fetch(testUrl, { 
                  method: 'GET',
                  signal: AbortSignal.timeout(5000)
                })
                
                if (testResponse.ok) {
                  console.log(`✅ DEEP DIAGNOSTIC: Server reachable, status ${testResponse.status}`)
                  addStreamingNotification('warning', 'Server Raggiungibile', 
                    `Server ${icecast.host}:${icecast.port} risponde, ma ffmpeg non si connette. Verifica credenziali.`)
                } else {
                  console.log(`❌ DEEP DIAGNOSTIC: Server error ${testResponse.status}`)
                  addStreamingNotification('error', 'Server Error', 
                    `Server ${icecast.host}:${icecast.port} risponde con errore ${testResponse.status}.`)
                }
              } catch (testError) {
                console.error('❌ DEEP DIAGNOSTIC: Connection test failed:', testError)
                addStreamingNotification('error', 'Server Irraggiungibile', 
                  `Impossibile raggiungere ${icecast.host}:${icecast.port}. Verifica host e porta.`)
              }
            } else {
              console.log('✅ DEEP DIAGNOSTIC: Connected to server, but mountpoint verification will follow...')
              
              // TEST DECISIVO: Se ffmpeg dice "connesso" ma il server non vede nulla,
              // potrebbe essere connesso al posto sbagliato. Verifichiamo TUTTI i server possibili.
              addStreamingNotification('warning', 'Connessione Anomala', 
                'ffmpeg dice di essere connesso ma il server remoto non mostra connessioni. Investigando...')
              
              // Test 1: Verifica se si è connesso a localhost invece del server remoto
              console.log('🧪 DECISIVE TEST: Checking if ffmpeg connected to wrong server...')
              
              try {
                const localhostTest = await fetch('http://localhost:8000/status-json.xsl', { 
                  signal: AbortSignal.timeout(3000) 
                })
                if (localhostTest.ok) {
                  const localhostData = await localhostTest.json()
                  const localhostSources = localhostData.icestats?.source || []
                  const localhostArray = Array.isArray(localhostSources) ? localhostSources : [localhostSources]
                  
                  console.log('🧪 DECISIVE TEST: Localhost Icecast sources:', localhostArray)
                  
                  if (localhostArray.length > 0) {
                    console.log('🚨 DECISIVE TEST: FOUND IT! ffmpeg is connected to LOCALHOST, not remote server!')
                    addStreamingNotification('error', 'ffmpeg su Localhost', 
                      'PROBLEMA TROVATO: ffmpeg si è connesso a localhost:8000 invece del server remoto!')
                      
                    const localhostMounts = localhostArray.map(s => s.mount || s.listenurl || 'unknown')
                    addStreamingNotification('info', 'Mountpoint Localhost', 
                      `Mountpoint trovati su localhost: ${localhostMounts.join(', ')}`)
                  } else {
                    console.log('🧪 DECISIVE TEST: Localhost Icecast exists but no sources')
                  }
                } else {
                  console.log('🧪 DECISIVE TEST: Localhost Icecast not responding')
                }
              } catch (localhostError) {
                console.log('🧪 DECISIVE TEST: No localhost Icecast server running')
              }
              
              // Test 2: Verifica altri possibili server locali
              const commonPorts = [8000, 8001, 8004, 9000]
              for (const port of commonPorts) {
                if (port === 8000) continue // già testato
                try {
                  const testResponse = await fetch(`http://localhost:${port}/status-json.xsl`, { 
                    signal: AbortSignal.timeout(2000) 
                  })
                  if (testResponse.ok) {
                    console.log(`🧪 DECISIVE TEST: Found Icecast on localhost:${port}!`)
                    addStreamingNotification('warning', 'Icecast Locale Trovato', 
                      `Trovato server Icecast su localhost:${port} - potrebbe interferire!`)
                  }
                } catch {}
              }
            }
            
            console.log('🔍 DEEP DIAGNOSTIC: Diagnostic check completed successfully')
            addStreamingNotification('info', 'Diagnostica Completata', 'Controllo stato connessione terminato')
            
          } catch (diagError) {
            console.error('❌ DEEP DIAGNOSTIC: Error during check:', diagError)
            addStreamingNotification('error', 'Errore Diagnostica', `Errore durante controllo: ${diagError.message}`)
          }
        }, 2000) // Ridotto a 2 secondi per test più rapido
        
        setStreamError(null)
        break
        case 'streaming':
          // NON mostriamo subito "Streaming Attivo" - aspettiamo la verifica server
          console.log('📡 Local streaming started, waiting for server verification...')
          
          // MONITORAGGIO DISCONNESSIONE: Controlla ogni 5 secondi se siamo ancora connessi
          const disconnectionMonitor = setInterval(async () => {
            try {
              const stillStreaming = streamingManager.isCurrentlyStreaming()
              const stillConnected = streamingManager.isConnectedToServer()
              
              console.log('🔍 CONNECTION MONITOR:', {
                streaming: stillStreaming,
                connected: stillConnected,
                timestamp: new Date().toISOString()
              })
              
              if (!stillStreaming || !stillConnected) {
                console.log('⚠️ CONNECTION LOST DETECTED!')
                addStreamingNotification('warning', 'Connessione Persa', 
                  'La connessione al server si è interrotta. Tentativo di riconnessione...')
                clearInterval(disconnectionMonitor)
              }
            } catch (monitorError) {
              console.error('❌ CONNECTION MONITOR ERROR:', monitorError)
              clearInterval(disconnectionMonitor)
            }
          }, 5000)
          
          // Pulisci il monitor quando lo streaming si ferma
          const originalStopStreaming = streamingManager.stopStreaming.bind(streamingManager)
          streamingManager.stopStreaming = () => {
            clearInterval(disconnectionMonitor)
            return originalStopStreaming()
          }
          
          // Avvia verifica periodica dello stato streaming + monitoraggio connessioni rifiutate
          if (streamVerificationInterval.current) {
            clearInterval(streamVerificationInterval.current)
          }
          
          let lastConnectionCount = 0
          let connectionAttemptCount = 0
          
          streamVerificationInterval.current = setInterval(async () => {
            const actuallyStreaming = streamingManager.isCurrentlyStreaming()
            const actuallyConnected = streamingManager.isConnectedToServer()
            
            if (!actuallyStreaming || !actuallyConnected) {
              console.log('📡 Periodic check: streaming lost!')
              addStreamingNotification('error', 'Streaming Perso', 
                'La connessione di streaming si è interrotta. Riprova a connetterti.')
              setStreamError('Streaming connection lost')
              setStreamStatus('disconnected')
              setIsStreaming(false)
              setIsStreamConnected(false)
              
              if (streamVerificationInterval.current) {
                clearInterval(streamVerificationInterval.current)
                streamVerificationInterval.current = null
              }
              return
            }
            
            // Monitora tentativi di connessione rifiutati controllando le statistiche del server
            try {
              const settings = await localDatabase.getSettings()
              if (settings?.streaming?.icecast) {
                const icecast = settings.streaming.icecast
                const protocol = icecast.useSSL ? 'https' : 'http'
                const statusUrl = `${protocol}://${icecast.host}:${icecast.port || 8000}/admin/stats.xml`
                
                try {
                  const response = await fetch(statusUrl, { 
                    signal: AbortSignal.timeout(3000),
                    headers: {
                      'Authorization': `Basic ${btoa(`${icecast.username}:${icecast.password}`)}`
                    }
                  })
                  
                  if (response.ok) {
                    const xmlText = await response.text()
                    
                    // Cerca pattern di connessioni rifiutate nei log
                    const rejectedMatches = xmlText.match(/source_connection_refused|source_already_connected|client_connection_refused/gi)
                    const currentConnectionAttempts = rejectedMatches ? rejectedMatches.length : 0
                    
                    if (currentConnectionAttempts > connectionAttemptCount) {
                      const newAttempts = currentConnectionAttempts - connectionAttemptCount
                      console.log(`📡 Detected ${newAttempts} rejected connection attempts`)
                      addStreamingNotification('info', 'Server Occupato Confermato', 
                        `${newAttempts} tentativo/i di connessione rifiutato/i dal server. Il mountpoint è effettivamente occupato da te.`)
                      connectionAttemptCount = currentConnectionAttempts
                    }
                  }
                } catch (adminError) {
                  // Admin endpoint potrebbe non essere accessibile, proviamo con status pubblico
                  const publicStatusUrl = `${protocol}://${icecast.host}:${icecast.port || 8000}/status-json.xsl`
                  try {
                    const publicResponse = await fetch(publicStatusUrl, { signal: AbortSignal.timeout(3000) })
                    if (publicResponse.ok) {
                      const statusData = await publicResponse.json()
                      const sources = statusData.icestats?.source || []
                      const sourcesArray = Array.isArray(sources) ? sources : [sources]
                      
                      // Controlla se ci sono più sorgenti che tentano di connettersi allo stesso mountpoint
                      const mountpoint = icecast.mount || '/live'
                      const matchingSources = sourcesArray.filter(source => {
                        const sourceMount = source.mount || ''
                        const sourceUrl = source.listenurl || ''
                        
                        // Match diretto sul mount
                        if (sourceMount === mountpoint) return true
                        
                        // Match sulla fine dell'URL (es. /live)
                        if (sourceUrl.endsWith(mountpoint)) return true
                        
                        // Match flessibile: se il nostro mountpoint è /live, cerca qualsiasi URL che contiene "live"
                        if (mountpoint && mountpoint.length > 1) {
                          const mountName = mountpoint.replace('/', '') // rimuovi /
                          if (sourceUrl.includes(mountName) || sourceMount.includes(mountName)) return true
                        }
                        
                        return false
                      })
                      
                      if (matchingSources.length > 1) {
                        addStreamingNotification('warning', 'Conflitto Mountpoint', 
                          `Rilevate ${matchingSources.length} sorgenti per lo stesso mountpoint. Possibili connessioni concorrenti.`)
                      }
                    }
                  } catch (publicError) {
                    // Non possiamo monitorare, ma non è un errore critico
                  }
                }
              }
            } catch (monitorError) {
              console.warn('📡 Monitoring error:', monitorError)
            }
          }, 15000) // Verifica ogni 15 secondi per non sovraccaricare il server
          break
        case 'disconnected':
          if (streamError) {
            addStreamingNotification('error', 'Disconnesso', `Connessione persa: ${streamError}`)
          }
          setStreamError(null)
          
          // Ferma verifica periodica
          if (streamVerificationInterval.current) {
            clearInterval(streamVerificationInterval.current)
            streamVerificationInterval.current = null
          }
          break
      }
    }
    
    streamingManager.onDebug = (message) => {
      console.log(`📡 [STREAMING] ${message}`)
      
      // Rileva e notifica errori nei messaggi di debug
      const lowerMsg = message.toLowerCase()
      
      if (lowerMsg.includes('error') || lowerMsg.includes('failed')) {
        const errorMsg = `Debug: ${message}`
        setStreamError(errorMsg)
        setStreamStatus('disconnected')
        setIsStreaming(false)
        setIsStreamConnected(false)
        
        // Errori specifici con messaggi più chiari
        if (lowerMsg.includes('mountpoint') || lowerMsg.includes('already') || lowerMsg.includes('occupied') || lowerMsg.includes('in use')) {
          addStreamingNotification('error', 'Server Occupato', 
            'Il mountpoint è già in uso da un altro utente. Prova più tardi o usa un mountpoint diverso.')
        } else if (lowerMsg.includes('auth') || lowerMsg.includes('password') || lowerMsg.includes('credentials')) {
          addStreamingNotification('error', 'Credenziali Errate', 
            'Username o password non corretti. Verifica le credenziali nelle impostazioni.')
        } else if (lowerMsg.includes('connection') || lowerMsg.includes('connect')) {
          addStreamingNotification('error', 'Connessione Fallita', 
            'Impossibile connettersi al server. Verifica URL e porta nelle impostazioni.')
        } else {
          addStreamingNotification('error', 'Errore Streaming', errorMsg)
        }
      } else if (lowerMsg.includes('connected')) {
        addStreamingNotification('info', 'Debug', message)
      } else if (lowerMsg.includes('rejected') || lowerMsg.includes('denied')) {
        setStreamError('Connection rejected')
        setStreamStatus('disconnected')
        setIsStreaming(false)
        setIsStreamConnected(false)
        addStreamingNotification('error', 'Connessione Rifiutata', 
          'Il server ha rifiutato la connessione. Potrebbe essere già occupato.')
      }
    }
    
    // Carica settings di streaming
    const loadStreamingSettings = async () => {
      console.log('🔄 Loading streaming settings...')
      try {
        await localDatabase.waitForInitialization()
        const settings = await localDatabase.getSettings()
        console.log('📡 Raw settings loaded:', settings?.streaming)
        
        // Per la modalità diretta Icecast, non serve WebSocket bridge
        // Il server URL è solo per fallback - la modalità diretta bypassa completamente WebSocket
        if (settings.streaming?.bridgeUrl) {
          // Solo se esplicitamente configurato un bridge WebSocket
          streamingManager.setServerUrl(settings.streaming.bridgeUrl)
          console.log(`📡 WebSocket bridge URL set to: ${settings.streaming.bridgeUrl}`)
        } else {
          // Nessun bridge configurato - useremo solo modalità diretta Icecast
          console.log(`📡 No WebSocket bridge configured - using direct Icecast mode only`)
        }
        
        // Verifica che le credenziali Icecast siano configurate (solo log, no toast)
        if (!settings.streaming?.icecast?.host || !settings.streaming?.icecast?.password) {
          console.warn('⚠️ Icecast credentials incomplete - streaming may not work')
          // Non mostriamo toast all'avvio, solo quando l'utente tenta di streammare
        }
        
        // Configura credenziali Icecast se presenti
        if (settings.streaming?.icecast) {
          const icecast = settings.streaming.icecast
          console.log('📡 RAW ICECAST SETTINGS FROM DATABASE:', {
            host: icecast.host,
            port: icecast.port,
            username: icecast.username,
            password: icecast.password ? `[${icecast.password.length} chars]` : '[EMPTY]',
            mount: icecast.mount,
            useSSL: icecast.useSSL
          })
          
          if (icecast.host && icecast.password) {
            const credentials = {
              host: icecast.host,
              port: icecast.port,
              username: icecast.username,
              password: icecast.password,
              mountpoint: icecast.mount,
              useSSL: icecast.useSSL
            }
            streamingManager.setCredentials(credentials)
            console.log(`📡 Icecast credentials configured for ${icecast.host}:${icecast.port}${icecast.mount}`)
            console.log(`📡 Username being used: "${icecast.username}"`)
          } else {
            console.error('📡 MISSING REQUIRED CREDENTIALS:', {
              hasHost: !!icecast.host,
              hasPassword: !!icecast.password
            })
          }
        } else {
          console.error('📡 NO ICECAST SETTINGS FOUND IN DATABASE!')
        }
        
        console.log('📡 Streaming settings loaded successfully', {
          serverUrl,
          hasIcecastConfig: !!settings.streaming?.icecast?.host,
          icecastHost: settings.streaming?.icecast?.host || 'not set',
          autoConnect: settings.streaming?.autoConnect || false
        })
        
        // Log settings caricati senza toast automatico
        const bridgeStatus = settings.streaming?.bridgeUrl ? `Bridge: ${settings.streaming.bridgeUrl}` : 'Direct mode'
        console.log(`📡 Settings loaded: ${bridgeStatus}${settings.streaming?.icecast?.host ? ` | Icecast: ${settings.streaming.icecast.host}` : ''}`)
        
        // Conferma che la configurazione è valida
        if (settings.streaming?.icecast?.host && settings.streaming?.icecast?.password) {
          addStreamingNotification('success', 'Configurazione OK', 
            `Server Icecast configurato: ${settings.streaming.icecast.host}:${settings.streaming.icecast.port || 8000}`)
        }
      } catch (error) {
        console.error('❌ Error loading streaming settings:', error)
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        })
        
        // Solo mostra errore se realmente non abbiamo configurazione
        try {
          const fallbackSettings = await localDatabase.getSettings()
          if (fallbackSettings?.streaming?.icecast?.host) {
            console.log('📡 Settings actually loaded correctly on retry - ignoring previous error')
            return // Non mostrare errore se i settings sono comunque disponibili
          }
        } catch (retryError) {
          console.error('❌ Retry also failed:', retryError)
        }
        
        // Solo ora mostra l'errore
        console.log('📡 No valid streaming configuration - streaming will not be available')
        addStreamingNotification('error', 'Errore Configurazione [LoadSettings]', 
          `Errore nel caricamento settings: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
      }
    }
    
    // Carica settings solo una volta all'inizializzazione - CON DEBOUNCE
    if (!settingsLoadedRef.current) {
      settingsLoadedRef.current = true
      // Ritarda il caricamento per non bloccare la navigazione
      setTimeout(() => {
        loadStreamingSettings()
      }, 100)
    }
    
    return () => {
      // Cleanup: disconnetti se connesso
      if (isStreamConnected) {
        streamingManager.disconnect()
      }
      
      // Cleanup verifica periodica
      if (streamVerificationInterval.current) {
        clearInterval(streamVerificationInterval.current)
        streamVerificationInterval.current = null
      }
    }
  }, [streamingManager, isStreamConnected, addStreamingNotification, streamError])
  
  // Funzione per controllare se una traccia è già caricata nell'altro deck
  const checkForDuplicateTrack = useCallback((track: any, targetDeck: 'A' | 'B'): { isDuplicate: boolean, sourceDeck?: 'A' | 'B' } => {
    const deckAState = audioManager.getDeck('A')
    const deckBState = audioManager.getDeck('B')
    
    if (targetDeck === 'A' && deckBState.track?.id === track.id) {
      return { isDuplicate: true, sourceDeck: 'B' }
    }
    if (targetDeck === 'B' && deckAState.track?.id === track.id) {
      return { isDuplicate: true, sourceDeck: 'A' }
    }
    
    return { isDuplicate: false }
  }, [audioManager])
  
  // Funzione per trovare la prossima traccia nella playlist
  const getNextTrackInPlaylist = useCallback((currentTrack: any): any | null => {
    if (!activePlaylistId) return null
    
    const currentPlaylist = playlistState.library.playlists.find(p => p.id === activePlaylistId)
    if (!currentPlaylist?.tracks) return null
    
    const currentIndex = currentPlaylist.tracks.findIndex(t => t.id === currentTrack.id)
    if (currentIndex === -1 || currentIndex >= currentPlaylist.tracks.length - 1) return null
    
    return currentPlaylist.tracks[currentIndex + 1]
  }, [activePlaylistId, playlistState.library.playlists])
  
  // Gestione doppio click su traccia nella playlist
  const handleTrackDoubleClick = useCallback(async (track: any, trackIndex: number, isAutoAdvance: boolean = false) => {
    console.log(`🎵 Double-click on track: ${track.title} (autoAdvance: ${isAutoAdvance})`)
    
    // Pulisci timeout precedente se esiste
    if (doubleClickTimeout) {
      clearTimeout(doubleClickTimeout)
    }
    
    // Imposta timeout per ripristinare draggable dopo il doppio click
    const timeout = setTimeout(() => {
      console.log('🎵 Double-click timeout cleared')
      setDoubleClickTimeout(null)
    }, 1000)
    setDoubleClickTimeout(timeout)
    
    // Determina il deck target
    const deckAState = audioManager.getDeck('A')
    const deckBState = audioManager.getDeck('B')
    
    let targetDeck: 'A' | 'B'
    
    if (!deckAState.track || !deckAState.isPlaying) {
      targetDeck = 'A'
    } else if (!deckBState.track || !deckBState.isPlaying) {
      targetDeck = 'B'
    } else {
      // Se entrambi sono occupati, carica in quello non attivo
      targetDeck = deckAState.isActive ? 'B' : 'A'
    }
    
    // Controlla se la traccia è già caricata nell'altro deck
    const duplicateCheck = checkForDuplicateTrack(track, targetDeck)
    
    if (duplicateCheck.isDuplicate) {
      console.log(`⚠️ Track "${track.title}" already loaded in Deck ${duplicateCheck.sourceDeck}`)
      
      if (isAutoAdvance) {
        // AUTOAVANZAMENTO: salta alla traccia successiva
        console.log('🔄 Auto-advance detected: skipping to next track')
        const nextTrack = getNextTrackInPlaylist(track)
        
        if (nextTrack) {
          console.log(`⏭️ Loading next track: ${nextTrack.title}`)
          const nextIndex = playlistState.library.playlists
            .find(p => p.id === activePlaylistId)?.tracks
            .findIndex(t => t.id === nextTrack.id) ?? -1
          
          // Ricorsione con la traccia successiva
          await handleTrackDoubleClick(nextTrack, nextIndex, true)
          return
        } else {
          console.log('📋 No more tracks in playlist')
          return
        }
      } else {
        // MANUALE: mostra dialog di conferma
        console.log('❓ Manual load: showing confirmation dialog')
        setDuplicateTrackDialog({
          show: true,
          track,
          targetDeck,
          sourceDeck: duplicateCheck.sourceDeck!
        })
        return
      }
    }
    
    console.log(`🎯 Loading track in Deck ${targetDeck}`)
    
    // Carica la traccia
    await loadTrackInDeck(track, targetDeck)
    
    // Aspetta un momento che si carichi e poi avvia automaticamente
    setTimeout(() => {
      console.log(`▶️ Auto-starting playback in Deck ${targetDeck}`)
      audioManager.play(targetDeck)
    }, 500)
    
  }, [audioManager, loadTrackInDeck, doubleClickTimeout, checkForDuplicateTrack, getNextTrackInPlaylist, activePlaylistId, playlistState.library.playlists])

  // Gestione doppio click semplificata e affidabile
  const handleTrackClick = useCallback((track: any, trackIndex: number) => {
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTimeRef.current
    const isSameTrack = lastClickedTrackRef.current === track.id
    
    // Se è lo stesso track e sono passati meno di 400ms, è un doppio click
    if (isSameTrack && timeSinceLastClick < 400) {
      console.log(`🎵 Double click detected on track: ${track.title}`)
      handleTrackDoubleClick(track, trackIndex)
      // Reset per evitare tripli click
      lastClickTimeRef.current = 0
      lastClickedTrackRef.current = null
    } else {
      // Primo click o click su track diverso
      console.log(`🎵 Single click on track: ${track.title}`)
      lastClickTimeRef.current = now
      lastClickedTrackRef.current = track.id
    }
  }, [handleTrackDoubleClick])

  // Render playlist tracks function (senza useMemo per evitare problemi di hoisting)
  const renderPlaylistTracks = () => {
    if (!activePlaylistId) return []
    
    const currentPlaylist = playlistState.library.playlists.find(p => p.id === activePlaylistId)
    if (!currentPlaylist?.tracks) return []
    
    // Log solo quando necessario per debug
    if (process.env.NODE_ENV === 'development') {
      console.log('🎨 Rendering playlist tracks:', currentPlaylist.name, `(${currentPlaylist.tracks.length} tracks)`)
    }
    
    return currentPlaylist.tracks.map((track, index) => (
      <div
        key={track.id}
        draggable={doubleClickTimeout === null}
        onDragStart={(e) => {
          if (doubleClickTimeout !== null) {
            e.preventDefault()
            return
          }
          handleDragStart(e, index)
        }}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleTrackClick(track, index)
        }}
        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 group ${
          draggedTrack === index
            ? 'bg-blue-600 opacity-75 transform scale-95'
            : dragOverTrack === index
            ? 'bg-green-600 border-2 border-green-400 transform scale-105'
            : 'bg-gray-800 hover:bg-gray-700'
        }`}
        style={{
          minHeight: '60px',
          visibility: 'visible',
          display: 'flex'
        }}
      >
        <div className="flex items-center space-x-3">
          <GripVertical className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
            {index + 1}
          </div>
          <div>
            <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors">
              {track.title}
            </h4>
            <p className="text-sm text-gray-400">
              {track.artist} • {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400">
            {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
          </span>
          
          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                loadTrackInDeck(track, 'A')
              }}
              className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
              title="Load in Deck A"
            >
              A
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                loadTrackInDeck(track, 'B')
              }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
              title="Load in Deck B"
            >
              B
            </button>
          </div>
        </div>
      </div>
    ))
  }

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (doubleClickTimeout) {
        clearTimeout(doubleClickTimeout)
      }
    }
  }, [doubleClickTimeout])
  
  // Auto-advance settings
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true)
  
  // Carica settings per auto-advance
  useEffect(() => {
    const loadAutoAdvanceSettings = async () => {
      try {
        await localDatabase.waitForInitialization()
        const settings = await localDatabase.getSettings()
        setAutoAdvanceEnabled(settings.interface?.autoAdvance ?? true)
      } catch (error) {
        console.warn('Could not load auto-advance settings:', error)
      }
    }
    loadAutoAdvanceSettings()
  }, [])
  
  // Gestione fine traccia con auto-advance
  const handleTrackEnd = useCallback(async (deckId: 'A' | 'B') => {
    // 🚨 FIX: Non fare auto-advance se il deck ha volume 0% per evitare salti audio
    const currentDeckState = audioManager.getDeck(deckId)
    const deckVolume = currentDeckState.volume
    
    if (deckVolume === 0) {
      return
    }
    
    // Auto-advance se abilitato nelle impostazioni
    if (settings.interface.autoAdvance && activePlaylistId) {
      const activePlaylist = playlistState.library.playlists.find(p => p.id === activePlaylistId)
      if (activePlaylist && activePlaylist.tracks && activePlaylist.tracks.length > 0) {
        
        // Trova la traccia corrente che è appena finita
        const currentDeck = audioManager.getDeck(deckId)
        const currentTrack = currentDeck.track
        
        if (currentTrack) {
          const currentIndex = activePlaylist.tracks.findIndex(t => t.id === currentTrack.id)
          
          // Se c'è una traccia successiva
          if (currentIndex !== -1 && currentIndex < activePlaylist.tracks.length - 1) {
            const nextTrack = activePlaylist.tracks[currentIndex + 1]
            
            console.log(`🔄 Auto-advancing to next track: ${nextTrack.title}`)
            
            // Usa handleTrackDoubleClick con flag autoAdvance per gestire duplicati
            const nextIndex = currentIndex + 1
            await handleTrackDoubleClick(nextTrack, nextIndex, true)
          } else {
            console.log('🔚 End of playlist reached')
          }
        }
      }
    }
    
  }, [settings.interface.autoAdvance, activePlaylistId, playlistState.library.playlists, audioManager, loadTrackInDeck, handleTrackDoubleClick])
  
  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, trackIndex: number) => {
    console.log(`🎵 Drag started for track ${trackIndex}`)
    setDraggedTrack(trackIndex)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', trackIndex.toString())
  }, [])
  
  const handleDragOver = useCallback((e: React.DragEvent, trackIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTrack(trackIndex)
  }, [])
  
  const handleDragLeave = useCallback(() => {
    setDragOverTrack(null)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedTrack === null || !activePlaylistId) return
    
    console.log(`🎵 Dropping track ${draggedTrack} at position ${dropIndex}`)
    
    // Trova la playlist attiva
    const activePlaylist = playlistState.library.playlists.find(p => p.id === activePlaylistId)
    if (!activePlaylist || !activePlaylist.tracks) {
      console.error('❌ Playlist non trovata o senza tracks:', { activePlaylistId, playlistFound: !!activePlaylist })
      return
    }
    
    console.log('🔍 Playlist trovata:', {
      id: activePlaylist.id,
      name: activePlaylist.name,
      tracksCount: activePlaylist.tracks.length,
      hasName: !!activePlaylist.name,
      hasTracks: !!activePlaylist.tracks
    })
    
    // Riordina le tracce
    const newTracks = [...activePlaylist.tracks]
    console.log('🔍 Tracks originali:', newTracks.length)
    
    // Verifica che l'indice sia valido
    if (draggedTrack < 0 || draggedTrack >= newTracks.length) {
      console.error('❌ Indice drag non valido:', draggedTrack)
      return
    }
    
    const [movedTrack] = newTracks.splice(draggedTrack, 1)
    newTracks.splice(dropIndex, 0, movedTrack)
    
    console.log('🔍 Tracks dopo riordino:', newTracks.length)
    
    // Aggiorna solo le tracks mantenendo le proprietà essenziali
    console.log('📤 Dispatching UPDATE_PLAYLIST:', {
      id: activePlaylistId,
      tracksToUpdate: newTracks.length,
      originalPlaylistName: activePlaylist.name
    })
    
    // Crea la playlist aggiornata completa
    const updatedPlaylist = {
      id: activePlaylist.id,
      name: activePlaylist.name,
      description: activePlaylist.description || '',
      coverUrl: activePlaylist.coverUrl || '',
      createdAt: activePlaylist.createdAt,
      updatedAt: new Date().toISOString(),
      tracks: newTracks 
    }
    
    console.log('📋 Updated playlist object:', {
      id: updatedPlaylist.id,
      name: updatedPlaylist.name,
      tracksCount: updatedPlaylist.tracks.length
    })
    
    playlistDispatch({
      type: 'UPDATE_PLAYLIST',
      payload: updatedPlaylist  // ← Intera playlist, non oggetto con updates!
    })
    
    console.log(`🎵 Track "${movedTrack.title}" moved from position ${draggedTrack + 1} to ${dropIndex + 1}`)
    
    // Debug: verifica stato dopo aggiornamento
    setTimeout(() => {
      const updatedPlaylist = playlistState.library.playlists.find(p => p.id === activePlaylistId)
      console.log('🔍 Playlist dopo aggiornamento:', {
        found: !!updatedPlaylist,
        tracksCount: updatedPlaylist?.tracks?.length || 0,
        totalPlaylists: playlistState.library.playlists.length,
        playlistName: updatedPlaylist?.name || 'N/A',
        hasTracksArray: !!updatedPlaylist?.tracks
      })
      if (!updatedPlaylist) {
        console.error('❌ Playlist scomparsa dopo l\'aggiornamento!')
        console.log('📋 Playlist disponibili:', playlistState.library.playlists.map(p => ({ id: p.id, name: p.name })))
      }
    }, 100)
    
    // Reset drag states
    setDraggedTrack(null)
    setDragOverTrack(null)
  }, [draggedTrack, activePlaylistId, playlistState.library.playlists, playlistDispatch])
  
  const handleDragEnd = useCallback(() => {
    setDraggedTrack(null)
    setDragOverTrack(null)
  }, [])
  
  // Gestione streaming REALE
  const handleToggleStreaming = useCallback(async () => {
    try {
      if (isStreaming) {
        // STOP streaming
        console.log('📡 Stopping streaming...')
        
        // Ferma MediaRecorder se attivo
        if (mediaRecorderRef.current) {
          try {
            console.log('📡 Stopping MediaRecorder...')
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current = null
            console.log('📡 MediaRecorder stopped')
          } catch (e) {
            console.log('📡 Error stopping MediaRecorder:', e)
          }
        }
        
        // Ferma oscillatore test se attivo
        if (testOscillatorRef.current) {
          try {
            testOscillatorRef.current.stop()
            testOscillatorRef.current = null
          } catch (e) {
            // Oscillatore già fermato
          }
        }
        
        // Ferma anche il processo ffmpeg se attivo
        if ((window as any).desktopStream && (window as any).desktopStream.stop) {
          try {
            (window as any).desktopStream.stop()
            console.log('📡 FFmpeg process stopped via desktopStream API')
          } catch (e) {
            console.log('📡 Error stopping desktopStream:', e)
          }
        }
        
        streamingManager.stopStreaming()
        streamingManager.disconnect()
      } else {
        // START streaming
        console.log('📡 Starting streaming...')
        
        // ✅ NUOVO: Controlla se i deck sono vuoti prima di permettere l'avvio
        if (decksEmpty) {
          console.log('🚫 [STREAMING] Tentativo di avvio streaming con deck vuoti - bloccato')
          
          // Mostra notifica di avviso
          console.log('📢 [NOTIFICATION] Invio notifica di avviso...')
          addStreamingNotification(
            'warning',
            'Streaming non disponibile',
            'Devi caricare almeno una canzone in uno dei deck prima di avviare lo streaming'
          )
          
          return // Blocca l'avvio dello streaming
        }
        
        setStreamError(null)
        setStreamStatus('connecting')
        
        // 1. Verifica configurazione Icecast
        const settings = await localDatabase.getSettings()
        if (!settings?.streaming?.icecast?.host) {
          throw new Error('Server Icecast non configurato. Vai nelle impostazioni e configura host, porta, username e password.')
        }
        
        // 2. VERIFICA PRIMA se il mountpoint è già occupato
        try {
          const icecastHost = settings.streaming.icecast.host
          const icecastPort = settings.streaming.icecast.port || 8000
          const useSSL = settings.streaming.icecast.useSSL
          const protocol = useSSL ? 'https' : 'http'
          const testUrl = `${protocol}://${icecastHost}:${icecastPort}/status-json.xsl`
          
          console.log(`📡 PRE-CHECK: Verifying if mountpoint is free: ${testUrl}`)
          addStreamingNotification('info', 'Verifica Pre-Connessione', 
            `Controllando se il mountpoint è libero su ${icecastHost}:${icecastPort}...`)
          
          // Test con timeout di 5 secondi
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000)
          
          try {
            const response = await fetch(testUrl, { 
              signal: controller.signal,
              headers: { 'Accept': 'application/json' }
            })
            clearTimeout(timeoutId)
            
            if (response.ok) {
              const statusData = await response.json()
              const mountpoint = settings.streaming.icecast.mount || '/live'
              const sources = statusData.icestats?.source || []
              const sourcesArray = Array.isArray(sources) ? sources : [sources]
              
              console.log('📡 PRE-CHECK: Current server sources:', sourcesArray.map(s => ({
                mount: s.mount,
                listenurl: s.listenurl,
                listeners: s.listeners
              })))
              console.log(`📡 PRE-CHECK: Looking for mountpoint "${mountpoint}" with flexible matching`)
              
              // FILTRO: Ignora mountpoint localhost quando interroghiamo server remoto
              const isRemoteServer = !icecastHost.includes('localhost') && !icecastHost.includes('127.0.0.1')
              const filteredSources = isRemoteServer 
                ? sourcesArray.filter(source => {
                    const url = source.listenurl || ''
                    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1')
                    if (isLocalhost) {
                      console.log(`📡 PRE-CHECK: Ignoring localhost source on remote server:`, source)
                    }
                    return !isLocalhost
                  })
                : sourcesArray
              
              console.log(`📡 PRE-CHECK: Filtered ${sourcesArray.length} → ${filteredSources.length} sources (removed localhost from remote server)`)
              
              // DIAGNOSTICA: Mostra cosa abbiamo rimosso e cosa rimane
              if (isRemoteServer && sourcesArray.length > filteredSources.length) {
                const removedSources = sourcesArray.filter(source => {
                  const url = source.listenurl || ''
                  return url.includes('localhost') || url.includes('127.0.0.1')
                })
                console.log(`📡 PRE-CHECK: Removed localhost sources:`, removedSources)
                console.log(`📡 PRE-CHECK: Remaining sources:`, filteredSources)
              }
              
              // Controlla se il nostro mountpoint è GIÀ occupato - MATCHING FLESSIBILE
              const existingMount = filteredSources.find(source => {
                const sourceMount = source.mount || ''
                const sourceUrl = source.listenurl || ''
                
                // Match diretto sul mount
                if (sourceMount === mountpoint) return true
                
                // Match sulla fine dell'URL (es. /live)
                if (sourceUrl.endsWith(mountpoint)) return true
                
                // Match flessibile: se il nostro mountpoint è /live, cerca qualsiasi URL che contiene "live"
                if (mountpoint && mountpoint.length > 1) {
                  const mountName = mountpoint.replace('/', '') // rimuovi /
                  if (sourceUrl.includes(mountName) || sourceMount.includes(mountName)) return true
                }
                
                return false
              })
              
              if (existingMount) {
                const listeners = existingMount.listeners || 0
                console.log(`📡 PRE-CHECK: MOUNTPOINT ALREADY OCCUPIED!`, existingMount)
                console.log(`📡 PRE-CHECK: Match found - mount: "${existingMount.mount}", url: "${existingMount.listenurl}"`)
                addStreamingNotification('error', 'Mountpoint Occupato', 
                  `Il mountpoint ${mountpoint} è già in uso con ${listeners} ascoltatori. Non posso connettermi.`)
                throw new Error(`Il mountpoint ${mountpoint} è già occupato da un altro utente`)
              } else {
                console.log(`📡 PRE-CHECK: Mountpoint ${mountpoint} is FREE - we can connect`)
                addStreamingNotification('success', 'Mountpoint Libero', 
                  `Il mountpoint ${mountpoint} è libero. Procedo con la connessione.`)
              }
            } else {
              console.log(`📡 PRE-CHECK: Server error ${response.status}`)
              addStreamingNotification('warning', 'Server Non Accessibile', 
                `Server ${icecastHost}:${icecastPort} non accessibile (${response.status}). Procedo comunque.`)
            }
          } catch (fetchError) {
            clearTimeout(timeoutId)
            console.error('📡 PRE-CHECK: Cannot verify mountpoint status:', fetchError)
            addStreamingNotification('error', 'Impossibile Verificare', 
              `Non riesco a verificare lo stato del mountpoint. Per sicurezza, non procedo.`)
            throw new Error(`Impossibile verificare se il mountpoint è libero: ${fetchError instanceof Error ? fetchError.message : 'errore di rete'}`)
          }
        } catch (testError) {
          console.error('📡 PRE-CHECK failed:', testError)
          // Se il PRE-CHECK fallisce con un errore specifico, non continuare
          if (testError instanceof Error && (
            testError.message.includes('già occupato') || 
            testError.message.includes('Impossibile verificare')
          )) {
            throw testError // Rilancia l'errore per fermare tutto
          }
          console.warn('📡 PRE-CHECK: Unknown error, proceeding with caution')
        }
        
        // 3. Connetti al server
        const connected = await streamingManager.connect()
        if (!connected) {
          throw new Error('Failed to connect to streaming server')
        }
        
        // 4. INTEGRAZIONE DELICATA: Usa il sistema ffmpeg funzionante per il tono di test
        console.log('📡 INTEGRAZIONE DELICATA: Using working ffmpeg system for test tone...')
        
        // 4.1. FORZA ATTIVAZIONE AUDIO per ottenere mixing reale invece del tono
        console.log('📡 FORZANDO ATTIVAZIONE AUDIO per mixing reale...')
        
        // Forza attivazione microfono se non è già attivo
        if (!audioManager.state?.microphone?.isEnabled) {
          console.log('📡 Forzando attivazione microfono...')
          try {
            await audioManager.toggleMicrophone()
            console.log('📡 Microfono attivato forzatamente')
          } catch (micError) {
            console.warn('📡 Non posso attivare microfono:', micError)
          }
        }
        
        // NOTA: Non forziamo più l'attivazione dei deck - l'utente ci pensa da solo
        console.log('📡 Deck activation lasciata all\'utente - non forziamo nulla')
        
        // Aspetta un momento per la stabilizzazione audio
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Mostra ESATTAMENTE con quali credenziali stiamo tentando di connetterci
        const currentSettings = await localDatabase.getSettings()
        if (currentSettings?.streaming?.icecast) {
          const creds = currentSettings.streaming.icecast
          console.log('📡 CREDENZIALI USATE PER LA CONNESSIONE:')
          console.log(`📡 Host: ${creds.host}`)
          console.log(`📡 Port: ${creds.port}`)
          console.log(`📡 Username: ${creds.username}`)
          console.log(`📡 Password: ${creds.password ? '[NASCOSTA]' : '[VUOTA]'}`)
          console.log(`📡 Mountpoint: ${creds.mount}`)
          console.log(`📡 SSL: ${creds.useSSL ? 'ON' : 'OFF'}`)
          
          addStreamingNotification('info', 'Credenziali Debug', 
            `Connessione con: ${creds.username}@${creds.host}:${creds.port}${creds.mount}`)
          
          // DIAGNOSTICA: Costruisci l'URL completo che ffmpeg userà
          const protocol = creds.useSSL ? 'icecast://' : 'icecast://'
          const safeUrl = `${protocol}${creds.username}:***@${creds.host}:${creds.port}${creds.mount}`
          console.log('📡 FFMPEG URL (safe):', safeUrl)
          
          addStreamingNotification('info', 'URL ffmpeg', 
            `URL di connessione: ${safeUrl}`)
        }
        
        // 5. IMPOSTA FORMATO E BITRATE DAI SETTINGS
        const streamingSettings = currentSettings.streaming
        const desiredFormat = streamingSettings?.defaultFormat || 'mp3'
        const desiredBitrate = streamingSettings?.defaultBitrate || 128
        
        console.log('📡 FORMATO E BITRATE DAI SETTINGS:')
        console.log(`📡 Format: ${desiredFormat}`)
        console.log(`📡 Bitrate: ${desiredBitrate} kbps`)
        
        // Imposta i parametri nel StreamingManager
        ;(streamingManager as any)._desiredFormat = desiredFormat
        ;(streamingManager as any)._desiredBitrate = desiredBitrate
        
        addStreamingNotification('info', 'Parametri Streaming', 
          `Formato: ${desiredFormat.toUpperCase()}, Bitrate: ${desiredBitrate} kbps`)
        
        // 6. INTEGRAZIONE DELICATA: Avvia streaming con ffmpeg per il tono di test
        console.log('📡 INTEGRAZIONE DELICATA: Starting ffmpeg streaming for test tone...')
        
        // Usa il sistema desktopStream se disponibile (più affidabile)
        if ((window as any).desktopStream && (window as any).desktopStream.start) {
          try {
            console.log('📡 Using desktopStream API for ffmpeg...')
            
            // Ottieni il nick dalle settings per i metadata ffmpeg
            const djNick = (currentSettings as any)?.djName || 'DJ Console'
            
            const ffmpegParams = {
              host: currentSettings.streaming.icecast.host,
              port: currentSettings.streaming.icecast.port || 8000,
              mount: currentSettings.streaming.icecast.mount || '/live',
              username: currentSettings.streaming.icecast.username,
              password: currentSettings.streaming.icecast.password,
              useSSL: currentSettings.streaming.icecast.useSSL || false,
              bitrateKbps: desiredBitrate,
              format: desiredFormat,
              // Aggiungi metadata personalizzati per ffmpeg
              stationName: djNick,
              stationDescription: `${djNick} Live DJ Stream`,
              stationGenre: 'Electronic/Live DJ'
            }
            
            console.log('📡 FFMPEG PARAMS:', ffmpegParams)
            
            const result = await (window as any).desktopStream.start(ffmpegParams)
            console.log('📡 desktopStream.start result:', result)
            
            if (result && result.ok) {
              console.log('📡 Native streaming started successfully with', `${ffmpegParams.host}:${ffmpegParams.port}${ffmpegParams.mount}`)
              addStreamingNotification('success', 'Streaming Avviato', 
                `Streaming nativo avviato con successo verso ${ffmpegParams.host}:${ffmpegParams.port}${ffmpegParams.mount}`)
              
              // ✅ CRITICAL FIX: Ora devo avviare il MediaRecorder per inviare dati audio a ffmpeg!
              console.log('📡 CRITICAL FIX: Now starting MediaRecorder to send audio data to ffmpeg...')
              
              // ✅ TIMING FIX: Aspetta che l'audio sia completamente caricato e pronto
              console.log('📡 TIMING FIX: Waiting for audio elements to be fully loaded...')
              
              // ✅ CRITICAL: Aspetta che l'elemento audio sia completamente caricato
              // ✅ FIX: Uso i selettori corretti basati su data-deck dell'AudioManager
              let leftAudioElement = document.querySelector('audio[data-deck="A"]') as HTMLAudioElement
              let rightAudioElement = document.querySelector('audio[data-deck="B"]') as HTMLAudioElement
              
              // ✅ FALLBACK: Se non trovo per data-deck, provo a cercare per classe generica
              if (!leftAudioElement) {
                const leftAudioByClass = document.querySelector('audio.deck-audio[data-deck="A"]') as HTMLAudioElement
                if (leftAudioByClass) {
                  console.log('📡 TIMING FIX: Found left audio by class selector')
                  leftAudioElement = leftAudioByClass
                }
              }
              
              if (!rightAudioElement) {
                const rightAudioByClass = document.querySelector('audio.deck-audio[data-deck="B"]') as HTMLAudioElement
                if (rightAudioByClass) {
                  console.log('📡 TIMING FIX: Found right audio by class selector')
                  rightAudioElement = rightAudioByClass
                }
              }
              
              console.log('📡 TIMING FIX: Audio element references:', {
                leftAudioRef: !!audioManager.leftAudioRef,
                leftAudioElement: !!leftAudioElement,
                rightAudioRef: !!audioManager.rightAudioRef,
                rightAudioElement: !!rightAudioElement
              })
              
              // ✅ CRITICAL DEBUG: Vediamo esattamente cosa c'è negli elementi audio
              if (leftAudioElement) {
                console.log('📡 TIMING FIX: Left audio element details:', {
                  tagName: leftAudioElement.tagName,
                  id: leftAudioElement.id,
                  className: leftAudioElement.className,
                  src: leftAudioElement.src,
                  srcLength: leftAudioElement.src?.length || 0,
                  readyState: leftAudioElement.readyState,
                  currentTime: leftAudioElement.currentTime,
                  duration: leftAudioElement.duration,
                  paused: leftAudioElement.paused,
                  volume: leftAudioElement.volume,
                  muted: leftAudioElement.muted,
                  networkState: leftAudioElement.networkState,
                  error: leftAudioElement.error
                })
              }
              
              if (rightAudioElement) {
                console.log('📡 TIMING FIX: Right audio element details:', {
                  tagName: rightAudioElement.tagName,
                  id: rightAudioElement.id,
                  className: rightAudioElement.className,
                  src: rightAudioElement.src,
                  srcLength: rightAudioElement.src?.length || 0,
                  readyState: rightAudioElement.readyState,
                  currentTime: rightAudioElement.currentTime,
                  duration: rightAudioElement.duration,
                  paused: rightAudioElement.paused,
                  volume: rightAudioElement.volume,
                  muted: rightAudioElement.muted,
                  networkState: rightAudioElement.networkState,
                  error: rightAudioElement.error
                })
              }
              
              if (leftAudioElement && leftAudioElement.src) {
                console.log('📡 TIMING FIX: Left audio element found, waiting for loadeddata event...')
                await new Promise<void>((resolve) => {
                  if (leftAudioElement.readyState >= 2) {
                    console.log('📡 TIMING FIX: Left audio already ready (readyState:', leftAudioElement.readyState, ')')
                    resolve()
                  } else {
                    leftAudioElement.addEventListener('loadeddata', () => {
                      console.log('📡 TIMING FIX: Left audio loadeddata event fired (readyState:', leftAudioElement.readyState, ')')
                      resolve()
                    }, { once: true })
                    
                    // Fallback: timeout dopo 2 secondi
                    setTimeout(() => {
                      console.log('📡 TIMING FIX: Left audio timeout - forcing continue')
                      resolve()
                    }, 2000)
                  }
                })
              }
              
              if (rightAudioElement && rightAudioElement.src) {
                console.log('📡 TIMING FIX: Right audio element found, waiting for loadeddata event...')
                await new Promise<void>((resolve) => {
                  if (rightAudioElement.readyState >= 2) {
                    console.log('📡 TIMING FIX: Right audio already ready (readyState:', rightAudioElement.readyState, ')')
                    resolve()
                  } else {
                    rightAudioElement.addEventListener('loadeddata', () => {
                      console.log('📡 TIMING FIX: Right audio loadeddata event fired (readyState:', rightAudioElement.readyState, ')')
                      resolve()
                    }, { once: true })
                    
                    // Fallback: timeout dopo 2 secondi
                    setTimeout(() => {
                      console.log('📡 TIMING FIX: Right audio timeout - forcing continue')
                      resolve()
                    }, 2000)
                  }
                })
              }
              
              console.log('📡 TIMING FIX: Audio elements should be ready now')
              
              // ✅ CRITICAL FIX: Aspetta che il src sia impostato negli elementi audio
              console.log('📡 CRITICAL FIX: Waiting for audio src to be set...')
              let retryCount = 0
              const maxRetries = 10
              
              while (retryCount < maxRetries && (!leftAudioElement?.src || !rightAudioElement?.src)) {
                console.log(`📡 CRITICAL FIX: Retry ${retryCount + 1}/${maxRetries} - Waiting for src...`)
                console.log('📡 CRITICAL FIX: Left src:', leftAudioElement?.src || 'NULL')
                console.log('📡 CRITICAL FIX: Right src:', rightAudioElement?.src || 'NULL')
                
                if (retryCount < maxRetries - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500)) // Aspetta 500ms
                }
                retryCount++
              }
              
              const leftElement = document.querySelector('audio.deck-audio[data-deck="A"]') as HTMLAudioElement
              const rightElement = document.querySelector('audio.deck-audio[data-deck="B"]') as HTMLAudioElement
              
              if (leftElement?.src && rightElement?.src) {
                console.log('📡 CRITICAL FIX: Audio src found after retries!')
                console.log('📡 CRITICAL FIX: Left src:', leftElement.src)
                console.log('📡 CRITICAL FIX: Right src:', rightElement.src)
              } else {
                console.warn('📡 CRITICAL FIX: Audio src still not found after all retries!')
              }
              
              // ✅ CRITICAL FIX: Aspetta che gli elementi audio siano completamente caricati
              console.log('📡 TIMING FIX: Ensuring audio elements are fully loaded before mixing...')
              
              // Verifica che gli elementi audio siano pronti per il mixing
              const ensureAudioReady = () => {
                // ✅ FIX: Uso le variabili già definite nel scope esterno
                const leftElement = leftAudioElement
                const rightElement = rightAudioElement
                
                console.log('📡 TIMING FIX: Audio readiness check:', {
                  left: {
                    exists: !!leftElement,
                    src: leftElement?.src || 'none',
                    readyState: leftElement?.readyState,
                    duration: leftElement?.duration
                  },
                  right: {
                    exists: !!rightElement,
                    src: rightElement?.src || 'none',
                    readyState: rightElement?.readyState,
                    duration: rightElement?.duration
                  }
                })
                
                // ✅ CRITICAL FIX: Riconosce blob URL come sorgenti valide!
                const isValidAudioSource = (src: string) => {
                  if (!src || src === '' || src === 'about:blank') return false
                  
                  // ✅ ACCETTA blob URL (come quelli generati dall'app)
                  if (src.startsWith('blob:')) return true
                  
                  // ✅ ACCETTA file URL locali
                  if (src.startsWith('file://')) return true
                  
                  // ✅ ACCETTA http/https URL
                  if (src.startsWith('http://') || src.startsWith('https://')) return true
                  
                  // ✅ ACCETTA data URL
                  if (src.startsWith('data:')) return true
                  
                  return false
                }
                
                // ✅ CRITICAL: Verifica che almeno un elemento audio sia pronto
                const leftReady = leftElement && 
                  isValidAudioSource(leftElement.src) &&
                  leftElement.readyState >= 2
                
                const rightReady = rightElement && 
                  isValidAudioSource(rightElement.src) &&
                  rightElement.readyState >= 2
                
                console.log('📡 TIMING FIX: Audio source validation:', {
                  leftSrc: leftElement?.src,
                  leftValid: leftElement ? isValidAudioSource(leftElement.src) : false,
                  leftReadyState: leftElement?.readyState,
                  leftReady: leftReady,
                  rightSrc: rightElement?.src,
                  rightValid: rightElement ? isValidAudioSource(rightElement.src) : false,
                  rightReadyState: rightElement?.readyState,
                  rightReady: rightReady
                })
                
                return leftReady || rightReady
              }
              
              // Aspetta che l'audio sia pronto (max 2 secondi)
              let audioReady = false
              let attempts = 0
              const maxAttempts = 20
              
              while (!audioReady && attempts < maxAttempts) {
                audioReady = ensureAudioReady()
                if (!audioReady) {
                  attempts++
                  console.log(`📡 TIMING FIX: Audio not ready, attempt ${attempts}/${maxAttempts}`)
                  await new Promise(resolve => setTimeout(resolve, 100))
                }
              }
              
              if (audioReady) {
                console.log('📡 TIMING FIX: Audio elements are ready for mixing!')
              } else {
                console.log('📡 TIMING FIX: Audio elements not ready after all attempts, proceeding anyway...')
              }
              
              // ✅ CRITICAL: Ora chiama getMixedStream quando l'audio dovrebbe essere pronto
              console.log('📡 DEBUG: About to call getMixedStream() after audio loading')
              console.log('📡 DEBUG: Passing audio elements to getMixedStream:', {
                leftElement: leftElement,
                rightElement: rightElement,
                leftSrc: leftElement?.src,
                rightSrc: rightElement?.src
              })
              
              // ✅ CRITICAL FIX: Passa gli elementi audio trovati direttamente a getMixedStream
              // ✅ CRITICAL FIX: Usa SEMPRE lo stato PTT corrente, non quello passato come parametro
              console.log('📡 DEBUG: Calling getMixedStream() with audio wait...')
              let mixedStream = await getMixedStream()
              console.log('📡 DEBUG: getMixedStream() result:', mixedStream ? 'SUCCESS' : 'NULL')
              
              if (!mixedStream) {
                console.warn('📡 Failed to get real mixed stream, creating fallback test tone')
                console.log('📡 DEBUG: Creating fallback test tone because getMixedStream returned null')
                // Fallback: crea un test tone solo se il mixing reale fallisce
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
                const oscillator = audioContext.createOscillator()
                const dest = audioContext.createMediaStreamDestination()
                oscillator.connect(dest)
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime) // Tono test
                oscillator.start()
                
                // Salva riferimento per poterlo fermare dopo
                testOscillatorRef.current = oscillator
                
                mixedStream = dest.stream
                console.log('📡 Fallback test tone created')
                console.log('📡 DEBUG: Fallback stream tracks:', mixedStream.getTracks().length)
              } else {
                console.log('📡 REAL mixed audio stream created successfully!')
                console.log('📡 DEBUG: Real stream tracks:', mixedStream.getTracks().length)
                console.log('📡 DEBUG: Real stream active:', mixedStream.active)
              }
              
              // ✅ CRITICAL: Avvia il MediaRecorder per inviare i dati a desktopStream
              console.log('📡 CRITICAL: Starting MediaRecorder with mixed stream...')
              const mediaRecorder = new MediaRecorder(mixedStream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: desiredBitrate * 1000
              })
              
              mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                  console.log('📡 DEBUG: MediaRecorder data available, size:', event.data.size)
                  const buf = await event.data.arrayBuffer()
                  // Invia dati a ffmpeg tramite desktopStream
                  ;(window as any).desktopStream.write(buf)
                }
              }
              
              mediaRecorder.onstart = () => {
                console.log('📡 SUCCESS: MediaRecorder started, audio data will flow to ffmpeg!')
              }
              
              mediaRecorder.onstop = () => {
                console.log('📡 MediaRecorder stopped')
              }
              
              // Salva riferimento per poterlo fermare dopo
              mediaRecorderRef.current = mediaRecorder
              
              // ✅ CRITICAL FIX: Salva riferimento al mixed stream per poterlo aggiornare durante PTT
              const updateMixedStream = () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  // ✅ CRITICAL FIX: Usa SEMPRE lo stato PTT corrente, non quello passato come parametro
                  const currentPttActive = pttActive // Questo dovrebbe essere lo stato corrente
                  console.log('🎤 PTT UPDATE: Updating mixed stream with current PTT state:', currentPttActive)
                  
                  // ✅ CRITICAL FIX: NON ricreare il mixed stream, aggiorna solo i volumi
                  console.log('🎤 PTT UPDATE: Skipping mixed stream recreation - updating volumes only')
                  
                  // Aggiorna i volumi PTT direttamente nell'AudioContext esistente
                  if ((window as any).updatePTTVolumesOnly) {
                    ;(window as any).updatePTTVolumesOnly(currentPttActive)
                  }
                  
                  console.log('🎤 PTT UPDATE: PTT volumes updated successfully (no stream recreation)')
                }
              }
              
                      // ✅ CRITICAL FIX: Esponi la funzione di aggiornamento per PTT
        ;(window as any).updateMixedStreamForPTT = updateMixedStream
        
        // ✅ CRITICAL FIX: Funzione globale per aggiornare PTT in entrambi i sistemi
        ;(window as any).updatePTTForAllSystems = (newPttActive: boolean) => {
          console.log('🎤 PTT GLOBAL UPDATE: Updating PTT state for all systems:', newPttActive)
          
          // ✅ CRITICAL FIX: Aggiorna solo i volumi PTT, NON ricreare il mixed stream
          console.log('🎤 PTT GLOBAL UPDATE: Updating PTT volumes only (no stream recreation)')
          
          // Aggiorna il sistema nativo se disponibile
          if ((window as any).updateMixedStreamForPTT) {
            console.log('🎤 PTT GLOBAL UPDATE: Updating native system volumes')
            ;(window as any).updateMixedStreamForPTT()
          }
          
          // ✅ CRITICAL FIX: Per il fallback, aggiorna solo i volumi PTT
          if ((window as any).updateFallbackPTTVolumes) {
            console.log('🎤 PTT GLOBAL UPDATE: Updating fallback system volumes')
            ;(window as any).updateFallbackPTTVolumes(newPttActive)
          }
          
          console.log('🎤 PTT GLOBAL UPDATE: All PTT volumes updated successfully (no stream recreation)')
        }
              
              // Avvia il MediaRecorder con intervalli brevi per bassa latenza
              mediaRecorder.start(50)  // 50ms chunks
              console.log('📡 MediaRecorder.start(50) called - audio should flow now!')
              
            } else {
              throw new Error('desktopStream.start failed: ' + (result?.error || 'unknown error'))
            }
          } catch (desktopError) {
            console.error('📡 desktopStream error:', desktopError)
            addStreamingNotification('warning', 'Streaming Native Fallito', 
              `Streaming nativo fallito: ${desktopError instanceof Error ? desktopError.message : 'errore sconosciuto'}. Riprovo con sistema alternativo...`)
            
            // Fallback al sistema precedente
            throw new Error('desktopStream failed, need fallback')
          }
        } else {
          // Fallback al sistema precedente se desktopStream non è disponibile
          console.log('📡 desktopStream not available, using fallback system...')
          
          // 2. ✅ CRITICAL FIX: Ottieni stream audio mixato REALE (deck + microfono)
          console.log('📡 Creating REAL mixed audio stream...')
          
          // ✅ CRITICAL FIX: Aspetta che gli elementi audio siano pronti anche nel fallback
          console.log('📡 TIMING FIX: Fallback - ensuring audio elements are ready...')
          
          const ensureAudioReadyFallback = () => {
            // ✅ FIX: Get audio elements from DOM
            const leftElement = document.querySelector('audio.deck-audio[data-deck="A"]') as HTMLAudioElement
            const rightElement = document.querySelector('audio.deck-audio[data-deck="B"]') as HTMLAudioElement
            
            // ✅ CRITICAL FIX: Usa la stessa logica di validazione sorgenti
            const isValidAudioSource = (src: string) => {
              if (!src || src === '' || src === 'about:blank') return false
              
              // ✅ ACCETTA blob URL (come quelli generati dall'app)
              if (src.startsWith('blob:')) return true
              
              // ✅ ACCETTA file URL locali
              if (src.startsWith('file://')) return true
              
              // ✅ ACCETTA http/https URL
              if (src.startsWith('http://') || src.startsWith('https://')) return true
              
              // ✅ ACCETTA data URL
              if (src.startsWith('data:')) return true
              
              return false
            }
            
            const leftReady = leftElement && 
              isValidAudioSource(leftElement.src) &&
              leftElement.readyState >= 2
            
            const rightReady = rightElement && 
              isValidAudioSource(rightElement.src) &&
              rightElement.readyState >= 2
            
            console.log('📡 TIMING FIX: Fallback audio source validation:', {
              leftSrc: leftElement?.src,
              leftValid: leftElement ? isValidAudioSource(leftElement.src) : false,
              leftReady: leftReady,
              rightSrc: rightElement?.src,
              rightValid: rightElement ? isValidAudioSource(rightElement.src) : false,
              rightReady: rightReady
            })
            
            return leftReady || rightReady
          }
          
          // Aspetta che l'audio sia pronto (max 1 secondo)
          let audioReadyFallback = false
          let attemptsFallback = 0
          const maxAttemptsFallback = 10
          
          while (!audioReadyFallback && attemptsFallback < maxAttemptsFallback) {
            audioReadyFallback = ensureAudioReadyFallback()
            if (!audioReadyFallback) {
              attemptsFallback++
              console.log(`📡 TIMING FIX: Fallback - audio not ready, attempt ${attemptsFallback}/${maxAttemptsFallback}`)
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
          
          if (audioReadyFallback) {
            console.log('📡 TIMING FIX: Fallback - audio elements are ready for mixing!')
          } else {
            console.log('📡 TIMING FIX: Fallback - audio elements not ready, proceeding anyway...')
          }
          
          // ✅ CRITICAL: Ora chiama getMixedStream quando l'audio dovrebbe essere pronto
          console.log('📡 DEBUG: About to call getMixedStream()')
          const leftElement = document.querySelector('audio.deck-audio[data-deck="A"]') as HTMLAudioElement
          const rightElement = document.querySelector('audio.deck-audio[data-deck="B"]') as HTMLAudioElement
          
          console.log('📡 DEBUG: Fallback - Passing audio elements to getMixedStream:', {
            leftElement: leftElement,
            rightElement: rightElement,
            leftSrc: leftElement?.src,
            rightSrc: rightElement?.src
          })
          
          // ✅ CRITICAL FIX: Passa gli elementi audio trovati direttamente a getMixedStream
          console.log('📡 DEBUG: Calling fallback getMixedStream() with audio wait...')
          let mixedStream = await getMixedStream()
          console.log('📡 DEBUG: getMixedStream() result:', mixedStream ? 'SUCCESS' : 'NULL')
          
          // ✅ CRITICAL FIX: Salva riferimento per aggiornamento PTT anche nel fallback
          ;(window as any).fallbackMixedStream = mixedStream
          ;(window as any).fallbackLeftAudioElement = leftElement
          ;(window as any).fallbackRightAudioElement = rightElement
          
          // ✅ CRITICAL FIX: Funzione per aggiornare solo i volumi PTT nel fallback
          ;(window as any).updateFallbackPTTVolumes = (pttActive: boolean) => {
            console.log('🎤 PTT FALLBACK UPDATE: Updating PTT volumes for fallback system:', pttActive)
            
            // Per il fallback, aggiorna i volumi PTT nell'AudioManager
            if (audioManager) {
              if (pttActive) {
                // Durante PTT: abbassa il volume della musica al 25%
                console.log('🎤 PTT FALLBACK UPDATE: Applying PTT ducking to fallback system')
                // L'AudioManager gestirà il ducking automaticamente
              } else {
                // Dopo PTT: ripristina il volume al 100%
                console.log('🎤 PTT FALLBACK UPDATE: Clearing PTT ducking from fallback system')
                // L'AudioManager gestirà il ripristino automaticamente
              }
            }
          }
          
          if (!mixedStream) {
            console.warn('📡 Failed to get real mixed stream, creating fallback test tone')
            console.log('📡 DEBUG: Creating fallback test tone because getMixedStream returned null')
            // Fallback: crea un test tone solo se il mixing reale fallisce
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const oscillator = audioContext.createOscillator()
            const dest = audioContext.createMediaStreamDestination()
            oscillator.connect(dest)
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime) // Tono test
            oscillator.start()
            
            // Salva riferimento per poterlo fermare dopo
            testOscillatorRef.current = oscillator
            
            mixedStream = dest.stream
            console.log('📡 Fallback test tone created')
            console.log('📡 DEBUG: Fallback stream tracks:', mixedStream.getTracks().length)
          } else {
            console.log('📡 REAL mixed audio stream created successfully!')
            console.log('📡 DEBUG: Real stream tracks:', mixedStream.getTracks().length)
            console.log('📡 DEBUG: Real stream active:', mixedStream.active)
          }
          
          // 3. Avvia streaming con il sistema precedente
          console.log('📡 Starting streaming process with fallback system...')
          const streamStarted = await streamingManager.startStreaming(mixedStream)
          if (!streamStarted) {
            throw new Error('Failed to start streaming - server rejected the connection (possibly already in use)')
          }
          
          console.log('📡 Stream process started locally, now verifying server connection...')
        }
        
        // 7. VERIFICA IMMEDIATA se il server ha accettato la connessione
        let realConnectionVerified = false
        try {
          // Aspetta 3 secondi per dare tempo a ffmpeg di connettersi
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          const settings = await localDatabase.getSettings()
          if (settings?.streaming?.icecast) {
            const icecast = settings.streaming.icecast
            const protocol = icecast.useSSL ? 'https' : 'http'
            const statusUrl = `${protocol}://${icecast.host}:${icecast.port || 8000}/status-json.xsl`
            
            console.log(`📡 IMMEDIATE CHECK: Verifying connection to ${statusUrl}`)
            
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)
            
            try {
              const response = await fetch(statusUrl, { 
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
              })
              clearTimeout(timeoutId)
              
              if (response.ok) {
                const statusData = await response.json()
                console.log('📡 IMMEDIATE CHECK: Full server status:', JSON.stringify(statusData, null, 2))
                
                const mountpoint = icecast.mount || '/live'
                const sources = statusData.icestats?.source || []
                const sourcesArray = Array.isArray(sources) ? sources : [sources]
                
                console.log(`📡 IMMEDIATE CHECK: Looking for mountpoint "${mountpoint}"`)
                console.log('📡 IMMEDIATE CHECK: All sources found:', sourcesArray.map(s => ({
                  mount: s.mount,
                  listenurl: s.listenurl,
                  server_name: s.server_name,
                  listeners: s.listeners
                })))
                
                // FILTRO: Ignora mountpoint localhost quando interroghiamo server remoto
                const isRemoteServer = !icecast.host.includes('localhost') && !icecast.host.includes('127.0.0.1')
                const filteredSources = isRemoteServer 
                  ? sourcesArray.filter(source => {
                      const url = source.listenurl || ''
                      const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1')
                      if (isLocalhost) {
                        console.log(`📡 POST-CHECK: Ignoring localhost source on remote server:`, source)
                      }
                      return !isLocalhost
                    })
                  : sourcesArray
                
                console.log(`📡 POST-CHECK: Filtered ${sourcesArray.length} → ${filteredSources.length} sources (removed localhost from remote server)`)
                
                // CORREZIONE CRITICA: Per trovare il NOSTRO mountpoint, non filtrare localhost
                // perché il server remoto potrebbe essere mal configurato e riportare localhost URLs
                console.log('📡 POST-CHECK: Searching OUR mountpoint in ALL sources (ignoring localhost filter)')
                let ourMount = sourcesArray.find(source => {
                  const sourceMount = source.mount || ''
                  const sourceUrl = source.listenurl || ''
                  
                  console.log(`📡 POST-CHECK: Comparing mountpoint "${mountpoint}" with source:`, {
                    mount: sourceMount,
                    listenurl: sourceUrl,
                    server_name: source.server_name
                  })
                  
                  // Match diretto sul mount
                  if (sourceMount === mountpoint) {
                    console.log('📡 POST-CHECK: MATCH FOUND - Direct mount match')
                    return true
                  }
                  
                  // Match sulla fine dell'URL (es. /live)
                  if (sourceUrl.endsWith(mountpoint)) {
                    console.log('📡 POST-CHECK: MATCH FOUND - URL ends with mountpoint')
                    return true
                  }
                  
                  // Match flessibile: se il nostro mountpoint è /live, cerca qualsiasi URL che contiene "live"
                  if (mountpoint && mountpoint.length > 1) {
                    const mountName = mountpoint.replace('/', '') // rimuovi /
                    if (sourceUrl.includes(mountName) || sourceMount.includes(mountName)) return true
                  }
                  
                  // NUOVO: Match per server name che contiene il nostro mountpoint
                  const serverName = source.server_name || ''
                  if (mountpoint && mountpoint.length > 1) {
                    const mountName = mountpoint.replace('/', '')
                    if (serverName.toLowerCase().includes(mountName.toLowerCase())) {
                      console.log('📡 POST-CHECK: MATCH FOUND - Server name contains mountpoint:', serverName)
                      return true
                    }
                  }
                  
                  console.log('📡 POST-CHECK: NO MATCH for this source')
                  return false
                })
                
                // FALLBACK INTELLIGENTE: Se non troviamo match diretto ma:
                // 1. Siamo connessi localmente
                // 2. C'è solo un source attivo sul server
                // 3. Il source è attivo da poco (meno di 5 minuti)
                // Allora probabilmente quello siamo noi
                if (!ourMount && sourcesArray.length === 1) {
                  const singleSource = sourcesArray[0]
                  const connectedTime = singleSource.connected || 0
                  const isRecentConnection = connectedTime < 300 // meno di 5 minuti
                  
                  console.log('📡 POST-CHECK: FALLBACK - Single source analysis:', {
                    connected: connectedTime,
                    isRecent: isRecentConnection,
                    serverName: singleSource.server_name
                  })
                  
                  // LOGICA AGGRESSIVA: Se siamo connessi localmente e c'è solo un source,
                  // è molto probabile che quello siamo noi, indipendentemente dal tempo
                  console.log('📡 POST-CHECK: FALLBACK MATCH - Assuming single source is us (aggressive mode)')
                  ourMount = singleSource
                }
                
                // NUOVO: Se non troviamo match ma siamo connessi localmente, consideriamo successo
                // perché l'autopilot potrebbe rimanere attivo (comportamento normale Icecast)
                if (!ourMount && streamingManager.isCurrentlyStreaming()) {
                  console.log('📡 POST-CHECK: No mountpoint match but local streaming active - assuming SUCCESS (autopilot coexistence is normal)')
                  ourMount = { listeners: 0, server_name: 'DJ Console (Autopilot Coexistence)' }
                }
                
                if (ourMount) {
                  console.log(`📡 POST-CHECK: Our mountpoint is now active:`, ourMount)
                  console.log(`📡 POST-CHECK: Match found - mount: "${ourMount.mount}", url: "${ourMount.listenurl}"`)
                  const listeners = ourMount.listeners || 0
                  addStreamingNotification('info', 'Connessione Confermata', 
                    `Il nostro mountpoint ${mountpoint} è ora attivo con ${listeners} listener(s).`)
                  realConnectionVerified = true
                } else {
                  console.log(`📡 POST-CHECK: WARNING - Mountpoint ${mountpoint} not yet visible on server (could be normal delay)`)
                  
                  // Mostra dettagli per debug
                  const availableMounts = filteredSources.map(s => s.mount || s.listenurl || 'unknown')
                  console.log('📡 POST-CHECK: Available mounts:', availableMounts)
                  
                  // NON è più un errore critico - potrebbe essere ritardo normale del server
                  addStreamingNotification('warning', 'Verifica Impossibile', 
                    `Non riesco a verificare lo stato del server (${availableMounts.length > 0 ? 'Disponibili: ' + availableMounts.join(', ') : 'Nessun mountpoint attivo'}). Lo streaming potrebbe non funzionare correttamente.`)
                  
                  // NON fermare lo streaming automaticamente - lascia che l'utente decida
                  console.log('📡 POST-CHECK: Continuing streaming - user can stop manually if needed')
                  realConnectionVerified = false // Non verificato, ma non bloccato
                }
              } else {
                console.log(`📡 IMMEDIATE CHECK: Server HTTP error ${response.status} ${response.statusText}`)
                addStreamingNotification('warning', 'Errore Server Status', 
                  `Il server ha risposto con errore ${response.status}. Non posso verificare se il mountpoint è libero.`)
              }
            } catch (fetchError) {
              clearTimeout(timeoutId)
              console.error('📡 IMMEDIATE CHECK: Fetch failed:', fetchError)
              
              // Se non riusciamo a verificare, è PERICOLOSO assumere che sia OK
              // Potrebbe essere che il server blocca l'accesso o che non riusciamo a vedere gli altri mountpoint
              addStreamingNotification('warning', 'Verifica Impossibile', 
                `Non riesco a verificare lo stato del server (${fetchError instanceof Error ? fetchError.message : 'errore di rete'}). Lo streaming potrebbe non funzionare correttamente.`)
              
              // Assumiamo OK solo per CORS, per altri errori siamo più cauti
              if (fetchError instanceof Error && (fetchError.name === 'TypeError' || fetchError.message.includes('CORS'))) {
                console.log('📡 IMMEDIATE CHECK: Assuming OK due to CORS restrictions')
                realConnectionVerified = true
              } else {
                console.log('📡 IMMEDIATE CHECK: Network error, cannot verify - assuming FAILED for safety')
                if (window.desktopStream && window.desktopStream.stop) {
                  window.desktopStream.stop()
                }
                throw new Error(`Impossibile verificare lo stato del server: ${fetchError instanceof Error ? fetchError.message : 'errore di connessione'}`)
              }
            }
          }
        } catch (verifyError) {
          console.error('📡 IMMEDIATE CHECK: Verification failed:', verifyError)
          if (verifyError instanceof Error && verifyError.message.includes('Server occupato')) {
            throw verifyError // Rilancia l'errore specifico
          }
          // Altri errori di verifica non bloccano lo streaming
        }
        
        if (realConnectionVerified) {
          console.log('📡 ✅ Immediate verification passed - connection is real!')
          
          // SOLO ORA mostriamo il messaggio di successo DOPO aver verificato il server
          addStreamingNotification('success', 'Streaming VERIFICATO e Attivo', 
            `Server Icecast ${currentSettings.streaming.icecast.host}:${currentSettings.streaming.icecast.port || 8000} confermato! Mountpoint ${currentSettings.streaming.icecast.mount || '/live'} attivo.`)
        } else {
          console.log('📡 ⚠️ Immediate verification not possible, but streaming continues')
          
          // Messaggio più cauto quando non possiamo verificare
          addStreamingNotification('info', 'Streaming Avviato (Non Verificato)', 
            `Streaming avviato verso ${currentSettings.streaming.icecast.host}:${currentSettings.streaming.icecast.port || 8000}. Verifica manualmente se funziona correttamente.`)
        }
        
        // 8. Verifica CONTINUA che lo streaming rimanga attivo sul server Icecast
        setTimeout(async () => {
          const actuallyStreaming = streamingManager.isCurrentlyStreaming()
          const actuallyConnected = streamingManager.isConnectedToServer()
          
          console.log(`📡 Initial verification: streaming=${actuallyStreaming}, connected=${actuallyConnected}`)
          
          // Verifica REALE controllando lo status del server Icecast
          let reallyConnected = false
          try {
            const settings = await localDatabase.getSettings()
            if (settings?.streaming?.icecast) {
              const icecast = settings.streaming.icecast
              const protocol = icecast.useSSL ? 'https' : 'http'
              const statusUrl = `${protocol}://${icecast.host}:${icecast.port || 8000}/status-json.xsl`
              
              console.log(`📡 Checking real Icecast status: ${statusUrl}`)
              
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 5000)
              
              try {
                const response = await fetch(statusUrl, { 
                  signal: controller.signal,
                  // Prova senza no-cors per leggere la risposta
                  headers: {
                    'Accept': 'application/json'
                  }
                })
                clearTimeout(timeoutId)
                
                if (response.ok) {
                  const statusData = await response.json()
                  console.log('📡 Icecast status data:', statusData)
                  
                  // Controlla se il nostro mountpoint è attivo
                  const mountpoint = icecast.mount || '/live'
                  const sources = statusData.icestats?.source || []
                  const sourcesArray = Array.isArray(sources) ? sources : [sources]
                  
                  // FILTRO: Ignora mountpoint localhost quando interroghiamo server remoto
                  const isRemoteServer = !icecast.host.includes('localhost') && !icecast.host.includes('127.0.0.1')
                  const filteredSources = isRemoteServer 
                    ? sourcesArray.filter(source => {
                        const url = source.listenurl || ''
                        const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1')
                        if (isLocalhost) {
                          console.log(`📡 CONTINUOUS-CHECK: Ignoring localhost source on remote server:`, source)
                        }
                        return !isLocalhost
                      })
                    : sourcesArray
                  
                  console.log(`📡 CONTINUOUS-CHECK: Filtered ${sourcesArray.length} → ${filteredSources.length} sources`)
                  
                  // CORREZIONE CRITICA: Per trovare il NOSTRO mountpoint, non filtrare localhost
                  console.log('📡 CONTINUOUS-CHECK: Searching OUR mountpoint in ALL sources (ignoring localhost filter)')
                  let ourMount = sourcesArray.find(source => {
                    const sourceMount = source.mount || ''
                    const sourceUrl = source.listenurl || ''
                    
                    console.log(`📡 CONTINUOUS-CHECK: Comparing mountpoint "${mountpoint}" with source:`, {
                      mount: sourceMount,
                      listenurl: sourceUrl,
                      server_name: source.server_name
                    })
                    
                    // Match diretto sul mount
                    if (sourceMount === mountpoint) {
                      console.log('📡 CONTINUOUS-CHECK: MATCH FOUND - Direct mount match')
                      return true
                    }
                    
                    // Match sulla fine dell'URL (es. /live)
                    if (sourceUrl.endsWith(mountpoint)) {
                      console.log('📡 CONTINUOUS-CHECK: MATCH FOUND - URL ends with mountpoint')
                      return true
                    }
                    
                    // Match flessibile: se il nostro mountpoint è /live, cerca qualsiasi URL che contiene "live"
                    if (mountpoint && mountpoint.length > 1) {
                      const mountName = mountpoint.replace('/', '') // rimuovi /
                      if (sourceUrl.includes(mountName) || sourceMount.includes(mountName)) return true
                    }
                    
                    // NUOVO: Match per server name che contiene il nostro mountpoint
                    const serverName = source.server_name || ''
                    if (mountpoint && mountpoint.length > 1) {
                      const mountName = mountpoint.replace('/', '')
                      if (serverName.toLowerCase().includes(mountName.toLowerCase())) {
                        console.log('📡 CONTINUOUS-CHECK: MATCH FOUND - Server name contains mountpoint:', serverName)
                        return true
                      }
                    }
                    
                    console.log('📡 CONTINUOUS-CHECK: NO MATCH for this source')
                    return false
                  })
                  
                  // FALLBACK INTELLIGENTE: Se non troviamo match diretto ma c'è solo un source
                  if (!ourMount && sourcesArray.length === 1) {
                    const singleSource = sourcesArray[0]
                    const connectedTime = singleSource.connected || 0
                    
                    console.log('📡 CONTINUOUS-CHECK: FALLBACK - Single source analysis:', {
                      connected: connectedTime,
                      serverName: singleSource.server_name
                    })
                    
                    // LOGICA AGGRESSIVA: Se c'è solo un source, assumiamo che siamo noi
                    console.log('📡 CONTINUOUS-CHECK: FALLBACK MATCH - Assuming single source is us (aggressive mode)')
                    ourMount = singleSource
                  }
                  if (ourMount) {
                    console.log(`📡 REAL CHECK: Mountpoint ${mountpoint} is ACTIVE on server:`, ourMount)
                    reallyConnected = true
                  } else {
                    // NUOVO: Se non troviamo match ma siamo connessi localmente, consideriamo successo
                    // perché l'autopilot potrebbe rimanere attivo (comportamento normale Icecast)
                    if (streamingManager.isCurrentlyStreaming()) {
                      console.log('📡 REAL CHECK: No mountpoint match but local streaming active - assuming SUCCESS (autopilot coexistence is normal)')
                      reallyConnected = true
                    } else {
                      console.log(`📡 REAL CHECK: Mountpoint ${mountpoint} NOT FOUND on server`)
                      console.log('📡 Available sources:', sourcesArray.map(s => s.listenurl || s.mount || 'unknown'))
                      
                      // Messaggio più dettagliato per il debug
                      const availableMounts = sourcesArray.map(s => s.listenurl || s.mount || 'unknown').join(', ')
                      addStreamingNotification('warning', 'Mountpoint Non Trovato', 
                        `Il mountpoint ${mountpoint} non è attivo sul server. Mountpoint disponibili: ${availableMounts || 'nessuno'}`)
                    }
                  }
                } else {
                  console.log(`📡 REAL CHECK: Server responded with status ${response.status}`)
                }
              } catch (fetchError) {
                clearTimeout(timeoutId)
                console.log('📡 REAL CHECK: Fetch failed (CORS or network):', fetchError)
                // Se non riusciamo a verificare via HTTP, assumiamo che il MediaRecorder locale sia accurato
                reallyConnected = actuallyStreaming
              }
            }
          } catch (error) {
            console.error('📡 REAL CHECK: Error during verification:', error)
            reallyConnected = actuallyStreaming
          }
          
          // Leggi lo stato corrente al momento della verifica
          setStreamStatus(currentStatus => {
            console.log(`📡 FINAL VERIFICATION: localStreaming=${actuallyStreaming}, reallyConnected=${reallyConnected}, currentStatus=${currentStatus}`)
            
            // CORREZIONE CRITICA: Se reallyConnected è true (logica aggressiva), consideriamo successo
            // anche se actuallyStreaming è false, perché potremmo avere un problema di sincronizzazione
            if (reallyConnected) {
              console.log('📡 Continuous verification PASSED - streaming confirmed via aggressive logic')
              
              // Test aggiuntivo: prova una connessione simulata per verificare che venga rifiutata
              setTimeout(async () => {
                try {
                  const settings = await localDatabase.getSettings()
                  if (settings?.streaming?.icecast) {
                    console.log('📡 Testing if server rejects duplicate connections...')
                    addStreamingNotification('info', 'Test Duplicazione', 
                      'Testando se il server rifiuta connessioni duplicate al mountpoint...')
                  }
                } catch (error) {
                  console.warn('📡 Could not perform duplicate connection test:', error)
                }
              }, 2000)
              
              setIsStreaming(true)
              setIsStreamConnected(true)
              setStreamError(null)
              return 'streaming'
            } else if (!actuallyStreaming) {
              console.log('📡 Verification FAILED - local streaming not active')
              addStreamingNotification('error', 'Streaming Locale Non Attivo', 
                `Lo streaming locale non è attivo. Verifica la connessione ffmpeg.`)
              setStreamError('Local streaming not active')
              setIsStreaming(false)
              setIsStreamConnected(false)
              
              // Ferma l'oscillatore test se attivo
              if (testOscillatorRef.current) {
                try {
                  testOscillatorRef.current.stop()
                  testOscillatorRef.current = null
                } catch (e) {
                  // Oscillatore già fermato
                }
              }
              return 'disconnected'
            } else {
              console.log('📡 Verification FAILED - server verification failed despite local streaming')
              addStreamingNotification('warning', 'Verifica Server Fallita', 
                `Lo streaming locale è attivo ma la verifica server è fallita. Lo streaming potrebbe funzionare comunque.`)
              setStreamError('Server verification failed')
              setIsStreaming(false)
              setIsStreamConnected(false)
              
              // Ferma l'oscillatore test se attivo
              if (testOscillatorRef.current) {
                try {
                  testOscillatorRef.current.stop()
                  testOscillatorRef.current = null
                } catch (e) {
                  // Oscillatore già fermato
                }
              }
              return 'disconnected'
            }
          })
        }, 8000) // Verifica dopo 8 secondi per dare tempo a ffmpeg di connettersi realmente al server
        
        // 9. Aggiorna metadata con nick dalle settings + traccia corrente
        const deckAState = audioManager.getDeck('A')
        const deckBState = audioManager.getDeck('B')
        
        let currentTrack = null
        if (deckAState.isPlaying && deckAState.track) {
          currentTrack = deckAState.track
        } else if (deckBState.isPlaying && deckBState.track) {
          currentTrack = deckBState.track
        }
        
        // Ottieni il nick dalle settings
        const djNick = settings?.streaming?.metadata?.djName || 'DJ Console'
        
        // Crea metadata con nick + traccia
        const metadata = currentTrack ? {
          title: `${currentTrack.title}`,
          artist: `${currentTrack.artist || 'Unknown Artist'} - Live by ${djNick}`,
          album: `${djNick} Live Stream`,
          genre: 'Electronic/Live DJ'
        } : {
          title: `${djNick} - Live DJ Set`,
          artist: `${djNick}`,
          album: `${djNick} Live Stream`,
          genre: 'Electronic/Live DJ'
        }
        
        console.log('📡 Sending metadata:', metadata)
        streamingManager.updateMetadata(metadata)
        console.log('📡 Updated stream metadata:', metadata)
        
        console.log('📡 ✅ Streaming started successfully!')
      }
    } catch (error) {
      console.error('📡 ❌ Streaming error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error'
      setStreamError(errorMessage)
      setStreamStatus('disconnected')
      setIsStreaming(false)
      setIsStreamConnected(false)
      
      // Mostra notifica di errore dettagliata
      addStreamingNotification('error', 'Errore di Connessione', 
        `Impossibile avviare lo streaming: ${errorMessage}`)
    }
  }, [isStreaming, streamingManager, getMixedStream, audioManager, decksEmpty])
  
  // Push-to-talk
  const [pttActive, setPttActive] = useState(false)
  const [originalVolumes, setOriginalVolumes] = useState<{deckA: number, deckB: number} | null>(null)
  const [duckingSettings, setDuckingSettings] = useState({ enabled: true, percentage: 50 })
  const pttTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 🚨 CRITICAL FIX: Microfono al 5% di default, 100% durante PTT
  const handleMicVolumeChange = useCallback((volume: number) => {
    console.log(`🎤 [MIC VOLUME] Changing microphone volume from ${micVolume} to ${volume}`)
    setMicVolume(volume)
    
    // 🚨 FIX: Update AudioManager state as well
    audioManager.setMicVolume(volume)
    
    // Save mic volume globally for persistence
    ;(window as any).__micVolume__ = volume
    
    // 🚨 CRITICAL FIX: Durante PTT, forza SEMPRE il microfono al 100%
    // Altrimenti, usa il volume impostato (ma mai sotto il 5% per udibilità)
    const actualVolume = pttActive ? 1.0 : Math.max(0.1, volume)  // Minimo 10% invece di 5% per essere più udibile
    
    // Update mic volume in live mixer if available
    if ((window as any).currentMicGain && (window as any).currentMixContext) {
      try {
        ;(window as any).currentMicGain.gain.setValueAtTime(actualVolume, (window as any).currentMixContext.currentTime)
        console.log(`🎤 [MIC VOLUME] Live mixer updated to ${Math.round(actualVolume * 100)}% ${pttActive ? '(FORCED TO 100% DURING PTT)' : ''}`)
      } catch (error) {
        console.warn('Failed to update mic volume in live mixer:', error)
      }
    }
    
    // 🚨 CRITICAL FIX: Aggiorna anche il gain PTT se disponibile
    if ((window as any).currentPTTMicGain && pttActive) {
      try {
        ;(window as any).currentPTTMicGain.gain.setValueAtTime(1.0, (window as any).currentMixContext?.currentTime || 0)
        console.log(`🎤 [MIC VOLUME] PTT mic gain forced to 100%`)
      } catch (error) {
        console.warn('Failed to update PTT mic gain:', error)
      }
    }
    
    console.log(`🎤 [MIC VOLUME] Microphone volume set to ${Math.round(actualVolume * 100)}% ${pttActive ? '(FORCED TO 100% DURING PTT)' : ''}`)
  }, [micVolume, audioManager, pttActive])
  
  // Riferimento immediato allo stato PTT
  
  // Debug PTT state changes
  useEffect(() => {
    console.log('🎤 PTT STATE CHANGED:', pttActive)
    
    // ✅ CRITICAL FIX: Aggiorna tutti i sistemi di streaming quando cambia lo stato PTT
    if ((window as any).updatePTTForAllSystems) {
      console.log('🎤 PTT UPDATE: Calling global update function for all systems')
      ;(window as any).updatePTTForAllSystems(pttActive)
    } else {
      console.log('🎤 PTT UPDATE: Global update function not available yet')
    }
  }, [pttActive])


  
  // Carica settings per il ducking
  useEffect(() => {
    const loadDuckingSettings = async () => {
      try {
        await localDatabase.waitForInitialization()
        const settings = await localDatabase.getSettings()
        const loadedSettings = {
          enabled: settings.microphone?.ducking ?? true,
          percentage: settings.microphone?.duckingPercent ?? 50
        }
        console.log('🎤 Loaded ducking settings:', loadedSettings)
        setDuckingSettings(loadedSettings)
      } catch (error) {
        console.warn('Could not load ducking settings:', error)
      }
    }
    loadDuckingSettings()
  }, [])
  
  const handlePTTStart = useCallback(() => {
    console.log('🎤 PTT START - Activating')
    
    if (pttActive) {
      console.log('🎤 PTT already active, skipping')
      return
    }
    
    console.log('🎤 PTT ACTIVATING - going ON AIR')
    setPttActive(true)
    ;(window as any).__pttActive__ = true
    
    // Salva volumi originali
    const currentVolumes = {
      deckA: deckAVolume,
      deckB: deckBVolume
    }
    setOriginalVolumes(currentVolumes)
    console.log('🎤 Saved original volumes:', currentVolumes)
    
    // Attiva microfono
    console.log('🎤 Activating microphone for PTT')
    audioManager.setMicrophoneEnabled(true)
    
    // 🚨 CRITICAL FIX: Forza il microfono al 100% durante PTT
    console.log('🎤 [PTT] Microphone will be forced to 100% during PTT (current volume preserved)')
    
    // Applica ducking se abilitato (SOLO streaming via mixer bus + feedback locale)
    if (duckingSettings.enabled) {
      // 🚨 CRITICAL FIX: Ducking al 100% = musica al 0% (completamente silenziosa)
      let duckingFactor = 0
      if (duckingSettings.percentage >= 100) {
        duckingFactor = 0  // Musica completamente silenziosa
      } else {
        duckingFactor = (100 - duckingSettings.percentage) / 100  // Ducking lineare: 75% = 0.25, 50% = 0.5
      }
      
      console.log(`🎤 Applying ducking: ${duckingSettings.percentage}% reduction, factor: ${duckingFactor}`)
      
      // Debug volume prima del ducking
      audioManager.debugPTTVolumes()
      
      // Feedback locale: abbassa temporaneamente i volumi locali
      audioManager.setPTTDucking('A', deckAVolume * duckingFactor)
      audioManager.setPTTDucking('B', deckBVolume * duckingFactor)
      // Live: aggiorna il mixer gain via funzione globale
      if ((window as any).updatePTTVolumesOnly) {
        ;(window as any).updatePTTVolumesOnly(true)
      }
      
      // Debug volume dopo il ducking
      setTimeout(() => {
        console.log('🎤 After PTT ducking:')
        audioManager.debugPTTVolumes()
      }, 50)
    }
    
  }, [pttActive, deckAVolume, deckBVolume, audioManager, duckingSettings])
  
  const handlePTTEnd = useCallback(() => {
    console.log('🎤 PTT END - Deactivating')
    
    if (!pttActive) {
      console.log('🎤 PTT already inactive, skipping')
      return
    }
    
    console.log('🎤 PTT DEACTIVATING - going OFF AIR')
    
    // Debug volume prima del ripristino
    audioManager.debugPTTVolumes()
    
    setPttActive(false)
    ;(window as any).__pttActive__ = false
    
    // Disattiva microfono
    console.log('🎤 Deactivating microphone')
    audioManager.setMicrophoneEnabled(false)
    
    // Rimuovi ducking PTT (ripristina volumi locali e mixer)
    if (duckingSettings.enabled) {
      console.log('🎤 Clearing PTT ducking')
      audioManager.clearPTTDucking('A')
      audioManager.clearPTTDucking('B')
      if ((window as any).updatePTTVolumesOnly) {
        ;(window as any).updatePTTVolumesOnly(false)
      }
      
      // Debug volume dopo il ripristino
      setTimeout(() => {
        console.log('🎤 After PTT clear:')
        audioManager.debugPTTVolumes()
      }, 50)
    }
    
    // Pulisci i volumi salvati
    if (originalVolumes) {
      setOriginalVolumes(null)
    }
    
    console.log('🎤 PTT deactivated successfully')
    
  }, [pttActive, originalVolumes, audioManager, duckingSettings])

  // Gestione eventi mouse globali per PTT
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (pttActive) {
        console.log('🎤 Global mouse UP - releasing PTT')
        handlePTTEnd()
      }
    }

    const handleGlobalMouseLeave = (e: MouseEvent) => {
      // Se il mouse esce dalla finestra mentre PTT è attivo, rilascialo
      if (pttActive && (e.target as Element)?.tagName === 'HTML') {
        console.log('🎤 Mouse left window - releasing PTT')
        handlePTTEnd()
      }
    }

    if (pttActive) {
      document.addEventListener('mouseup', handleGlobalMouseUp)
      document.addEventListener('mouseleave', handleGlobalMouseLeave)
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('mouseleave', handleGlobalMouseLeave)
    }
  }, [pttActive, handlePTTEnd])
  
  // ✅ FIX: Usa il nuovo hook PTT che legge l'impostazione dalle settings
  usePTT((active: boolean) => {
    if (active) {
      handlePTTStart()
    } else {
      handlePTTEnd()
    }
  })
  
  // Listener per l'auto-advance
  useEffect(() => {
    const handleTrackEnded = (event: CustomEvent) => {
      const { deckId } = event.detail
      console.log(`🔚 [AUTO-ADVANCE] Track ended event received for Deck ${deckId}`)
      handleTrackEnd(deckId)
    }
    
    window.addEventListener('djconsole:track-ended', handleTrackEnded as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:track-ended', handleTrackEnded as EventListener)
    }
  }, [handleTrackEnd])
  
  // Aggiorna metadata streaming quando cambiano le tracce
  useEffect(() => {
    if (!isStreaming || !isStreamConnected) return
    
    const updateStreamingMetadata = async () => {
      try {
        const deckAState = audioManager.getDeck('A')
        const deckBState = audioManager.getDeck('B')
        
        let currentTrack = null
        if (deckAState.isPlaying && deckAState.track) {
          currentTrack = deckAState.track
        } else if (deckBState.isPlaying && deckBState.track) {
          currentTrack = deckBState.track
        }
        
        // Ottieni il nick dalle settings
        const currentSettings = await localDatabase.getSettings()
        const djNick = currentSettings?.streaming?.metadata?.djName || 'DJ Console'
        
        // Crea metadata con nick + traccia
        const metadata = currentTrack ? {
          title: `${currentTrack.title}`,
          artist: `${currentTrack.artist || 'Unknown Artist'} - Live by ${djNick}`,
          album: `${djNick} Live Stream`,
          genre: 'Electronic/Live DJ'
        } : {
          title: `${djNick} - Live DJ Set`,
          artist: `${djNick}`,
          album: `${djNick} Live Stream`,
          genre: 'Electronic/Live DJ'
        }
        
        console.log('📡 Auto-updating stream metadata:', metadata)
        streamingManager.updateMetadata(metadata)
        
      } catch (error) {
        console.error('📡 Error updating stream metadata:', error)
      }
    }
    
    updateStreamingMetadata()
    
  }, [deckATrack, deckBTrack, isStreaming, isStreamConnected, audioManager, streamingManager, settings])
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">DJ Console v2.0</h1>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">Ready</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Push-to-Talk con indicatore sotto */}
            <div className="flex flex-col items-center space-y-1">
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('🎤 Mouse DOWN on PTT button')
                  handlePTTStart()
                }}
                onContextMenu={(e) => {
                  e.preventDefault() // Previeni menu contestuale
                }}
                className={`p-3 rounded-lg transition-all duration-200 select-none ${
                  pttActive
                    ? 'bg-red-500 text-white shadow-lg animate-pulse ring-2 ring-red-300'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Push-to-Talk (Hold M key or mouse button)"
                style={{ 
                  userSelect: 'none', 
                  WebkitUserSelect: 'none', 
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserDrag: 'none'
                }}
              >
                <Mic className="w-6 h-6" />
              </button>
              
              {/* Status microfono - SOTTO il bottone PTT */}
              {pttActive && (
                <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs font-bold animate-pulse whitespace-nowrap">
                  MIC ON AIR
                </span>
              )}
            </div>
            
            {/* Streaming */}
            <button
              onClick={handleToggleStreaming}
              disabled={streamStatus === 'connecting' || (streamStatus === 'disconnected' && decksEmpty)}
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
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={
                streamStatus === 'streaming' ? 'Stop Streaming' :
                streamStatus === 'connecting' ? 'Connecting...' :
                streamStatus === 'connected' ? 'Start Streaming' :
                streamError ? `Error: ${streamError}` :
                (streamStatus === 'disconnected' && decksEmpty) ? 'Carica almeno una canzone in uno dei deck per avviare lo streaming' :
                'Start Streaming'
              }
            >
              <Radio className="w-5 h-5" />
              {streamStatus === 'connecting' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>
              )}
              {isStreaming && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
              )}
            </button>
            
            {/* Settings */}
            <button
              onClick={() => navigate('/settings')}
              className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg transition-all duration-200"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Deck Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeckPlayer
            deckId="A"
            track={deckATrack}
            isActive={deckAActive}
            volume={deckAVolume}
            isMuted={deckAMuted}
            onVolumeChange={handleDeckAVolumeChange}
            onActivate={handleDeckAActivate}
            onTrackEnd={() => handleTrackEnd('A')}
          />
          
          <DeckPlayer
            deckId="B"
            track={deckBTrack}
            isActive={deckBActive}
            volume={deckBVolume}
            isMuted={deckBMuted}
            onVolumeChange={handleDeckBVolumeChange}
            onActivate={handleDeckBActivate}
            onTrackEnd={() => handleTrackEnd('B')}
          />
        </div>
        
        {/* Mixer Section */}
        <MixerControls
          deckAVolume={deckAVolume}
          deckBVolume={deckBVolume}
          onDeckAVolumeChange={handleDeckAVolumeChange}
          onDeckBVolumeChange={handleDeckBVolumeChange}
          deckAMuted={deckAMuted}
          deckBMuted={deckBMuted}
          onDeckAMuteToggle={() => audioManager.toggleDeckMute('A')}
          onDeckBMuteToggle={() => audioManager.toggleDeckMute('B')}
          masterVolume={masterVolume}
          onMasterVolumeChange={handleMasterVolumeChange}
          micEnabled={micEnabled}
          micVolume={micVolume}
          onMicToggle={handleMicToggle}
          onMicVolumeChange={handleMicVolumeChange}
          cueEnabled={cueEnabled}
          onCueToggle={handleCueToggle}
        />
        
        {/* Playlist Section */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Playlists</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">
                {playlistState.library.playlists.length} playlist(s)
              </span>
            </div>
          </div>
          
          {/* Playlist Tabs */}
          <div className="flex space-x-2 mb-4 overflow-x-auto">
            {playlistState.library.playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setActivePlaylistId(playlist.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activePlaylistId === playlist.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {playlist.name} ({playlist.tracks?.length || 0})
              </button>
            ))}
          </div>
          
          {/* Playlist Content */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activePlaylistId && (() => {
              const tracks = renderPlaylistTracks()
              return tracks.length > 0 ? tracks : (
                <div className="text-center py-8 text-gray-400">
                  Playlist vuota
                </div>
              )
            })()}
            
            {!activePlaylistId && (
              <div className="text-center py-8 text-gray-400">
                Seleziona una playlist
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Status */}
      <footer className="bg-gray-900 border-t border-gray-800 p-4">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Deck A: {deckAActive ? 'ACTIVE' : 'INACTIVE'}</span>
            <span>Deck B: {deckBActive ? 'ACTIVE' : 'INACTIVE'}</span>
            <span>Master: {Math.round(masterVolume * 100)}%</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {pttActive && <span className="text-red-400 animate-pulse">🎤 PTT ACTIVE</span>}
            {micEnabled && !pttActive && <span className="text-red-400">🎤 MIC</span>}
            {streamStatus === 'streaming' && <span className="text-blue-400 animate-pulse">📡 STREAMING</span>}
            {streamStatus === 'connected' && !isStreaming && <span className="text-green-400">📡 READY</span>}
            {streamStatus === 'connecting' && <span className="text-yellow-400 animate-pulse">📡 CONNECTING</span>}
            {streamError && <span className="text-red-400">📡 ERROR</span>}
            {cueEnabled && <span className="text-yellow-400">🎧 CUE</span>}
            {settings.interface.autoAdvance && <span className="text-green-400">🔄 AUTO</span>}
            
            {/* Debug button per streaming */}
            <button
              onClick={() => {
                setShowNotificationPanel(!showNotificationPanel)
                setNotificationPanelHasNew(false)
              }}
              className={`text-xs px-2 py-1 rounded transition-colors relative ${
                notificationPanelHasNew 
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Notifiche Streaming"
            >
              📡 NOTIFICHE
              {notificationPanelHasNew && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            
            <button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Debug Avanzato"
            >
              📋 DEBUG
            </button>
          </div>
        </div>
      </footer>
      
      {/* Pannello Notifiche Streaming - Integrato nell'header */}
      {showNotificationPanel && (
        <div className="fixed top-16 right-4 z-40 w-96 max-h-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
            <h3 className="text-sm font-bold text-white flex items-center">
              📡 Notifiche Streaming
            </h3>
            <button
              onClick={() => {
                setShowNotificationPanel(false)
                setNotificationPanelHasNew(false)
              }}
              className="text-gray-400 hover:text-white text-lg"
            >
              ×
            </button>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {streamLogs.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                Nessuna notifica
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {streamLogs.slice(0, 10).map((log, index) => {
                  const isError = log.includes('ERROR:')
                  const isSuccess = log.includes('SUCCESS:')
                  const isWarning = log.includes('WARNING:')
                  
                  return (
                    <div key={index} className={`p-3 text-xs ${
                      isError ? 'bg-red-900/20 text-red-200' :
                      isSuccess ? 'bg-green-900/20 text-green-200' :
                      isWarning ? 'bg-yellow-900/20 text-yellow-200' :
                      'bg-gray-800/20 text-gray-300'
                    }`}>
                      <div className="font-mono whitespace-pre-wrap break-all">
                        {log}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          <div className="p-2 bg-gray-800 border-t border-gray-700 flex justify-between text-xs">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setStreamLogs([])
                  setNotificationPanelHasNew(false)
                  console.log('🗑️ Streaming logs cleared')
                }}
                className="text-gray-400 hover:text-white"
              >
                🗑️ Pulisci
              </button>
              <button
                onClick={async () => {
                  try {
                    // Prima mostra le credenziali salvate
                    const settings = await localDatabase.getSettings()
                    if (settings?.streaming?.icecast) {
                      const creds = settings.streaming.icecast
                      addStreamingNotification('info', 'Credenziali Salvate', 
                        `DB: ${creds.username}@${creds.host}:${creds.port}${creds.mount} (pwd: ${creds.password ? creds.password.length + ' chars' : 'vuota'})`)
                      
                      console.log('📡 CREDENZIALI ATTUALMENTE SALVATE NEL DATABASE:')
                      console.log(`📡 Host: "${creds.host}"`)
                      console.log(`📡 Port: ${creds.port}`)
                      console.log(`📡 Username: "${creds.username}"`)
                      console.log(`📡 Password: "${creds.password}"`)
                      console.log(`📡 Mount: "${creds.mount}"`)
                      console.log(`📡 SSL: ${creds.useSSL}`)
                    } else {
                      addStreamingNotification('error', 'Nessuna Credenziale', 'Nessuna configurazione Icecast trovata nel database!')
                    }
                    
                    addStreamingNotification('info', 'Debug Server', 'Interrogando il server per informazioni dettagliate...')
                    
                    if (settings?.streaming?.icecast) {
                      const icecast = settings.streaming.icecast
                      const protocol = icecast.useSSL ? 'https' : 'http'
                      const statusUrl = `${protocol}://${icecast.host}:${icecast.port || 8000}/status-json.xsl`
                      
                      console.log(`📡 Manual debug: querying ${statusUrl}`)
                      
                      try {
                        const response = await fetch(statusUrl, { 
                          signal: AbortSignal.timeout(10000),
                          headers: { 'Accept': 'application/json' }
                        })
                        
                        if (response.ok) {
                          const statusData = await response.json()
                          console.log('📡 MANUAL DEBUG: Full server response:', statusData)
                          
                          const sources = statusData.icestats?.source || []
                          const sourcesArray = Array.isArray(sources) ? sources : [sources]
                          
                          if (sourcesArray.length === 0) {
                            addStreamingNotification('info', 'Server Vuoto', 
                              'Il server non ha sorgenti attive. Tutti i mountpoint sono liberi.')
                          } else {
                            const sourceInfo = sourcesArray.map(s => 
                              `${s.mount || s.listenurl || 'unknown'} (${s.listeners || 0} listeners)`
                            ).join(', ')
                            
                            addStreamingNotification('info', 'Sorgenti Attive', 
                              `Mountpoint attivi sul server: ${sourceInfo}`)
                          }
                          
                          // Controlla il nostro mountpoint specifico
                          const ourMountpoint = icecast.mount || '/live'
                          const ourSource = sourcesArray.find(s => 
                            s.mount === ourMountpoint || (s.listenurl && s.listenurl.endsWith(ourMountpoint))
                          )
                          
                          if (ourSource) {
                            addStreamingNotification('success', 'Mountpoint Confermato', 
                              `Il nostro mountpoint ${ourMountpoint} è attivo con ${ourSource.listeners || 0} ascoltatori.`)
                          } else {
                            addStreamingNotification('warning', 'Mountpoint Assente', 
                              `Il nostro mountpoint ${ourMountpoint} NON è presente nella lista delle sorgenti attive!`)
                          }
                        } else {
                          addStreamingNotification('error', 'Errore Server', 
                            `Server ha risposto con errore: ${response.status} ${response.statusText}`)
                        }
                      } catch (fetchError) {
                        addStreamingNotification('error', 'Errore Connessione', 
                          `Impossibile interrogare il server: ${fetchError instanceof Error ? fetchError.message : 'errore sconosciuto'}`)
                      }
                    }
                  } catch (error) {
                    addStreamingNotification('error', 'Debug Fallito', 
                      `Errore durante il debug: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
                  }
                }}
                className="text-yellow-400 hover:text-yellow-300"
                title="Mostra informazioni dettagliate sullo stato del server"
              >
                🔍 Debug Server
              </button>
              
              {isStreaming && (
                <button
                  onClick={async () => {
                    try {
                      addStreamingNotification('info', 'Test Manuale', 'Testando se altri client vengono rifiutati dal server...')
                      
                      // Simula un test di connessione duplicata
                      const settings = await localDatabase.getSettings()
                      if (settings?.streaming?.icecast) {
                        const icecast = settings.streaming.icecast
                        const protocol = icecast.useSSL ? 'https' : 'http'
                        const testUrl = `${protocol}://${icecast.host}:${icecast.port || 8000}${icecast.mount || '/live'}`
                        
                        console.log(`📡 Manual test: attempting connection to ${testUrl}`)
                        
                        // Prova una connessione HEAD per vedere se il mountpoint risponde
                        try {
                          const response = await fetch(testUrl, { 
                            method: 'HEAD',
                            signal: AbortSignal.timeout(5000)
                          })
                          
                          if (response.ok) {
                            addStreamingNotification('success', 'Test Riuscito', 
                              `Il mountpoint ${icecast.mount || '/live'} è raggiungibile e attivo. Altri client dovrebbero essere rifiutati.`)
                          } else {
                            addStreamingNotification('warning', 'Test Inconclusivo', 
                              `Risposta server: ${response.status} ${response.statusText}`)
                          }
                        } catch (testError) {
                          addStreamingNotification('info', 'Test Limitato', 
                            'Non è possibile testare direttamente, ma il mountpoint dovrebbe essere occupato se lo streaming è attivo.')
                        }
                      }
                    } catch (error) {
                      addStreamingNotification('error', 'Test Fallito', 
                        `Errore durante il test: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
                    }
                  }}
                  className="text-blue-400 hover:text-blue-300"
                  title="Testa se il server rifiuta connessioni duplicate"
                >
                  🧪 Test
                </button>
              )}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(streamLogs.join('\n'))
                console.log('📋 Streaming logs copied to clipboard')
              }}
              className="text-gray-400 hover:text-white"
            >
              📋 Copia
            </button>
          </div>
        </div>
      )}
      
      {/* Debug Panel Streaming */}
      {showDebugPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-4xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">📋 Debug Streaming</h3>
              <button
                onClick={() => setShowDebugPanel(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Status attuale */}
              <div className="bg-gray-800 rounded p-4">
                <h4 className="font-bold text-white mb-2">📊 Status Attuale</h4>
                <div className="space-y-1 text-sm">
                  <div>Status: <span className={`font-mono ${
                    streamStatus === 'streaming' ? 'text-blue-400' :
                    streamStatus === 'connected' ? 'text-green-400' :
                    streamStatus === 'connecting' ? 'text-yellow-400' :
                    'text-gray-400'
                  }`}>{streamStatus}</span></div>
                  <div>Connesso: <span className={isStreamConnected ? 'text-green-400' : 'text-red-400'}>
                    {isStreamConnected ? 'Sì' : 'No'}
                  </span></div>
                  <div>Streaming: <span className={isStreaming ? 'text-blue-400' : 'text-gray-400'}>
                    {isStreaming ? 'Attivo' : 'Inattivo'}
                  </span></div>
                  {streamError && (
                    <div>Errore: <span className="text-red-400 font-mono text-xs">{streamError}</span></div>
                  )}
                </div>
              </div>
              
              {/* Log degli eventi */}
              <div className="bg-gray-800 rounded p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white">📝 Log Eventi</h4>
                  <button
                    onClick={() => setStreamLogs([])}
                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded"
                  >
                    Cancella
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto max-h-64 bg-gray-900 rounded p-2 font-mono text-xs">
                  {streamLogs.length === 0 ? (
                    <div className="text-gray-500">Nessun log disponibile</div>
                  ) : (
                    streamLogs.map((log, index) => (
                      <div key={index} className={`mb-1 ${
                        log.includes('ERROR') ? 'text-red-400' :
                        log.includes('SUCCESS') ? 'text-green-400' :
                        log.includes('WARNING') ? 'text-yellow-400' :
                        'text-gray-300'
                      }`}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(streamLogs.join('\n'))
                  addStreamingNotification('success', 'Copiato', 'Log copiati negli appunti')
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
              >
                📋 Copia Log
              </button>
              <button
                onClick={() => setShowDebugPanel(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Dialog conferma traccia duplicata */}
      {duplicateTrackDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-white mb-4">⚠️ Traccia già caricata</h3>
            <p className="text-gray-300 mb-4">
              La traccia <strong>"{duplicateTrackDialog.track.title}"</strong> è già caricata nel Deck {duplicateTrackDialog.sourceDeck}.
            </p>
            <p className="text-gray-400 mb-6">
              Vuoi comunque caricarla nel Deck {duplicateTrackDialog.targetDeck}?
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  // Conferma: carica comunque la traccia
                  const dialog = duplicateTrackDialog
                  setDuplicateTrackDialog(null)
                  
                  console.log(`✅ User confirmed loading duplicate track in Deck ${dialog.targetDeck}`)
                  await loadTrackInDeck(dialog.track, dialog.targetDeck)
                  
                  setTimeout(() => {
                    audioManager.play(dialog.targetDeck)
                  }, 500)
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
              >
                Sì, carica comunque
              </button>
              
              <button
                onClick={() => {
                  console.log('❌ User cancelled loading duplicate track')
                  setDuplicateTrackDialog(null)
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NewDJConsole
