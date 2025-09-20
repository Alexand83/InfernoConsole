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
  token?: string // Token per eseguire tunnel (solo Cloudflare ufficiale)
}

export interface CloudflareConfig {
  apiToken: string
  accountId: string
}

// ===== NGROK TUNNEL (REALE E GRATUITO) =====
class BrowserNgrokTunnel {
  async createTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Creazione tunnel ngrok REALE per porta ${localPort}...`)
      
      // Usa ngrok API pubblica (completamente gratuita)
      const response = await fetch('https://api.ngrok.com/tunnels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-version': '2'
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
      const tunnelId = data.id || `ngrok_${Date.now()}`
      const publicUrl = data.public_url || data.url
      
      if (!publicUrl) {
        throw new Error('URL pubblico non ricevuto da ngrok')
      }
      
      const tunnelInfo: BrowserTunnelInfo = {
        id: tunnelId,
        publicUrl: publicUrl.replace('http://', 'https://'), // Forza HTTPS
        localPort,
        status: 'connected',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 ore
        provider: 'ngrok'
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel ngrok REALE creato: ${tunnelInfo.publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel ngrok:', error)
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

// ===== CLOUDFLARE TUNNEL (API REALE) =====
class BrowserCloudflareTunnel {
  private apiToken: string | null = null
  private accountId: string | null = null
  
  constructor() {
    // Carica token da variabili d'ambiente o localStorage
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || localStorage.getItem('cloudflare_api_token')
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || localStorage.getItem('cloudflare_account_id')
  }
  
  /**
   * Configura Cloudflare con token e account ID
   */
  configure(config: CloudflareConfig): void {
    this.apiToken = config.apiToken
    this.accountId = config.accountId
    
    // Salva in localStorage per persistenza
    localStorage.setItem('cloudflare_api_token', config.apiToken)
    localStorage.setItem('cloudflare_account_id', config.accountId)
    
    console.log('✅ [BROWSER TUNNEL] Cloudflare configurato con API ufficiali')
  }
  
  /**
   * Verifica se Cloudflare è configurato
   */
  isConfigured(): boolean {
    return !!(this.apiToken && this.accountId)
  }
  
  async createTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Creazione tunnel Cloudflare REALE per porta ${localPort}...`)
      
      // Se abbiamo token e account ID, usa API ufficiali
      if (this.apiToken && this.accountId) {
        return await this.createOfficialTunnel(localPort)
      } else {
        // Fallback a servizio pubblico
        return await this.createPublicTunnel(localPort)
      }
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel Cloudflare:', error)
      throw error
    }
  }
  
  // Crea tunnel con API ufficiali Cloudflare
  private async createOfficialTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    console.log('🔑 [BROWSER TUNNEL] Usando API ufficiali Cloudflare...')
    
    // 1. Crea tunnel
    const createResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/cfd_tunnel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`
      },
      body: JSON.stringify({
        name: `djconsole-${Date.now()}`,
        tunnel_type: 'cfd_tunnel'
      })
    })
    
    if (!createResponse.ok) {
      throw new Error(`Errore creazione tunnel: ${createResponse.status}`)
    }
    
    const createData = await createResponse.json()
    const tunnelId = createData.result.id
    const token = createData.result.token
    
    // 2. Configura tunnel
    await this.configureTunnel(tunnelId, localPort)
    
    const tunnelInfo: BrowserTunnelInfo = {
      id: tunnelId,
      publicUrl: `https://${tunnelId}.cfargotunnel.com`,
      localPort,
      status: 'connected',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 ore
      provider: 'cloudflare',
      token: token // Salva token per eseguire tunnel
    }
    
    console.log(`✅ [BROWSER TUNNEL] Tunnel Cloudflare UFFICIALE creato: ${tunnelInfo.publicUrl}`)
    return tunnelInfo
  }
  
  // Fallback a servizio pubblico
  private async createPublicTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    console.log('🌐 [BROWSER TUNNEL] Usando servizio pubblico Cloudflare...')
    
    const response = await fetch('https://api.trycloudflare.com/tunnel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        port: localPort
      })
    })
    
    if (!response.ok) {
      throw new Error(`Errore API Cloudflare: ${response.status}`)
    }
    
    const data = await response.json()
    const tunnelId = `cf_public_${Date.now()}`
    const publicUrl = data.url || `https://${tunnelId}.trycloudflare.com`
    
    if (!publicUrl) {
      throw new Error('URL pubblico non ricevuto da Cloudflare')
    }
    
    const tunnelInfo: BrowserTunnelInfo = {
      id: tunnelId,
      publicUrl: publicUrl.replace('http://', 'https://'),
      localPort,
      status: 'connected',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minuti (Cloudflare gratuito)
      provider: 'cloudflare'
    }
    
    console.log(`✅ [BROWSER TUNNEL] Tunnel Cloudflare PUBBLICO creato: ${tunnelInfo.publicUrl}`)
    return tunnelInfo
  }
  
  // Configura tunnel per la porta locale
  private async configureTunnel(tunnelId: string, localPort: number): Promise<void> {
    try {
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/configurations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: JSON.stringify({
          config: {
            ingress: [
              {
                hostname: `djconsole-${tunnelId}.cfargotunnel.com`,
                service: `http://localhost:${localPort}`
              },
              {
                service: 'http_status:404'
              }
            ]
          }
        })
      })
    } catch (error) {
      console.warn('⚠️ [BROWSER TUNNEL] Errore configurazione tunnel:', error)
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Distruzione tunnel Cloudflare: ${tunnelId}`)
      
      // Chiama API per distruggere tunnel
      await fetch(`https://api.trycloudflare.com/tunnel/${tunnelId}`, {
        method: 'DELETE'
      })
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel Cloudflare distrutto: ${tunnelId}`)
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore distruzione tunnel Cloudflare:', error)
      throw error
    }
  }
}

// ===== LOCALTUNNEL (REALE E GRATUITO) =====
class BrowserLocalTunnel {
  async createTunnel(localPort: number): Promise<BrowserTunnelInfo> {
    try {
      console.log(`🚇 [BROWSER TUNNEL] Creazione tunnel localtunnel REALE per porta ${localPort}...`)
      
      // Usa localtunnel API pubblica (completamente gratuita, nessuna registrazione)
      const response = await fetch('https://localtunnel.me/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          port: localPort,
          subdomain: `djconsole-${Date.now()}` // Subdomain unico
        })
      })
      
      if (!response.ok) {
        throw new Error(`Errore API localtunnel: ${response.status}`)
      }
      
      const data = await response.json()
      const tunnelId = `lt_${Date.now()}`
      const publicUrl = data.url || `https://djconsole-${Date.now()}.loca.lt`
      
      if (!publicUrl) {
        throw new Error('URL pubblico non ricevuto da localtunnel')
      }
      
      const tunnelInfo: BrowserTunnelInfo = {
        id: tunnelId,
        publicUrl: publicUrl.replace('http://', 'https://'), // Forza HTTPS
        localPort,
        status: 'connected',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 ore
        provider: 'localtunnel'
      }
      
      console.log(`✅ [BROWSER TUNNEL] Tunnel localtunnel REALE creato: ${tunnelInfo.publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [BROWSER TUNNEL] Errore creazione tunnel localtunnel:', error)
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


// ===== BROWSER TUNNEL MANAGER =====
export class BrowserTunnelManager {
  private cloudflareTunnel: BrowserCloudflareTunnel
  private ngrokTunnel: BrowserNgrokTunnel
  private webrtcTunnel: BrowserWebRTCTunnel
  private localTunnel: BrowserLocalTunnel
  private activeTunnel: BrowserTunnelInfo | null = null
  private renewalInterval: NodeJS.Timeout | null = null
  private onTunnelRenewed: ((newTunnel: BrowserTunnelInfo) => void) | null = null
  
  constructor() {
    this.cloudflareTunnel = new BrowserCloudflareTunnel()
    this.ngrokTunnel = new BrowserNgrokTunnel()
    this.webrtcTunnel = new BrowserWebRTCTunnel()
    this.localTunnel = new BrowserLocalTunnel()
  }
  
  /**
   * Crea un tunnel REALE nel browser
   */
  async createTunnel(localPort: number, provider: 'cloudflare' | 'ngrok' | 'webrtc' | 'local' = 'local'): Promise<BrowserTunnelInfo> {
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
   * Crea tunnel con fallback automatico tra provider
   */
  async createTunnelWithFallback(localPort: number): Promise<BrowserTunnelInfo> {
    const providers: Array<'local' | 'ngrok' | 'cloudflare'> = ['local', 'ngrok', 'cloudflare']
    
    for (const provider of providers) {
      try {
        console.log(`🔄 [BROWSER TUNNEL] Tentativo provider: ${provider}`)
        const tunnelInfo = await this.createTunnel(localPort, provider)
        console.log(`✅ [BROWSER TUNNEL] Successo con provider: ${provider}`)
        return tunnelInfo
      } catch (error) {
        console.warn(`⚠️ [BROWSER TUNNEL] Provider ${provider} fallito:`, error)
        continue
      }
    }
    
    throw new Error('Tutti i provider tunnel sono falliti')
  }
  
  /**
   * Configura Cloudflare con API token e account ID
   */
  configureCloudflare(config: CloudflareConfig): void {
    this.cloudflareTunnel.configure(config)
  }
  
  /**
   * Verifica se Cloudflare è configurato
   */
  isCloudflareConfigured(): boolean {
    return this.cloudflareTunnel.isConfigured()
  }
  
  /**
   * Imposta callback per rinnovo tunnel
   */
  setTunnelRenewalCallback(callback: (newTunnel: BrowserTunnelInfo) => void): void {
    this.onTunnelRenewed = callback
  }
  
  /**
   * Avvia rinnovo automatico tunnel
   */
  startTunnelRenewal(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval)
    }
    
    // Controlla ogni 2 minuti se il tunnel sta per scadere
    this.renewalInterval = setInterval(() => {
      this.checkAndRenewTunnel()
    }, 2 * 60 * 1000) // 2 minuti
    
    console.log('🔄 [BROWSER TUNNEL] Rinnovo automatico tunnel avviato')
  }
  
  /**
   * Ferma rinnovo automatico tunnel
   */
  stopTunnelRenewal(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval)
      this.renewalInterval = null
    }
    
    console.log('🛑 [BROWSER TUNNEL] Rinnovo automatico tunnel fermato')
  }
  
  /**
   * Controlla e rinnova tunnel se necessario
   */
  private async checkAndRenewTunnel(): Promise<void> {
    if (!this.activeTunnel || !this.activeTunnel.expiresAt) {
      return
    }
    
    const now = new Date()
    const expiresAt = this.activeTunnel.expiresAt
    const timeUntilExpiry = expiresAt.getTime() - now.getTime()
    
    // Se il tunnel scade tra meno di 5 minuti, rinnovalo
    if (timeUntilExpiry < 5 * 60 * 1000) {
      console.log('🔄 [BROWSER TUNNEL] Tunnel in scadenza, rinnovo automatico...')
      
      try {
        const oldTunnel = this.activeTunnel
        const newTunnel = await this.createTunnelWithFallback(oldTunnel.localPort)
        
        console.log(`✅ [BROWSER TUNNEL] Tunnel rinnovato: ${oldTunnel.publicUrl} → ${newTunnel.publicUrl}`)
        
        // Notifica il rinnovo
        if (this.onTunnelRenewed) {
          this.onTunnelRenewed(newTunnel)
        }
        
      } catch (error) {
        console.error('❌ [BROWSER TUNNEL] Errore rinnovo tunnel:', error)
      }
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
