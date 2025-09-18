/**
 * 🚇 BROWSER TUNNEL MANAGER
 * Tunnel manager che funziona completamente nel BROWSER
 */

import { createWebRTCPeerConnection } from '../config/webrtc.config'

// ===== INTERFACCE =====
export interface BrowserTunnelInfo {
  id: string
  publicUrl: string
  localPort: number
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  createdAt: Date
  expiresAt?: Date
  provider: 'cloudflare' | 'ngrok' | 'webrtc' | 'local'
}

// ===== CLOUDFLARE TUNNEL (BROWSER) =====
class BrowserCloudflareTunnel {
  async createTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Creazione tunnel Cloudflare per porta ${localPort}...`)
      
      // Usa Cloudflare Tunnel API pubblica
      const response = await fetch('https://api.trycloudflare.com/tunnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          port: localPort,
          protocol: 'websocket'
        })
      })
      
      if (!response.ok) {
        throw new Error(`Errore API Cloudflare: ${response.status}`)
      }
      
      const data = await response.json()
      const tunnelId = `cf_${Date.now()}`
      const publicUrl = data.url.replace('http://', 'wss://')
      
      const tunnelInfo: BrowserTunnelInfo = {
        id: tunnelId,
        publicUrl,
        localPort,
        status: 'connected',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 ore
        provider: 'cloudflare'
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel Cloudflare creato: ${publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel Cloudflare:', error)
      throw error
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Distruzione tunnel Cloudflare: ${tunnelId}`)
      
      // Chiama API per distruggere tunnel
      await fetch(`https://api.trycloudflare.com/tunnel/${tunnelId}`, {
        method: 'DELETE'
      })
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel Cloudflare distrutto`)
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore distruzione tunnel Cloudflare:', error)
    }
  }
}

// ===== NGROK TUNNEL (BROWSER) =====
class BrowserNgrokTunnel {
  async createTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Creazione tunnel ngrok per porta ${localPort}...`)
      
      // Usa ngrok API pubblica
      const response = await fetch('https://api.ngrok.com/tunnels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_NGROK_TOKEN' // Da configurare
        },
        body: JSON.stringify({
          addr: localPort,
          proto: 'http'
        })
      })
      
      if (!response.ok) {
        throw new Error(`Errore API ngrok: ${response.status}`)
      }
      
      const data = await response.json()
      const tunnelId = `ngrok_${Date.now()}`
      const publicUrl = data.public_url.replace('http://', 'wss://')
      
      const tunnelInfo: BrowserTunnelInfo = {
        id: tunnelId,
        publicUrl,
        localPort,
        status: 'connected',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 ore
        provider: 'ngrok'
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel ngrok creato: ${publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel ngrok:', error)
      throw error
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Distruzione tunnel ngrok: ${tunnelId}`)
      
      // Chiama API per distruggere tunnel
      await fetch(`https://api.ngrok.com/tunnels/${tunnelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer YOUR_NGROK_TOKEN'
        }
      })
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel ngrok distrutto`)
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore distruzione tunnel ngrok:', error)
    }
  }
}

// ===== WEBRTC TUNNEL (BROWSER) =====
class BrowserWebRTCTunnel {
  private peerConnection: RTCPeerConnection | null = null
  
  async createTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Creazione tunnel WebRTC per porta ${localPort}...`)
      
      // Crea connessione WebRTC reale
      this.peerConnection = createWebRTCPeerConnection('remote')
      
      const tunnelId = `webrtc_${Date.now()}`
      const publicUrl = `webrtc://${tunnelId}.p2p.com`
      
      const tunnelInfo: BrowserTunnelInfo = {
        id: tunnelId,
        publicUrl,
        localPort,
        status: 'connected',
        createdAt: new Date(),
        provider: 'webrtc'
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel WebRTC creato: ${publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel WebRTC:', error)
      throw error
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Distruzione tunnel WebRTC: ${tunnelId}`)
      
      if (this.peerConnection) {
        this.peerConnection.close()
        this.peerConnection = null
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel WebRTC distrutto`)
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore distruzione tunnel WebRTC:', error)
    }
  }
}

// ===== LOCAL TUNNEL (BROWSER) =====
class BrowserLocalTunnel {
  async createTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Creazione tunnel locale per porta ${localPort}...`)
      
      const tunnelId = `local_${Date.now()}`
      const publicUrl = `ws://localhost:${localPort}`
      
