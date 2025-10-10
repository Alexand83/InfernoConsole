#!/usr/bin/env node

/**
 * Script per aggiornare automaticamente la lista dei proxy
 * Scarica proxy funzionanti da fonti online e li testa
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')

const PROXY_SOURCES = [
  {
    name: 'FreeProxyList',
    url: 'https://www.free-proxy-list.net/',
    parser: parseFreeProxyList
  },
  {
    name: 'ProxyListDownload',
    url: 'https://www.proxy-list.download/api/v1/get?type=http',
    parser: parseProxyListDownload
  },
  {
    name: 'ProxyScrape',
    url: 'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    parser: parseProxyScrape
  }
]

async function updateProxyList() {
  console.log('🔄 [PROXY-UPDATER] Avvio aggiornamento lista proxy...')
  
  try {
    // Carica proxy da tutte le fonti
    const allProxies = []
    
    for (const source of PROXY_SOURCES) {
      try {
        console.log(`📥 [PROXY-UPDATER] Caricamento da ${source.name}...`)
        const response = await axios.get(source.url, { timeout: 15000 })
        const proxies = source.parser(response.data)
        allProxies.push(...proxies)
        console.log(`✅ [PROXY-UPDATER] ${proxies.length} proxy da ${source.name}`)
      } catch (error) {
        console.warn(`⚠️ [PROXY-UPDATER] Errore caricamento ${source.name}:`, error.message)
      }
    }
    
    // Rimuovi duplicati
    const uniqueProxies = removeDuplicates(allProxies)
    console.log(`📊 [PROXY-UPDATER] ${uniqueProxies.length} proxy unici trovati`)
    
    // Testa i proxy (max 50 per evitare sovraccarico)
    const proxiesToTest = uniqueProxies.slice(0, 50)
    const workingProxies = await testProxies(proxiesToTest)
    
    console.log(`✅ [PROXY-UPDATER] ${workingProxies.length} proxy funzionanti trovati`)
    
    // Aggiorna il file di configurazione
    updateConfigFile(workingProxies)
    
    console.log('🎉 [PROXY-UPDATER] Aggiornamento completato!')
    
  } catch (error) {
    console.error('❌ [PROXY-UPDATER] Errore aggiornamento:', error)
  }
}

function parseFreeProxyList(html) {
  const proxies = []
  const regex = /<tr><td>(\d+\.\d+\.\d+\.\d+)<\/td><td>(\d+)<\/td><td>(\w+)<\/td><td>(\w+)<\/td>/g
  let match
  
  while ((match = regex.exec(html)) !== null) {
    const [, host, port, country, anonymity] = match
    
    if (anonymity.toLowerCase().includes('anonymous') || 
        anonymity.toLowerCase().includes('elite')) {
      proxies.push({
        host,
        port: parseInt(port),
        protocol: 'http',
        country,
        anonymity
      })
    }
  }
  
  return proxies
}

function parseProxyListDownload(data) {
  const proxies = []
  const lines = data.split('\n').filter(line => line.trim())
  
  for (const line of lines) {
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

function parseProxyScrape(data) {
  const proxies = []
  const lines = data.split('\n').filter(line => line.trim())
  
  for (const line of lines) {
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

function removeDuplicates(proxies) {
  const seen = new Set()
  return proxies.filter(proxy => {
    const key = `${proxy.host}:${proxy.port}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

async function testProxies(proxies) {
  const workingProxies = []
  const batchSize = 5
  
  console.log(`🧪 [PROXY-UPDATER] Test di ${proxies.length} proxy...`)
  
  for (let i = 0; i < proxies.length; i += batchSize) {
    const batch = proxies.slice(i, i + batchSize)
    const batchPromises = batch.map(proxy => testSingleProxy(proxy))
    const batchResults = await Promise.all(batchPromises)
    
    const working = batchResults.filter(result => result.working)
    workingProxies.push(...working)
    
    console.log(`📊 [PROXY-UPDATER] Batch ${Math.floor(i/batchSize) + 1}: ${working.length}/${batch.length} funzionanti`)
    
    // Pausa tra i batch
    if (i + batchSize < proxies.length) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  return workingProxies
}

async function testSingleProxy(proxy) {
  try {
    const { HttpsProxyAgent } = require('https-proxy-agent')
    const { HttpProxyAgent } = require('http-proxy-agent')
    
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
    
    return {
      ...proxy,
      working: true,
      lastTested: new Date().toISOString(),
      responseTime: response.duration || 0
    }
    
  } catch (error) {
    return {
      ...proxy,
      working: false,
      lastTested: new Date().toISOString(),
      error: error.message
    }
  }
}

function updateConfigFile(workingProxies) {
  const configPath = path.join(__dirname, '..', 'src', 'config', 'proxyList.json')
  
  const config = {
    proxyList: workingProxies.map(proxy => ({
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol,
      description: `${proxy.country || 'Unknown'} - ${proxy.anonymity || 'HTTP'} Proxy`,
      lastTested: proxy.lastTested,
      working: proxy.working,
      responseTime: proxy.responseTime
    })),
    socksProxies: [],
    premiumProxies: [],
    lastUpdated: new Date().toISOString(),
    note: "Lista proxy aggiornata automaticamente. I proxy gratuiti possono essere instabili."
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log(`💾 [PROXY-UPDATER] Configurazione salvata in ${configPath}`)
}

// Esegui se chiamato direttamente
if (require.main === module) {
  updateProxyList()
}

module.exports = { updateProxyList }
