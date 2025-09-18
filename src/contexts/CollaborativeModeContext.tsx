/**
 * 🤝 COLLABORATIVE MODE CONTEXT
 * Gestisce le modalità DJ collaborativo (Host/Client/Solo)
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { detectLocalIP, detectAllIPs, generateConnectionInfo, copyToClipboard, shareConnectionInfo, type ConnectionInfo } from '../utils/NetworkUtils'
import { browserTunnelManager, type BrowserTunnelInfo } from '../utils/BrowserTunnelManager'
import { BrowserWebSocketServer, type BrowserWebSocketClient } from '../server/BrowserWebSocketServer'

// ===== INTERFACCE =====
export interface DJInfo {
  id: string
  name: string
  microphone: boolean
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  connectedAt: Date
  lastSeen: Date
}

export interface CollaborativeModeState {
  mode: 'solo' | 'host' | 'client'
  serverStatus: 'stopped' | 'running' | 'connecting' | 'error'
  sessionCode: string | null
  serverUrl: string | null
  connectedDJs: DJInfo[]
  localMicrophone: boolean
  remoteMicrophones: Map<string, boolean>
  serverPort: number
  errorMessage: string | null
  localIP: string | null
  publicIP: string | null
  connectionInfo: ConnectionInfo | null
  connectionType: 'p2p' | 'tunnel'
  tunnelInfo: BrowserTunnelInfo | null
  isCreatingTunnel: boolean
}

export interface CollaborativeModeActions {
  setMode: (mode: 'solo' | 'host' | 'client') => void
  startServer: () => Promise<void>
  stopServer: () => void
  connectToServer: (serverUrl: string, sessionCode: string) => Promise<void>
  disconnectFromServer: () => void
  startLocalMicrophone: () => Promise<void>
  stopLocalMicrophone: () => void
  setServerPort: (port: number) => void
  clearError: () => void
  copyConnectionInfo: () => Promise<boolean>
  shareConnectionInfo: () => Promise<boolean>
  detectLocalIP: () => Promise<void>
  setConnectionType: (type: 'p2p' | 'tunnel') => void
}

// ===== CONTESTO =====
const CollaborativeModeContext = createContext<{
  state: CollaborativeModeState
  actions: CollaborativeModeActions
} | undefined>(undefined)

// ===== PROVIDER =====
export const CollaborativeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CollaborativeModeState>({
    mode: 'solo',
    serverStatus: 'stopped',
    sessionCode: null,
    serverUrl: null,
    connectedDJs: [],
    localMicrophone: false,
    remoteMicrophones: new Map(),
    serverPort: 8080,
    errorMessage: null,
    localIP: null,
    publicIP: null,
    connectionInfo: null,
    connectionType: 'p2p',
    tunnelInfo: null,
    isCreatingTunnel: false
  })

  // Refs per WebSocket e server
  const wsServerRef = useRef<BrowserWebSocketServer | null>(null)
  const wsClientRef = useRef<WebSocket | null>(null)
  const localMicrophoneRef = useRef<MediaStream | null>(null)

  // ===== AZIONI =====

  // Cambia modalità
  const setMode = useCallback((mode: 'solo' | 'host' | 'client') => {
    console.log(`🤝 [COLLABORATIVE] Cambio modalità: ${state.mode} → ${mode}`)
    
    // Pulisci stato precedente
    if (state.mode === 'host') {
      stopServer()
    } else if (state.mode === 'client') {
      disconnectFromServer()
    }
    
    setState(prev => ({ 
      ...prev, 
      mode,
      serverStatus: 'stopped',
      sessionCode: null,
      serverUrl: null,
      connectedDJs: [],
      errorMessage: null
    }))
  }, [state.mode])

  // Rileva IP locale e pubblico
  const detectLocalIPAction = useCallback(async () => {
    try {
      console.log('🌐 [COLLABORATIVE] Rilevamento IP locale e pubblico...')
      const { local, public: publicIP } = await detectAllIPs()
      setState(prev => ({ ...prev, localIP: local, publicIP }))
      console.log(`🌐 [COLLABORATIVE] IP rilevati - Locale: ${local}, Pubblico: ${publicIP}`)
    } catch (error) {
      console.error('❌ [COLLABORATIVE] Errore rilevamento IP:', error)
    }
  }, [])

  // Avvia server (modalità host)
  const startServer = useCallback(async () => {
    try {
      console.log('🖥️ [COLLABORATIVE] Avvio server...')
      setState(prev => ({ ...prev, serverStatus: 'running', errorMessage: null }))
      
      // Rileva IP se non già fatto
      let localIP = state.localIP
      let publicIP = state.publicIP
      if (!localIP || !publicIP) {
        const ips = await detectAllIPs()
        localIP = ips.local
        publicIP = ips.public
        setState(prev => ({ ...prev, localIP, publicIP }))
      }
      
      // Genera codice sessione
      const sessionCode = generateSessionCode()
      
      // Gestisci tunnel se necessario
      let tunnelInfo: TunnelInfo | null = null
      if (state.connectionType === 'tunnel') {
        try {
          setState(prev => ({ ...prev, isCreatingTunnel: true }))
          console.log('🚇 [COLLABORATIVE] Creazione tunnel in corso...')
          
          tunnelInfo = await browserTunnelManager.createTunnel(state.serverPort, 'cloudflare')
          console.log(`🚇 [COLLABORATIVE] Tunnel creato: ${tunnelInfo.publicUrl}`)
          
          setState(prev => ({ ...prev, isCreatingTunnel: false }))
        } catch (error) {
          console.error('❌ [COLLABORATIVE] Errore creazione tunnel:', error)
          setState(prev => ({ 
            ...prev, 
            serverStatus: 'error',
            errorMessage: `Errore creazione tunnel: ${error}`,
            isCreatingTunnel: false
          }))
          return
        }
      }
      
      // Genera informazioni connessione
      let connectionIP: string
      if (state.connectionType === 'tunnel' && tunnelInfo) {
        connectionIP = tunnelInfo.publicUrl
      } else if (state.connectionType === 'public' && publicIP) {
        connectionIP = publicIP
      } else {
        connectionIP = localIP
      }
      
      const connectionInfo = generateConnectionInfo(sessionCode, connectionIP, state.serverPort)
      
      setState(prev => ({ 
        ...prev, 
        sessionCode,
        connectionInfo,
        tunnelInfo
      }))
      
      // Avvia server WebSocket REALE
      try {
        const wsServer = new BrowserWebSocketServer(state.serverPort)
        await wsServer.start()
        wsServerRef.current = wsServer
        
        // Gestisci connessioni client
        wsServer.onMessage('join', (message) => {
          console.log(`👋 [COLLABORATIVE] Client connesso: ${message.data.name}`)
          // Aggiorna lista client connessi
          const connectedClients = wsServer.getConnectedClients()
          const djInfos: DJInfo[] = connectedClients.map(client => ({
            id: client.id,
            name: client.name,
            microphone: client.microphone,
            quality: 'good' as const,
            connectedAt: client.connectedAt,
            lastSeen: client.lastSeen
          }))
          setState(prev => ({ ...prev, connectedDJs: djInfos }))
        })
        
        console.log(`🖥️ [COLLABORATIVE] Server WebSocket REALE avviato - Codice: ${sessionCode} - IP: ${localIP}`)
      } catch (error) {
        console.error('❌ [COLLABORATIVE] Errore avvio server WebSocket:', error)
        setState(prev => ({ 
          ...prev, 
          serverStatus: 'error',
          errorMessage: `Errore avvio server: ${error}`
        }))
        return
      }
      
    } catch (error) {
      console.error('❌ [COLLABORATIVE] Errore avvio server:', error)
      setState(prev => ({ 
        ...prev, 
        serverStatus: 'error',
        errorMessage: `Errore avvio server: ${error}`
      }))
    }
  }, [state.localIP, state.serverPort])

  // Ferma server
  const stopServer = useCallback(async () => {
    console.log('🛑 [COLLABORATIVE] Fermata server...')
    
    // Distruggi tunnel se attivo
    if (state.tunnelInfo) {
      try {
        await browserTunnelManager.destroyTunnel()
        console.log('✅ [COLLABORATIVE] Tunnel distrutto')
      } catch (error) {
        console.error('❌ [COLLABORATIVE] Errore distruzione tunnel:', error)
      }
    }
    
    // Ferma server WebSocket REALE
    if (wsServerRef.current) {
      await wsServerRef.current.stop()
      wsServerRef.current = null
    }
    
    setState(prev => ({ 
      ...prev, 
      serverStatus: 'stopped',
      sessionCode: null,
      connectedDJs: [],
      tunnelInfo: null
    }))
  }, [state.tunnelInfo])

  // Connetti a server (modalità client)
  const connectToServer = useCallback(async (serverUrl: string, sessionCode: string) => {
    try {
      console.log(`🔗 [COLLABORATIVE] Connessione a server: ${serverUrl}`)
      setState(prev => ({ 
        ...prev, 
        serverStatus: 'connecting',
        serverUrl,
        sessionCode,
        errorMessage: null
      }))
      
      // Simula connessione (per ora)
      // TODO: Implementare connessione WebSocket reale
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setState(prev => ({ 
        ...prev, 
        serverStatus: 'running'
      }))
      
      console.log('✅ [COLLABORATIVE] Connesso al server')
      
    } catch (error) {
      console.error('❌ [COLLABORATIVE] Errore connessione:', error)
      setState(prev => ({ 
        ...prev, 
        serverStatus: 'error',
        errorMessage: `Errore connessione: ${error}`
      }))
    }
  }, [])

  // Disconnetti da server
  const disconnectFromServer = useCallback(() => {
    console.log('🔌 [COLLABORATIVE] Disconnessione da server...')
    
    if (wsClientRef.current) {
      wsClientRef.current.close()
      wsClientRef.current = null
    }
    
    setState(prev => ({ 
      ...prev, 
      serverStatus: 'stopped',
      serverUrl: null,
      sessionCode: null,
      localMicrophone: false
    }))
  }, [])

  // Avvia microfono locale
  const startLocalMicrophone = useCallback(async () => {
    try {
      console.log('🎤 [COLLABORATIVE] Avvio microfono locale...')
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      localMicrophoneRef.current = stream
      setState(prev => ({ ...prev, localMicrophone: true }))
      
      console.log('✅ [COLLABORATIVE] Microfono locale attivato')
      
    } catch (error) {
      console.error('❌ [COLLABORATIVE] Errore accesso microfono:', error)
      setState(prev => ({ 
        ...prev, 
        errorMessage: `Errore accesso microfono: ${error}`
      }))
    }
  }, [])

  // Ferma microfono locale
  const stopLocalMicrophone = useCallback(() => {
    console.log('🔇 [COLLABORATIVE] Fermata microfono locale...')
    
    if (localMicrophoneRef.current) {
      localMicrophoneRef.current.getTracks().forEach(track => track.stop())
      localMicrophoneRef.current = null
    }
    
    setState(prev => ({ ...prev, localMicrophone: false }))
  }, [])

  // Imposta porta server
  const setServerPort = useCallback((port: number) => {
    setState(prev => ({ ...prev, serverPort: port }))
  }, [])

  // Pulisci errore
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, errorMessage: null }))
  }, [])

  // Copia informazioni connessione
  const copyConnectionInfo = useCallback(async (): Promise<boolean> => {
    if (!state.connectionInfo) {
      console.error('❌ [COLLABORATIVE] Nessuna informazione connessione da copiare')
      return false
    }

    const textToCopy = `Sessione DJ Collaborativa
Codice: ${state.connectionInfo.sessionCode}
URL: ${state.connectionInfo.serverURL}

${state.connectionInfo.instructions}`

    return await copyToClipboard(textToCopy)
  }, [state.connectionInfo])

  // Condividi informazioni connessione
  const shareConnectionInfoAction = useCallback(async (): Promise<boolean> => {
    if (!state.connectionInfo) {
      console.error('❌ [COLLABORATIVE] Nessuna informazione connessione da condividere')
      return false
    }

    return await shareConnectionInfo(state.connectionInfo)
  }, [state.connectionInfo])

  // Imposta tipo di connessione
  const setConnectionType = useCallback((type: 'p2p' | 'tunnel') => {
    setState(prev => ({ ...prev, connectionType: type }))
    console.log(`🌐 [COLLABORATIVE] Tipo connessione cambiato: ${type}`)
  }, [])

  // ===== CLEANUP =====
  useEffect(() => {
    return () => {
      // Cleanup al dismount
      if (wsServerRef.current) {
        wsServerRef.current.close()
      }
      if (wsClientRef.current) {
        wsClientRef.current.close()
      }
      if (localMicrophoneRef.current) {
        localMicrophoneRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // ===== RENDER =====
  const actions: CollaborativeModeActions = {
    setMode,
    startServer,
    stopServer,
    connectToServer,
    disconnectFromServer,
    startLocalMicrophone,
    stopLocalMicrophone,
    setServerPort,
    clearError,
    copyConnectionInfo,
    shareConnectionInfo: shareConnectionInfoAction,
    detectLocalIP: detectLocalIPAction,
    setConnectionType
  }

  return (
    <CollaborativeModeContext.Provider value={{ state, actions }}>
      {children}
    </CollaborativeModeContext.Provider>
  )
}

// ===== HOOK =====
export const useCollaborativeMode = () => {
  const context = useContext(CollaborativeModeContext)
  if (context === undefined) {
    throw new Error('useCollaborativeMode must be used within a CollaborativeModeProvider')
  }
  return context
}

// ===== UTILITY FUNCTIONS =====

// Genera codice sessione
function generateSessionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default CollaborativeModeContext