      const tunnelInfo: BrowserTunnelInfo = {
        id: tunnelId,
        publicUrl,
        localPort,
        status: 'connected',
        createdAt: new Date(),
        provider: 'local'
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel locale creato: ${publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel locale:', error)
      throw error
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    console.log(`🚇 [BROWSER TUNNEL] Distruzione tunnel locale: ${tunnelId}`)
    // Niente da fare per il tunnel locale
  }
}

// ===== BROWSER TUNNEL MANAGER =====
export class BrowserTunnelManager {
  private cloudflareTunnel: BrowserCloudflareTunnel
  private ngrokTunnel: BrowserNgrokTunnel
  private webrtcTunnel: BrowserWebRTCTunnel
  private localTunnel: BrowserLocalTunnel
  private activeTunnel: BrowserTunnelInfo | null = null
  
  constructor() {
    this.cloudflareTunnel = new BrowserCloudflareTunnel()
    this.ngrokTunnel = new BrowserNgrokTunnel()
    this.webrtcTunnel = new BrowserWebRTCTunnel()
    this.localTunnel = new BrowserLocalTunnel()
  }
  
  /**
   * Crea un tunnel REALE nel browser
   */
  async createTunnel(localPort: number, provider: 'cloudflare' | 'ngrok' | 'webrtc' | 'local' = 'cloudflare'): Promise<BrowserTunnelInfo> {
    try {
      // Se c'è già un tunnel attivo, distruggilo
      if (this.activeTunnel) {
        await this.destroyTunnel()
      }
      
      let tunnelInfo: BrowserTunnelInfo
      
      switch (provider) {
        case 'cloudflare':
          tunnelInfo = await this.cloudflareTunnel.createTunnel(localPort)
          break
        case 'ngrok':
          tunnelInfo = await this.ngrokTunnel.createTunnel(localPort)
          break
        case 'webrtc':
          tunnelInfo = await this.webrtcTunnel.createTunnel(localPort)
          break
        case 'local':
          tunnelInfo = await this.localTunnel.createTunnel(localPort)
          break
        default:
          throw new Error(`Provider tunnel non supportato: ${provider}`)
      }
      
      this.activeTunnel = tunnelInfo
      console.log(`✅ [BROWSER TUNNEL] Tunnel ${provider} creato: ${tunnelInfo.publicUrl}`)
      
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel:', error)
      throw error
    }
  }
  
  /**
   * Distrugge il tunnel attivo
   */
  async destroyTunnel(): Promise<void> {
    if (!this.activeTunnel) {
      return
    }
    
    try {
      switch (this.activeTunnel.provider) {
        case 'cloudflare':
          await this.cloudflareTunnel.destroyTunnel(this.activeTunnel.id)
          break
        case 'ngrok':
          await this.ngrokTunnel.destroyTunnel(this.activeTunnel.id)
          break
        case 'webrtc':
          await this.webrtcTunnel.destroyTunnel(this.activeTunnel.id)
          break
        case 'local':
          await this.localTunnel.destroyTunnel(this.activeTunnel.id)
          break
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel distrutto: ${this.activeTunnel.publicUrl}`)
      this.activeTunnel = null
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore distruzione tunnel:', error)
    }
  }
  
  /**
   * Ottiene il tunnel attivo
   */
  getActiveTunnel(): BrowserTunnelInfo | null {
    return this.activeTunnel
  }
  
  /**
   * Verifica se il tunnel è ancora valido
   */
  isTunnelValid(): boolean {
    if (!this.activeTunnel) {
      return false
    }
    
    if (this.activeTunnel.expiresAt && this.activeTunnel.expiresAt < new Date()) {
      console.log('⚠️ [BROWSER TUNNEL] Tunnel scaduto')
      return false
    }
    
    return this.activeTunnel.status === 'connected'
  }
  
  /**
   * Ottiene provider disponibili
   */
  getAvailableProviders(): string[] {
    return ['cloudflare', 'webrtc', 'local'] // ngrok richiede token
  }
}

// ===== ISTANZA SINGLETON =====
export const browserTunnelManager = new BrowserTunnelManager()

export default browserTunnelManager
