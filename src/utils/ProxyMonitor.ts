/**
 * Proxy Monitor - Sistema di monitoraggio proxy in tempo reale
 * Monitora e aggiorna automaticamente i proxy funzionanti
 */

import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'

export interface ProxyStatus {
  host: string
  port: number
  protocol: string
  working: boolean
  lastTested: Date
  responseTime: number
  error?: string
}

export interface ProxyListSource {
  name: string
  url: string
  parser: (data: string) => Array<{host: string, port: number, protocol: string}>
}

export class ProxyMonitor {
  private static instance: ProxyMonitor
  private workingProxies: ProxyStatus[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false

  private constructor() {
    this.startMonitoring()
  }

  public static getInstance(): ProxyMonitor {
    if (!ProxyMonitor.instance) {
      ProxyMonitor.instance = new ProxyMonitor()
    }
    return ProxyMonitor.instance
  }

  private startMonitoring() {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    console.log('🔄 [PROXY-MONITOR] Avvio monitoraggio proxy...')
    
    // Testa i proxy ogni 5 minuti
    this.monitoringInterval = setInterval(() => {
      this.updateProxyList()
    }, 5 * 60 * 1000)
    
    // Testa immediatamente
    this.updateProxyList()
  }

  private async updateProxyList() {
    try {
      console.log('🔍 [PROXY-MONITOR] Aggiornamento lista proxy...')
      
      // Carica proxy da fonti online
      const onlineProxies = await this.fetchOnlineProxies()
      
      // Testa tutti i proxy
      const testedProxies = await this.testProxyList(onlineProxies)
      
      // Aggiorna la lista dei proxy funzionanti
      this.workingProxies = testedProxies.filter(p => p.working)
      
      console.log(`✅ [PROXY-MONITOR] ${this.workingProxies.length} proxy funzionanti trovati`)
      
    } catch (error) {
      console.error('❌ [PROXY-MONITOR] Errore aggiornamento proxy:', error)
    }
  }

  private async fetchOnlineProxies(): Promise<Array<{host: string, port: number, protocol: string}>> {
    const sources: ProxyListSource[] = [
      {
        name: 'FreeProxyList',
        url: 'https://www.free-proxy-list.net/',
        parser: this.parseFreeProxyList
      },
      {
        name: 'ProxyList',
        url: 'https://www.proxy-list.download/api/v1/get?type=http',
        parser: this.parseProxyListDownload
      }
    ]

    const allProxies: Array<{host: string, port: number, protocol: string}> = []

    for (const source of sources) {
      try {
        console.log(`📥 [PROXY-MONITOR] Caricamento da ${source.name}...`)
        const response = await axios.get(source.url, { timeout: 10000 })
        const proxies = source.parser(response.data)
        allProxies.push(...proxies)
        console.log(`✅ [PROXY-MONITOR] ${proxies.length} proxy da ${source.name}`)
      } catch (error) {
        console.warn(`⚠️ [PROXY-MONITOR] Errore caricamento ${source.name}:`, error)
      }
    }

    return allProxies
  }

  private parseFreeProxyList(html: string): Array<{host: string, port: number, protocol: string}> {
    const proxies: Array<{host: string, port: number, protocol: string}> = []
    
    // Regex per estrarre IP e porta dalla tabella HTML
    const regex = /<tr><td>(\d+\.\d+\.\d+\.\d+)<\/td><td>(\d+)<\/td><td>(\w+)<\/td><td>(\w+)<\/td>/g
    let match
    
    while ((match = regex.exec(html)) !== null) {
      const [, host, port, country, anonymity] = match
      
      // Solo proxy HTTP e HTTPS
      if (anonymity.toLowerCase().includes('anonymous') || anonymity.toLowerCase().includes('elite')) {
        proxies.push({
          host,
          port: parseInt(port),
          protocol: 'http'
        })
      }
    }
    
    return proxies.slice(0, 20) // Limita a 20 proxy per evitare sovraccarico
  }

  private parseProxyListDownload(data: string): Array<{host: string, port: number, protocol: string}> {
    const proxies: Array<{host: string, port: number, protocol: string}> = []
    
    const lines = data.split('\n').filter(line => line.trim())
    
    for (const line of lines.slice(0, 20)) { // Limita a 20 proxy
      const parts = line.split(':')
      if (parts.length === 2) {
        proxies.push({
          host: parts[0],
          port: parseInt(parts[1]),
          protocol: 'http'
        })
      }
    }
    
    return proxies
  }

  private async testProxyList(proxies: Array<{host: string, port: number, protocol: string}>): Promise<ProxyStatus[]> {
    const results: ProxyStatus[] = []
    
    console.log(`🧪 [PROXY-MONITOR] Test di ${proxies.length} proxy...`)
    
    // Testa i proxy in parallelo (max 5 alla volta)
    const batchSize = 5
    for (let i = 0; i < proxies.length; i += batchSize) {
      const batch = proxies.slice(i, i + batchSize)
      const batchPromises = batch.map(proxy => this.testSingleProxy(proxy))
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // Pausa tra i batch per evitare sovraccarico
      if (i + batchSize < proxies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }

  private async testSingleProxy(proxy: {host: string, port: number, protocol: string}): Promise<ProxyStatus> {
    const startTime = Date.now()
    
    try {
      const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`
      const agent = new HttpProxyAgent(proxyUrl)
      
      const response = await axios.get('https://httpbin.org/ip', {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      const responseTime = Date.now() - startTime
      
      return {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        working: true,
        lastTested: new Date(),
        responseTime
      }
      
    } catch (error: any) {
      return {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        working: false,
        lastTested: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message
      }
    }
  }

  public getWorkingProxies(): ProxyStatus[] {
    return this.workingProxies.filter(p => p.working)
  }

  public getBestProxy(): ProxyStatus | null {
    const working = this.getWorkingProxies()
    if (working.length === 0) return null
    
    // Restituisce il proxy con il tempo di risposta più basso
    return working.reduce((best, current) => 
      current.responseTime < best.responseTime ? current : best
    )
  }

  public getProxyStats() {
    return {
      totalWorking: this.workingProxies.filter(p => p.working).length,
      totalTested: this.workingProxies.length,
      averageResponseTime: this.getAverageResponseTime(),
      lastUpdate: this.workingProxies.length > 0 ? 
        Math.max(...this.workingProxies.map(p => p.lastTested.getTime())) : null
    }
  }

  private getAverageResponseTime(): number {
    const working = this.workingProxies.filter(p => p.working)
    if (working.length === 0) return 0
    
    const total = working.reduce((sum, p) => sum + p.responseTime, 0)
    return Math.round(total / working.length)
  }

  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
    console.log('⏹️ [PROXY-MONITOR] Monitoraggio fermato')
  }

  public forceUpdate() {
    console.log('🔄 [PROXY-MONITOR] Aggiornamento forzato...')
    this.updateProxyList()
  }
}

export default ProxyMonitor
