/**
 * 🔗 WEBSOCKET CLIENT MANAGER
 * Gestisce la connessione WebSocket come client
 */

export interface WebSocketClientState {
  isConnected: boolean
  isAuthenticated: boolean
  sessionCode: string | null
  serverUrl: string | null
  djName: string
  error: string | null
}

export interface ConnectionInfo {
  sessionCode: string
  serverUrl: string
  djName: string
}

class WebSocketClientManager {
  private ws: WebSocket | null = null
  private state: WebSocketClientState
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor() {
    this.state = {
      isConnected: false,
      isAuthenticated: false,
      sessionCode: null,
      serverUrl: null,
      djName: 'DJ Collaboratore',
      error: null
    }
  }

  /**
   * Connetti al server WebSocket
   */
  async connect(connectionInfo: ConnectionInfo): Promise<boolean> {
    try {
      this.state.sessionCode = connectionInfo.sessionCode
      this.state.serverUrl = connectionInfo.serverUrl
      this.state.djName = connectionInfo.djName
      this.state.error = null

      console.log(`🔗 [WebSocketClient] Connecting to ${connectionInfo.serverUrl}`)

      // Crea connessione WebSocket
      this.ws = new WebSocket(connectionInfo.serverUrl)

      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('Failed to create WebSocket'))
          return
        }

        // Timeout di connessione
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        this.ws.onopen = () => {
          clearTimeout(timeout)
          console.log('✅ [WebSocketClient] Connected to server')
          this.state.isConnected = true
          this.reconnectAttempts = 0
          
          // Invia messaggio di benvenuto
          console.log('🔐 [WebSocketClient] Sending authentication with DJ name:', this.state.djName)
          this.sendMessage({
            type: 'authenticate',
            djName: this.state.djName,
            sessionCode: this.state.sessionCode
          })
          
          resolve(true)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = (event) => {
          clearTimeout(timeout)
          console.log('🔌 [WebSocketClient] Connection closed:', event.code, event.reason)
          this.state.isConnected = false
          this.state.isAuthenticated = false
          
          // Tentativo di riconnessione automatica
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect()
          }
        }

        this.ws.onerror = (error) => {
          clearTimeout(timeout)
          console.error('❌ [WebSocketClient] Connection error:', error)
          this.state.error = 'Connection failed'
          reject(error)
        }
      })

    } catch (error) {
      console.error('❌ [WebSocketClient] Failed to connect:', error)
      this.state.error = error instanceof Error ? error.message : 'Unknown error'
      return false
    }
  }

  /**
   * Disconnetti dal server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting')
      this.ws = null
    }
    
    this.state.isConnected = false
    this.state.isAuthenticated = false
    this.state.error = null
    console.log('🔌 [WebSocketClient] Disconnected')
  }

  /**
   * Invia messaggio al server
   */
  sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('⚠️ [WebSocketClient] Cannot send message - not connected')
    }
  }

  /**
   * Invia dati audio
   */
  sendAudioData(audioData: Float32Array): void {
    if (!this.state.isAuthenticated) {
      return
    }

    this.sendMessage({
      type: 'audioData',
      audioData: Array.from(audioData),
      timestamp: Date.now()
    })
  }

  /**
   * Invia stato microfono
   */
  sendMicrophoneStatus(enabled: boolean): void {
    this.sendMessage({
      type: 'microphoneStatus',
      microphone: enabled,
      timestamp: Date.now()
    })
  }

  /**
   * Gestisce i messaggi ricevuti dal server
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      console.log('📨 [WebSocketClient] Received message:', message.type)

      switch (message.type) {
        case 'welcome':
          console.log('👋 [WebSocketClient] Welcome message received')
          break

        case 'authenticated':
          console.log('✅ [WebSocketClient] Authentication successful')
          this.state.isAuthenticated = true
          break

        case 'authError':
          console.error('❌ [WebSocketClient] Authentication failed:', message.message)
          this.state.error = 'Codice sessione non valido'
          // Emit event for UI
          this.emit('authError', { ...message, message: 'Codice sessione non valido' })
          break

        case 'djConnected':
          console.log('🎤 [WebSocketClient] DJ connected:', message.djName)
          // Emit event for UI
          this.emit('djConnected', message)
          break

        case 'djDisconnected':
          console.log('🔌 [WebSocketClient] DJ disconnected:', message.djName)
          // Emit event for UI
          this.emit('djDisconnected', message)
          break

        case 'remoteAudio':
          console.log('🎵 [WebSocketClient] Remote audio received from:', message.fromDjName)
          // Emit event for audio processing
          this.emit('remoteAudio', message)
          break

        case 'microphoneStatus':
          console.log('🎤 [WebSocketClient] Microphone status:', message.djName, message.microphone)
          // Emit event for UI
          this.emit('microphoneStatus', message)
          break

        case 'pong':
          console.log('🏓 [WebSocketClient] Pong received')
          break

        default:
          console.warn('⚠️ [WebSocketClient] Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('❌ [WebSocketClient] Failed to parse message:', error)
    }
  }

  /**
   * Tentativo di riconnessione automatica
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ [WebSocketClient] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 [WebSocketClient] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)

    setTimeout(() => {
      if (this.state.sessionCode && this.state.serverUrl) {
        this.connect({
          sessionCode: this.state.sessionCode,
          serverUrl: this.state.serverUrl,
          djName: this.state.djName
        }).catch(error => {
          console.error('❌ [WebSocketClient] Reconnection failed:', error)
        })
      }
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  /**
   * Emette eventi personalizzati
   */
  private emit(event: string, data: any): void {
    // Dispatch custom event
    const customEvent = new CustomEvent(`websocket-${event}`, { detail: data })
    window.dispatchEvent(customEvent)
  }

  /**
   * Ottiene lo stato corrente
   */
  getState(): WebSocketClientState {
    return { ...this.state }
  }

  /**
   * Verifica se è connesso
   */
  isConnected(): boolean {
    return this.state.isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Verifica se è autenticato
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated
  }

  /**
   * Ottiene il nome DJ
   */
  getDjName(): string {
    return this.state.djName
  }

  /**
   * Imposta il nome DJ
   */
  setDjName(name: string): void {
    this.state.djName = name
  }
}

export default WebSocketClientManager
