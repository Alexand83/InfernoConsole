const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

class StreamingServer {
  constructor() {
    this.app = express()
    this.server = http.createServer(this.app)
    this.wss = new WebSocket.Server({ server: this.server })
    this.clients = new Set()
    this.streams = new Map()
    this.currentMetadata = {
      title: 'Inferno Console',
      artist: 'Live Stream',
      album: 'Live Session'
    }
    
    this.setupMiddleware()
    this.setupRoutes()
    this.setupWebSocket()
    this.setupStreaming()
  }

  setupMiddleware() {
    this.app.use(cors())
    this.app.use(express.json())
    this.app.use(express.static(path.join(__dirname, '../public')))
  }

  setupRoutes() {
    // Status endpoint
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'online',
        clients: this.clients.size,
        streams: this.streams.size,
        metadata: this.currentMetadata,
        uptime: process.uptime()
      })
    })

    // Metadata endpoint
    this.app.post('/api/metadata', (req, res) => {
      const { title, artist, album } = req.body
      this.updateMetadata(title, artist, album)
      res.json({ success: true, metadata: this.currentMetadata })
    })

    // Stream endpoint for Icecast
    this.app.get('/stream', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      })

      const clientId = Date.now()
      this.clients.add(clientId)
      
      req.on('close', () => {
        this.clients.delete(clientId)
      })

      // Send initial metadata
      this.sendMetadata(res)
    })

    // Icecast endpoint
    this.app.get('/icecast', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'icy-name': 'Inferno Console',
        'icy-genre': 'Electronic',
        'icy-url': 'http://localhost:8000',
        'icy-description': 'Professional DJ Console Live Stream'
      })

      const clientId = Date.now()
      this.clients.add(clientId)
      
      req.on('close', () => {
        this.clients.delete(clientId)
      })

      // Send initial metadata
      this.sendMetadata(res)
    })
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket client connected')
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message)
          this.handleWebSocketMessage(ws, data)
        } catch (error) {
          console.error('WebSocket message error:', error)
        }
      })

      ws.on('close', () => {
        console.log('WebSocket client disconnected')
      })
    })
  }

  setupStreaming() {
    // Create a buffer for audio data
    this.audioBuffer = Buffer.alloc(0)
    
    // Simulate audio stream for testing
    setInterval(() => {
      if (this.clients.size > 0) {
        this.broadcastAudio()
      }
    }, 100) // 10 FPS for smooth streaming
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'audio_data':
        this.handleAudioData(data.audio)
        break
      case 'metadata_update':
        this.updateMetadata(data.title, data.artist, data.album)
        break
      case 'stream_start':
        this.startStream(data.streamId)
        break
      case 'stream_stop':
        this.stopStream(data.streamId)
        break
      default:
        console.log('Unknown message type:', data.type)
    }
  }

  handleAudioData(audioData) {
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64')
    this.audioBuffer = Buffer.concat([this.audioBuffer, audioBuffer])
    
    // Keep buffer size manageable
    if (this.audioBuffer.length > 1024 * 1024) { // 1MB max
      this.audioBuffer = this.audioBuffer.slice(-1024 * 512) // Keep last 512KB
    }
  }

  broadcastAudio() {
    if (this.audioBuffer.length > 0) {
      // Send audio to all connected clients
      this.clients.forEach(clientId => {
        // In a real implementation, you'd send the actual audio buffer
        // For now, we'll simulate streaming
      })
    }
  }

  updateMetadata(title, artist, album) {
    this.currentMetadata = { title, artist, album }
    
    // Broadcast metadata to all WebSocket clients
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'metadata_update',
          metadata: this.currentMetadata
        }))
      }
    })

    console.log('Metadata updated:', this.currentMetadata)
  }

  sendMetadata(res) {
    // Send ICY metadata
    const metadata = `${this.currentMetadata.title} - ${this.currentMetadata.artist}`
    const metadataBytes = Buffer.from(metadata, 'utf8')
    const metadataLength = Math.ceil(metadataBytes.length / 16)
    const padding = Buffer.alloc(metadataLength * 16 - metadataBytes.length)
    
    res.write(metadataBytes)
    res.write(padding)
  }

  startStream(streamId) {
    this.streams.set(streamId, {
      id: streamId,
      startTime: Date.now(),
      active: true
    })
    console.log(`Stream started: ${streamId}`)
  }

  stopStream(streamId) {
    const stream = this.streams.get(streamId)
    if (stream) {
      stream.active = false
      stream.endTime = Date.now()
      console.log(`Stream stopped: ${streamId}, duration: ${stream.endTime - stream.startTime}ms`)
    }
  }

  start(port = 8000) {
    this.server.listen(port, () => {
      console.log(`🚀 Streaming Server running on port ${port}`)
      console.log(`📡 Icecast endpoint: http://localhost:${port}/icecast`)
      console.log(`🎵 Stream endpoint: http://localhost:${port}/stream`)
      console.log(`📊 Status: http://localhost:${port}/api/status`)
      console.log(`🔌 WebSocket: ws://localhost:${port}`)
    })
  }
}

// Start the server
const streamingServer = new StreamingServer()
streamingServer.start(8000)

module.exports = StreamingServer
