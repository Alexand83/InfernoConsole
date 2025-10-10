/**
 * YouTube Proxy Manager
 * Gestisce rotazione proxy e User-Agent per bypassare blocchi YouTube
 */

import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import UserAgent from 'user-agents'

export interface ProxyConfig {
  host: string
  port: number
  username?: string
  password?: string
  protocol: 'http' | 'https' | 'socks4' | 'socks5'
}

export interface YouTubeRequestConfig {
  url: string
  proxy?: ProxyConfig
  userAgent?: string
  retries?: number
  timeout?: number
}

export class YouTubeProxyManager {
  private static instance: YouTubeProxyManager
  private proxyList: ProxyConfig[] = []
  private currentProxyIndex = 0
  private userAgentGenerator: UserAgent
  private requestHistory: Map<string, number> = new Map()

  private constructor() {
    this.userAgentGenerator = new UserAgent({
      deviceCategory: 'desktop',
      platform: 'Win32'
    })
    this.initializeDefaultProxies()
  }

  public static getInstance(): YouTubeProxyManager {
    if (!YouTubeProxyManager.instance) {
      YouTubeProxyManager.instance = new YouTubeProxyManager()
    }
    return YouTubeProxyManager.instance
  }

  private initializeDefaultProxies() {
    // Lista di proxy pubblici gratuiti (da aggiornare periodicamente)
    this.proxyList = [
      // Proxy HTTP gratuiti (da verificare periodicamente)
      { host: '8.8.8.8', port: 8080, protocol: 'http' },
      { host: '1.1.1.1', port: 8080, protocol: 'http' },
      { host: '9.9.9.9', port: 8080, protocol: 'http' },
      // Proxy SOCKS5 (se disponibili)
      { host: '127.0.0.1', port: 1080, protocol: 'socks5' },
    ]
  }

  public addProxy(proxy: ProxyConfig) {
    this.proxyList.push(proxy)
  }

  public removeProxy(host: string, port: number) {
    this.proxyList = this.proxyList.filter(
      p => !(p.host === host && p.port === port)
    )
  }

  public getRandomUserAgent(): string {
    return this.userAgentGenerator.toString()
  }

  public getNextProxy(): ProxyConfig | null {
    if (this.proxyList.length === 0) return null
    
    const proxy = this.proxyList[this.currentProxyIndex]
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length
    return proxy
  }

  public getRandomProxy(): ProxyConfig | null {
    if (this.proxyList.length === 0) return null
    return this.proxyList[Math.floor(Math.random() * this.proxyList.length)]
  }

  private createProxyAgent(proxy: ProxyConfig) {
    const proxyUrl = `${proxy.protocol}://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`
    
    switch (proxy.protocol) {
      case 'http':
        return new HttpProxyAgent(proxyUrl)
      case 'https':
        return new HttpsProxyAgent(proxyUrl)
      case 'socks4':
      case 'socks5':
        return new HttpsProxyAgent(proxyUrl)
      default:
        return new HttpProxyAgent(proxyUrl)
    }
  }

  public async makeRequest(config: YouTubeRequestConfig): Promise<any> {
    const maxRetries = config.retries || 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const proxy = config.proxy || this.getRandomProxy()
        const userAgent = config.userAgent || this.getRandomUserAgent()
        
        console.log(`🔄 [PROXY] Tentativo ${attempt + 1}/${maxRetries} con proxy:`, proxy?.host, 'User-Agent:', userAgent.substring(0, 50) + '...')

        const axiosConfig: any = {
          url: config.url,
          method: 'GET',
          timeout: config.timeout || 30000,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
          },
          maxRedirects: 5,
          validateStatus: (status: number) => status < 400
        }

        if (proxy) {
          axiosConfig.httpsAgent = this.createProxyAgent(proxy)
          axiosConfig.httpAgent = this.createProxyAgent(proxy)
        }

        const response = await axios(axiosConfig)
        
        console.log(`✅ [PROXY] Richiesta completata con successo`)
        return response.data

      } catch (error: any) {
        lastError = error
        console.warn(`⚠️ [PROXY] Tentativo ${attempt + 1} fallito:`, error.message)
        
        // Se è un errore di proxy, prova il prossimo
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
          console.log(`🔄 [PROXY] Cambio proxy per il prossimo tentativo...`)
          continue
        }
        
        // Se è un errore 403/429, aspetta prima di riprovare
        if (error.response?.status === 403 || error.response?.status === 429) {
          const waitTime = Math.pow(2, attempt) * 1000 // Backoff esponenziale
          console.log(`⏳ [PROXY] Rate limit rilevato, aspetto ${waitTime}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    throw lastError || new Error('Tutti i tentativi di richiesta sono falliti')
  }

  public async testProxy(proxy: ProxyConfig): Promise<boolean> {
    try {
      await this.makeRequest({
        url: 'https://httpbin.org/ip',
        proxy,
        timeout: 10000
      })
      return true
    } catch (error) {
      console.warn(`❌ [PROXY] Test fallito per ${proxy.host}:${proxy.port}:`, error)
      return false
    }
  }

  public async testAllProxies(): Promise<ProxyConfig[]> {
    const workingProxies: ProxyConfig[] = []
    
    console.log(`🔍 [PROXY] Test di ${this.proxyList.length} proxy...`)
    
    for (const proxy of this.proxyList) {
      const isWorking = await this.testProxy(proxy)
      if (isWorking) {
        workingProxies.push(proxy)
        console.log(`✅ [PROXY] ${proxy.host}:${proxy.port} funziona`)
      }
    }
    
    console.log(`📊 [PROXY] ${workingProxies.length}/${this.proxyList.length} proxy funzionanti`)
    return workingProxies
  }

  public getProxyStats() {
    return {
      totalProxies: this.proxyList.length,
      currentIndex: this.currentProxyIndex,
      requestHistory: Object.fromEntries(this.requestHistory)
    }
  }
}

export default YouTubeProxyManager
