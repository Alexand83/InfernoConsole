import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { ContinuousStreamingManager, StreamStatus } from '../audio/ContinuousStreamingManager'

// ===== INTERFACCE =====
export interface StreamingState {
  isStreaming: boolean
  streamStatus: 'disconnected' | 'connecting' | 'connected' | 'streaming'
  streamError: string | null
  debugMessages: string[]
  showDebugPanel: boolean
  pttActive: boolean
  errorCount: number
  showStartConfirmation: boolean
  showStopConfirmation: boolean
  pendingStreamingAction: 'start' | 'stop' | null
  showSilenceWarning: boolean
  silenceSecondsRemaining: number
  streamingManager: ContinuousStreamingManager | null
  listenerCount: number // ✅ NUOVO: Contatore ascoltatori
  broadcastStartTime: Date | null // ✅ NUOVO: Timer di trasmissione
  broadcastDuration: string // ✅ NUOVO: Durata formattata
}

type StreamingAction =
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_STREAM_STATUS'; payload: 'disconnected' | 'connecting' | 'connected' | 'streaming' }
  | { type: 'SET_STREAM_ERROR'; payload: string | null }
  | { type: 'ADD_DEBUG_MESSAGE'; payload: string }
  | { type: 'CLEAR_DEBUG_MESSAGES' }
  | { type: 'SET_SHOW_DEBUG_PANEL'; payload: boolean }
  | { type: 'SET_PTT_ACTIVE'; payload: boolean }
  | { type: 'SET_ERROR_COUNT'; payload: number }
  | { type: 'SET_SHOW_START_CONFIRMATION'; payload: boolean }
  | { type: 'SET_SHOW_STOP_CONFIRMATION'; payload: boolean }
  | { type: 'SET_PENDING_STREAMING_ACTION'; payload: 'start' | 'stop' | null }
  | { type: 'SET_SHOW_SILENCE_WARNING'; payload: boolean }
  | { type: 'SET_SILENCE_SECONDS_REMAINING'; payload: number }
  | { type: 'SET_STREAMING_MANAGER'; payload: ContinuousStreamingManager | null }
  | { type: 'SET_LISTENER_COUNT'; payload: number } // ✅ NUOVO: Azione per contatore ascoltatori
  | { type: 'SET_BROADCAST_START_TIME'; payload: Date | null } // ✅ NUOVO: Azione per timer di trasmissione
  | { type: 'SET_BROADCAST_DURATION'; payload: string } // ✅ NUOVO: Azione per durata formattata
  | { type: 'RESTORE_STATE_FROM_MANAGER' }

// ===== STATO INIZIALE =====
const initialState: StreamingState = {
  isStreaming: false,
  streamStatus: 'disconnected',
  streamError: null,
  debugMessages: [],
  showDebugPanel: false,
  pttActive: false,
  errorCount: 0,
  showStartConfirmation: false,
  showStopConfirmation: false,
  pendingStreamingAction: null,
  showSilenceWarning: false,
  silenceSecondsRemaining: 0,
  streamingManager: null,
  listenerCount: 0, // ✅ NUOVO: Contatore ascoltatori iniziale
  broadcastStartTime: null, // ✅ NUOVO: Timer di trasmissione iniziale
  broadcastDuration: '00:00:00' // ✅ NUOVO: Durata iniziale
}

