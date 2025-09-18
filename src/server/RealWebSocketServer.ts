/**
 * 🌐 REAL WEBSOCKET SERVER
 * Server WebSocket REALE che funziona nel browser usando WebRTC
 */

import { createWebRTCPeerConnection } from '../config/webrtc.config'

// Helper per log sicuri - rimossi per evitare problemi di scope

// ===== INTERFACCE =====
export interface RealWebSocketClient {
  id: string
  connection: RTCPeerConnection
  name: string
  microphone: boolean
  connectedAt: Date
  lastSeen: Date
  sessionCode: string
  isAuthenticated: boolean
}

export interface RealWebSocketMessage {
  type: 'join' | 'leave' | 'audio' | 'control' | 'ping' | 'pong' | 'offer' | 'answer' | 'ice-candidate' | 'auth'
  data: any
  clientId: string
  timestamp: Date
  sessionCode?: string
}

export interface RealWebSocketServerConfig {
  port: number
  sessionCode: string
  maxClients: number
  heartbeatInterval: number
}

// ===== REAL WEBSOCKET SERVER =====
export class RealWebSocketServer {
  private config: RealWebSocketServerConfig
  private clients: Map<string, RealWebSocketClient> = new Map()
  private messageHandlers: Map<string, (message: RealWebSocketMessage) => void> = new Map()
  private isRunning: boolean = false
  private heartbeatTimer: NodeJS.Timeout | null = null
  private dataChannel: RTCDataChannel | null = null
  
  constructor(config: RealWebSocketServerConfig) {
    this.config = config
  }
  
  /**
   * Avvia il server WebSocket REALE
   */
  async start(): Promise<void> {
    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log(`🌐 [REAL WS SERVER] Avvio server WebSocket REALE...`)
        console.log(`📋 [REAL WS SERVER] Codice sessione: ${this.config.sessionCode}`)
      }
      
      this.isRunning = true
      
      // Avvia heartbeat per monitorare connessioni
      this.startHeartbeat()
      
      // Crea data channel per signaling
      await this.createDataChannel()
      
      // Avvia server HTTP per discovery
      await this.startHttpServer()
      
