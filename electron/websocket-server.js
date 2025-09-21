const WebSocket = require('ws')
const EventEmitter = require('events')
const net = require('net')

class DJWebSocketServer extends EventEmitter {
  constructor() {
    super()
    this.server = null
    this.clients = new Map()
    this.sessionCode = null
    this.port = null
    this.isRunning = false
  }

  async start(port = 8080, sessionCode = null) {
    try {
      if (this.isRunning) {
        await this.stop()
      }

      // Trova una porta libera se quella richiesta è occupata
      this.port = await this.findFreePort(port, port + 10)
      this.sessionCode = sessionCode || this.generateSessionCode()
      
      console.log(`🔍 [WebSocket Server] Using port ${this.port} (requested: ${port})`)
      
      this.server = new WebSocket.Server({ 
        port: this.port,
        perMessageDeflate: false // Disabilita compressione per audio
      })

      this.server.on('connection', (ws, req) => {
        this.handleNewConnection(ws, req)
      })

      this.server.on('error', (error) => {
        console.error('❌ [WebSocket Server] Error:', error)
        this.emit('error', error)
      })

      this.isRunning = true
      console.log(`✅ [WebSocket Server] Started on port ${this.port} with session: ${this.sessionCode}`)
      this.emit('started', { port: this.port, sessionCode: this.sessionCode })

      return { success: true, port: this.port, sessionCode: this.sessionCode }
    } catch (error) {
      console.error('❌ [WebSocket Server] Failed to start:', error)
      this.emit('error', error)
      return { success: false, error: error.message }
    }
  }

  async stop() {
    try {
      if (this.server) {
        // Chiudi tutte le connessioni client
        this.clients.forEach((client, id) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(1000, 'Server shutting down')
          }
        })
        this.clients.clear()

        // Chiudi il server
        this.server.close()
        this.server = null
      }

      this.isRunning = false
      this.sessionCode = null
      this.port = null
      
