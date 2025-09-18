/**
 * 🌐 BROWSER WEBSOCKET SERVER
 * Server WebSocket che funziona nel BROWSER
 */

import { createWebRTCPeerConnection } from '../config/webrtc.config'

// ===== INTERFACCE =====
export interface BrowserWebSocketClient {
  id: string
  connection: RTCPeerConnection | WebSocket
  name: string
  microphone: boolean
  connectedAt: Date
  lastSeen: Date
  type: 'webrtc' | 'websocket'
}

export interface BrowserWebSocketMessage {
  type: 'join' | 'leave' | 'audio' | 'control' | 'ping' | 'pong' | 'offer' | 'answer' | 'ice-candidate'
  data: any
  clientId: string
  timestamp: Date
}

// ===== BROWSER WEBSOCKET SERVER =====
export class BrowserWebSocketServer {
  private port: number
  private clients: Map<string, BrowserWebSocketClient> = new Map()
  private messageHandlers: Map<string, (message: BrowserWebSocketMessage) => void> = new Map()
  private isRunning: boolean = false
  private signalingServer: string = 'wss://signaling-server.herokuapp.com' // Server di signaling pubblico
  
  constructor(port: number = 8080) {
    this.port = port
  }
  
  /**
   * Avvia il server WebSocket nel browser
   */
  async start(): Promise<void> {
    try {
      console.log(`🌐 [BROWSER WS SERVER] Avvio server WebSocket nel browser...`)
      
      // Metodo 1: Usa WebRTC per connessioni P2P
      await this.startWebRTCServer()
      
      // Metodo 2: Usa WebSocket client per connessioni remote
      await this.startWebSocketClient()
      
      this.isRunning = true
      console.log(`✅ [BROWSER WS SERVER] Server WebSocket avviato nel browser`)
      
    } catch (error) {
      console.error('❌ [BROWSER WS SERVER] Errore avvio server:', error)
      throw error
    }
  }
  
  /**
   * Avvia server WebRTC per connessioni P2P
   */
  private async startWebRTCServer(): Promise<void> {
    console.log('🌐 [BROWSER WS SERVER] Avvio server WebRTC...')
    
    // Crea connessione WebRTC per signaling
    const signalingConnection = new WebSocket(this.signalingServer)
    
    signalingConnection.onopen = () => {
      console.log('✅ [BROWSER WS SERVER] Connesso al server di signaling')
      
      // Registra questo server come "host"
      signalingConnection.send(JSON.stringify({
        type: 'register-host',
        data: {
          port: this.port,
          capabilities: ['audio', 'control']
        }
      }))
    }
    
    signalingConnection.onmessage = (event) => {
      this.handleSignalingMessage(event.data)
    }
    
    signalingConnection.onerror = (error) => {
      console.error('❌ [BROWSER WS SERVER] Errore signaling:', error)
    }
  }
  
  /**
   * Avvia WebSocket client per connessioni remote
   */
  private async startWebSocketClient(): Promise<void> {
    console.log('🌐 [BROWSER WS SERVER] Avvio WebSocket client...')
    
    // Crea WebSocket client per connessioni remote
    const wsClient = new WebSocket(`wss://websocket-server.herokuapp.com/room/${this.port}`)
    
    wsClient.onopen = () => {
      console.log('✅ [BROWSER WS SERVER] Connesso al server WebSocket remoto')
    }
    
    wsClient.onmessage = (event) => {
      this.handleWebSocketMessage(event.data)
    }
    
    wsClient.onerror = (error) => {
      console.error('❌ [BROWSER WS SERVER] Errore WebSocket client:', error)
    }
  }
  
