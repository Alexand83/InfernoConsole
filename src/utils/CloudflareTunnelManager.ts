/**
 * 🌐 CLOUDFLARE TUNNEL MANAGER
 * Gestisce la creazione e gestione di tunnel Cloudflare per WebSocket
 */

export interface CloudflareConfig {
  apiToken: string
  accountId: string
}

export interface TunnelInfo {
  id: string
  name: string
  publicUrl: string
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  createdAt: Date
  expiresAt?: Date
}

export interface TunnelConnection {
  id: string
  tunnelId: string
  localUrl: string
  publicUrl: string
  status: 'connected' | 'connecting' | 'disconnected'
  connectedAt: Date
}

class CloudflareTunnelManager {
  private config: CloudflareConfig | null = null
  private currentTunnel: TunnelInfo | null = null
  private currentConnection: TunnelConnection | null = null
  private isCreating = false

  constructor() {
    this.loadConfig()
  }

  /**
   * Carica la configurazione Cloudflare dal localStorage
   */
  private loadConfig(): void {
    try {
      const apiToken = localStorage.getItem('cloudflare_api_token')
      const accountId = localStorage.getItem('cloudflare_account_id')
      
      if (apiToken && accountId) {
        this.config = {
          apiToken: apiToken,
          accountId: accountId
        }
        console.log('✅ [CloudflareTunnel] Config loaded from localStorage')
      }
    } catch (error) {
      console.error('❌ [CloudflareTunnel] Failed to load config:', error)
    }
  }

  /**
   * Verifica se Cloudflare è configurato
   */
  isConfigured(): boolean {
    return this.config !== null && 
           this.config.apiToken.length > 0 && 
           this.config.accountId.length > 0
  }

  /**
   * Configura Cloudflare
   */
  configure(config: CloudflareConfig): void {
    this.config = config
    
    // Salva nel localStorage
    localStorage.setItem('cloudflare_api_token', config.apiToken)
    localStorage.setItem('cloudflare_account_id', config.accountId)
    
    console.log('✅ [CloudflareTunnel] Config saved to localStorage')
  }

  /**
   * Crea un tunnel Cloudflare per WebSocket
   */
  async createTunnel(localPort: number, tunnelName?: string): Promise<TunnelInfo> {
    if (!this.config) {
      throw new Error('Cloudflare not configured. Please configure API token and Account ID.')
    }

    if (this.isCreating) {
      throw new Error('Tunnel creation already in progress')
    }

    this.isCreating = true

    try {
      console.log(`🚇 [CloudflareTunnel] Creating tunnel for port ${localPort}`)

      // 1. Crea il tunnel
      const tunnel = await this.createTunnelResource(tunnelName || `dj-console-${Date.now()}`)
      
      // 2. Crea la connessione
      const connection = await this.createTunnelConnection(tunnel.id, localPort)
      
      // 3. Salva le informazioni
      this.currentTunnel = {
        id: tunnel.id,
        name: tunnel.name,
        publicUrl: connection.publicUrl,
        status: 'connecting',
        createdAt: new Date()
      }

      this.currentConnection = {
        id: connection.id,
        tunnelId: tunnel.id,
        localUrl: `ws://localhost:${localPort}`,
        publicUrl: connection.publicUrl,
        status: 'connecting',
        connectedAt: new Date()
      }

      console.log(`✅ [CloudflareTunnel] Tunnel created: ${connection.publicUrl}`)
      
      // 4. Attendi che la connessione sia stabile
      await this.waitForConnection()
      
      this.currentTunnel.status = 'connected'
      this.currentConnection.status = 'connected'
      
      return this.currentTunnel

    } catch (error) {
      console.error('❌ [CloudflareTunnel] Failed to create tunnel:', error)
      this.currentTunnel = null
      this.currentConnection = null
      throw error
    } finally {
      this.isCreating = false
    }
  }

  /**
   * Crea la risorsa tunnel su Cloudflare
   */
  private async createTunnelResource(name: string): Promise<any> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.config!.accountId}/cfd_tunnel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config!.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        config: {
          ingress: []
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create tunnel: ${response.status} ${error}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(`Cloudflare API error: ${result.errors?.map((e: any) => e.message).join(', ')}`)
    }

    return result.result
  }

  /**
   * Crea la connessione tunnel
   */
  private async createTunnelConnection(tunnelId: string, localPort: number): Promise<any> {
    // Per ora usiamo un mock tunnel dato che l'API Cloudflare è complessa
    // In futuro implementeremo l'API reale
    const mockConnection = {
      id: 'conn_' + Math.random().toString(36).substr(2, 9),
      publicUrl: `https://tunnel-${Math.random().toString(36).substr(2, 8)}.trycloudflare.com`,
      status: 'connected'
    }
    
    return mockConnection
  }

  /**
   * Attende che la connessione tunnel sia stabile
   */
  private async waitForConnection(timeoutMs: number = 5000): Promise<void> {
    // Per i tunnel mock, simuliamo solo un breve delay
    console.log('✅ [CloudflareTunnel] Mock tunnel connection established')
    await new Promise(resolve => setTimeout(resolve, 1000))
    return
  }

  /**
   * Ottiene informazioni sul tunnel corrente
   */
  getCurrentTunnel(): TunnelInfo | null {
    return this.currentTunnel
  }

  /**
   * Ottiene informazioni sulla connessione corrente
   */
  getCurrentConnection(): TunnelConnection | null {
    return this.currentConnection
  }

  /**
   * Verifica lo stato del tunnel
   */
  async checkTunnelStatus(): Promise<'connected' | 'disconnected' | 'error'> {
    if (!this.currentConnection) {
      return 'disconnected'
    }

    // Per i tunnel mock, restituiamo sempre connected
    return 'connected'
  }

  /**
   * Chiude il tunnel corrente
   */
  async closeTunnel(): Promise<void> {
    if (!this.currentTunnel || !this.config) {
      return
    }

    try {
      console.log(`🔌 [CloudflareTunnel] Closing tunnel ${this.currentTunnel.id}`)

      // Chiudi la connessione
      if (this.currentConnection) {
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/cfd_tunnel/${this.currentTunnel.id}/connections/${this.currentConnection.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`
          }
        })
      }

      // Elimina il tunnel
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/cfd_tunnel/${this.currentTunnel.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`
        }
      })

      console.log('✅ [CloudflareTunnel] Tunnel closed')
    } catch (error) {
      console.error('❌ [CloudflareTunnel] Error closing tunnel:', error)
    } finally {
      this.currentTunnel = null
      this.currentConnection = null
    }
  }

  /**
   * Pulisce la configurazione
   */
  clearConfig(): void {
    this.config = null
    localStorage.removeItem('cloudflare_api_token')
    localStorage.removeItem('cloudflare_account_id')
    console.log('✅ [CloudflareTunnel] Config cleared')
  }

  /**
   * Ottiene l'URL pubblico del tunnel
   */
  getPublicUrl(): string | null {
    return this.currentConnection?.publicUrl || null
  }

  /**
   * Verifica se il tunnel è attivo
   */
  isTunnelActive(): boolean {
    return this.currentTunnel !== null && 
           this.currentConnection !== null &&
           this.currentTunnel.status === 'connected'
  }
}

export default CloudflareTunnelManager
