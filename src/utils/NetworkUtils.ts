/**
 * 🌐 NETWORK UTILITIES
 * Utility per rilevamento IP e gestione rete
 */

import { createWebRTCPeerConnection } from '../config/webrtc.config'

// ===== INTERFACCE =====
export interface NetworkInfo {
  localIP: string
  publicIP: string | null
  networkInterfaces: NetworkInterface[]
  isOnline: boolean
}

export interface NetworkInterface {
  name: string
  address: string
  family: 'IPv4' | 'IPv6'
  internal: boolean
}

// ===== FUNZIONI PRINCIPALI =====

/**
 * Rileva l'IP locale del computer
 */
export async function detectLocalIP(): Promise<string> {
  try {
    // Metodo 1: Usa WebRTC per rilevare IP locale
    const localIP = await getLocalIPViaWebRTC()
    if (localIP) {
      console.log(`🌐 [NETWORK] IP locale rilevato via WebRTC: ${localIP}`)
      return localIP
    }

    // Metodo 2: Fallback - usa window.location.hostname
    const fallbackIP = window.location.hostname
    if (fallbackIP && fallbackIP !== 'localhost' && fallbackIP !== '127.0.0.1') {
      console.log(`🌐 [NETWORK] IP locale rilevato via hostname: ${fallbackIP}`)
      return fallbackIP
    }

    // Metodo 3: Ultimo fallback
    console.log(`🌐 [NETWORK] Usando IP di fallback: 192.168.1.100`)
    return '192.168.1.100'
    
  } catch (error) {
    console.error('❌ [NETWORK] Errore rilevamento IP:', error)
    return '192.168.1.100' // IP di fallback
  }
}

/**
 * Rileva sia IP locale che pubblico
 */
export async function detectAllIPs(): Promise<{ local: string, public: string | null }> {
  try {
    console.log('🌐 [NETWORK] Rilevamento IP locale e pubblico...')
    
    const [localIP, publicIP] = await Promise.all([
      detectLocalIP(),
      detectPublicIP()
    ])
    
    console.log(`🌐 [NETWORK] IP rilevati - Locale: ${localIP}, Pubblico: ${publicIP}`)
    
    return { local: localIP, public: publicIP }
  } catch (error) {
    console.error('❌ [NETWORK] Errore rilevamento IP multipli:', error)
    return { local: '192.168.1.100', public: null }
  }
}

/**
 * Rileva IP locale usando WebRTC
 */
async function getLocalIPViaWebRTC(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = createWebRTCPeerConnection('local')

      pc.createDataChannel('')
      pc.createOffer().then(offer => pc.setLocalDescription(offer))

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate
          const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/)
          if (ipMatch && !isPrivateIP(ipMatch[1])) {
            pc.close()
            resolve(ipMatch[1])
          }
        }
      }

      // Timeout dopo 3 secondi
      setTimeout(() => {
        pc.close()
        resolve(null)
      }, 3000)

    } catch (error) {
      console.error('❌ [NETWORK] Errore WebRTC:', error)
      resolve(null)
    }
  })
}

/**
 * Verifica se un IP è privato
 */
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ]
  
  return privateRanges.some(range => range.test(ip))
}

/**
 * Rileva IP pubblico (opzionale)
 */
export async function detectPublicIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      timeout: 5000
    })
    const data = await response.json()
    console.log(`🌐 [NETWORK] IP pubblico rilevato: ${data.ip}`)
    return data.ip
  } catch (error) {
    console.error('❌ [NETWORK] Errore rilevamento IP pubblico:', error)
    return null
  }
}

/**
 * Genera URL di connessione completo
 */
export function generateConnectionURL(localIP: string, port: number): string {
  return `ws://${localIP}:${port}`
}

/**
 * Genera informazioni connessione per condivisione
 */
export function generateConnectionInfo(sessionCode: string, localIP: string, port: number): ConnectionInfo {
  const connectionURL = generateConnectionURL(localIP, port)
  
  return {
    sessionCode,
    serverURL: connectionURL,
    instructions: `Per connettersi:
1. Apri l'app DJ Console
2. Clicca "🤝 Collaborativo"
3. Seleziona "🔗 DJ Collaboratore"
4. Inserisci:
   - URL: ${connectionURL}
   - Codice: ${sessionCode}
5. Clicca "Connetti al Server"
6. Attiva il microfono`,
    quickConnect: {
      url: connectionURL,
      code: sessionCode
    }
  }
}

export interface ConnectionInfo {
  sessionCode: string
  serverURL: string
  instructions: string
  quickConnect: {
    url: string
    code: string
  }
}

/**
 * Copia testo negli appunti
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    console.log('📋 [NETWORK] Testo copiato negli appunti')
    return true
  } catch (error) {
    console.error('❌ [NETWORK] Errore copia appunti:', error)
    return false
  }
}

/**
 * Condivide informazioni connessione
 */
export async function shareConnectionInfo(connectionInfo: ConnectionInfo): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Sessione DJ Collaborativa',
        text: `Unisciti alla mia sessione DJ!\n\nCodice: ${connectionInfo.sessionCode}\nURL: ${connectionInfo.serverURL}`,
        url: window.location.href
      })
      return true
    } else {
      // Fallback: copia negli appunti
      const shareText = `Sessione DJ Collaborativa\n\nCodice: ${connectionInfo.sessionCode}\nURL: ${connectionInfo.serverURL}\n\n${connectionInfo.instructions}`
      return await copyToClipboard(shareText)
    }
  } catch (error) {
    console.error('❌ [NETWORK] Errore condivisione:', error)
    return false
  }
}

/**
 * Verifica se la connessione è online
 */
export function isOnline(): boolean {
  return navigator.onLine
}

/**
 * Monitora stato connessione
 */
export function onConnectionChange(callback: (isOnline: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

export default {
  detectLocalIP,
  detectPublicIP,
  generateConnectionURL,
  generateConnectionInfo,
  copyToClipboard,
  shareConnectionInfo,
  isOnline,
  onConnectionChange
}