  /**
   * Gestisce messaggi di signaling WebRTC
   */
  private handleSignalingMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      
      switch (message.type) {
        case 'client-join':
          this.handleClientJoin(message.data)
          break
        case 'offer':
          this.handleWebRTCOffer(message.data)
          break
        case 'answer':
          this.handleWebRTCAnswer(message.data)
          break
        case 'ice-candidate':
          this.handleICECandidate(message.data)
          break
      }
    } catch (error) {
      console.error('❌ [BROWSER WS SERVER] Errore parsing signaling:', error)
    }
  }
  
  /**
   * Gestisce messaggi WebSocket
   */
  private handleWebSocketMessage(data: string): void {
    try {
      const message: BrowserWebSocketMessage = JSON.parse(data)
      this.handleMessage(message.clientId, message)
    } catch (error) {
      console.error('❌ [BROWSER WS SERVER] Errore parsing WebSocket:', error)
    }
  }
  
  /**
   * Gestisce join di nuovi client
   */
  private handleClientJoin(data: any): void {
    const clientId = this.generateClientId()
    const client: BrowserWebSocketClient = {
      id: clientId,
      connection: createWebRTCPeerConnection('auto'),
      name: data.name || 'DJ Remoto',
      microphone: false,
      connectedAt: new Date(),
      lastSeen: new Date(),
      type: 'webrtc'
    }
    
    this.clients.set(clientId, client)
    console.log(`🔗 [BROWSER WS SERVER] Nuovo client WebRTC: ${clientId}`)
    
    // Gestisci connessione WebRTC
    this.setupWebRTCConnection(client)
  }
  
  /**
   * Configura connessione WebRTC
   */
  private setupWebRTCConnection(client: BrowserWebSocketClient): void {
    const peerConnection = client.connection as RTCPeerConnection
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Invia ICE candidate al client
        this.sendSignalingMessage({
          type: 'ice-candidate',
          data: {
            candidate: event.candidate,
            clientId: client.id
          }
        })
      }
    }
    
    peerConnection.ondatachannel = (event) => {
      const channel = event.channel
      channel.onmessage = (event) => {
        this.handleMessage(client.id, JSON.parse(event.data))
      }
    }
    
    // Crea data channel per comunicazione
    const dataChannel = peerConnection.createDataChannel('dj-communication')
    dataChannel.onopen = () => {
      console.log(`✅ [BROWSER WS SERVER] Data channel aperto per ${client.id}`)
    }
  }
  
  /**
   * Gestisce offer WebRTC
   */
  private handleWebRTCOffer(data: any): void {
    const client = this.clients.get(data.clientId)
    if (client) {
      const peerConnection = client.connection as RTCPeerConnection
      
      peerConnection.setRemoteDescription(data.offer)
        .then(() => peerConnection.createAnswer())
        .then(answer => {
          peerConnection.setLocalDescription(answer)
          this.sendSignalingMessage({
            type: 'answer',
            data: {
              answer,
              clientId: data.clientId
            }
          })
        })
        .catch(error => {
          console.error('❌ [BROWSER WS SERVER] Errore WebRTC offer:', error)
        })
    }
  }
  
  /**
   * Gestisce answer WebRTC
   */
  private handleWebRTCAnswer(data: any): void {
    const client = this.clients.get(data.clientId)
    if (client) {
      const peerConnection = client.connection as RTCPeerConnection
      peerConnection.setRemoteDescription(data.answer)
    }
  }
  
  /**
   * Gestisce ICE candidate
   */
  private handleICECandidate(data: any): void {
    const client = this.clients.get(data.clientId)
    if (client) {
      const peerConnection = client.connection as RTCPeerConnection
      peerConnection.addIceCandidate(data.candidate)
    }
  }
  
  /**
   * Gestisce messaggi dai client
   */
  private handleMessage(clientId: string, message: BrowserWebSocketMessage): void {
    try {
      message.clientId = clientId
      message.timestamp = new Date()
      
      console.log(`📨 [BROWSER WS SERVER] Messaggio da ${clientId}:`, message.type)
      
      // Aggiorna last seen
      const client = this.clients.get(clientId)
      if (client) {
        client.lastSeen = new Date()
      }
      
      // Gestisci diversi tipi di messaggio
      switch (message.type) {
        case 'join':
          this.handleJoinMessage(clientId, message)
          break
        case 'audio':
          this.handleAudioMessage(clientId, message)
          break
        case 'control':
          this.handleControlMessage(clientId, message)
          break
        case 'ping':
          this.handlePingMessage(clientId, message)
          break
        default:
          console.log(`⚠️ [BROWSER WS SERVER] Tipo messaggio non riconosciuto: ${message.type}`)
      }
      
      // Chiama handler personalizzati
      const handler = this.messageHandlers.get(message.type)
      if (handler) {
        handler(message)
      }
      
    } catch (error) {
      console.error(`❌ [BROWSER WS SERVER] Errore gestione messaggio da ${clientId}:`, error)
    }
  }
  
  /**
   * Gestisce messaggi di join
   */
  private handleJoinMessage(clientId: string, message: BrowserWebSocketMessage): void {
    const client = this.clients.get(clientId)
    if (client && message.data.name) {
      client.name = message.data.name
      console.log(`👋 [BROWSER WS SERVER] Client ${clientId} si è presentato come: ${client.name}`)
    }
  }
  
  /**
   * Gestisce messaggi audio
   */
  private handleAudioMessage(clientId: string, message: BrowserWebSocketMessage): void {
    // Inoltra audio a tutti gli altri client
    this.broadcastToOthers(clientId, message)
  }
  
  /**
   * Gestisce messaggi di controllo
   */
  private handleControlMessage(clientId: string, message: BrowserWebSocketMessage): void {
    const client = this.clients.get(clientId)
    if (client && message.data.microphone !== undefined) {
      client.microphone = message.data.microphone
      console.log(`🎤 [BROWSER WS SERVER] Client ${clientId} microfono: ${client.microphone ? 'ON' : 'OFF'}`)
    }
  }
  
  /**
   * Gestisce messaggi ping
   */
  private handlePingMessage(clientId: string, message: BrowserWebSocketMessage): void {
    this.sendMessage(clientId, {
      type: 'pong',
      data: { timestamp: Date.now() },
      clientId: 'server',
      timestamp: new Date()
    })
  }
  
  /**
   * Invia messaggio di signaling
   */
  private sendSignalingMessage(message: any): void {
    // Implementa invio messaggio di signaling
    console.log('📤 [BROWSER WS SERVER] Invio signaling:', message.type)
  }
  
  /**
   * Invia messaggio a un client specifico
   */
  sendMessage(clientId: string, message: BrowserWebSocketMessage): void {
    const client = this.clients.get(clientId)
    if (client) {
      try {
        if (client.type === 'webrtc') {
          const peerConnection = client.connection as RTCPeerConnection
          const dataChannel = peerConnection.createDataChannel('message')
          dataChannel.send(JSON.stringify(message))
        } else {
          const ws = client.connection as WebSocket
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message))
          }
        }
      } catch (error) {
        console.error(`❌ [BROWSER WS SERVER] Errore invio messaggio a ${clientId}:`, error)
      }
    }
  }
  
  /**
   * Invia messaggio a tutti i client
   */
  broadcast(message: BrowserWebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      this.sendMessage(clientId, message)
    })
  }
  
  /**
   * Invia messaggio a tutti tranne uno
   */
  broadcastToOthers(excludeClientId: string, message: BrowserWebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendMessage(clientId, message)
      }
    })
  }
  
  /**
   * Registra handler per tipi di messaggio
   */
  onMessage(type: string, handler: (message: BrowserWebSocketMessage) => void): void {
    this.messageHandlers.set(type, handler)
  }
  
  /**
   * Ottiene lista client connessi
   */
  getConnectedClients(): BrowserWebSocketClient[] {
    return Array.from(this.clients.values())
  }
  
  /**
   * Ottiene numero client connessi
   */
  getClientCount(): number {
    return this.clients.size
  }
  
  /**
   * Verifica se il server è in esecuzione
   */
  isServerRunning(): boolean {
    return this.isRunning
  }
  
  /**
   * Ferma il server
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 [BROWSER WS SERVER] Fermata server WebSocket...')
      
      // Chiudi tutte le connessioni
      this.clients.forEach((client) => {
        if (client.type === 'webrtc') {
          const peerConnection = client.connection as RTCPeerConnection
          peerConnection.close()
        } else {
          const ws = client.connection as WebSocket
          if (ws.readyState === WebSocket.OPEN) {
            ws.close()
          }
        }
      })
      
      this.clients.clear()
      this.isRunning = false
      console.log('✅ [BROWSER WS SERVER] Server WebSocket fermato')
      
    } catch (error) {
      console.error('❌ [BROWSER WS SERVER] Errore fermata server:', error)
    }
  }
  
  /**
   * Genera ID univoco per client
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default BrowserWebSocketServer