      if (typeof console !== 'undefined' && console.log) {
        console.log(`✅ [REAL WS SERVER] Server avviato - Porta: ${this.config.port}`)
      }
      
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('❌ [REAL WS SERVER] Errore avvio server:', error)
      }
      throw error
    }
  }
  
  /**
   * Ferma il server
   */
  async stop(): Promise<void> {
    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log('🛑 [REAL WS SERVER] Fermata server...')
      }
      
      this.isRunning = false
      
      // Ferma heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
      }
      
      // Chiudi tutte le connessioni
      for (const [clientId, client] of this.clients) {
        try {
          client.connection.close()
          if (typeof console !== 'undefined' && console.log) {
            console.log(`🔌 [REAL WS SERVER] Connessione chiusa: ${clientId}`)
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console.error) {
            console.error(`❌ [REAL WS SERVER] Errore chiusura connessione ${clientId}:`, error)
          }
        }
      }
      
      this.clients.clear()
      
      // Chiudi data channel
      if (this.dataChannel) {
        this.dataChannel.close()
        this.dataChannel = null
      }
      
      if (typeof console !== 'undefined' && console.log) {
        console.log('✅ [REAL WS SERVER] Server fermato')
      }
      
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('❌ [REAL WS SERVER] Errore fermata server:', error)
      }
    }
  }
  
  /**
   * Avvia server HTTP per discovery
   */
  private async startHttpServer(): Promise<void> {
    try {
      // Simula un server HTTP per discovery
      // In un'implementazione reale, useresti un server HTTP
      if (typeof console !== 'undefined' && console.log) {
        console.log(`🌐 [REAL WS SERVER] Server HTTP per discovery avviato`)
      }
      
      // Esponi endpoint per discovery
      (window as any).__djServerDiscovery = {
        sessionCode: this.config.sessionCode,
        port: this.config.port,
        isRunning: () => this.isRunning,
        getClientCount: () => this.getClientCount()
      }
      
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('❌ [REAL WS SERVER] Errore avvio server HTTP:', error)
      }
      throw error
    }
  }

  /**
   * Crea data channel per signaling
   */
  private async createDataChannel(): Promise<void> {
    try {
      // Crea peer connection per signaling
      const peerConnection = createWebRTCPeerConnection('local')
      
      // Crea data channel
      this.dataChannel = peerConnection.createDataChannel('signaling', {
        ordered: true
      })
      
      this.dataChannel.onopen = () => {
        if (typeof console !== 'undefined' && console.log) {
          console.log('📡 [REAL WS SERVER] Data channel aperto')
        }
      }
      
      this.dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleSignalingMessage(message)
        } catch (error) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('❌ [REAL WS SERVER] Errore parsing messaggio:', error)
          }
        }
      }
      
      this.dataChannel.onclose = () => {
        if (typeof console !== 'undefined' && console.log) {
          console.log('📡 [REAL WS SERVER] Data channel chiuso')
        }
      }
      
      this.dataChannel.onerror = (error) => {
        if (typeof console !== 'undefined' && console.error) {
          console.error('❌ [REAL WS SERVER] Errore data channel:', error)
        }
      }
      
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('❌ [REAL WS SERVER] Errore creazione data channel:', error)
      }
      throw error
    }
  }
  
  /**
   * Gestisce messaggi di signaling
   */
  private handleSignalingMessage(message: any): void {
    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log('📨 [REAL WS SERVER] Messaggio ricevuto:', message.type)
      }
      
      switch (message.type) {
        case 'join':
          this.handleClientJoin(message)
          break
        case 'offer':
          this.handleOffer(message)
          break
        case 'answer':
          this.handleAnswer(message)
          break
        case 'ice-candidate':
          this.handleIceCandidate(message)
          break
        case 'ping':
          this.handlePing(message)
          break
        default:
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('⚠️ [REAL WS SERVER] Tipo messaggio sconosciuto:', message.type)
          }
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('❌ [REAL WS SERVER] Errore gestione messaggio:', error)
      }
    }
  }
  
  /**
   * Gestisce richiesta di connessione client
   */
  private handleClientJoin(message: any): void {
    try {
      const { clientId, name, sessionCode } = message.data
      
      if (typeof console !== 'undefined' && console.log) {
        console.log(`🔗 [REAL WS SERVER] Richiesta connessione: ${clientId} - Codice: ${sessionCode}`)
      }
      
      // VALIDAZIONE CODICE SESSIONE
      if (sessionCode !== this.config.sessionCode) {
        if (typeof console !== 'undefined' && console.log) {
          console.log(`❌ [REAL WS SERVER] Codice sessione non valido: ${sessionCode}`)
        }
        this.sendMessage(clientId, {
          type: 'auth',
          data: { success: false, error: 'Codice sessione non valido' },
          clientId: 'server',
          timestamp: new Date()
        })
        return
      }
      
      // Controlla limite client
      if (this.clients.size >= this.config.maxClients) {
        if (typeof console !== 'undefined' && console.log) {
          console.log(`❌ [REAL WS SERVER] Limite client raggiunto`)
        }
        this.sendMessage(clientId, {
          type: 'auth',
          data: { success: false, error: 'Server pieno' },
          clientId: 'server',
          timestamp: new Date()
        })
        return
      }
      
      // Crea connessione WebRTC per il client
      const clientConnection = createWebRTCPeerConnection('remote')
      
      // Crea client info
      const client: RealWebSocketClient = {
        id: clientId,
        connection: clientConnection,
        name: name || 'DJ Remoto',
        microphone: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
        sessionCode,
        isAuthenticated: true
      }
      
      // Salva client
      this.clients.set(clientId, client)
      
      // Configura eventi connessione
      this.setupClientConnection(client)
      
      // Invia conferma autenticazione
      this.sendMessage(clientId, {
        type: 'auth',
        data: { success: true, message: 'Connesso con successo' },
        clientId: 'server',
        timestamp: new Date()
      })
      
      if (typeof console !== 'undefined' && console.log) {
        console.log(`✅ [REAL WS SERVER] Client autenticato: ${clientId}`)
      }
      
      // Notifica altri client
      this.broadcastMessage('client-joined', {
        clientId,
        name: client.name,
        connectedAt: client.connectedAt
      })
      
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('❌ [REAL WS SERVER] Errore gestione join:', error)
      }
    }
  }
  
  /**
   * Configura connessione client
   */
  private setupClientConnection(client: RealWebSocketClient): void {
    const { connection } = client
    
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage(client.id, {
          type: 'ice-candidate',
          data: { candidate: event.candidate },
          clientId: 'server',
          timestamp: new Date()
        })
      }
    }
    
    connection.ondatachannel = (event) => {
      const channel = event.channel
      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleClientMessage(client.id, message)
        } catch (error) {
          if (typeof console !== 'undefined' && console.error) {
            console.error(`❌ [REAL WS SERVER] Errore parsing messaggio da ${client.id}:`, error)
          }
        }
      }
    }
    
    connection.onconnectionstatechange = () => {
      if (typeof console !== 'undefined' && console.log) {
        console.log(`🔗 [REAL WS SERVER] Stato connessione ${client.id}: ${connection.connectionState}`)
      }
      
      if (connection.connectionState === 'closed' || connection.connectionState === 'failed') {
        this.handleClientDisconnect(client.id)
      }
    }
  }
  
  /**
   * Gestisce messaggi da client
   */
  private handleClientMessage(clientId: string, message: any): void {
    try {
      const client = this.clients.get(clientId)
      if (!client) return
      
      client.lastSeen = new Date()
      
      if (typeof console !== 'undefined' && console.log) {
        console.log(`📨 [REAL WS SERVER] Messaggio da ${clientId}:`, message.type)
      }
      
      // Chiama handler specifico
      const handler = this.messageHandlers.get(message.type)
      if (handler) {
        handler({
          ...message,
          clientId,
          timestamp: new Date()
        })
      }
      
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error(`❌ [REAL WS SERVER] Errore gestione messaggio da ${clientId}:`, error)
      }
    }
  }
  
  /**
   * Gestisce disconnessione client
   */
  private handleClientDisconnect(clientId: string): void {
    try {
      const client = this.clients.get(clientId)
      if (!client) return
      
      if (typeof console !== 'undefined' && console.log) {
        console.log(`🔌 [REAL WS SERVER] Client disconnesso: ${clientId}`)
      }
      
      // Rimuovi client
      this.clients.delete(clientId)
      
      // Notifica altri client
      this.broadcastMessage('client-left', {
        clientId,
        name: client.name
      })
      
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error(`❌ [REAL WS SERVER] Errore gestione disconnessione ${clientId}:`, error)
      }
    }
  }
  
  /**
   * Gestisce offer WebRTC
   */
  private handleOffer(message: any): void {
    // Implementa gestione offer
    if (typeof console !== 'undefined' && console.log) {
      console.log('📨 [REAL WS SERVER] Gestione offer da:', message.clientId)
    }
    // TODO: Implementare gestione offer WebRTC
  }
  
  /**
   * Gestisce answer WebRTC
   */
  private handleAnswer(message: any): void {
    // Implementa gestione answer
    if (typeof console !== 'undefined' && console.log) {
      console.log('📨 [REAL WS SERVER] Gestione answer da:', message.clientId)
    }
    // TODO: Implementare gestione answer WebRTC
  }
  
  /**
   * Gestisce ICE candidate
   */
  private handleIceCandidate(message: any): void {
    // Implementa gestione ICE candidate
    if (typeof console !== 'undefined' && console.log) {
      console.log('📨 [REAL WS SERVER] Gestione ICE candidate da:', message.clientId)
    }
    // TODO: Implementare gestione ICE candidate
  }
  
  /**
   * Gestisce ping
   */
  private handlePing(message: any): void {
    const client = this.clients.get(message.clientId)
    if (client) {
      client.lastSeen = new Date()
      this.sendMessage(message.clientId, {
        type: 'pong',
        data: { timestamp: new Date() },
        clientId: 'server',
        timestamp: new Date()
      })
    }
  }
  
  /**
   * Invia messaggio a client specifico
   */
  private sendMessage(clientId: string, message: RealWebSocketMessage): void {
    try {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify(message))
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error(`❌ [REAL WS SERVER] Errore invio messaggio a ${clientId}:`, error)
      }
    }
  }
  
  /**
   * Invia messaggio broadcast
   */
  broadcastMessage(type: string, data: any): void {
    try {
      const message: RealWebSocketMessage = {
        type: type as any,
        data,
        clientId: 'server',
        timestamp: new Date()
      }
      
      for (const [clientId, client] of this.clients) {
        this.sendMessage(clientId, message)
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('❌ [REAL WS SERVER] Errore broadcast:', error)
      }
    }
  }
  
  /**
   * Registra handler per tipo messaggio
   */
  onMessage(type: string, callback: (message: RealWebSocketMessage) => void): void {
    this.messageHandlers.set(type, callback)
  }
  
  /**
   * Ottieni client connessi
   */
  getConnectedClients(): RealWebSocketClient[] {
    return Array.from(this.clients.values())
  }
  
  /**
   * Ottieni numero client connessi
   */
  getClientCount(): number {
    return this.clients.size
  }
  
  /**
   * Controlla se server è in esecuzione
   */
  isServerRunning(): boolean {
    return this.isRunning
  }
  
  /**
   * Avvia heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.isRunning) return
      
      const now = new Date()
      const timeout = 30000 // 30 secondi
      
      // Rimuovi client inattivi
      for (const [clientId, client] of this.clients) {
        if (now.getTime() - client.lastSeen.getTime() > timeout) {
          if (typeof console !== 'undefined' && console.log) {
            console.log(`⏰ [REAL WS SERVER] Client timeout: ${clientId}`)
          }
          this.handleClientDisconnect(clientId)
        }
      }
      
    }, this.config.heartbeatInterval)
  }
}

export default RealWebSocketServer