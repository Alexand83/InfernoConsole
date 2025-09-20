/**
 * 🌍 REMOTE IP DISCOVERY
 * Sistema per trovare automaticamente l'IP remoto usando solo il codice sessione
 */

export interface RemoteServerInfo {
  sessionCode: string
  ip: string
  port: number
  lastSeen: number
  region?: string
}

export interface DiscoveryResult {
  success: boolean
  server?: RemoteServerInfo
  error?: string
}

// ===== DISCOVERY AUTOMATICO REMOTO =====
export class RemoteIPDiscovery {
  private static instance: RemoteIPDiscovery
  private discoveryCache = new Map<string, RemoteServerInfo>()
  private discoveryTimeout = 10000 // 10 secondi
  
  private constructor() {}
  
  public static getInstance(): RemoteIPDiscovery {
    if (!RemoteIPDiscovery.instance) {
      RemoteIPDiscovery.instance = new RemoteIPDiscovery()
    }
    return RemoteIPDiscovery.instance
  }
  
  /**
   * Registra un server per discovery
   */
  async registerServer(sessionCode: string, ip: string, port: number): Promise<boolean> {
    try {
      console.log(`🌍 [REMOTE DISCOVERY] Registrazione server: ${sessionCode} @ ${ip}:${port}`)
      
      const serverInfo: RemoteServerInfo = {
        sessionCode,
        ip,
        port,
        lastSeen: Date.now(),
        region: 'auto-detected'
      }
      
      // Salva in cache locale
      this.discoveryCache.set(sessionCode, serverInfo)
      
      // Prova a registrare su servizi di discovery distribuiti
      await this.registerOnDistributedServices(serverInfo)
      
      return true
      
    } catch (error) {
      console.error('❌ [REMOTE DISCOVERY] Errore registrazione:', error)
      return false
    }
  }
  
  /**
   * Cerca un server per codice sessione
   */
  async findServer(sessionCode: string): Promise<DiscoveryResult> {
    try {
      console.log(`🔍 [REMOTE DISCOVERY] Ricerca server: ${sessionCode}`)
      
      // 1. Controlla cache locale
      const cached = this.discoveryCache.get(sessionCode)
      if (cached && (Date.now() - cached.lastSeen) < 300000) { // 5 minuti
        console.log(`✅ [REMOTE DISCOVERY] Server trovato in cache: ${cached.ip}:${cached.port}`)
        return { success: true, server: cached }
      }
      
      // 2. Prova discovery distribuito
      const distributedResult = await this.searchDistributedServices(sessionCode)
      if (distributedResult.success) {
        console.log(`✅ [REMOTE DISCOVERY] Server trovato su servizi distribuiti: ${distributedResult.server?.ip}:${distributedResult.server?.port}`)
        return distributedResult
      }
      
      // 3. Prova discovery tramite WebRTC
      const webrtcResult = await this.searchViaWebRTC(sessionCode)
      if (webrtcResult.success) {
        console.log(`✅ [REMOTE DISCOVERY] Server trovato via WebRTC: ${webrtcResult.server?.ip}:${webrtcResult.server?.port}`)
        return webrtcResult
      }
      
      return {
        success: false,
        error: 'Server non trovato'
      }
      
    } catch (error) {
      console.error('❌ [REMOTE DISCOVERY] Errore ricerca:', error)
      return {
        success: false,
        error: `Errore ricerca: ${error}`
      }
    }
  }
  
