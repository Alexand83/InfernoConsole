/**
 * 🤝 COLLABORATIVE MODE CONTEXT
 * Gestisce le modalità DJ collaborativo (Host/Client/Solo)
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { detectLocalIP, detectPublicIP, detectAllIPs, generateConnectionInfo, copyToClipboard, shareConnectionInfo, type ConnectionInfo } from '../utils/NetworkUtils'
import { browserTunnelManager, type BrowserTunnelInfo } from '../utils/BrowserTunnelManager'
import { BrowserWebSocketServer, type BrowserWebSocketClient } from '../server/BrowserWebSocketServer'
import { RealWebSocketClient as RealClient, type RealWebSocketClientState } from '../server/RealWebSocketClient'
import { QRCodeGenerator } from '../utils/QRCodeGenerator'
import { RemoteIPDiscovery } from '../utils/RemoteIPDiscovery'

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
  connectToServer: (sessionCode: string) => Promise<void>
  connectToServerWithIP: (sessionCode: string, serverIP: string) => Promise<void>
  disconnectFromServer: () => void
  startLocalMicrophone: () => Promise<void>
  stopLocalMicrophone: () => void
  setServerPort: (port: number) => void
  clearError: () => void
  copyConnectionInfo: () => Promise<boolean>
  shareConnectionInfo: () => Promise<boolean>
  detectLocalIP: () => Promise<void>
  setConnectionType: (type: 'p2p' | 'tunnel') => void
  testServerConnection: (sessionCode: string) => Promise<{ success: boolean; serverUrl?: string; error?: string }>
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
  const wsClientRef = useRef<RealClient | null>(null)
  const localMicrophoneRef = useRef<MediaStream | null>(null)

  // ===== AZIONI =====

  // Auto-discovery del server (completamente autonomo)
  const discoverServer = useCallback(async (sessionCode: string): Promise<string | null> => {
    try {
      console.log(`🔍 [COLLABORATIVE] Ricerca server per codice: ${sessionCode}`)
      
      // 1. Controlla se c'è un server attivo nella stessa finestra
      const globalDiscovery = (window as any).__djServerDiscovery
      if (globalDiscovery && globalDiscovery.sessionCode === sessionCode && globalDiscovery.isRunning()) {
        const url = `http://localhost:${globalDiscovery.port}`
        console.log(`✅ [COLLABORATIVE] Server trovato localmente: ${url}`)
        return url
      }
      
      // 2. Prova connessioni locali e remote
      const commonPorts = [8080, 8081, 8082, 3000, 3001, 5000, 5001]
      const commonHosts = ['localhost', '127.0.0.1']
      
      // Aggiungi IP pubblico se disponibile
      if (state.publicIP) {
        commonHosts.push(state.publicIP)
      }
      
      // Prova a rilevare l'IP pubblico del client
      try {
        const clientPublicIP = await detectPublicIP()
        if (clientPublicIP && !commonHosts.includes(clientPublicIP)) {
          commonHosts.push(clientPublicIP)
        }
      } catch (error) {
        console.warn('⚠️ [COLLABORATIVE] Errore rilevamento IP pubblico client:', error)
      }
      
      console.log(`🔍 [COLLABORATIVE] Host da provare:`, commonHosts)
      
      for (const host of commonHosts) {
        for (const port of commonPorts) {
          const url = `http://${host}:${port}`
          try {
            console.log(`🔍 [COLLABORATIVE] Provo connessione: ${url}`)
            
            const response = await fetch(`${url}/api/session/${sessionCode}`, {
              method: 'GET',
              timeout: 3000
            })
            
            if (response.ok) {
              console.log(`✅ [COLLABORATIVE] Server locale trovato: ${url}`)
              return url
            }
          } catch (error) {
            continue
          }
        }
      }
      
      // 3. Prova discovery automatico remoto
      console.log(`🌍 [COLLABORATIVE] Ricerca server remoto automatica...`)
      try {
        const discoveryService = RemoteIPDiscovery.getInstance()
        const remoteResult = await discoveryService.findServer(sessionCode)
        
        if (remoteResult.success && remoteResult.server) {
          const server = remoteResult.server
          const serverUrl = `http://${server.ip}:${server.port}`
          
          console.log(`✅ [COLLABORATIVE] Server remoto trovato: ${serverUrl}`)
          
          // Prova a connettersi al server remoto
          try {
            const testResponse = await fetch(`${serverUrl}/api/session/${sessionCode}`, {
              method: 'GET',
              timeout: 5000
            })
            
            if (testResponse.ok) {
              console.log(`✅ [COLLABORATIVE] Connessione remota verificata: ${serverUrl}`)
              return serverUrl
            }
          } catch (error) {
            console.warn(`⚠️ [COLLABORATIVE] Server remoto non raggiungibile: ${error}`)
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ [COLLABORATIVE] Errore discovery remoto:`, error)
      }
      
      console.log(`❌ [COLLABORATIVE] Server non trovato per codice: ${sessionCode}`)
      console.log(`💡 [COLLABORATIVE] Suggerimento: Assicurati che il server sia online e accessibile`)
      return null
      
    } catch (error) {
      console.error('❌ [COLLABORATIVE] Errore discovery server:', error)
      return null
    }
  }, [])

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
      
      // 🚇 TUNNEL AUTOMATICO PER PLUG-AND-PLAY
      let tunnelInfo: TunnelInfo | null = null
      try {
        setState(prev => ({ ...prev, isCreatingTunnel: true }))
        console.log('🚇 [COLLABORATIVE] Creazione tunnel automatico PLUG-AND-PLAY...')
        
        // Prova LocalTunnel prima, poi fallback a ngrok se fallisce
        try {
          tunnelInfo = await browserTunnelManager.createTunnel(state.serverPort, 'local')
          console.log(`✅ [COLLABORATIVE] LocalTunnel creato: ${tunnelInfo.publicUrl}`)
        } catch (error) {
          console.warn('⚠️ [COLLABORATIVE] LocalTunnel fallito, provo ngrok:', error)
          try {
            tunnelInfo = await browserTunnelManager.createTunnel(state.serverPort, 'ngrok')
            console.log(`✅ [COLLABORATIVE] ngrok creato: ${tunnelInfo.publicUrl}`)
          } catch (ngrokError) {
            console.warn('⚠️ [COLLABORATIVE] ngrok fallito, provo Cloudflare:', ngrokError)
            tunnelInfo = await browserTunnelManager.createTunnel(state.serverPort, 'cloudflare')
            console.log(`✅ [COLLABORATIVE] Cloudflare creato: ${tunnelInfo.publicUrl}`)
          }
        }
        console.log(`🌐 [COLLABORATIVE] Tunnel PLUG-AND-PLAY creato: ${tunnelInfo.publicUrl}`)
        
        // Configura rinnovo automatico tunnel
        browserTunnelManager.setTunnelRenewalCallback((newTunnel) => {
          console.log(`🔄 [COLLABORATIVE] Tunnel rinnovato automaticamente: ${newTunnel.publicUrl}`)
          setState(prev => ({ 
            ...prev, 
            tunnelInfo: {
              id: newTunnel.id,
              publicUrl: newTunnel.publicUrl,
              localPort: newTunnel.localPort,
              status: newTunnel.status,
              createdAt: newTunnel.createdAt,
              expiresAt: newTunnel.expiresAt,
              provider: newTunnel.provider
            }
          }))
        })
        
        // Avvia rinnovo automatico
        browserTunnelManager.startTunnelRenewal()
        
        setState(prev => ({ ...prev, isCreatingTunnel: false, connectionType: 'tunnel' }))
      } catch (error) {
        console.warn('⚠️ [COLLABORATIVE] Tunnel fallito, fallback a IP locale:', error)
        setState(prev => ({ ...prev, isCreatingTunnel: false, connectionType: 'p2p' }))
        // Continua senza tunnel
      }
      
      // Genera informazioni connessione - PRIORITÀ TUNNEL PER PLUG-AND-PLAY
      let connectionIP: string
      if (tunnelInfo) {
        // Usa tunnel se disponibile (PLUG-AND-PLAY)
        connectionIP = tunnelInfo.publicUrl
        console.log(`🔗 [COLLABORATIVE] Connessione PLUG-AND-PLAY via tunnel: ${connectionIP}`)
      } else if (publicIP) {
        // Fallback a IP pubblico
        connectionIP = publicIP
        console.log(`🌍 [COLLABORATIVE] Connessione via IP pubblico: ${connectionIP}`)
      } else {
        // Fallback a IP locale
        connectionIP = localIP
        console.log(`🏠 [COLLABORATIVE] Connessione via IP locale: ${connectionIP}`)
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
      const wsServer = new BrowserWebSocketServer({
        port: state.serverPort,
        sessionCode,
        maxClients: 10,
        heartbeatInterval: 5000
      })
        await wsServer.start()
        wsServerRef.current = wsServer
        
        // Gestisci connessioni client
        wsServer.onMessage('client-joined', (message) => {
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
        
        wsServer.onMessage('client-left', (message) => {
          console.log(`👋 [COLLABORATIVE] Client disconnesso: ${message.data.name}`)
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
        
        // Registra server per discovery automatico remoto
        try {
          const discoveryService = RemoteIPDiscovery.getInstance()
          await discoveryService.registerServer(sessionCode, localIP, state.serverPort)
          console.log(`🌍 [COLLABORATIVE] Server registrato per discovery automatico`)
          
          // Avvia heartbeat per mantenere la registrazione attiva
          const heartbeatInterval = setInterval(async () => {
            await discoveryService.updateHeartbeat(sessionCode)
          }, 30000) // Ogni 30 secondi
          
          // Salva l'interval per cleanup
          ;(wsServer as any).heartbeatInterval = heartbeatInterval
          
        } catch (error) {
          console.warn('⚠️ [COLLABORATIVE] Errore registrazione discovery:', error)
          // Non bloccare l'avvio del server per questo errore
        }
        
        console.log(`🚀 [COLLABORATIVE] Server autonomo avviato con discovery automatico`)
        
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
      // Ferma heartbeat
      const heartbeatInterval = (wsServerRef.current as any).heartbeatInterval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
      
      // Rimuovi registrazione dal discovery
      if (state.sessionCode) {
        try {
          const discoveryService = RemoteIPDiscovery.getInstance()
          await discoveryService.unregisterServer(state.sessionCode)
          console.log('🌍 [COLLABORATIVE] Server rimosso da discovery')
        } catch (error) {
          console.warn('⚠️ [COLLABORATIVE] Errore rimozione discovery:', error)
        }
      }
      
      await wsServerRef.current.stop()
      wsServerRef.current = null
      console.log('🛑 [COLLABORATIVE] Server autonomo fermato')
    }
    
    // Ferma rinnovo automatico tunnel
    browserTunnelManager.stopTunnelRenewal()
    
    setState(prev => ({ 
      ...prev, 
      serverStatus: 'stopped',
      sessionCode: null,
      connectedDJs: [],
      tunnelInfo: null
    }))
  }, [state.tunnelInfo])

  // Connetti a server (modalità client) - Solo con codice sessione
  const connectToServer = useCallback(async (sessionCode: string) => {
    try {
      console.log(`🔗 [COLLABORATIVE] Connessione con codice: ${sessionCode}`)
      setState(prev => ({ 
        ...prev, 
        serverStatus: 'connecting',
        sessionCode,
        errorMessage: null
      }))
      
      // Auto-discovery del server
      const serverUrl = await discoverServer(sessionCode)
      if (!serverUrl) {
        throw new Error('Server non trovato. Verifica che il DJ titolare sia online e che il codice sia corretto.')
      }
      
      console.log(`🌐 [COLLABORATIVE] Server trovato: ${serverUrl}`)
      
      // Crea client WebSocket REALE
      const wsClient = new RealClient({
        serverUrl,
        sessionCode,
        clientName: 'DJ Collaboratore',
        heartbeatInterval: 5000
      })
      
      // Configura eventi client
      wsClient.onStateChange((clientState) => {
        console.log('🔗 [COLLABORATIVE] Stato client:', clientState)
        
        if (clientState.connectionState === 'connected' && clientState.isAuthenticated) {
          setState(prev => ({ 
            ...prev, 
            serverStatus: 'running',
            serverUrl
          }))
        } else if (clientState.connectionState === 'failed') {
          setState(prev => ({ 
            ...prev, 
            serverStatus: 'error',
            errorMessage: clientState.error || 'Errore connessione'
          }))
        }
      })
      
      // Connetti al server
      await wsClient.connect()
      wsClientRef.current = wsClient
      
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

  // Connetti a server con IP specifico (modalità client manuale)
  const connectToServerWithIP = useCallback(async (sessionCode: string, serverIP: string) => {
    try {
      console.log(`🔗 [COLLABORATIVE] Connessione manuale con IP: ${serverIP}`)
      setState(prev => ({ 
        ...prev, 
        serverStatus: 'connecting',
        sessionCode,
        errorMessage: null
      }))
      
      // Costruisci URL server
      const serverUrl = serverIP.startsWith('http') ? serverIP : `http://${serverIP}`
      console.log(`🌐 [COLLABORATIVE] Server URL: ${serverUrl}`)
      
      // Crea client WebSocket REALE
      const wsClient = new RealClient({
        serverUrl,
        sessionCode,
        clientName: 'DJ Collaboratore',
        heartbeatInterval: 5000
      })
      
      // Configura eventi client
      wsClient.onStateChange((clientState) => {
        console.log('🔗 [COLLABORATIVE] Stato client:', clientState)
        
        if (clientState.connectionState === 'connected' && clientState.isAuthenticated) {
          setState(prev => ({ 
            ...prev, 
            serverStatus: 'running',
            connectedDJs: [{
              id: 'host',
              name: 'DJ Titolare',
              microphone: false,
              quality: 'excellent',
              connectedAt: new Date()
            }]
          }))
        } else if (clientState.connectionState === 'disconnected') {
          setState(prev => ({ 
            ...prev, 
            serverStatus: 'stopped',
            connectedDJs: []
          }))
        }
      })
      
      // Salva riferimento client
      wsClientRef.current = wsClient
      
      // Connetti
      await wsClient.connect()
      
    } catch (error) {
      console.error('❌ [COLLABORATIVE] Errore connessione:', error)
      setState(prev => ({ 
        ...prev, 
        serverStatus: 'stopped',
        errorMessage: error instanceof Error ? error.message : 'Errore di connessione'
      }))
      
      // Cleanup
      if (wsClientRef.current) {
        wsClientRef.current = null
      }
    }
  }, [])

  // Disconnetti da server
  const disconnectFromServer = useCallback(async () => {
    console.log('🔌 [COLLABORATIVE] Disconnessione da server...')
    
    if (wsClientRef.current) {
      await wsClientRef.current.disconnect()
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
    if (!state.sessionCode) {
      console.error('❌ [COLLABORATIVE] Nessun codice sessione da copiare')
      return false
    }

    // Genera URL di connessione
    let connectionURL: string
    if (state.connectionType === 'tunnel' && state.tunnelInfo) {
      connectionURL = state.tunnelInfo.publicUrl
    } else if (state.publicIP) {
      connectionURL = `http://${state.publicIP}:${state.serverPort}`
    } else if (state.localIP) {
      connectionURL = `http://${state.localIP}:${state.serverPort}`
    } else {
      connectionURL = 'URL non disponibile'
    }

    // Genera dati QR code
    const qrData = QRCodeGenerator.generateConnectionData(
      state.sessionCode,
      connectionURL,
      state.publicIP || state.localIP || 'unknown',
      state.serverPort
    )

    // Genera testo da copiare
    const textToCopy = QRCodeGenerator.generateShareText(qrData)

    return await copyToClipboard(textToCopy)
  }, [state.sessionCode, state.connectionType, state.tunnelInfo, state.publicIP, state.localIP, state.serverPort])

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

  // Test connessione server (per bottone test)
  const testServerConnection = useCallback(async (sessionCode: string): Promise<{ success: boolean; serverUrl?: string; error?: string }> => {
    try {
      console.log(`🧪 [TEST] Test connessione server per codice: ${sessionCode}`)
      
      // Usa lo stesso discovery del client per testare la connessione REALE
      const serverUrl = await discoverServer(sessionCode)
      
      if (serverUrl) {
        console.log(`✅ [TEST] Server trovato: ${serverUrl}`)
        return {
          success: true,
          serverUrl: serverUrl
        }
      } else {
        console.log(`❌ [TEST] Server non trovato per codice: ${sessionCode}`)
        return {
          success: false,
          error: 'Server non trovato. Verifica che il DJ titolare sia online e il codice sia corretto.'
        }
      }
      
    } catch (error) {
      console.error('❌ [TEST] Errore test connessione:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      }
    }
  }, [discoverServer])

  // ===== RENDER =====
  const actions: CollaborativeModeActions = {
    setMode,
    startServer,
    stopServer,
    connectToServer,
    connectToServerWithIP,
    disconnectFromServer,
    startLocalMicrophone,
    stopLocalMicrophone,
    setServerPort,
    clearError,
    copyConnectionInfo,
    shareConnectionInfo: shareConnectionInfoAction,
    detectLocalIP: detectLocalIPAction,
    setConnectionType,
    testServerConnection
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
