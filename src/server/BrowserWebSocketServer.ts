/**
 * 🌐 BROWSER WEB SOCKET SERVER
 * Server WebSocket compatibile con il browser per DJ collaborativo
 */

import { createWebRTCPeerConnection } from '../config/webrtc.config'

// ===== INTERFACCE =====
export interface BrowserWebSocketServerConfig {
  port: number
  sessionCode: string
  maxClients: number
  heartbeatInterval: number
}

export interface BrowserWebSocketClient {
  id: string
  name: string
  connection: RTCPeerConnection
  dataChannel: RTCDataChannel
  lastHeartbeat: Date
  isAuthenticated: boolean
}

export interface BrowserWebSocketMessage {
  type: string
  data: any
  timestamp: number
}

// ===== BROWSER WEB SOCKET SERVER =====
export class BrowserWebSocketServer {
  private config: BrowserWebSocketServerConfig
  private isRunning: boolean = false
  private clients: Map<string, BrowserWebSocketClient> = new Map()
  private connection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageHandlers: Map<string, (client: BrowserWebSocketClient, data: any) => void> = new Map()

  constructor(config: BrowserWebSocketServerConfig) {
    this.config = config
  }

  /**
   * Avvia il server (Browser-compatible)
   */
  async start(): Promise<void> {
    try {
      console.log(`🌐 [BROWSER WS SERVER] Avvio server browser-compatible...`)
      console.log(`📋 [BROWSER WS SERVER] Codice sessione: ${this.config.sessionCode}`)
      
      this.isRunning = true
      
      // Crea connessione WebRTC
      this.connection = createWebRTCPeerConnection('local')
      
      // Configura eventi connessione
      this.setupConnection()
      
      // Crea data channel
      this.dataChannel = this.connection.createDataChannel('signaling', {
        ordered: true
      })
      
      this.setupDataChannel()
      
      // Avvia heartbeat
      this.startHeartbeat()
      
      // Registra server per discovery
      this.registerForDiscovery()
      
      console.log(`✅ [BROWSER WS SERVER] Server avviato (Browser mode)`)
      
    } catch (error) {
      console.error('❌ [BROWSER WS SERVER] Errore avvio server:', error)
      throw error
    }
  }

  /**
   * Ferma il server
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 [BROWSER WS SERVER] Fermata server...')
      
      this.isRunning = false
      
      // Ferma heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval)
        this.heartbeatInterval = null
      }
      
      // Chiudi tutte le connessioni
      for (const [clientId, client] of this.clients) {
        try {
          client.connection.close()
          console.log(`🔌 [BROWSER WS SERVER] Connessione chiusa: ${clientId}`)
        } catch (error) {
          console.error(`❌ [BROWSER WS SERVER] Errore chiusura connessione ${clientId}:`, error)
        }
      }
      
      this.clients.clear()
      
      // Chiudi data channel
      if (this.dataChannel) {
        this.dataChannel.close()
        this.dataChannel = null
      }
      
      // Chiudi connessione
      if (this.connection) {
        this.connection.close()
        this.connection = null
      }
      
      // Rimuovi registrazione discovery
      this.unregisterFromDiscovery()
      
      console.log('✅ [BROWSER WS SERVER] Server fermato')
      
    } catch (error) {
      console.error('❌ [BROWSER WS SERVER] Errore fermata server:', error)
      throw error
    }
  }

  /**
   * Configura eventi connessione WebRTC
   */
  private setupConnection(): void {
    if (!this.connection) return

    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 [BROWSER WS SERVER] ICE candidate generato')
      }
    }

    this.connection.onconnectionstatechange = () => {
      console.log(`🔗 [BROWSER WS SERVER] Stato connessione: ${this.connection?.connectionState}`)
    }
  }

  /**
   * Configura data channel
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return

    this.dataChannel.onopen = () => {
      console.log('📡 [BROWSER WS SERVER] Data channel aperto')
    }

    this.dataChannel.onclose = () => {
      console.log('📡 [BROWSER WS SERVER] Data channel chiuso')
    }

    this.dataChannel.onerror = (error) => {
      console.error('❌ [BROWSER WS SERVER] Errore data channel:', error)
    }

    this.dataChannel.onmessage = (event) => {
      try {
        const message: BrowserWebSocketMessage = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        console.error('❌ [BROWSER WS SERVER] Errore parsing messaggio:', error)
      }
    }
  }

  /**
   * Gestisce messaggi ricevuti
   */
  private handleMessage(message: BrowserWebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type)
    if (handler) {
      // Trova il client che ha inviato il messaggio
      const client = Array.from(this.clients.values()).find(c => 
        c.dataChannel === this.dataChannel
      )
      
      if (client) {
        handler(client, message.data)
      }
    }
  }

  /**
   * Registra handler per tipo di messaggio
   */
  onMessage(type: string, handler: (client: BrowserWebSocketClient, data: any) => void): void {
    this.messageHandlers.set(type, handler)
  }

  /**
   * Invia messaggio a un client specifico
   */
  sendMessage(clientId: string, type: string, data: any): void {
    const client = this.clients.get(clientId)
    if (client && client.dataChannel.readyState === 'open') {
      const message: BrowserWebSocketMessage = {
        type,
        data,
        timestamp: Date.now()
      }
      client.dataChannel.send(JSON.stringify(message))
    }
  }

  /**
   * Invia messaggio a tutti i client
   */
  broadcastMessage(type: string, data: any): void {
    for (const [clientId] of this.clients) {
      this.sendMessage(clientId, type, data)
    }
  }

  /**
   * Ottiene lista client connessi
   */
  getConnectedClients(): BrowserWebSocketClient[] {
    return Array.from(this.clients.values())
  }

  /**
   * Avvia heartbeat per monitorare connessioni
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date()
      const timeout = this.config.heartbeatInterval * 2

      for (const [clientId, client] of this.clients) {
        if (now.getTime() - client.lastHeartbeat.getTime() > timeout) {
          console.log(`💔 [BROWSER WS SERVER] Client timeout: ${clientId}`)
          this.disconnectClient(clientId)
        }
      }
    }, this.config.heartbeatInterval)
  }

  /**
   * Disconnette un client
   */
  private disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (client) {
      try {
        client.connection.close()
        this.clients.delete(clientId)
        console.log(`🔌 [BROWSER WS SERVER] Client disconnesso: ${clientId}`)
      } catch (error) {
        console.error(`❌ [BROWSER WS SERVER] Errore disconnessione client ${clientId}:`, error)
      }
    }
  }

  /**
   * Registra server per discovery
   */
  private registerForDiscovery(): void {
    // Espone server globalmente per discovery
    ;(window as any).__djServerDiscovery = {
      sessionCode: this.config.sessionCode,
      port: this.config.port,
      isRunning: () => this.isRunning,
      getClientCount: () => this.clients.size,
      server: this
    }
    
    console.log('🌍 [BROWSER WS SERVER] Server registrato per discovery')
  }

  /**
   * Rimuove registrazione discovery
   */
  private unregisterFromDiscovery(): void {
    if ((window as any).__djServerDiscovery) {
      delete (window as any).__djServerDiscovery
    }
    
    console.log('🌍 [BROWSER WS SERVER] Server rimosso da discovery')
  }

  /**
   * Verifica se il server è in esecuzione
   */
  isServerRunning(): boolean {
    return this.isRunning
  }
}