// ===== REDUCER =====
function streamingReducer(state: StreamingState, action: StreamingAction): StreamingState {
  switch (action.type) {
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload }
    
    case 'SET_STREAM_STATUS':
      return { ...state, streamStatus: action.payload }
    
    case 'SET_STREAM_ERROR':
      return { ...state, streamError: action.payload }
    
    case 'ADD_DEBUG_MESSAGE':
      const newMessages = [
        `${new Date().toLocaleTimeString()}: ${action.payload}`,
        ...state.debugMessages
      ].slice(0, 50) // Mantieni solo gli ultimi 50 messaggi
      return { ...state, debugMessages: newMessages }
    
    case 'CLEAR_DEBUG_MESSAGES':
      return { ...state, debugMessages: [] }
    
    case 'SET_SHOW_DEBUG_PANEL':
      return { ...state, showDebugPanel: action.payload }
    
    case 'SET_PTT_ACTIVE':
      return { ...state, pttActive: action.payload }
    
    case 'SET_ERROR_COUNT':
      return { ...state, errorCount: action.payload }
    
    case 'SET_SHOW_START_CONFIRMATION':
      return { ...state, showStartConfirmation: action.payload }
    
    case 'SET_SHOW_STOP_CONFIRMATION':
      return { ...state, showStopConfirmation: action.payload }
    
    case 'SET_PENDING_STREAMING_ACTION':
      return { ...state, pendingStreamingAction: action.payload }
    
    case 'SET_SHOW_SILENCE_WARNING':
      return { ...state, showSilenceWarning: action.payload }
    
    case 'SET_SILENCE_SECONDS_REMAINING':
      return { ...state, silenceSecondsRemaining: action.payload }
    
    case 'SET_STREAMING_MANAGER':
      return { ...state, streamingManager: action.payload }
    
    case 'SET_LISTENER_COUNT':
      return { ...state, listenerCount: action.payload }
    
    case 'SET_BROADCAST_START_TIME':
      return { ...state, broadcastStartTime: action.payload }
    
    case 'SET_BROADCAST_DURATION':
      return { ...state, broadcastDuration: action.payload }
    
    case 'RESTORE_STATE_FROM_MANAGER':
      if (state.streamingManager) {
        // ✅ FIX: Usa metodi pubblici invece di proprietà private
        const isStreaming = state.streamingManager.getStatus?.()?.isStreaming || false
        const isConnected = state.streamingManager.getStatus?.()?.isConnected || false
        return {
          ...state,
          isStreaming,
          streamStatus: isStreaming ? 'streaming' : isConnected ? 'connected' : 'disconnected'
        }
      }
      return state
    
    default:
      return state
  }
}

// ===== CONTESTO =====
const StreamingContext = createContext<{
  state: StreamingState
  dispatch: React.Dispatch<StreamingAction>
  // Metodi di utilità
  addDebugMessage: (message: string) => void
  clearDebugMessages: () => void
  updateErrorCount: () => void
  restoreStateFromManager: () => void
  // Nuovo metodo per verificare se i deck sono vuoti
  checkDecksEmpty: () => boolean
  // ✅ NUOVO: Metodi per il timer di trasmissione
  startBroadcastTimer: () => void
  stopBroadcastTimer: () => void
  updateBroadcastDuration: () => void
} | undefined>(undefined)

