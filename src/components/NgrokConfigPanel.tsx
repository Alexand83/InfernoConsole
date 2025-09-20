/**
 * 🔑 NGROK CONFIG PANEL
 * Pannello per configurare ngrok con auth token
 */

import React, { useState } from 'react'
import { X, Key, ExternalLink } from 'lucide-react'
import { BrowserTunnelManager } from '../utils/BrowserTunnelManager'

interface NgrokConfigPanelProps {
  isOpen: boolean
  onClose: () => void
  onConfigured: () => void
}

export const NgrokConfigPanel: React.FC<NgrokConfigPanelProps> = ({ isOpen, onClose, onConfigured }) => {
  const [authToken, setAuthToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!authToken.trim()) {
      setError('Inserisci il token ngrok')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const tunnelManager = new BrowserTunnelManager()
      tunnelManager.configureNgrok({ authToken: authToken.trim() })
      
      console.log('✅ ngrok configurato con successo')
      onConfigured()
      onClose()
    } catch (error) {
      console.error('❌ Errore configurazione ngrok:', error)
      setError('Errore durante la configurazione')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Configurazione ngrok</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Auth Token ngrok
            </label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Il token inizia con "2_" seguito da una stringa lunga
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-600/30 rounded-md">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-blue-900/20 border border-blue-600/30 rounded-md p-3">
            <h4 className="text-blue-300 font-medium text-sm mb-2">Come ottenere il token:</h4>
            <ol className="text-xs text-gray-300 space-y-1">
              <li>1. Vai su <a href="https://dashboard.ngrok.com/signup" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center">
                dashboard.ngrok.com <ExternalLink className="w-3 h-3 ml-1" />
              </a></li>
              <li>2. Crea un account gratuito</li>
              <li>3. Vai su "Get Started" → "Your Authtoken"</li>
              <li>4. Copia il token e incollalo qui</li>
            </ol>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !authToken.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              {isLoading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

