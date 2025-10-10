import React, { useState, useEffect } from 'react'

interface VPNConfig {
  name: string
  type: 'openvpn' | 'wireguard' | 'http' | 'socks'
  server: string
  port: number
  country: string
  free: boolean
  limitations?: string
}

interface VPNStatus {
  connected: boolean
  currentServer?: string
  country?: string
  ip?: string
  startTime?: Date
  dataUsed?: number
  error?: string
}

const VPNManager: React.FC = () => {
  const [freeVPNs, setFreeVPNs] = useState<VPNConfig[]>([])
  const [premiumVPNs, setPremiumVPNs] = useState<VPNConfig[]>([])
  const [vpnStatus, setVpnStatus] = useState<VPNStatus>({ connected: false })
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [isConnecting, setIsConnecting] = useState(false)
  const [dataUsage, setDataUsage] = useState(0)

  useEffect(() => {
    loadVPNs()
    loadVPNStatus()
    loadAvailableCountries()
    
    // Aggiorna uso dati ogni minuto
    const interval = setInterval(() => {
      loadDataUsage()
    }, 60000)
    
    return () => clearInterval(interval)
  }, [])

  const loadVPNs = async () => {
    try {
      const response = await window.electronAPI.invoke('get-free-vpns')
      if (response.success) {
        setFreeVPNs(response.vpns)
      }
    } catch (error) {
      console.error('Errore caricamento VPN gratuite:', error)
    }

    try {
      const response = await window.electronAPI.invoke('get-premium-vpns')
      if (response.success) {
        setPremiumVPNs(response.vpns)
      }
    } catch (error) {
      console.error('Errore caricamento VPN premium:', error)
    }
  }

  const loadVPNStatus = async () => {
    try {
      const response = await window.electronAPI.invoke('get-vpn-status')
      if (response.success) {
        setVpnStatus(response.status)
      }
    } catch (error) {
      console.error('Errore caricamento stato VPN:', error)
    }
  }

  const loadAvailableCountries = async () => {
    try {
      const response = await window.electronAPI.invoke('get-vpn-countries')
      if (response.success) {
        setAvailableCountries(response.countries)
      }
    } catch (error) {
      console.error('Errore caricamento paesi VPN:', error)
    }
  }

  const loadDataUsage = async () => {
    try {
      const response = await window.electronAPI.invoke('get-vpn-data-usage')
      if (response.success) {
        setDataUsage(response.usage)
      }
    } catch (error) {
      console.error('Errore caricamento uso dati:', error)
    }
  }

  const connectToVPN = async (vpn: VPNConfig) => {
    setIsConnecting(true)
    try {
      const response = await window.electronAPI.invoke('connect-vpn', vpn)
      if (response.success) {
        setVpnStatus(response.status)
        alert(`✅ Connesso a ${vpn.name}`)
      } else {
        alert(`❌ Errore connessione: ${response.error}`)
      }
    } catch (error) {
      console.error('Errore connessione VPN:', error)
      alert('Errore durante la connessione VPN')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectVPN = async () => {
    try {
      const response = await window.electronAPI.invoke('disconnect-vpn')
      if (response.success) {
        setVpnStatus({ connected: false })
        alert('🔌 VPN disconnessa')
      } else {
        alert(`❌ Errore disconnessione: ${response.error}`)
      }
    } catch (error) {
      console.error('Errore disconnessione VPN:', error)
      alert('Errore durante la disconnessione VPN')
    }
  }

  const testVPNConnection = async () => {
    try {
      const response = await window.electronAPI.invoke('test-vpn-connection')
      if (response.success) {
        alert(`✅ Test connessione riuscito\nIP: ${response.ip}`)
        setVpnStatus(prev => ({ ...prev, ip: response.ip }))
      } else {
        alert(`❌ Test connessione fallito: ${response.error}`)
      }
    } catch (error) {
      console.error('Errore test VPN:', error)
      alert('Errore durante il test VPN')
    }
  }

  const filteredVPNs = selectedCountry 
    ? [...freeVPNs, ...premiumVPNs].filter(vpn => vpn.country === selectedCountry)
    : [...freeVPNs, ...premiumVPNs]

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-bold mb-4 flex items-center">
        🔌 Gestione VPN
      </h3>

      {/* Stato VPN */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <h4 className="font-bold mb-2">📊 Stato VPN</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Stato:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${
              vpnStatus.connected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {vpnStatus.connected ? 'Connesso' : 'Disconnesso'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Server:</span>
            <span className="ml-2 text-white">{vpnStatus.currentServer || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-400">Paese:</span>
            <span className="ml-2 text-white">{vpnStatus.country || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-400">IP:</span>
            <span className="ml-2 text-white">{vpnStatus.ip || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-400">Dati usati:</span>
            <span className="ml-2 text-white">{dataUsage} MB</span>
          </div>
          <div>
            <span className="text-gray-400">Tempo connesso:</span>
            <span className="ml-2 text-white">
              {vpnStatus.startTime ? 
                Math.round((Date.now() - new Date(vpnStatus.startTime).getTime()) / 60000) + ' min' : 
                'N/A'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Controlli VPN */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <h4 className="font-bold mb-2">🎛️ Controlli</h4>
        <div className="flex gap-4">
          <button
            onClick={testVPNConnection}
            disabled={!vpnStatus.connected}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            🧪 Test Connessione
          </button>
          <button
            onClick={disconnectVPN}
            disabled={!vpnStatus.connected}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            🔌 Disconnetti
          </button>
          <button
            onClick={loadVPNStatus}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* Filtro per Paese */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <h4 className="font-bold mb-2">🌍 Filtra per Paese</h4>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="">Tutti i paesi</option>
          {availableCountries.map(country => (
            <option key={country} value={country}>{country}</option>
          ))}
        </select>
      </div>

      {/* Lista VPN */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h4 className="font-bold mb-2">🔌 VPN Disponibili</h4>
        <div className="space-y-3">
          {filteredVPNs.map((vpn, index) => (
            <div key={index} className="bg-gray-600 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h5 className="font-medium text-white">{vpn.name}</h5>
                  <p className="text-sm text-gray-300">
                    {vpn.country} • {vpn.server}:{vpn.port}
                  </p>
                  {vpn.limitations && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ⚠️ {vpn.limitations}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    vpn.free ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {vpn.free ? 'GRATUITA' : 'PREMIUM'}
                  </span>
                  <button
                    onClick={() => connectToVPN(vpn)}
                    disabled={isConnecting || vpnStatus.connected}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm transition-colors"
                  >
                    {isConnecting ? 'Connessione...' : 'Connetti'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Informazioni */}
      <div className="mt-4 p-4 bg-blue-900 border border-blue-700 rounded-lg">
        <h5 className="font-bold text-blue-200 mb-2">💡 Informazioni VPN</h5>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• Le VPN gratuite hanno limitazioni di dati e velocità</li>
          <li>• Le VPN premium offrono prestazioni migliori</li>
          <li>• La connessione VPN può rallentare il download</li>
          <li>• Usa VPN solo se necessario per bypassare blocchi</li>
        </ul>
      </div>
    </div>
  )
}

export default VPNManager