      console.log('✅ [WebSocket Server] Stopped')
      this.emit('stopped')
      return { success: true }
    } catch (error) {
      console.error('❌ [WebSocket Server] Error stopping:', error)
      this.emit('error', error)
      return { success: false, error: error.message }
    }
  }

  handleNewConnection(ws, req) {
    const clientId = this.generateClientId()
    const clientIP = req.socket.remoteAddress
    
    console.log(`🔗 [WebSocket Server] New connection from ${clientIP} (ID: ${clientId})`)

    const client = {
      id: clientId,
      ws: ws,
      ip: clientIP,
      connectedAt: new Date(),
      isAuthenticated: false,
      djName: null,
      microphone: false,
      audioData: null
    }

    this.clients.set(clientId, client)

    // Invia messaggio di benvenuto (senza sessionCode per sicurezza)
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId: clientId,
      serverTime: Date.now()
    })

    // Gestisci messaggi dal client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        this.handleClientMessage(clientId, message)
      } catch (error) {
        console.error(`❌ [WebSocket Server] Invalid message from ${clientId}:`, error)
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Invalid message format'
        })
      }
    })

    // Gestisci disconnessione
    ws.on('close', (code, reason) => {
      console.log(`🔌 [WebSocket Server] Client ${clientId} disconnected (${code}: ${reason})`)
      this.handleClientDisconnection(clientId)
    })

    // Gestisci errori
    ws.on('error', (error) => {
      console.error(`❌ [WebSocket Server] Client ${clientId} error:`, error)
      this.handleClientDisconnection(clientId)
    })

    this.emit('clientConnected', client)
  }

  handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId)
    if (!client) return

    console.log(`📨 [WebSocket Server] Message from ${clientId}:`, message.type)

    switch (message.type) {
      case 'authenticate':
        this.handleAuthentication(clientId, message)
        break
      
      case 'audioData':
        this.handleAudioData(clientId, message)
        break
      
      case 'microphoneStatus':
        this.handleMicrophoneStatus(clientId, message)
        break
      
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() })
        break
      
      default:
        console.warn(`⚠️ [WebSocket Server] Unknown message type: ${message.type}`)
        this.sendToClient(clientId, {
          type: 'error',
          message: `Unknown message type: ${message.type}`
        })
    }
  }

  handleAuthentication(clientId, message) {
    const client = this.clients.get(clientId)
    if (!client) return

    const { djName, sessionCode } = message
    console.log(`🔐 [WebSocket Server] Authentication request from ${clientId}:`, { djName, sessionCode })

    // Verifica codice sessione
    if (sessionCode !== this.sessionCode) {
      console.log(`❌ [WebSocket Server] Invalid session code from ${clientId}: received "${sessionCode}", expected "${this.sessionCode}"`)
      this.sendToClient(clientId, {
        type: 'authError',
        message: 'Invalid session code'
      })
      return
    }

    // Autentica il client
    client.isAuthenticated = true
    client.djName = djName || `DJ-${clientId.substring(0, 6)}`

    console.log(`✅ [WebSocket Server] Client ${clientId} authenticated as ${client.djName}`)

    // Notifica autenticazione riuscita
    this.sendToClient(clientId, {
      type: 'authenticated',
      clientId: clientId,
      djName: client.djName,
      serverTime: Date.now()
    })

    // Notifica tutti gli altri client
    this.broadcastToOthers(clientId, {
      type: 'djConnected',
      clientId: clientId,
      djName: client.djName,
      connectedAt: client.connectedAt
    })

    this.emit('clientAuthenticated', client)
  }

  handleAudioData(clientId, message) {
    const client = this.clients.get(clientId)
    if (!client || !client.isAuthenticated) return

    const { audioData, timestamp } = message

    // Salva i dati audio del client
    client.audioData = {
      data: audioData,
      timestamp: timestamp || Date.now()
    }

    // Inoltra i dati audio a tutti gli altri client autenticati
    this.broadcastToOthers(clientId, {
      type: 'remoteAudio',
      fromClientId: clientId,
      fromDjName: client.djName,
      audioData: audioData,
      timestamp: timestamp || Date.now()
    })

    this.emit('audioDataReceived', {
      clientId: clientId,
      djName: client.djName,
      audioData: audioData,
      timestamp: timestamp || Date.now()
    })
  }

  handleMicrophoneStatus(clientId, message) {
    const client = this.clients.get(clientId)
    if (!client || !client.isAuthenticated) return

    const { microphone } = message
    client.microphone = microphone

    console.log(`🎤 [WebSocket Server] ${client.djName} microphone: ${microphone ? 'ON' : 'OFF'}`)

    // Notifica tutti gli altri client
    this.broadcastToOthers(clientId, {
      type: 'microphoneStatus',
      clientId: clientId,
      djName: client.djName,
      microphone: microphone
    })

    this.emit('microphoneStatusChanged', {
      clientId: clientId,
      djName: client.djName,
      microphone: microphone
    })
  }

  handleClientDisconnection(clientId) {
    const client = this.clients.get(clientId)
    if (!client) return

    // Notifica tutti gli altri client
    if (client.isAuthenticated) {
      this.broadcastToOthers(clientId, {
        type: 'djDisconnected',
        clientId: clientId,
        djName: client.djName
      })
    }

    this.clients.delete(clientId)
    this.emit('clientDisconnected', client)
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) return false

    try {
      client.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error(`❌ [WebSocket Server] Failed to send to ${clientId}:`, error)
      return false
    }
  }

  broadcastToOthers(excludeClientId, message) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.isAuthenticated) {
        this.sendToClient(clientId, message)
      }
    })
  }

  broadcastToAll(message) {
    this.clients.forEach((client, clientId) => {
      if (client.isAuthenticated) {
        this.sendToClient(clientId, message)
      }
    })
  }

  getConnectedClients() {
    const clients = []
    this.clients.forEach((client, clientId) => {
      if (client.isAuthenticated) {
        clients.push({
          id: clientId,
          djName: client.djName,
          ip: client.ip,
          connectedAt: client.connectedAt,
          microphone: client.microphone,
          isOnline: client.ws.readyState === WebSocket.OPEN
        })
      }
    })
    return clients
  }

  getServerInfo() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      sessionCode: this.sessionCode,
      clientCount: this.clients.size,
      authenticatedClients: this.getConnectedClients().length
    }
  }

  generateSessionCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9)
  }

  /**
   * Trova una porta libera
   */
  async findFreePort(startPort = 8080, maxPort = 8090) {
    for (let port = startPort; port <= maxPort; port++) {
      if (await this.isPortFree(port)) {
        return port
      }
    }
    throw new Error(`No free port found between ${startPort} and ${maxPort}`)
  }

  /**
   * Verifica se una porta è libera
   */
  isPortFree(port) {
    return new Promise((resolve) => {
      const server = net.createServer()
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(true)
        })
        server.close()
      })
      
      server.on('error', () => {
        resolve(false)
      })
    })
  }
}

module.exports = DJWebSocketServer
