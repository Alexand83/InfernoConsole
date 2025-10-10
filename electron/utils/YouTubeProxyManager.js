/**
 * YouTube Proxy Manager - JavaScript Version
 * Gestisce rotazione proxy e User-Agent per bypassare blocchi YouTube
 */

const axios = require('axios')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { HttpProxyAgent } = require('http-proxy-agent')
const UserAgent = require('user-agents')

class YouTubeProxyManager {
  constructor() {
    this.proxyList = []
    this.currentProxyIndex = 0
    this.userAgentGenerator = new UserAgent({
      deviceCategory: 'desktop',
      platform: 'Win32'
    })
    this.requestHistory = new Map()
    this.initializeDefaultProxies()
  }

  static getInstance() {
    if (!YouTubeProxyManager.instance) {
      YouTubeProxyManager.instance = new YouTubeProxyManager()
    }
    return YouTubeProxyManager.instance
  }

  initializeDefaultProxies() {
    // Lista di proxy pubblici gratuiti (da aggiornare periodicamente)
    this.proxyList = [
      // Proxy HTTP gratuiti più affidabili
      { host: '103.152.112.162', port: 80, protocol: 'http' },
      { host: '45.77.56.113', port: 8080, protocol: 'http' },
      { host: '103.149.162.194', port: 80, protocol: 'http' },
      { host: '185.162.251.76', port: 3128, protocol: 'http' },
      { host: '103.152.112.145', port: 80, protocol: 'http' },
      { host: '45.32.101.24', port: 80, protocol: 'http' },
      { host: '103.149.162.195', port: 80, protocol: 'http' },
      { host: '185.162.251.77', port: 3128, protocol: 'http' },
      // Proxy di fallback
      { host: '8.8.8.8', port: 8080, protocol: 'http' },
      { host: '1.1.1.1', port: 8080, protocol: 'http' },
    ]
  }

  addProxy(proxy) {
    this.proxyList.push(proxy)
  }

  removeProxy(host, port) {
    this.proxyList = this.proxyList.filter(
      p => !(p.host === host && p.port === port)
    )
  }

  getRandomUserAgent() {
    return this.userAgentGenerator.toString()
  }

  getNextProxy() {
    if (this.proxyList.length === 0) return null
    
    const proxy = this.proxyList[this.currentProxyIndex]
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length
    return proxy
  }

  getRandomProxy() {
    if (this.proxyList.length === 0) return null
    return this.proxyList[Math.floor(Math.random() * this.proxyList.length)]
  }

  createProxyAgent(proxy) {
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

  async makeRequest(config) {
    const maxRetries = config.retries || 3
    let lastError = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const proxy = config.proxy || this.getRandomProxy()
        const userAgent = config.userAgent || this.getRandomUserAgent()
        
        console.log(`🔄 [PROXY] Tentativo ${attempt + 1}/${maxRetries} con proxy:`, proxy?.host, 'User-Agent:', userAgent.substring(0, 50) + '...')

        const axiosConfig = {
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
          validateStatus: (status) => status < 400
        }

        if (proxy) {
          axiosConfig.httpsAgent = this.createProxyAgent(proxy)
          axiosConfig.httpAgent = this.createProxyAgent(proxy)
        }

        const response = await axios(axiosConfig)
        
        console.log(`✅ [PROXY] Richiesta completata con successo`)
        return response.data

      } catch (error) {
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

  async testProxy(proxy) {
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

  async testAllProxies() {
    const workingProxies = []
    
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

  getProxyStats() {
    return {
      totalProxies: this.proxyList.length,
      currentIndex: this.currentProxyIndex,
      requestHistory: Object.fromEntries(this.requestHistory)
    }
  }
}

module.exports = { YouTubeProxyManager }
