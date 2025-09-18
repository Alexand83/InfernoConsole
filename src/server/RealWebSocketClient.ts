/**
 * 🌐 REAL WEBSOCKET CLIENT
 * Client WebSocket REALE per connessioni DJ collaborativo
 */

import { createWebRTCPeerConnection } from '../config/webrtc.config'

// ===== INTERFACCE =====
export interface RealWebSocketClientConfig {
  serverUrl: string
  sessionCode: string
  clientName: string
  heartbeatInterval: number
}

export interface RealWebSocketClientMessage {
  type: 'join' | 'leave' | 'audio' | 'control' | 'ping' | 'pong' | 'offer' | 'answer' | 'ice-candidate' | 'auth'
  data: any
  clientId: string
  timestamp: Date
  sessionCode?: string
}

export interface RealWebSocketClientState {
  isConnected: boolean
  isAuthenticated: boolean
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed'
  error: string | null
  lastPing: Date | null
  latency: number
}

// ===== REAL WEBSOCKET CLIENT =====
export class RealWebSocketClient {
  private config: RealWebSocketClientConfig
  private state: RealWebSocketClientState
  private connection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private messageHandlers: Map<string, (message: RealWebSocketClientMessage) => void> = new Map()
  private clientId: string
  private onStateChangeCallback: ((state: RealWebSocketClientState) => void) | null = null
  
  constructor(config: RealWebSocketClientConfig) {
    this.config = config
    this.clientId = this.generateClientId()
    this.state = {
      isConnected: false,
      isAuthenticated: false,
      connectionState: 'disconnected',
      error: null,
      lastPing: null,
      latency: 0
    }
  }
  
  /**
   * Genera ID client unico
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Connetti al server
   */
  async connect(): Promise<void> {
    try {
      console.log(`🔗 [REAL WS CLIENT] Connessione a server: ${this.config.serverUrl}`)
      console.log(`📋 [REAL WS CLIENT] Codice sessione: ${this.config.sessionCode}`)
      
      this.updateState({ connectionState: 'connecting', error: null })
      
      // Crea connessione WebRTC
      this.connection = createWebRTCPeerConnection('remote')
      
      // Configura eventi connessione
      this.setupConnection()
      
      // Crea data channel
      this.dataChannel = this.connection.createDataChannel('signaling', {
        ordered: true
      })
      
      this.setupDataChannel()
      
      // Invia richiesta di connessione
      await this.sendJoinRequest()
      
      // Avvia heartbeat
      this.startHeartbeat()
      
      console.log('✅ [REAL WS CLIENT] Connessione avviata')
      
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore connessione:', error)
      this.updateState({ 
        connectionState: 'failed', 
        error: `Errore connessione: ${error}` 
      })
      throw error
    }
  }
  