  /**
   * Registra su servizi di discovery distribuiti
   */
  private async registerOnDistributedServices(serverInfo: RemoteServerInfo): Promise<void> {
    // Lista di servizi di discovery distribuiti (gratuiti e aperti)
    const discoveryServices = [
      'https://discovery.djconsole.app', // Servizio dedicato (da creare)
      'https://dj-discovery.herokuapp.com', // Backup 1
      'https://dj-discovery.vercel.app', // Backup 2
      'https://dj-discovery.netlify.app' // Backup 3
    ]
    
    for (const service of discoveryServices) {
      try {
        const response = await fetch(`${service}/api/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(serverInfo),
          timeout: 5000
        })
        
        if (response.ok) {
          console.log(`✅ [REMOTE DISCOVERY] Registrato su: ${service}`)
        }
      } catch (error) {
        console.warn(`⚠️ [REMOTE DISCOVERY] Errore registrazione su ${service}:`, error)
        continue
      }
    }
  }
  
  /**
   * Cerca su servizi di discovery distribuiti
   */
  private async searchDistributedServices(sessionCode: string): Promise<DiscoveryResult> {
    const discoveryServices = [
      'https://discovery.djconsole.app',
      'https://dj-discovery.herokuapp.com',
      'https://dj-discovery.vercel.app',
      'https://dj-discovery.netlify.app'
    ]
    
    for (const service of discoveryServices) {
      try {
        console.log(`🔍 [REMOTE DISCOVERY] Provo servizio: ${service}`)
        const response = await fetch(`${service}/api/find/${sessionCode}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 3000 // Ridotto timeout per evitare attese lunghe
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.server) {
            console.log(`✅ [REMOTE DISCOVERY] Server trovato su ${service}`)
            return {
              success: true,
              server: data.server
            }
          }
        } else if (response.status === 404) {
          // 404 è normale se il server non è registrato su questo servizio
          console.log(`ℹ️ [REMOTE DISCOVERY] Server non trovato su ${service} (404)`)
          continue
        } else {
          console.warn(`⚠️ [REMOTE DISCOVERY] Errore HTTP ${response.status} su ${service}`)
        }
      } catch (error) {
        // Ignora errori di rete (ERR_NAME_NOT_RESOLVED, ERR_CONNECTION_REFUSED, etc.)
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.log(`ℹ️ [REMOTE DISCOVERY] Servizio ${service} non raggiungibile`)
        } else {
          console.warn(`⚠️ [REMOTE DISCOVERY] Errore ricerca su ${service}:`, error)
        }
        continue
      }
    }
    
    console.log(`ℹ️ [REMOTE DISCOVERY] Server non trovato su nessun servizio distribuito`)
    return { success: false, error: 'Non trovato su servizi distribuiti' }
  }
  
  /**
   * Cerca tramite WebRTC (P2P discovery)
   */
  private async searchViaWebRTC(sessionCode: string): Promise<DiscoveryResult> {
    try {
      console.log(`🌐 [REMOTE DISCOVERY] Tentativo discovery WebRTC per: ${sessionCode}`)
      
      // Crea connessione WebRTC per discovery
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.openrelay.metered.ca:80' },
          { urls: 'stun:stun.mozilla.org:3478' }
        ]
      })
      
      // Crea data channel per discovery
      const dataChannel = peerConnection.createDataChannel('discovery', {
        ordered: true
      })
      
      // Prova a connettersi usando il codice sessione
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      // Simula discovery P2P (in realtà richiederebbe un sistema di signaling)
      // Per ora restituiamo null, ma il sistema è pronto per P2P
      
      peerConnection.close()
      
      return { success: false, error: 'WebRTC discovery non implementato' }
      
    } catch (error) {
      console.warn(`⚠️ [REMOTE DISCOVERY] Errore WebRTC discovery:`, error)
      return { success: false, error: `WebRTC error: ${error}` }
    }
  }
  
  /**
   * Aggiorna heartbeat del server
   */
  async updateHeartbeat(sessionCode: string): Promise<boolean> {
    try {
      const cached = this.discoveryCache.get(sessionCode)
      if (cached) {
        cached.lastSeen = Date.now()
        this.discoveryCache.set(sessionCode, cached)
        
        // Aggiorna su servizi distribuiti
        await this.registerOnDistributedServices(cached)
        return true
      }
      
      return false
      
    } catch (error) {
      console.error('❌ [REMOTE DISCOVERY] Errore heartbeat:', error)
      return false
    }
  }
  
  /**
   * Rimuove registrazione server
   */
  async unregisterServer(sessionCode: string): Promise<boolean> {
    try {
      console.log(`🗑️ [REMOTE DISCOVERY] Rimozione server: ${sessionCode}`)
      
      // Rimuovi da cache locale
      this.discoveryCache.delete(sessionCode)
      
      // Rimuovi da servizi distribuiti
      const discoveryServices = [
        'https://discovery.djconsole.app',
        'https://dj-discovery.herokuapp.com',
        'https://dj-discovery.vercel.app',
        'https://dj-discovery.netlify.app'
      ]
      
      for (const service of discoveryServices) {
        try {
          await fetch(`${service}/api/unregister`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionCode }),
            timeout: 5000
          })
        } catch (error) {
          console.warn(`⚠️ [REMOTE DISCOVERY] Errore rimozione da ${service}:`, error)
          continue
        }
      }
      
      return true
      
    } catch (error) {
      console.error('❌ [REMOTE DISCOVERY] Errore rimozione:', error)
      return false
    }
  }
  
  /**
   * Ottieni lista server online
   */
  async getOnlineServers(): Promise<RemoteServerInfo[]> {
    try {
      const servers: RemoteServerInfo[] = []
      
      // Ottieni da servizi distribuiti
      const discoveryServices = [
        'https://discovery.djconsole.app',
        'https://dj-discovery.herokuapp.com',
        'https://dj-discovery.vercel.app',
        'https://dj-discovery.netlify.app'
      ]
      
      for (const service of discoveryServices) {
        try {
          const response = await fetch(`${service}/api/servers`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 5000
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.servers) {
              servers.push(...data.servers)
            }
          }
        } catch (error) {
          continue
        }
      }
      
      return servers
      
    } catch (error) {
      console.error('❌ [REMOTE DISCOVERY] Errore lista server:', error)
      return []
    }
  }
}

export default RemoteIPDiscovery