// ===== PROVIDER =====
export const StreamingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(streamingReducer, initialState)
  const isInitialized = useRef(false)

  // Metodi di utilità
  const addDebugMessage = (message: string) => {
    dispatch({ type: 'ADD_DEBUG_MESSAGE', payload: message })
    
    // Aggiorna contatore errori se il messaggio contiene errori
    if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail') || message.includes('❌')) {
      updateErrorCount()
    }
  }

  const clearDebugMessages = () => {
    dispatch({ type: 'CLEAR_DEBUG_MESSAGES' })
    dispatch({ type: 'SET_ERROR_COUNT', payload: 0 })
  }

  const updateErrorCount = () => {
    const errorMessages = state.debugMessages.filter(msg => 
      msg.includes('❌') || msg.includes('ERROR') || msg.includes('Errore')
    )
    dispatch({ type: 'SET_ERROR_COUNT', payload: errorMessages.length })
  }

  const restoreStateFromManager = () => {
    dispatch({ type: 'RESTORE_STATE_FROM_MANAGER' })
  }

  // Verifica se i deck sono vuoti (nessuna traccia caricata)
  const checkDecksEmpty = (): boolean => {
    try {
      // Accedi al global audio manager per verificare lo stato dei deck
      const audioManager = (window as any).globalAudioManager
      if (!audioManager) {
        console.warn('⚠️ [STREAMING] AudioManager non disponibile per controllo deck')
        return true // Se non c'è audio manager, considera i deck vuoti
      }

      const state = audioManager.getState()
      const leftDeckEmpty = !state.leftDeck.track
      const rightDeckEmpty = !state.rightDeck.track
      
      const isEmpty = leftDeckEmpty && rightDeckEmpty
      
      if (isEmpty) {
        console.log('🎵 [STREAMING] Entrambi i deck sono vuoti - streaming non disponibile')
      } else {
        console.log('🎵 [STREAMING] Almeno un deck ha musica caricata - streaming disponibile')
      }
      
      return isEmpty
    } catch (error) {
      console.error('❌ [STREAMING] Errore nel controllo deck vuoti:', error)
      return true // In caso di errore, considera i deck vuoti per sicurezza
    }
  }

  // ✅ NUOVO: Metodi per il timer di trasmissione
  const startBroadcastTimer = () => {
    if (!state.broadcastStartTime) {
      const startTime = new Date()
      dispatch({ type: 'SET_BROADCAST_START_TIME', payload: startTime })
      console.log('📡 [BROADCAST TIMER] Timer di trasmissione avviato')
    }
  }

  const stopBroadcastTimer = () => {
    dispatch({ type: 'SET_BROADCAST_START_TIME', payload: null })
    dispatch({ type: 'SET_BROADCAST_DURATION', payload: '00:00:00' })
    console.log('📡 [BROADCAST TIMER] Timer di trasmissione fermato')
  }

  const updateBroadcastDuration = () => {
    if (state.broadcastStartTime) {
      const now = new Date()
      const diff = now.getTime() - state.broadcastStartTime.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      dispatch({ type: 'SET_BROADCAST_DURATION', payload: formattedTime })
    }
  }

  // Inizializza il StreamingManager globale
  useEffect(() => {
    if (!isInitialized.current) {
      const initializeStreamingManager = async () => {
        try {
          const streamingManager = new ContinuousStreamingManager()
          dispatch({ type: 'SET_STREAMING_MANAGER', payload: streamingManager })
          
          // Esponi globalmente
          ;(window as any).globalStreamingManager = streamingManager
          ;(window as any).streamingManager = streamingManager
          
          // Carica le settings dal database
          const { localDatabase } = await import('../database/LocalDatabase')
          await localDatabase.waitForInitialization()
          const s = await localDatabase.getSettings()
          
          // Configura URL server
          const isElectron = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
          let defaultWs = `ws://127.0.0.1:8000`
          if (!isElectron) {
            defaultWs = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8000`
          }
          const wsUrl = (s.streaming.bridgeUrl && s.streaming.bridgeUrl.length > 0) ? s.streaming.bridgeUrl : defaultWs
          
          // ✅ USA SERVER DI DEFAULT SELEZIONATO
          const defaultServer = await localDatabase.getDefaultIcecastServer()
          if (defaultServer) {
            streamingManager.setServerUrl(wsUrl)
            streamingManager.setCredentials({
              host: defaultServer.host,
              port: defaultServer.port,
              username: defaultServer.username,
              password: defaultServer.password,
              mountpoint: defaultServer.mount,
              useSSL: !!defaultServer.useSSL
            })
            
            // ✅ CRITICAL FIX: Configura anche le impostazioni di streaming
            streamingManager.setCredentials({
              format: s.streaming.defaultFormat || 'mp3', // ✅ USA FORMATO DAI SETTINGS
              bitrate: s.streaming.defaultBitrate || 128,
              channels: s.streaming.channels || 2,
              sampleRate: s.audio.sampleRate || 44100
            })
            
            console.log(`📡 [STREAMING CONTEXT] Configurato con server: ${defaultServer.name} (${defaultServer.host}:${defaultServer.port}${defaultServer.mount})`)
            console.log(`📡 [STREAMING CONTEXT] Formato: ${s.streaming.defaultFormat || 'mp3'}, bitrate: ${s.streaming.defaultBitrate || 128}`)
          } else {
            // Fallback ai settings legacy
            streamingManager.setServerUrl(wsUrl)
            streamingManager.setCredentials({
              host: 'localhost',
              port: 5040,
              username: 'source',
              password: '',
              mountpoint: '/stream',
              useSSL: false
            })
            
            // ✅ CRITICAL FIX: Configura anche le impostazioni di streaming per fallback
            streamingManager.setCredentials({
              format: s.streaming.defaultFormat || 'mp3', // ✅ USA FORMATO DAI SETTINGS
              bitrate: s.streaming.defaultBitrate || 128,
              channels: s.streaming.channels || 2,
              sampleRate: 44100
            })
            
            console.log(`📡 [STREAMING CONTEXT] Configurato con settings legacy: localhost:5040/stream`)
            console.log(`📡 [STREAMING CONTEXT] Formato: ${s.streaming.defaultFormat || 'mp3'}, bitrate: ${s.streaming.defaultBitrate || 128}`)
          }
          
          // Setup callbacks
          streamingManager.setCallbacks({
            onStatusChange: (status: StreamStatus) => {
              const newStatus = status.isStreaming ? 'streaming' : status.isConnected ? 'connected' : 'disconnected'
              dispatch({ type: 'SET_STREAM_STATUS', payload: newStatus })
              dispatch({ type: 'SET_STREAMING', payload: status.isStreaming })
              console.log(`📡 [STREAMING CONTEXT] Status: ${newStatus}`)
            },
            onError: (error: string) => {
              dispatch({ type: 'SET_STREAM_ERROR', payload: error })
              dispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
              addDebugMessage(`❌ Error: ${error}`)
            },
            onDebug: (msg: string) => {
              addDebugMessage(msg)
            },
            onSilenceWarning: (secondsRemaining: number) => {
              dispatch({ type: 'SET_SILENCE_SECONDS_REMAINING', payload: secondsRemaining })
              dispatch({ type: 'SET_SHOW_SILENCE_WARNING', payload: true })
              addDebugMessage(`⚠️ [SILENCE] Avviso: disconnessione in ${secondsRemaining} secondi`)
            },
            onSilenceDisconnect: () => {
              dispatch({ type: 'SET_SHOW_SILENCE_WARNING', payload: false })
            },
            onRetryAttempt: (attempt: number, maxRetries: number) => {
              addDebugMessage(`🔄 Tentativo ${attempt}/${maxRetries} di riconnessione...`)
            },
            onRetryFailed: () => {
              dispatch({ type: 'SET_STREAM_ERROR', payload: 'Riconnessione fallita dopo 5 tentativi' })
              dispatch({ type: 'SET_SHOW_DEBUG_PANEL', payload: true })
              addDebugMessage('❌ Riconnessione fallita dopo 5 tentativi')
            },
            onConnectionLost: (reason: string) => {
              addDebugMessage(`🚨 [CONNECTION] Connessione persa: ${reason}`)
            },
            onMountConflict: (message: string) => {
              addDebugMessage(`🚨 [MOUNT CONFLICT] ${message}`)
            }
          })
          
          console.log(`📡 [STREAMING CONTEXT] StreamingManager inizializzato con server: ${wsUrl}`)
          isInitialized.current = true
          console.log('📡 [STREAMING CONTEXT] Inizializzato con StreamingManager globale')
          
        } catch (error) {
          console.error('❌ [STREAMING CONTEXT] Errore inizializzazione StreamingManager:', error)
          dispatch({ type: 'SET_STREAM_ERROR', payload: `Initialization error: ${error}` })
        }
      }
      
      initializeStreamingManager()
    }
  }, [])

  // Restore stato dal manager quando il context si monta
  useEffect(() => {
    if (state.streamingManager) {
      restoreStateFromManager()
    }
  }, [state.streamingManager])

  // ✅ OTTIMIZZATO: Gestione automatica del timer di trasmissione (5s invece di 1s)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (state.isStreaming && state.broadcastStartTime) {
      // Avvia il timer se non è già attivo - OTTIMIZZATO: 5 secondi invece di 1
      interval = setInterval(() => {
        updateBroadcastDuration()
      }, 5000) // ✅ PERFORMANCE: Ridotto da 1000ms a 5000ms
    } else if (!state.isStreaming) {
      // Ferma il timer quando lo streaming si ferma
      stopBroadcastTimer()
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [state.isStreaming, state.broadcastStartTime])

  // ✅ NUOVO: Avvia il timer quando inizia lo streaming
  useEffect(() => {
    if (state.isStreaming && !state.broadcastStartTime) {
      startBroadcastTimer()
    }
  }, [state.isStreaming, state.broadcastStartTime])

  // ✅ NUOVO: Reset del timer quando l'app si chiude
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.broadcastStartTime) {
        console.log('📡 [BROADCAST TIMER] App in chiusura - Timer resettato')
        stopBroadcastTimer()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [state.broadcastStartTime])

  return (
    <StreamingContext.Provider value={{
      state,
      dispatch,
      addDebugMessage,
      clearDebugMessages,
      updateErrorCount,
      restoreStateFromManager,
      checkDecksEmpty,
      startBroadcastTimer,
      stopBroadcastTimer,
      updateBroadcastDuration
    }}>
      {children}
    </StreamingContext.Provider>
  )
}

// ===== HOOK =====
export const useStreaming = () => {
  const context = useContext(StreamingContext)
  if (context === undefined) {
    throw new Error('useStreaming must be used within a StreamingProvider')
  }
  return context
}
