/**
 * Configurazione WebRTC per DJ Console
 * Gestisce server STUN/TURN e configurazioni di rete
 */

export interface WebRTCConfig {
  iceServers: RTCIceServer[]
  iceCandidatePoolSize: number
  bundlePolicy: RTCBundlePolicy
  rtcpMuxPolicy: RTCRtcpMuxPolicy
  iceTransportPolicy: RTCIceTransportPolicy
}

/**
 * Server STUN/TURN di fallback
 */
const STUN_SERVERS = [
  // OpenRelay (più affidabili e gratuiti)
  { urls: 'stun:stun.openrelay.metered.ca:80' },
  { urls: 'stun:stun1.openrelay.metered.ca:80' },
  { urls: 'stun:stun2.openrelay.metered.ca:80' },
  
  // Mozilla (backup)
  { urls: 'stun:stun.mozilla.org:3478' },
  
  // Xirsys (alternativo)
  { urls: 'stun:stun.xirsys.com:3478' },
  
  // Google (ultimo fallback)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // Cloudflare (se disponibile)
  { urls: 'stun:stun.cloudflare.com:3478' }
]

/**
 * Configurazione WebRTC ottimizzata per DJ
 */
export const WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: STUN_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
}

/**
 * Configurazione WebRTC per connessioni locali (stessa rete)
 */
export const WEBRTC_LOCAL_CONFIG: WebRTCConfig = {
  iceServers: STUN_SERVERS,
  iceCandidatePoolSize: 5,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
}

/**
 * Configurazione WebRTC offline (senza STUN)
 */
export const WEBRTC_OFFLINE_CONFIG: WebRTCConfig = {
  iceServers: [],
  iceCandidatePoolSize: 0,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
}

/**
 * Configurazione WebRTC per connessioni remote (internet)
 */
export const WEBRTC_REMOTE_CONFIG: WebRTCConfig = {
  iceServers: STUN_SERVERS,
  iceCandidatePoolSize: 15,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
}

/**
 * Crea una connessione WebRTC con configurazione ottimizzata
 */
export function createWebRTCPeerConnection(
  type: 'local' | 'remote' | 'auto' | 'offline' = 'auto'
): RTCPeerConnection {
  let config: WebRTCConfig
  
  switch (type) {
    case 'local':
      config = WEBRTC_LOCAL_CONFIG
      break
    case 'remote':
      config = WEBRTC_REMOTE_CONFIG
      break
    case 'offline':
      config = WEBRTC_OFFLINE_CONFIG
      break
    default:
      config = WEBRTC_CONFIG
  }
  
  try {
    const peerConnection = new RTCPeerConnection(config)
    
    // Log per debug
    console.log(`🌐 [WEBRTC] Connessione creata con tipo: ${type}`)
    console.log(`🌐 [WEBRTC] Server STUN: ${config.iceServers.length}`)
    
    return peerConnection
  } catch (error) {
    console.error('❌ [WEBRTC] Errore creazione connessione:', error)
    
    // Fallback con configurazione offline
    console.log('🔄 [WEBRTC] Fallback a modalità offline')
    return new RTCPeerConnection(WEBRTC_OFFLINE_CONFIG)
  }
}

/**
 * Testa la connettività STUN con fallback multipli
 */
export async function testSTUNConnectivity(): Promise<boolean> {
  const testServers = [
    'stun:stun.openrelay.metered.ca:80',
    'stun:stun.mozilla.org:3478',
    'stun:stun.l.google.com:19302',
    'stun:stun.cloudflare.com:3478'
  ]
  
  for (const serverUrl of testServers) {
    try {
      const result = await testSingleSTUNServer(serverUrl)
      if (result) {
        console.log(`✅ [WEBRTC] STUN server funzionante: ${serverUrl}`)
        return true
      }
    } catch (error) {
      console.log(`❌ [WEBRTC] STUN server fallito: ${serverUrl}`)
      continue
    }
  }
  
  console.log('❌ [WEBRTC] Nessun STUN server raggiungibile')
  return false
}

/**
 * Testa un singolo server STUN
 */
function testSingleSTUNServer(serverUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: serverUrl }]
      })
      
      let resolved = false
      
      pc.onicecandidate = (event) => {
        if (event.candidate && !resolved) {
          resolved = true
          pc.close()
          resolve(true)
        }
      }
      
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete' && !resolved) {
          resolved = true
          pc.close()
          resolve(false)
        }
      }
      
      pc.createDataChannel('test')
      pc.createOffer().then(offer => pc.setLocalDescription(offer))
      
      // Timeout ridotto a 3 secondi per test più veloci
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          pc.close()
          resolve(false)
        }
      }, 3000)
      
    } catch (error) {
      resolve(false)
    }
  })
}

/**
 * Rileva il tipo di connessione migliore
 */
export async function detectBestConnectionType(): Promise<'local' | 'remote'> {
  try {
    // Testa connettività STUN
    const stunWorking = await testSTUNConnectivity()
    
    if (stunWorking) {
      console.log('🌐 [WEBRTC] Connessione remota disponibile')
      return 'remote'
    } else {
      console.log('🏠 [WEBRTC] Solo connessione locale disponibile')
      return 'local'
    }
  } catch (error) {
    console.error('❌ [WEBRTC] Errore rilevamento connessione:', error)
    return 'local'
  }
}
