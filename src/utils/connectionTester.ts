/**
 * Connection testing utilities for remote DJ connections
 */

export interface ConnectionTestResult {
  success: boolean
  latency?: number
  error?: string
  ipAddress: string
  port: number
}

/**
 * Test WebSocket connection to a host
 */
export const testWebSocketConnection = async (
  ip: string, 
  port: number, 
  timeout: number = 5000
): Promise<ConnectionTestResult> => {
  const startTime = Date.now()
  
  try {
    const wsUrl = `ws://${ip}:${port}`
    console.log(`🧪 [ConnectionTester] Testing connection to: ${wsUrl}`)
    
    const ws = new WebSocket(wsUrl)
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        ws.close()
        resolve({
          success: false,
          error: 'Connection timeout',
          ipAddress: ip,
          port: port
        })
      }, timeout)
      
      ws.onopen = () => {
        const latency = Date.now() - startTime
        clearTimeout(timeoutId)
        ws.close()
        resolve({
          success: true,
          latency: latency,
          ipAddress: ip,
          port: port
        })
      }
      
      ws.onerror = (error) => {
        clearTimeout(timeoutId)
        resolve({
          success: false,
          error: 'Connection failed',
          ipAddress: ip,
          port: port
        })
      }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ipAddress: ip,
      port: port
    }
  }
}

/**
 * Test multiple connection options and return the best one
 */
export const testBestConnection = async (
  ips: string[], 
  port: number = 8080
): Promise<ConnectionTestResult[]> => {
  console.log(`🧪 [ConnectionTester] Testing ${ips.length} IP addresses...`)
  
  const tests = ips.map(ip => testWebSocketConnection(ip, port))
  const results = await Promise.all(tests)
  
  // Sort by success and latency
  results.sort((a, b) => {
    if (a.success && !b.success) return -1
    if (!a.success && b.success) return 1
    if (a.success && b.success) {
      return (a.latency || 999999) - (b.latency || 999999)
    }
    return 0
  })
  
  console.log(`🧪 [ConnectionTester] Test results:`, results)
  return results
}

/**
 * Get recommended connection settings
 */
export const getConnectionRecommendations = (testResults: ConnectionTestResult[]) => {
  const successful = testResults.filter(r => r.success)
  
  if (successful.length === 0) {
    return {
      recommendation: 'Nessuna connessione disponibile',
      suggestions: [
        '🔧 Verifica che il server sia avviato',
        '🔧 Controlla firewall e port forwarding',
        '🌐 Usa servizi tunnel come ngrok o localtunnel'
      ]
    }
  }
  
  const best = successful[0]
  const isLocal = best.ipAddress.startsWith('192.168.') || 
                  best.ipAddress.startsWith('10.') || 
                  best.ipAddress.startsWith('172.')
  
  return {
    recommendation: `Usa ${best.ipAddress}:${best.port}`,
    type: isLocal ? 'LAN' : 'Internet',
    latency: best.latency,
    suggestions: isLocal ? [
      '🏠 Connessione LAN rilevata',
      '⚡ Prestazioni ottimali',
      '🔒 Massima sicurezza'
    ] : [
      '🌐 Connessione Internet rilevata', 
      '📶 Verifica la stabilità della connessione',
      '🔒 Assicurati che il codice sessione sia complesso'
    ]
  }
}

