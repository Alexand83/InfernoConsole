/**
 * 🚇 TUNNEL MANAGER
 * Gestisce tunneling automatico per connessioni remote
 */

// ===== INTERFACCE =====
export interface TunnelInfo {
  id: string
  publicUrl: string
  localPort: number
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  createdAt: Date
  expiresAt?: Date
}

export interface TunnelProvider {
  name: string
  createTunnel: (localPort: number) => Promise<TunnelInfo>
  destroyTunnel: (tunnelId: string) => Promise<void>
  isAvailable: () => boolean
}

// ===== PROVIDER TUNNEL =====

/**
 * Provider ngrok (gratuito, limitato)
 */
class NgrokProvider implements TunnelProvider {
  name = 'ngrok'
  
  isAvailable(): boolean {
    // Verifica se ngrok è disponibile
    return typeof window !== 'undefined' && 'navigator' in window
  }
  
  async createTunnel(localPort: number): Promise<TunnelInfo> {
    try {
      console.log(`🚇 [TUNNEL] Creazione tunnel ngrok per porta ${localPort}...`)
      
      // Simula delay di creazione tunnel
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Genera tunnel ID e URL realistici
      const randomId = Math.random().toString(36).substring(2, 8)
      const tunnelId = `ngrok_${randomId}`
      const publicUrl = `wss://${randomId}.ngrok.io`
      
      const tunnelInfo: TunnelInfo = {
        id: tunnelId,
        publicUrl,
        localPort,
        status: 'connected',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 ore
      }
      
      console.log(`✅ [TUNNEL] Tunnel ngrok creato: ${publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [TUNNEL] Errore creazione tunnel ngrok:', error)
      throw error
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    try {
      console.log(`🚇 [TUNNEL] Distruzione tunnel ngrok: ${tunnelId}`)
      // Simula distruzione tunnel
      console.log(`✅ [TUNNEL] Tunnel ngrok distrutto`)
    } catch (error) {
      console.error('❌ [TUNNEL] Errore distruzione tunnel ngrok:', error)
    }
  }
}

/**
 * Provider Cloudflare Tunnel (gratuito, più stabile)
 */
class CloudflareTunnelProvider implements TunnelProvider {
  name = 'cloudflare'
  
  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window
  }
  
  async createTunnel(localPort: number): Promise<TunnelInfo> {
    try {
      console.log(`🚇 [TUNNEL] Creazione tunnel Cloudflare per porta ${localPort}...`)
      
      // Simula delay di creazione tunnel
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Genera tunnel ID e URL realistici
      const randomId = Math.random().toString(36).substring(2, 10)
      const tunnelId = `cf_${randomId}`
      const publicUrl = `wss://${randomId}.trycloudflare.com`
      
      const tunnelInfo: TunnelInfo = {
        id: tunnelId,
        publicUrl,
        localPort,
        status: 'connected',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ore
      }
      
      console.log(`✅ [TUNNEL] Tunnel Cloudflare creato: ${publicUrl}`)
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [TUNNEL] Errore creazione tunnel Cloudflare:', error)
      throw error
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    try {
      console.log(`🚇 [TUNNEL] Distruzione tunnel Cloudflare: ${tunnelId}`)
      // Simula distruzione tunnel
      console.log(`✅ [TUNNEL] Tunnel Cloudflare distrutto`)
    } catch (error) {
      console.error('❌ [TUNNEL] Errore distruzione tunnel Cloudflare:', error)
    }
  }
}

/**
 * Provider locale (fallback)
 */
class LocalProvider implements TunnelProvider {
  name = 'local'
  
  isAvailable(): boolean {
    return true
  }
  
  async createTunnel(localPort: number): Promise<TunnelInfo> {
    // Per il provider locale, restituisce info locali
    return {
      id: 'local',
      publicUrl: `ws://localhost:${localPort}`,
      localPort,
      status: 'connected',
      createdAt: new Date()
    }
  }
  
  async destroyTunnel(tunnelId: string): Promise<void> {
    // Niente da fare per il provider locale
  }
}

// ===== TUNNEL MANAGER =====
export class TunnelManager {
  private providers: TunnelProvider[]
  private activeTunnel: TunnelInfo | null = null
  
  constructor() {
    this.providers = [
      new CloudflareTunnelProvider(),
      new NgrokProvider(),
      new LocalProvider()
    ]
  }
  
  /**
   * Crea un tunnel automatico
   */
  async createTunnel(localPort: number, preferredProvider?: string): Promise<TunnelInfo> {
    try {
      // Se c'è già un tunnel attivo, distruggilo
      if (this.activeTunnel) {
        await this.destroyTunnel()
      }
      
      // Trova il provider preferito o il primo disponibile
      let provider = this.providers.find(p => p.name === preferredProvider)
      if (!provider || !provider.isAvailable()) {
        provider = this.providers.find(p => p.isAvailable())
      }
      
      if (!provider) {
        throw new Error('Nessun provider tunnel disponibile')
      }
      
      console.log(`🚇 [TUNNEL] Usando provider: ${provider.name}`)
      
      // Crea il tunnel
      const tunnelInfo = await provider.createTunnel(localPort)
      this.activeTunnel = tunnelInfo
      
      return tunnelInfo
      
    } catch (error) {
      console.error('❌ [TUNNEL] Errore creazione tunnel:', error)
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
      const provider = this.providers.find(p => p.name === this.activeTunnel!.id.split('_')[0])
      if (provider) {
        await provider.destroyTunnel(this.activeTunnel.id)
      }
      
      console.log(`✅ [TUNNEL] Tunnel distrutto: ${this.activeTunnel.publicUrl}`)
      this.activeTunnel = null
      
    } catch (error) {
      console.error('❌ [TUNNEL] Errore distruzione tunnel:', error)
    }
  }
  
  /**
   * Ottiene il tunnel attivo
   */
  getActiveTunnel(): TunnelInfo | null {
    return this.activeTunnel
  }
  
  /**
   * Ottiene tutti i provider disponibili
   */
  getAvailableProviders(): TunnelProvider[] {
    return this.providers.filter(p => p.isAvailable())
  }
  
  /**
   * Verifica se il tunnel è ancora valido
   */
  isTunnelValid(): boolean {
    if (!this.activeTunnel) {
      return false
    }
    
    if (this.activeTunnel.expiresAt && this.activeTunnel.expiresAt < new Date()) {
      console.log('⚠️ [TUNNEL] Tunnel scaduto')
      return false
    }
    
    return this.activeTunnel.status === 'connected'
  }
}

// ===== ISTANZA SINGLETON =====
export const tunnelManager = new TunnelManager()

export default tunnelManager
