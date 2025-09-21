/**
 * 🤝 COLLABORATION CONTEXT
 * Gestisce lo stato della collaborazione DJ
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import CollaborativeAudioMixer from '../audio/CollaborativeAudioMixer'
import CloudflareTunnelManager, { TunnelInfo } from '../utils/CloudflareTunnelManager'

export interface ConnectedDJ {
  id: string
  name: string
  ip: string
  connectedAt: Date
  microphone: boolean
  isOnline: boolean
  audioLevel: number
}

export interface CollaborationState {
  // Server WebSocket
  serverStatus: 'stopped' | 'starting' | 'running' | 'error'
  serverPort: number
  sessionCode: string | null
  
  // Tunnel Cloudflare
  tunnelInfo: TunnelInfo | null
  isCreatingTunnel: boolean
  tunnelStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  
  // DJ Connessi
  connectedDJs: ConnectedDJ[]
  localDJName: string
  
  // Audio Mixing
  isMixing: boolean
  localMicrophone: boolean
  audioConfig: MixingConfig
  audioError: string | null
  
  // UI State
  showCollaborationPanel: boolean
  isHost: boolean
  mode: 'host' | 'client' | null
}

export type CollaborationAction =
  | { type: 'SET_SERVER_STATUS'; payload: 'stopped' | 'starting' | 'running' | 'error' }
  | { type: 'SET_SERVER_PORT'; payload: number }
  | { type: 'SET_SESSION_CODE'; payload: string | null }
  | { type: 'SET_TUNNEL_INFO'; payload: TunnelInfo | null }
  | { type: 'SET_CREATING_TUNNEL'; payload: boolean }
  | { type: 'SET_TUNNEL_STATUS'; payload: 'disconnected' | 'connecting' | 'connected' | 'error' }
  | { type: 'ADD_CONNECTED_DJ'; payload: ConnectedDJ }
  | { type: 'REMOVE_CONNECTED_DJ'; payload: string }
  | { type: 'UPDATE_DJ_STATUS'; payload: { id: string; updates: Partial<ConnectedDJ> } }
  | { type: 'SET_LOCAL_DJ_NAME'; payload: string }
  | { type: 'SET_MIXING'; payload: boolean }
  | { type: 'SET_LOCAL_MICROPHONE'; payload: boolean }
  | { type: 'UPDATE_AUDIO_CONFIG'; payload: Partial<MixingConfig> }
  | { type: 'SET_AUDIO_ERROR'; payload: string | null }
  | { type: 'SET_SHOW_PANEL'; payload: boolean }
  | { type: 'SET_IS_HOST'; payload: boolean }
  | { type: 'SET_MODE'; payload: 'host' | 'client' | null }
  | { type: 'RESET_STATE' }

const initialState: CollaborationState = {
  serverStatus: 'stopped',
  serverPort: 8080,
  sessionCode: null,
  tunnelInfo: null,
  isCreatingTunnel: false,
  tunnelStatus: 'disconnected',
  connectedDJs: [],
  localDJName: 'DJ Host',
  isMixing: false,
  localMicrophone: false,
  audioConfig: {
    masterVolume: 80,
    localMicVolume: 80,
    remoteMicVolume: 80,
    musicVolume: 100
  },
  audioError: null,
  showCollaborationPanel: false,
  isHost: true,
  mode: null
}

function collaborationReducer(state: CollaborationState, action: CollaborationAction): CollaborationState {
  switch (action.type) {
    case 'SET_SERVER_STATUS':
      return { ...state, serverStatus: action.payload }
    
    case 'SET_SERVER_PORT':
      return { ...state, serverPort: action.payload }
    
    case 'SET_SESSION_CODE':
      return { ...state, sessionCode: action.payload }
    
    case 'SET_TUNNEL_INFO':
      return { ...state, tunnelInfo: action.payload }
    
    case 'SET_CREATING_TUNNEL':
      return { ...state, isCreatingTunnel: action.payload }
    
    case 'SET_TUNNEL_STATUS':
      return { ...state, tunnelStatus: action.payload }
    
    case 'ADD_CONNECTED_DJ':
      return {
        ...state,
        connectedDJs: [...state.connectedDJs.filter(dj => dj.id !== action.payload.id), action.payload]
      }
    
    case 'REMOVE_CONNECTED_DJ':
      return {
        ...state,
        connectedDJs: state.connectedDJs.filter(dj => dj.id !== action.payload)
      }
    
    case 'UPDATE_DJ_STATUS':
      return {
        ...state,
        connectedDJs: state.connectedDJs.map(dj =>
          dj.id === action.payload.id ? { ...dj, ...action.payload.updates } : dj
        )
      }
    
    case 'SET_LOCAL_DJ_NAME':
      return { ...state, localDJName: action.payload }
    
    case 'SET_MIXING':
      return { ...state, isMixing: action.payload }
    
    case 'SET_LOCAL_MICROPHONE':
      return { ...state, localMicrophone: action.payload }
    
    case 'UPDATE_AUDIO_CONFIG':
      return {
        ...state,
        audioConfig: { ...state.audioConfig, ...action.payload }
      }
    
    case 'SET_AUDIO_ERROR':
      return { ...state, audioError: action.payload }
    
    case 'SET_SHOW_PANEL':
      return { ...state, showCollaborationPanel: action.payload }
    
    case 'SET_IS_HOST':
      return { ...state, isHost: action.payload }
    
    case 'SET_MODE':
      return { ...state, mode: action.payload, isHost: action.payload === 'host' }
    
    case 'RESET_STATE':
      return initialState
    
    default:
      return state
  }
}

interface CollaborationContextType {
  state: CollaborationState
  actions: {
    // Server Management
    startServer: (port?: number) => Promise<void>
    stopServer: () => Promise<void>
    
    // Tunnel Management
    createTunnel: (port: number) => Promise<void>
    closeTunnel: () => Promise<void>
    
    // DJ Management
    addDJ: (dj: ConnectedDJ) => Promise<void>
    removeDJ: (id: string) => void
    updateDJStatus: (id: string, updates: Partial<ConnectedDJ>) => void
    
    // Audio Management
    startMixing: () => Promise<void>
    stopMixing: () => void
    setLocalMicrophone: (enabled: boolean) => Promise<void>
    updateAudioConfig: (config: Partial<MixingConfig>) => void
    setSourceVolume: (sourceId: string, volume: number) => void
    setSourceMuted: (sourceId: string, muted: boolean) => void
    getCollaborativeMediaStream: () => MediaStream | null
    
    // UI Management
    showPanel: () => void
    hidePanel: () => void
    setHostMode: (isHost: boolean) => void
    setMode: (mode: 'host' | 'client' | null) => void
    
    // Utility
    copySessionCode: () => Promise<boolean>
    shareSession: () => Promise<boolean>
    clearError: () => void
    resetState: () => void
  }
}

const CollaborationContext = createContext<CollaborationContextType | null>(null)

export const useCollaboration = () => {
  const context = useContext(CollaborationContext)
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider')
  }
  return context
}

interface CollaborationProviderProps {
  children: React.ReactNode
}

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(collaborationReducer, initialState)
  
  // Managers
  const audioMixer = React.useRef<CollaborativeAudioMixer | null>(null)
  const tunnelManager = React.useRef<CloudflareTunnelManager | null>(null)
  const websocketClient = React.useRef<WebSocket | null>(null)

  // Inizializza i manager
  useEffect(() => {
    console.log('🎵 [Collaboration] Initializing audio mixer...')
    audioMixer.current = new CollaborativeAudioMixer()
    tunnelManager.current = new CloudflareTunnelManager()
    console.log('✅ [Collaboration] Audio mixer initialized:', audioMixer.current)
    
    return () => {
      console.log('🛑 [Collaboration] Stopping audio mixer...')
      audioMixer.current?.stop()
    }
  }, [])

  // Gestione eventi WebSocket
  useEffect(() => {
    console.log('🔧 [Collaboration] Setting up WebSocket event listeners...')
    if (!window.electronAPI?.websocketServerAPI) {
      console.log('❌ [Collaboration] WebSocket Server API not available')
      return
    }

    console.log('✅ [Collaboration] WebSocket Server API available, registering listeners...')

    const handleClientConnected = (event: any, client: any) => {
      console.log('🔗 [Collaboration] Client connected event received:', client)
      
      // Crea oggetto DJ temporaneo (non autenticato)
      const dj: ConnectedDJ = {
        id: client.id,
        name: 'Connecting...',
        ip: client.ip,
        connectedAt: new Date(client.connectedAt),
        microphone: false,
        isOnline: true,
        audioLevel: 0
      }
      
      dispatch({ type: 'ADD_CONNECTED_DJ', payload: dj })
    }

    const handleClientAuthenticated = async (event: any, client: any) => {
      console.log('✅ [Collaboration] Client authenticated:', client)
      
      // Aggiorna il DJ esistente con i dati di autenticazione
      dispatch({ type: 'UPDATE_DJ_STATUS', payload: {
        id: client.id,
        updates: {
          name: client.djName,
          status: 'connected'
        }
      }})
      
      // Aggiungi sorgente audio per il DJ e avvia mixing
      if (audioMixer.current) {
        console.log('🎵 [Collaboration] Adding audio source for DJ:', client.djName)
        audioMixer.current.addSource(client.id, client.djName)
        
        // Avvia il mixing se non è già attivo
        if (!state.isMixing) {
          try {
            console.log('🎵 [Collaboration] Starting audio mixer...')
            await audioMixer.current.start()
            dispatch({ type: 'SET_MIXING', payload: true })
            console.log('✅ [Collaboration] Audio mixing started automatically for authenticated DJ')
          } catch (error) {
            console.error('❌ [Collaboration] Failed to start mixing for authenticated DJ:', error)
          }
        } else {
          console.log('🎵 [Collaboration] Audio mixer already active')
        }
      } else {
        console.error('❌ [Collaboration] Audio mixer not available')
      }
    }

    const handleClientDisconnected = (event: any, client: any) => {
      console.log('🔌 [Collaboration] Client disconnected:', client)
      
      // Rimuovi sorgente audio dal mixer
      if (audioMixer.current) {
        audioMixer.current.removeSource(client.id)
      }
      
      dispatch({ type: 'REMOVE_CONNECTED_DJ', payload: client.id })
    }

    const handleClientAuthError = (event: any, data: any) => {
      console.log('❌ [Collaboration] Client authentication error:', data)
      // Rimuovi il client dalla lista se c'è un errore di autenticazione
      if (data.clientId) {
        dispatch({ type: 'REMOVE_CONNECTED_DJ', payload: data.clientId })
      }
    }

        const handleAudioData = (event: any, data: any) => {
          console.log('🎵 [Collaboration] Audio data received from:', data.djName, 'Client ID:', data.clientId)
          
          // Aggiungi/aggiorna sorgente audio nel mixer
          if (audioMixer.current) {
            console.log('🎵 [Collaboration] Audio mixer available, processing data...')
            
            // Assicurati che la sorgente esista
            if (!audioMixer.current.getSources().find(s => s.id === data.clientId)) {
              console.log('🎵 [Collaboration] Adding new audio source for:', data.djName)
              audioMixer.current.addSource(data.clientId, data.djName)
            }
            
            // Aggiorna i dati audio
            if (data.audioData && Array.isArray(data.audioData)) {
              const audioArray = new Float32Array(data.audioData)
              const maxAmplitude = Math.max(...audioArray.map(s => Math.abs(s)))
              const avgAmplitude = audioArray.reduce((sum, s) => sum + Math.abs(s), 0) / audioArray.length
              console.log('🎵 [Collaboration] Updating audio data, length:', audioArray.length, 'Max:', maxAmplitude.toFixed(6), 'Avg:', avgAmplitude.toFixed(6))
              audioMixer.current.updateAudioData(data.clientId, audioArray)
            } else {
              console.warn('⚠️ [Collaboration] Invalid audio data format:', data.audioData)
            }
          } else {
            console.error('❌ [Collaboration] Audio mixer not available')
          }
        }

    const handleMicrophoneStatus = (event: any, data: any) => {
      console.log('🎤 [Collaboration] Microphone status:', data)
      dispatch({ type: 'UPDATE_DJ_STATUS', payload: {
        id: data.clientId,
        updates: {
          microphoneOn: data.status === 'on'
        }
      }})
    }

    // Registra gli event listeners
    console.log('📡 [Collaboration] Registering event listeners...')
    window.electronAPI.websocketServerAPI.onClientConnected(handleClientConnected)
    window.electronAPI.websocketServerAPI.onClientAuthenticated(handleClientAuthenticated)
    window.electronAPI.websocketServerAPI.onClientDisconnected(handleClientDisconnected)
    window.electronAPI.websocketServerAPI.onAudioData(handleAudioData)
    window.electronAPI.websocketServerAPI.onMicrophoneStatus(handleMicrophoneStatus)
    
    // Aggiungi listener per errori di autenticazione
    window.addEventListener('websocket-authError', handleClientAuthError)
    
    console.log('✅ [Collaboration] Event listeners registered successfully')

    return () => {
      // Cleanup event listeners
      if (window.electronAPI?.websocketServerAPI) {
        window.electronAPI.websocketServerAPI.removeAllListeners()
      }
      window.removeEventListener('websocket-authError', handleClientAuthError)
    }
  }, [])

  // Actions
  const startServer = useCallback(async (port: number = 8080) => {
    try {
      dispatch({ type: 'SET_SERVER_STATUS', payload: 'starting' })
      
      // Verifica che l'API sia disponibile
      if (!window.electronAPI?.websocketServerAPI) {
        throw new Error('WebSocket Server API not available. Make sure you are running in Electron.')
      }
      
      console.log('🚀 [Collaboration] Starting WebSocket server on port', port)
      
      // Avvia server WebSocket via IPC
      const result = await window.electronAPI.websocketServerAPI.startServer(null, port)
      
      console.log('📡 [Collaboration] Server result:', result)
      
      if (result?.success) {
        dispatch({ type: 'SET_SERVER_STATUS', payload: 'running' })
        dispatch({ type: 'SET_SERVER_PORT', payload: result.port })
        dispatch({ type: 'SET_SESSION_CODE', payload: result.sessionCode })
        console.log('✅ [Collaboration] Server started successfully')
      } else {
        throw new Error(result?.error || 'Failed to start server')
      }
    } catch (error) {
      console.error('❌ [Collaboration] Failed to start server:', error)
      dispatch({ type: 'SET_SERVER_STATUS', payload: 'error' })
      dispatch({ type: 'SET_AUDIO_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
    }
  }, [])

  const stopServer = useCallback(async () => {
    try {
      // Ferma server WebSocket via IPC
      await window.electronAPI?.websocketServerAPI?.stopServer()
      
      dispatch({ type: 'SET_SERVER_STATUS', payload: 'stopped' })
      dispatch({ type: 'SET_SESSION_CODE', payload: null })
      dispatch({ type: 'SET_TUNNEL_INFO', payload: null })
      dispatch({ type: 'SET_TUNNEL_STATUS', payload: 'disconnected' })
      
      // Rimuovi tutti i DJ connessi
      state.connectedDJs.forEach(dj => {
        dispatch({ type: 'REMOVE_CONNECTED_DJ', payload: dj.id })
      })
      
      console.log('✅ [Collaboration] Server stopped')
    } catch (error) {
      console.error('❌ [Collaboration] Failed to stop server:', error)
    }
  }, [state.connectedDJs])

  const createTunnel = useCallback(async (port: number) => {
    if (!tunnelManager.current) return
    
    try {
      dispatch({ type: 'SET_CREATING_TUNNEL', payload: true })
      dispatch({ type: 'SET_TUNNEL_STATUS', payload: 'connecting' })
      
      const tunnelInfo = await tunnelManager.current.createTunnel(port)
      
      dispatch({ type: 'SET_TUNNEL_INFO', payload: tunnelInfo })
      dispatch({ type: 'SET_TUNNEL_STATUS', payload: 'connected' })
      dispatch({ type: 'SET_CREATING_TUNNEL', payload: false })
      
      console.log('✅ [Collaboration] Tunnel created:', tunnelInfo.publicUrl)
    } catch (error) {
      console.error('❌ [Collaboration] Failed to create tunnel:', error)
      dispatch({ type: 'SET_TUNNEL_STATUS', payload: 'error' })
      dispatch({ type: 'SET_CREATING_TUNNEL', payload: false })
      dispatch({ type: 'SET_AUDIO_ERROR', payload: error instanceof Error ? error.message : 'Tunnel creation failed' })
    }
  }, [])

  const closeTunnel = useCallback(async () => {
    if (!tunnelManager.current) return
    
    try {
      await tunnelManager.current.closeTunnel()
      dispatch({ type: 'SET_TUNNEL_INFO', payload: null })
      dispatch({ type: 'SET_TUNNEL_STATUS', payload: 'disconnected' })
      console.log('✅ [Collaboration] Tunnel closed')
    } catch (error) {
      console.error('❌ [Collaboration] Failed to close tunnel:', error)
    }
  }, [])

  const addDJ = useCallback(async (dj: ConnectedDJ) => {
    dispatch({ type: 'ADD_CONNECTED_DJ', payload: dj })
    
    // Aggiungi sorgente audio per il DJ
    if (audioMixer.current) {
      audioMixer.current.addSource(dj.id, dj.name)
      
      // Avvia il mixing se non è già attivo
      if (!state.isMixing) {
        try {
          await audioMixer.current.start()
          dispatch({ type: 'SET_MIXING', payload: true })
          console.log('✅ [Collaboration] Audio mixing started automatically for new DJ')
        } catch (error) {
          console.error('❌ [Collaboration] Failed to start mixing for new DJ:', error)
        }
      }
    }
  }, [state.isMixing])

  const removeDJ = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_CONNECTED_DJ', payload: id })
    
    // Rimuovi sorgente audio
    if (audioMixer.current) {
      audioMixer.current.removeSource(id)
    }
  }, [])

  const updateDJStatus = useCallback((id: string, updates: Partial<ConnectedDJ>) => {
    dispatch({ type: 'UPDATE_DJ_STATUS', payload: { id, updates } })
  }, [])

  const startMixing = useCallback(async () => {
    if (!audioMixer.current) return
    
    try {
      await audioMixer.current.start()
      dispatch({ type: 'SET_MIXING', payload: true })
      console.log('✅ [Collaboration] Audio mixing started')
    } catch (error) {
      console.error('❌ [Collaboration] Failed to start mixing:', error)
      dispatch({ type: 'SET_AUDIO_ERROR', payload: error instanceof Error ? error.message : 'Failed to start mixing' })
    }
  }, [])

  const stopMixing = useCallback(() => {
    if (!audioMixer.current) return
    
    audioMixer.current.stop()
    dispatch({ type: 'SET_MIXING', payload: false })
    console.log('✅ [Collaboration] Audio mixing stopped')
  }, [])

  const setLocalMicrophone = useCallback(async (enabled: boolean) => {
    try {
      // Implementa logica per attivare/disattivare microfono
      dispatch({ type: 'SET_LOCAL_MICROPHONE', payload: enabled })
      console.log(`🎤 [Collaboration] Local microphone: ${enabled ? 'ON' : 'OFF'}`)
    } catch (error) {
      console.error('❌ [Collaboration] Failed to set microphone:', error)
      dispatch({ type: 'SET_AUDIO_ERROR', payload: error instanceof Error ? error.message : 'Microphone error' })
    }
  }, [])

  const updateAudioConfig = useCallback((config: Partial<MixingConfig>) => {
    dispatch({ type: 'UPDATE_AUDIO_CONFIG', payload: config })
    
    // Aggiorna il mixer audio
    if (audioMixer.current) {
      if (config.masterVolume !== undefined) {
        audioMixer.current.setMasterVolume(config.masterVolume)
      }
    }
    
    // ✅ NUOVO: Aggiorna il volume dell'audio collaborativo
    if (config.remoteMicVolume !== undefined && (window as any).currentCollaborativeGain) {
      const volume = config.remoteMicVolume / 100 // Converti da 0-100 a 0-1
      ;(window as any).currentCollaborativeGain.gain.setValueAtTime(volume, (window as any).currentCollaborativeGain.context.currentTime)
      console.log('🤝 [COLLABORATIVE] Volume audio collaborativo aggiornato:', volume)
    }
    
    // ✅ NUOVO: Aggiorna il volume del microfono locale
    if (config.localMicVolume !== undefined && (window as any).currentCollaborativeGain) {
      const volume = config.localMicVolume / 100 // Converti da 0-100 a 0-1
      ;(window as any).currentCollaborativeGain.gain.setValueAtTime(volume, (window as any).currentCollaborativeGain.context.currentTime)
      console.log('🤝 [COLLABORATIVE] Volume microfono locale aggiornato:', volume)
    }
  }, [])

  const setSourceVolume = useCallback((sourceId: string, volume: number) => {
    if (audioMixer.current) {
      audioMixer.current.setSourceVolume(sourceId, volume)
    }
  }, [])

  const setSourceMuted = useCallback((sourceId: string, muted: boolean) => {
    if (audioMixer.current) {
      audioMixer.current.setSourceMuted(sourceId, muted)
    }
  }, [])

  const showPanel = useCallback(() => {
    dispatch({ type: 'SET_SHOW_PANEL', payload: true })
  }, [])

  const hidePanel = useCallback(() => {
    dispatch({ type: 'SET_SHOW_PANEL', payload: false })
  }, [])

  const setHostMode = useCallback((isHost: boolean) => {
    dispatch({ type: 'SET_IS_HOST', payload: isHost })
  }, [])

  const setMode = useCallback((mode: 'host' | 'client' | null) => {
    dispatch({ type: 'SET_MODE', payload: mode })
  }, [])

  const copySessionCode = useCallback(async (): Promise<boolean> => {
    if (!state.sessionCode) return false
    
    try {
      await navigator.clipboard.writeText(state.sessionCode)
      console.log('✅ [Collaboration] Session code copied to clipboard')
      return true
    } catch (error) {
      console.error('❌ [Collaboration] Failed to copy session code:', error)
      return false
    }
  }, [state.sessionCode])

  const shareSession = useCallback(async (): Promise<boolean> => {
    if (!state.sessionCode) return false
    
    try {
      const shareData = {
        title: 'DJ Console Collaboration',
        text: `Join my DJ session! Code: ${state.sessionCode}`,
        url: window.location.href
      }
      
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`Join my DJ session! Code: ${state.sessionCode}`)
      }
      
      console.log('✅ [Collaboration] Session shared')
      return true
    } catch (error) {
      console.error('❌ [Collaboration] Failed to share session:', error)
      return false
    }
  }, [state.sessionCode])

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_AUDIO_ERROR', payload: null })
  }, [])

  const getCollaborativeMediaStream = useCallback((): MediaStream | null => {
    console.log('🤝 [Collaboration] getCollaborativeMediaStream chiamato...')
    console.log('🤝 [Collaboration] audioMixer.current:', !!audioMixer.current)
    console.log('🤝 [Collaboration] state.isMixing:', state.isMixing)
    console.log('🤝 [Collaboration] connectedDJs:', state.connectedDJs.length)
    
    if (!audioMixer.current || !state.isMixing) {
      console.log('🤝 [Collaboration] getCollaborativeMediaStream: mixer non disponibile o mixing non attivo')
      return null
    }

    const stream = audioMixer.current.getMediaStream()
    console.log('🤝 [Collaboration] getCollaborativeMediaStream: stream disponibile:', !!stream)
    if (stream) {
      console.log('🤝 [Collaboration] Stream ID:', stream.id)
      console.log('🤝 [Collaboration] Stream attivo:', stream.active)
      console.log('🤝 [Collaboration] Audio tracks:', stream.getAudioTracks().length)
    }
    return stream
  }, [state.isMixing, state.connectedDJs.length])

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' })
  }, [])

  const contextValue: CollaborationContextType = {
    state,
    actions: {
      startServer,
      stopServer,
      createTunnel,
      closeTunnel,
      addDJ,
      removeDJ,
      updateDJStatus,
      startMixing,
      stopMixing,
      setLocalMicrophone,
      updateAudioConfig,
      setSourceVolume,
      setSourceMuted,
      getCollaborativeMediaStream,
      showPanel,
      hidePanel,
      setHostMode,
      setMode,
      copySessionCode,
      shareSession,
      clearError,
      resetState
    }
  }

  // Esponi la funzione globalmente per l'integrazione con AudioContext
  useEffect(() => {
    ;(window as any).getCollaborativeMediaStream = getCollaborativeMediaStream
    console.log('🌍 [Collaboration] getCollaborativeMediaStream esposto globalmente')
    
    return () => {
      delete (window as any).getCollaborativeMediaStream
    }
  }, [getCollaborativeMediaStream])
  
  // Aggiorna l'audio collaborativo nel sistema principale quando diventa disponibile
  useEffect(() => {
    if (state.isMixing && (window as any).updateCollaborativeAudio) {
      console.log('🤝 [Collaboration] Aggiornamento audio collaborativo nel sistema principale...')
      ;(window as any).updateCollaborativeAudio()
    }
  }, [state.isMixing])

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
    </CollaborationContext.Provider>
  )
}

export default CollaborationContext
