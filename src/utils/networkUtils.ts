/**
 * Network utilities for DJ Console
 */

/**
 * Get the local IP address of the machine
 */
export const getLocalIP = async (): Promise<string> => {
  try {
    // Try to detect local IP using WebRTC
    const rtc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    
    // Create a dummy data channel to trigger ICE gathering
    rtc.createDataChannel('dummy')
    
    const offer = await rtc.createOffer()
    await rtc.setLocalDescription(offer)
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        rtc.close()
        resolve('192.168.1.100') // Fallback IP
      }, 3000)
      
      rtc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate
          // Look for host candidates (local IP)
          if (candidate.includes('typ host')) {
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/)
            if (ipMatch && !ipMatch[1].startsWith('127.')) {
              clearTimeout(timeout)
              rtc.close()
              resolve(ipMatch[1])
            }
          }
        }
      }
    })
  } catch (error) {
    console.error('Error detecting local IP:', error)
    return '192.168.1.100' // Fallback
  }
}

/**
 * Get the public IP address using a free service
 */
export const getPublicIP = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      timeout: 5000
    } as RequestInit)
    const data = await response.json()
    return data.ip
  } catch (error) {
    console.warn('Could not fetch public IP:', error)
    return null
  }
}

/**
 * Check if an IP is reachable
 */
export const checkIPReachability = async (ip: string, port: number): Promise<boolean> => {
  try {
    // Simple WebSocket connection test
    const ws = new WebSocket(`ws://${ip}:${port}`)
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.close()
        resolve(false)
      }, 3000)
      
      ws.onopen = () => {
        clearTimeout(timeout)
        ws.close()
        resolve(true)
      }
      
      ws.onerror = () => {
        clearTimeout(timeout)
        resolve(false)
      }
    })
  } catch (error) {
    return false
  }
}

/**
 * Get connection information for the host
 */
export const getHostConnectionInfo = async () => {
  const localIP = await getLocalIP()
  const publicIP = await getPublicIP()
  
  return {
    localIP,
    publicIP,
    recommendedIP: localIP, // Prefer local IP for LAN connections
    ports: {
      webrtc: 8080,
      streaming: 8000
    }
  }
}