  /**
   * Disconnetti dal server
   */
  async disconnect(): Promise<void> {
    try {
      console.log('🔌 [REAL WS CLIENT] Disconnessione...')
      
      // Ferma heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
      }
      
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
      
      this.updateState({ 
        isConnected: false,
        isAuthenticated: false,
        connectionState: 'disconnected',
        error: null
      })
      
      console.log('✅ [REAL WS CLIENT] Disconnesso')
      
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore disconnessione:', error)
    }
  }
  
  /**
   * Configura connessione WebRTC
   */
  private setupConnection(): void {
    if (!this.connection) return
    
    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          type: 'ice-candidate',
          data: { candidate: event.candidate },
          clientId: this.clientId,
          timestamp: new Date()
        })
      }
    }
    
    this.connection.onconnectionstatechange = () => {
      if (!this.connection) return
      
      console.log(`🔗 [REAL WS CLIENT] Stato connessione: ${this.connection.connectionState}`)
      
      switch (this.connection.connectionState) {
        case 'connected':
          this.updateState({ 
            isConnected: true,
            connectionState: 'connected',
            error: null
          })
          break
        case 'disconnected':
        case 'failed':
        case 'closed':
          this.updateState({ 
            isConnected: false,
            isAuthenticated: false,
            connectionState: 'disconnected'
          })
          break
      }
    }
    
    this.connection.ondatachannel = (event) => {
      const channel = event.channel
      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('❌ [REAL WS CLIENT] Errore parsing messaggio:', error)
        }
      }
    }
  }
  
  /**
   * Configura data channel
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return
    
    this.dataChannel.onopen = () => {
      console.log('📡 [REAL WS CLIENT] Data channel aperto')
    }
    
    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        console.error('❌ [REAL WS CLIENT] Errore parsing messaggio:', error)
      }
    }
    
    this.dataChannel.onclose = () => {
      console.log('📡 [REAL WS CLIENT] Data channel chiuso')
    }
    
    this.dataChannel.onerror = (error) => {
      console.error('❌ [REAL WS CLIENT] Errore data channel:', error)
    }
  }
  
  /**
   * Invia richiesta di connessione
   */
  private async sendJoinRequest(): Promise<void> {
    try {
      const message: RealWebSocketClientMessage = {
        type: 'join',
        data: {
          clientId: this.clientId,
          name: this.config.clientName,
          sessionCode: this.config.sessionCode
        },
        clientId: this.clientId,
        timestamp: new Date(),
        sessionCode: this.config.sessionCode
      }
      
      await this.sendMessage(message)
      console.log('📨 [REAL WS CLIENT] Richiesta connessione inviata')
      
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore invio richiesta connessione:', error)
      throw error
    }
  }
  
  /**
   * Gestisce messaggi ricevuti
   */
  private handleMessage(message: RealWebSocketClientMessage): void {
    try {
      console.log(`📨 [REAL WS CLIENT] Messaggio ricevuto: ${message.type}`)
      
      switch (message.type) {
        case 'auth':
          this.handleAuth(message)
          break
        case 'pong':
          this.handlePong(message)
          break
        case 'client-joined':
          this.handleClientJoined(message)
          break
        case 'client-left':
          this.handleClientLeft(message)
          break
        default:
          // Chiama handler specifico
          const handler = this.messageHandlers.get(message.type)
          if (handler) {
            handler(message)
          }
      }
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore gestione messaggio:', error)
    }
  }
  
  /**
   * Gestisce risposta autenticazione
   */
  private handleAuth(message: RealWebSocketClientMessage): void {
    try {
      const { success, error } = message.data
      
      if (success) {
        console.log('✅ [REAL WS CLIENT] Autenticazione riuscita')
        this.updateState({ 
          isAuthenticated: true,
          error: null
        })
      } else {
        console.log(`❌ [REAL WS CLIENT] Autenticazione fallita: ${error}`)
        this.updateState({ 
          isAuthenticated: false,
          connectionState: 'failed',
          error: error
        })
      }
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore gestione auth:', error)
    }
  }
  
  /**
   * Gestisce pong
   */
  private handlePong(message: RealWebSocketClientMessage): void {
    try {
      const now = new Date()
      const pingTime = message.data.timestamp
      const latency = now.getTime() - new Date(pingTime).getTime()
      
      this.updateState({ 
        lastPing: now,
        latency
      })
      
      console.log(`🏓 [REAL WS CLIENT] Pong ricevuto - Latenza: ${latency}ms`)
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore gestione pong:', error)
    }
  }
  
  /**
   * Gestisce client connesso
   */
  private handleClientJoined(message: RealWebSocketClientMessage): void {
    try {
      const { clientId, name, connectedAt } = message.data
      console.log(`👥 [REAL WS CLIENT] Client connesso: ${name} (${clientId})`)
      
      // Chiama handler se registrato
      const handler = this.messageHandlers.get('client-joined')
      if (handler) {
        handler(message)
      }
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore gestione client joined:', error)
    }
  }
  
  /**
   * Gestisce client disconnesso
   */
  private handleClientLeft(message: RealWebSocketClientMessage): void {
    try {
      const { clientId, name } = message.data
      console.log(`👥 [REAL WS CLIENT] Client disconnesso: ${name} (${clientId})`)
      
      // Chiama handler se registrato
      const handler = this.messageHandlers.get('client-left')
      if (handler) {
        handler(message)
      }
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore gestione client left:', error)
    }
  }
  
  /**
   * Invia messaggio al server
   */
  async sendMessage(message: RealWebSocketClientMessage): Promise<void> {
    try {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        throw new Error('Data channel non disponibile')
      }
      
      this.dataChannel.send(JSON.stringify(message))
      
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore invio messaggio:', error)
      throw error
    }
  }
  
  /**
   * Invia ping
   */
  private sendPing(): void {
    try {
      const message: RealWebSocketClientMessage = {
        type: 'ping',
        data: { timestamp: new Date() },
        clientId: this.clientId,
        timestamp: new Date()
      }
      
      this.sendMessage(message)
      
    } catch (error) {
      console.error('❌ [REAL WS CLIENT] Errore invio ping:', error)
    }
  }
  
  /**
   * Avvia heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.state.isConnected) {
        this.sendPing()
      }
    }, this.config.heartbeatInterval)
  }
  
  /**
   * Aggiorna stato
   */
  private updateState(updates: Partial<RealWebSocketClientState>): void {
    this.state = { ...this.state, ...updates }
    
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.state)
    }
  }
  
  /**
   * Registra handler per tipo messaggio
   */
  onMessage(type: string, callback: (message: RealWebSocketClientMessage) => void): void {
    this.messageHandlers.set(type, callback)
  }
  
  /**
   * Registra callback per cambiamenti stato
   */
  onStateChange(callback: (state: RealWebSocketClientState) => void): void {
    this.onStateChangeCallback = callback
  }
  
  /**
   * Ottieni stato corrente
   */
  getState(): RealWebSocketClientState {
    return { ...this.state }
  }
  
  /**
   * Ottieni ID client
   */
  getClientId(): string {
    return this.clientId
  }
  
  /**
   * Controlla se connesso
   */
  isConnected(): boolean {
    return this.state.isConnected && this.state.isAuthenticated
  }
}

export default RealWebSocketClient
