import React, { useState, useEffect } from 'react'
import { Settings, Key, User, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { BrowserTunnelManager, CloudflareConfig } from '../utils/BrowserTunnelManager'

interface CloudflareConfigPanelProps {
  isOpen: boolean
  onClose: () => void
  onConfigured: () => void
}

export const CloudflareConfigPanel: React.FC<CloudflareConfigPanelProps> = ({
  isOpen,
  onClose,
  onConfigured
}) => {
  const [apiToken, setApiToken] = useState('')
  const [accountId, setAccountId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    // Verifica se Cloudflare è già configurato
    const tunnelManager = new BrowserTunnelManager()
    setIsConfigured(tunnelManager.isCloudflareConfigured())
    
    // Carica valori salvati
    const savedToken = localStorage.getItem('cloudflare_api_token')
    const savedAccountId = localStorage.getItem('cloudflare_account_id')
    
    if (savedToken) setApiToken(savedToken)
    if (savedAccountId) setAccountId(savedAccountId)
  }, [])

  const handleSave = async () => {
    if (!apiToken.trim() || !accountId.trim()) {
      setError('Inserisci sia API Token che Account ID')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const config: CloudflareConfig = {
        apiToken: apiToken.trim(),
        accountId: accountId.trim()
      }

      const tunnelManager = new BrowserTunnelManager()
      tunnelManager.configureCloudflare(config)

      setSuccess(true)
      setIsConfigured(true)
      
      setTimeout(() => {
        onConfigured()
        onClose()
      }, 2000)

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore configurazione')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    localStorage.removeItem('cloudflare_api_token')
    localStorage.removeItem('cloudflare_account_id')
    setApiToken('')
    setAccountId('')
    setIsConfigured(false)
    setError(null)
    setSuccess(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dj-dark rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-dj-accent" />
            <h2 className="text-xl font-bold text-white">Configurazione Cloudflare</h2>
          </div>
          <button
            onClick={onClose}
            className="text-dj-light hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {isConfigured && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">Cloudflare configurato correttamente</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dj-light mb-2">
              <Key className="w-4 h-4 inline mr-1" />
              API Token
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Incolla il tuo API Token Cloudflare"
              className="w-full px-3 py-2 bg-dj-dark border border-dj-light/30 rounded-md text-white placeholder-dj-light/50 focus:border-dj-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dj-light mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Account ID
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Incolla il tuo Account ID Cloudflare"
              className="w-full px-3 py-2 bg-dj-dark border border-dj-light/30 rounded-md text-white placeholder-dj-light/50 focus:border-dj-accent focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm">Configurazione salvata con successo!</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <div className="text-blue-400 text-sm">
                <p className="font-medium mb-1">Come ottenere le credenziali:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Vai su <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" className="underline">dash.cloudflare.com</a></li>
                  <li>Profilo → API Tokens → Create Token</li>
                  <li>Custom token con permessi: Cloudflare Tunnel:Edit</li>
                  <li>Account ID si trova nella sidebar destra</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleSave}
            disabled={isLoading || !apiToken.trim() || !accountId.trim()}
            className="flex-1 bg-dj-accent hover:bg-dj-accent/80 disabled:bg-dj-light/20 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors"
          >
            {isLoading ? 'Salvataggio...' : 'Salva Configurazione'}
          </button>
          
          {isConfigured && (
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Rimuovi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
