import React, { useState, useEffect } from 'react'

interface ProxyConfig {
  host: string
  port: number
  username?: string
  password?: string
  protocol: 'http' | 'https' | 'socks4' | 'socks5'
}

interface ProxyStats {
  totalProxies: number
  currentIndex: number
  requestHistory: Record<string, number>
}

interface MethodTestResult {
  method: string
  working: boolean
  error?: string
}

const ProxyManager: React.FC = () => {
  const [proxyStats, setProxyStats] = useState<ProxyStats | null>(null)
  const [workingProxies, setWorkingProxies] = useState<ProxyConfig[]>([])
  const [testResults, setTestResults] = useState<MethodTestResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newProxy, setNewProxy] = useState<ProxyConfig>({
    host: '',
    port: 8080,
    protocol: 'http'
  })
  const [testUrl, setTestUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

  useEffect(() => {
    loadProxyStats()
    loadWorkingProxies()
  }, [])

  const loadProxyStats = async () => {
    try {
      const response = await window.electronAPI.invoke('get-proxy-stats')
      if (response.success) {
        setProxyStats(response.stats)
      }
    } catch (error) {
      console.error('Errore caricamento stats proxy:', error)
    }
  }

  const loadWorkingProxies = async () => {
    try {
      const response = await window.electronAPI.invoke('test-all-proxies')
      if (response.success) {
        setWorkingProxies(response.workingProxies)
        console.log(`✅ [PROXY] ${response.workingProxies.length} proxy funzionanti caricati`)
      } else {
        console.warn('⚠️ [PROXY] Nessun proxy funzionante trovato')
      }
    } catch (error) {
      console.error('Errore caricamento proxy funzionanti:', error)
    }
  }

  const testAllMethods = async () => {
    if (!testUrl) {
      alert('Inserisci un URL YouTube per il test')
      return
    }

    setIsLoading(true)
    try {
      const response = await window.electronAPI.invoke('test-youtube-methods', testUrl)
      if (response.success) {
        setTestResults(response.results)
      } else {
        alert(`Errore test metodi: ${response.error}`)
      }
    } catch (error) {
      console.error('Errore test metodi:', error)
      alert('Errore durante il test dei metodi')
    } finally {
      setIsLoading(false)
    }
  }

  const addProxy = async () => {
    if (!newProxy.host || !newProxy.port) {
      alert('Inserisci host e porta del proxy')
      return
    }

    try {
      const response = await window.electronAPI.invoke('add-proxy', newProxy)
      if (response.success) {
        alert(`Proxy aggiunto: ${response.working ? 'funziona' : 'non funziona'}`)
        setNewProxy({ host: '', port: 8080, protocol: 'http' })
        loadProxyStats()
        loadWorkingProxies()
      } else {
        alert(`Errore aggiunta proxy: ${response.error}`)
      }
    } catch (error) {
      console.error('Errore aggiunta proxy:', error)
      alert('Errore durante l\'aggiunta del proxy')
    }
  }

  const removeProxy = async (host: string, port: number) => {
    try {
      const response = await window.electronAPI.invoke('remove-proxy', host, port)
      if (response.success) {
        alert('Proxy rimosso')
        loadProxyStats()
        loadWorkingProxies()
      } else {
        alert(`Errore rimozione proxy: ${response.error}`)
      }
    } catch (error) {
      console.error('Errore rimozione proxy:', error)
      alert('Errore durante la rimozione del proxy')
    }
  }

  const forceProxyRotation = async () => {
    try {
      const response = await window.electronAPI.invoke('force-proxy-rotation')
      if (response.success) {
        alert(`Nuovo proxy selezionato: ${response.proxy.host}:${response.proxy.port}`)
        loadProxyStats()
      } else {
        alert(`Errore rotazione proxy: ${response.error}`)
      }
    } catch (error) {
      console.error('Errore rotazione proxy:', error)
      alert('Errore durante la rotazione del proxy')
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-bold mb-4 flex items-center">
        🔄 Gestione Proxy e Sistema Avanzato
      </h3>

      {/* Statistiche Proxy */}
      {proxyStats && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold mb-2">📊 Statistiche Proxy</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Proxy totali:</span>
              <span className="ml-2 text-white">{proxyStats.totalProxies}</span>
            </div>
            <div>
              <span className="text-gray-400">Proxy funzionanti:</span>
              <span className="ml-2 text-green-400">{workingProxies.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Indice corrente:</span>
              <span className="ml-2 text-white">{proxyStats.currentIndex}</span>
            </div>
            <div>
              <span className="text-gray-400">Richieste totali:</span>
              <span className="ml-2 text-white">{Object.keys(proxyStats.requestHistory).length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Test Metodi */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <h4 className="font-bold mb-2">🧪 Test Metodi Download</h4>
        <div className="flex gap-4 mb-4">
          <input
            type="url"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="URL YouTube per test..."
            className="flex-1 px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={testAllMethods}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            {isLoading ? 'Test...' : 'Test Metodi'}
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h5 className="font-medium">Risultati Test:</h5>
            {testResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-600 rounded p-2">
                <span className="font-mono text-sm">{result.method}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    result.working ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {result.working ? 'OK' : 'FAIL'}
                  </span>
                  {result.error && (
                    <span className="text-xs text-red-400" title={result.error}>
                      {result.error.substring(0, 50)}...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gestione Proxy */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <h4 className="font-bold mb-2">➕ Aggiungi Proxy</h4>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            value={newProxy.host}
            onChange={(e) => setNewProxy({ ...newProxy, host: e.target.value })}
            placeholder="Host (es: 8.8.8.8)"
            className="px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            value={newProxy.port}
            onChange={(e) => setNewProxy({ ...newProxy, port: parseInt(e.target.value) || 8080 })}
            placeholder="Porta (es: 8080)"
            className="px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <select
            value={newProxy.protocol}
            onChange={(e) => setNewProxy({ ...newProxy, protocol: e.target.value as any })}
            className="px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:outline-none focus:border-blue-500"
            title="Seleziona protocollo proxy"
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks4">SOCKS4</option>
            <option value="socks5">SOCKS5</option>
          </select>
          <button
            onClick={addProxy}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
          >
            Aggiungi
          </button>
        </div>
      </div>

      {/* Lista Proxy Funzionanti */}
      {workingProxies.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h4 className="font-bold mb-2">✅ Proxy Funzionanti</h4>
          <div className="space-y-2">
            {workingProxies.map((proxy, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-600 rounded p-2">
                <span className="font-mono text-sm">
                  {proxy.protocol}://{proxy.host}:{proxy.port}
                </span>
                <button
                  onClick={() => removeProxy(proxy.host, proxy.port)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                >
                  Rimuovi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controlli */}
      <div className="flex gap-4">
        <button
          onClick={loadWorkingProxies}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          🔄 Aggiorna Proxy
        </button>
        <button
          onClick={forceProxyRotation}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
        >
          🔄 Forza Rotazione
        </button>
        <button
          onClick={loadProxyStats}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
        >
          📊 Aggiorna Stats
        </button>
      </div>
    </div>
  )
}

export default ProxyManager
