const { EventEmitter } = require('events')
const WebSocket = require('ws')
const net = require('net')

class WebRTCServer extends EventEmitter {
  constructor(options = {}) {
    super()
    this.port = options.port || 8080
    this.maxConnections = options.maxConnections || 5
    this.sessionCode = this.generateSessionCode()
    this.connections = new Map()
    this.wss = null
  }

  // Funzione per trovare una porta libera
  async findFreePort(startPort = 8080) {
    return new Promise((resolve, reject) => {
      const server = net.createServer()
      
      server.listen(startPort, () => {
        const port = server.address().port
        console.log(`✅ [WebRTC Server] Porta ${port} disponibile`)
        server.close(() => resolve(port))
      })
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`⚠️ [WebRTC Server] Porta ${startPort} occupata, provo ${startPort + 1}`)
          // Prova la porta successiva con timeout per evitare loop infiniti
          if (startPort > 8100) {
            reject(new Error(`Nessuna porta libera trovata tra 8080 e 8100`))
            return
          }
          this.findFreePort(startPort + 1).then(resolve).catch(reject)
        } else {
          reject(err)
        }
      })
    })
  }

  // Funzione per verificare se una porta è effettivamente libera
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer()
      
      server.listen(port, () => {
        server.close(() => resolve(true))
      })
      
      server.on('error', () => {
        resolve(false)
      })
    })
  }

  generateSessionCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  async start() {
    return new Promise(async (resolve, reject) => {
      try {
        // ✅ CRITICAL FIX: Genera un nuovo codice sessione per ogni avvio
        this.sessionCode = this.generateSessionCode()
        console.log(`🔐 [WebRTC Server] Nuovo codice sessione generato: ${this.sessionCode}`)
        
        // Trova una porta libera, evitando la 8081 (usata da ngrok)
        let freePort
        if (this.port === 8081) {
          // Se la porta richiesta è 8081, prova prima 8080, poi 8082, etc.
          console.log(`🔍 [WebRTC Server] Evitando porta 8081 (ngrok), provo 8080...`)
          freePort = await this.findFreePort(8080)
        } else {
          freePort = await this.findFreePort(this.port)
        }
        this.port = freePort
        
        console.log(`🔍 [WebRTC Server] Porta ${this.port} richiesta, usando porta libera: ${freePort}`)
        
        this.wss = new WebSocket.Server({ 
          port: this.port,
          host: '0.0.0.0', // ✅ ACCEPT CONNECTIONS FROM ANY IP
          perMessageDeflate: false
        })
        
        // ✅ CRITICAL FIX: Aumenta il limite di listener per evitare memory leak
        this.wss.setMaxListeners(20)

        this.wss.on('connection', (ws, req) => {
          const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const clientIP = req.socket.remoteAddress

          console.log(`🔗 [WebRTC Server] Nuova connessione: ${clientId} da ${clientIP}`)

          // Salva connessione
          this.connections.set(clientId, {
            id: clientId,
            ws: ws,
            ip: clientIP,
            connectedAt: new Date(),
            isAuthenticated: false,
            djName: null
          })

          // Invia messaggio di benvenuto
          this.sendToClient(clientId, {
            type: 'welcome',
            clientId: clientId,
            sessionCode: this.sessionCode,
            serverTime: Date.now()
          })

          // Gestisci messaggi
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data)
              this.handleMessage(clientId, message)
            } catch (error) {
              console.error(`❌ [WebRTC Server] Errore parsing messaggio da ${clientId}:`, error)
            }
          })

          // Gestisci disconnessione
          ws.on('close', () => {
            console.log(`🔌 [WebRTC Server] Client disconnesso: ${clientId}`)
            this.handleDisconnection(clientId)
          })

          ws.on('error', (error) => {
            console.error(`❌ [WebRTC Server] Errore WebSocket da ${clientId}:`, error)
            this.handleDisconnection(clientId)
          })
        })

        this.wss.on('listening', () => {
          console.log(`🚀 [WebRTC Server] Server avviato su porta ${this.port}`)
          console.log(`🔐 [WebRTC Server] Codice sessione: ${this.sessionCode}`)
          console.log(`👥 [WebRTC Server] Max connessioni: ${this.maxConnections}`)
          resolve({
            port: this.port,
            sessionCode: this.sessionCode,
            maxConnections: this.maxConnections
          })
        })

        this.wss.on('error', (error) => {
          console.error(`❌ [WebRTC Server] Errore server:`, error)
          reject(error)
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  handleMessage(clientId, message) {
    const client = this.connections.get(clientId)
    if (!client) return

    console.log(`📨 [WebRTC Server] Messaggio da ${clientId}:`, message.type)

    switch (message.type) {
      case 'authenticate':
        this.handleAuthentication(clientId, message)
        break
      case 'webrtc-offer':
        this.handleWebRTCOffer(clientId, message)
        break
      case 'webrtc-answer':
        this.handleWebRTCAnswer(clientId, message)
        break
      case 'ice-candidate':
        this.handleICECandidate(clientId, message)
        break
      case 'audio-level':
        this.handleAudioLevel(clientId, message)
        break
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() })
        break
      case 'chatMessage':
        this.handleChatMessage(clientId, message)
        break
      default:
        console.warn(`⚠️ [WebRTC Server] Tipo messaggio sconosciuto: ${message.type}`)
    }
  }

  handleAuthentication(clientId, message) {
    const client = this.connections.get(clientId)
    if (!client) return

    const { djName, sessionCode } = message
    console.log(`🔐 [WebRTC Server] Tentativo autenticazione da ${clientId}:`, { djName, sessionCode })

    // Verifica codice sessione
    if (sessionCode !== this.sessionCode) {
      console.log(`❌ [WebRTC Server] Codice sessione errato da ${clientId}: ${sessionCode}`)
      this.sendToClient(clientId, {
        type: 'auth-error',
        message: 'Codice sessione non valido'
      })
      return
    }

    // Verifica limite connessioni
    const authenticatedCount = Array.from(this.connections.values())
      .filter(c => c.isAuthenticated).length

    if (authenticatedCount >= this.maxConnections) {
      console.log(`❌ [WebRTC Server] Limite connessioni raggiunto`)
      this.sendToClient(clientId, {
        type: 'auth-error',
        message: 'Limite connessioni raggiunto'
      })
      return
    }

    // Autentica client
    client.isAuthenticated = true
    client.djName = djName || `DJ-${clientId.substring(0, 6)}`

    console.log(`✅ [WebRTC Server] Client autenticato: ${client.djName}`)

    // Invia conferma
    this.sendToClient(clientId, {
      type: 'auth-success',
      clientId: clientId,
      djName: client.djName
    })

    // Notifica altri client
    this.emit('clientAuthenticated', {
      id: clientId,
      djName: client.djName,
      ip: client.ip,
      connectedAt: client.connectedAt,
      authenticatedAt: new Date()
    })
  }

  handleWebRTCOffer(clientId, message) {
    const client = this.connections.get(clientId)
    if (!client || !client.isAuthenticated) return

    console.log(`🎵 [WebRTC Server] WebRTC Offer da ${client.djName}`)
    
    // Inoltra offer ad altri client (per ora solo log)
    this.emit('webrtcOffer', {
      clientId: clientId,
      djName: client.djName,
      sdp: message.sdp
    })
  }

  handleWebRTCAnswer(clientId, message) {
    const client = this.connections.get(clientId)
    if (!client || !client.isAuthenticated) return

    console.log(`🎵 [WebRTC Server] WebRTC Answer da ${client.djName}`)
    
    this.emit('webrtcAnswer', {
      clientId: clientId,
      djName: client.djName,
      sdp: message.sdp
    })
  }

  handleICECandidate(clientId, message) {
    const client = this.connections.get(clientId)
    if (!client || !client.isAuthenticated) return

    console.log(`🧊 [WebRTC Server] ICE Candidate da ${client.djName}`)
    
    this.emit('iceCandidate', {
      clientId: clientId,
      djName: client.djName,
      candidate: message.candidate
    })
  }

  handleAudioLevel(clientId, message) {
    const client = this.connections.get(clientId)
    if (!client || !client.isAuthenticated) return

    this.emit('audioLevel', {
      clientId: clientId,
      djName: client.djName,
      level: message.level
    })
  }

  handleChatMessage(clientId, message) {
    const client = this.connections.get(clientId)
    if (!client || !client.isAuthenticated) return

    // ✅ DEBUG: Log dettagliato per debug nickname
    console.log(`💬 [WebRTC Server] Chat message ricevuto:`, {
      clientId: clientId,
      clientDjName: client.djName,
      messageDjName: message.djName,
      message: message.message,
      isAuthenticated: client.isAuthenticated
    })
    
    // ✅ FIX: Usa il djName del client autenticato, non quello del messaggio
    const finalDjName = client.djName || message.djName || `DJ-${clientId.substring(0, 6)}`
    console.log(`💬 [WebRTC Server] Usando djName finale: ${finalDjName}`)
    
    // Emetti evento per l'host (messaggio da client)
    this.emit('chatMessage', {
      djName: finalDjName,
      message: message.message,
      timestamp: message.timestamp || Date.now()
    })
    
    // Invia il messaggio a tutti i client connessi
    this.broadcastChatMessage({
      djName: finalDjName,
      message: message.message,
      timestamp: message.timestamp || Date.now()
    })
  }

  broadcastChatMessage(chatMessage) {
    console.log(`📢 [WebRTC Server] Broadcasting chat message:`, chatMessage)
    
    // Invia a tutti i client autenticati
    this.connections.forEach((client, clientId) => {
      if (client.isAuthenticated) {
        this.sendToClient(clientId, {
          type: 'chatMessage',
          ...chatMessage
        })
      }
    })
  }

  // Metodo per inviare messaggi dall'host ai client
  sendHostMessage(message) {
    console.log(`📢 [WebRTC Server] Host message:`, message)
    
    // ✅ FIX: Emetti evento per l'host (per mostrare nella chat dell'host)
    this.emit('hostChatMessage', {
      djName: 'Host',
      message: message,
      timestamp: Date.now()
    })
    
    // Invia a tutti i client autenticati
    this.connections.forEach((client, clientId) => {
      if (client.isAuthenticated) {
        this.sendToClient(clientId, {
          type: 'chatMessage',
          djName: 'Host',
          message: message,
          timestamp: Date.now()
        })
      }
    })
  }

  // Metodo per inviare WebRTC Answer dall'host al client
  sendWebRTCAnswer(data) {
    const { clientId, sdp } = data
    console.log(`🎵 [WebRTC Server] Invio WebRTC Answer a ${clientId}`)
    
    const client = this.connections.get(clientId)
    if (client && client.isAuthenticated) {
      this.sendToClient(clientId, {
        type: 'webrtc-answer',
        sdp: sdp
      })
    }
  }

  // Metodo per inviare ICE Candidate dall'host al client
  sendICECandidate(data) {
    const { clientId, candidate } = data
    console.log(`🧊 [WebRTC Server] Invio ICE Candidate a ${clientId}`)
    
    const client = this.connections.get(clientId)
    if (client && client.isAuthenticated) {
      this.sendToClient(clientId, {
        type: 'ice-candidate',
        candidate: candidate
      })
    }
  }

  handleDisconnection(clientId) {
    const client = this.connections.get(clientId)
    if (client) {
      this.emit('clientDisconnected', {
        id: clientId,
        djName: client.djName || 'Unknown'
      })
      this.connections.delete(clientId)
    }
  }

  sendToClient(clientId, message) {
    const client = this.connections.get(clientId)
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message))
      } catch (error) {
        console.error(`❌ [WebRTC Server] Errore invio messaggio a ${clientId}:`, error)
      }
    }
  }

  getConnectedClients() {
    return Array.from(this.connections.values())
      .filter(client => client.isAuthenticated)
      .map(client => ({
        id: client.id,
        djName: client.djName,
        ip: client.ip,
        connectedAt: client.connectedAt
      }))
  }

  getServerInfo() {
    return {
      port: this.port,
      sessionCode: this.sessionCode,
      maxConnections: this.maxConnections,
      connectedCount: this.connections.size,
      authenticatedCount: Array.from(this.connections.values())
        .filter(c => c.isAuthenticated).length
    }
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        console.log('🔄 [WebRTC Server] Fermata server in corso...')
        
        // ✅ CRITICAL FIX: Chiudi tutte le connessioni WebSocket
        this.connections.forEach((client, clientId) => {
          if (client.ws && client.ws.readyState === WebSocket.OPEN) {
            console.log(`🔌 [WebRTC Server] Chiusura connessione client: ${clientId}`)
            client.ws.close()
          }
        })
        this.connections.clear()
        
        // ✅ CRITICAL FIX: Chiudi il server WebSocket
        this.wss.close(() => {
          console.log('✅ [WebRTC Server] Server fermato completamente')
          this.wss = null
          resolve()
        })
      } else {
        console.log('ℹ️ [WebRTC Server] Nessun server da fermare')
        resolve()
      }
    })
  }
}

module.exports = WebRTCServer
