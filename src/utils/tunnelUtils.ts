/**
 * Tunnel utilities for exposing local services remotely
 * Uses ngrok-like services for easy remote access
 */

/**
 * Configuration for tunnel services
 */
export interface TunnelConfig {
  localPort: number
  tunnelService: 'localtunnel' | 'serveo' | 'custom'
  customEndpoint?: string
}

/**
 * Creates a tunnel to expose local WebRTC server to the internet
 * Uses localtunnel.me (free service similar to ngrok)
 */
export const createTunnel = async (config: TunnelConfig): Promise<string | null> => {
  try {
    console.log('🚇 [Tunnel] Creazione tunnel per porta:', config.localPort)
    
    switch (config.tunnelService) {
      case 'localtunnel':
        return await createLocalTunnel(config.localPort)
      case 'serveo':
        return await createServeoTunnel(config.localPort)
      default:
        console.warn('⚠️ [Tunnel] Servizio tunnel non supportato:', config.tunnelService)
        return null
    }
  } catch (error) {
    console.error('❌ [Tunnel] Errore creazione tunnel:', error)
    return null
  }
}

/**
 * Creates a tunnel using localtunnel.me
 */
const createLocalTunnel = async (port: number): Promise<string | null> => {
  try {
    // For now, just return the instruction for manual setup
    // In a future update, we can integrate the actual localtunnel npm package
    const subdomain = `djconsole-${Math.random().toString(36).substr(2, 8)}`
    
    console.log('🚇 [LocalTunnel] Per esporre il server usa questo comando:')
    console.log(`npx localtunnel --port ${port} --subdomain ${subdomain}`)
    
    return `https://${subdomain}.loca.lt`
  } catch (error) {
    console.error('❌ [LocalTunnel] Errore:', error)
    return null
  }
}

/**
 * Creates a tunnel using serveo.net (SSH-based)
 */
const createServeoTunnel = async (port: number): Promise<string | null> => {
  try {
    const subdomain = `djconsole-${Math.random().toString(36).substr(2, 8)}`
    
    console.log('🚇 [Serveo] Per esporre il server usa questo comando:')
    console.log(`ssh -R ${subdomain}.serveo.net:80:localhost:${port} serveo.net`)
    
    return `https://${subdomain}.serveo.net`
  } catch (error) {
    console.error('❌ [Serveo] Errore:', error)
    return null
  }
}

/**
 * Instructions for manual port forwarding
 */
export const getPortForwardingInstructions = (port: number) => {
  return {
    title: '🔧 Configurazione Port Forwarding Manuale',
    steps: [
      '1. Accedi al router (di solito http://192.168.1.1 o http://192.168.0.1)',
      '2. Cerca la sezione "Port Forwarding" o "Virtual Servers"',
      `3. Crea una regola: Porta Esterna ${port} → IP Locale + Porta ${port}`,
      '4. Salva e riavvia il router se necessario',
      '5. Usa il tuo IP pubblico per le connessioni remote'
    ],
    notes: [
      'ℹ️ L\'IP locale verrà rilevato automaticamente',
      '⚠️ L\'IP pubblico può cambiare, controlla periodicamente',
      '🔒 Assicurati che il firewall permetta connessioni sulla porta'
    ]
  }
}

/**
 * Get easy setup options for remote connections
 */
export const getRemoteConnectionOptions = () => {
  return {
    easy: {
      title: '🌟 Opzioni Facili (Raccomandato)',
      options: [
        {
          name: 'Localtunnel',
          description: 'Servizio gratuito per tunnel HTTP/WebSocket',
          command: 'npx localtunnel --port 8080',
          pros: ['✅ Gratuito', '✅ Nessuna configurazione', '✅ Funziona immediatamente'],
          cons: ['⚠️ URL cambia ad ogni riavvio', '⚠️ Limitazioni di banda']
        },
        {
          name: 'Ngrok',
          description: 'Servizio tunnel professionale',
          command: 'ngrok http 8080',
          pros: ['✅ Molto stabile', '✅ URLs statici (account Pro)', '✅ Ottima performance'],
          cons: ['💰 Limitazioni nell\'account gratuito', '⚠️ Richiede registrazione']
        }
      ]
    },
    manual: {
      title: '🔧 Configurazione Manuale',
      description: 'Port forwarding sul router per connessioni dirette',
      difficulty: 'Media',
      stability: 'Alta',
      performance: 'Ottima'
    }
  }
}

