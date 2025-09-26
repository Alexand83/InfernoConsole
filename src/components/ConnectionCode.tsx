import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface ConnectionCodeProps {
  serverUrl: string
  sessionCode: string
  serverMode: 'locale' | 'internet'
}

const ConnectionCode: React.FC<ConnectionCodeProps> = ({ serverUrl, sessionCode, serverMode }) => {
  const [copied, setCopied] = useState(false)

  const generateConnectionCode = () => {
    if (serverMode === 'internet') {
      // Modalità internet - URL completo + codice
      return `DJCONNECT:${serverUrl}|${sessionCode}`
    } else {
      // Modalità locale - IP + porta + codice
      const ip = serverUrl.replace('ws://', '').replace('wss://', '')
      return `DJCONNECT:${ip}|${sessionCode}`
    }
  }

  const handleCopy = async () => {
    try {
      const code = generateConnectionCode()
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      console.log('✅ [ConnectionCode] Codice copiato:', code)
    } catch (error) {
      console.error('❌ [ConnectionCode] Errore copia:', error)
    }
  }

  return (
    <div className="p-3 bg-green-900/30 border border-green-500/50 rounded">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-green-300 font-medium text-sm mb-1">
            🔗 {serverMode === 'internet' ? 'Connessione Internet' : 'Connessione LAN'}
          </div>
          <div className="text-green-200 text-xs">
            {serverMode === 'internet' 
              ? 'Copia e condividi con i DJ remoti' 
              : 'Copia e condividi con i DJ in rete locale'
            }
          </div>
        </div>
        <button
          onClick={handleCopy}
          className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center space-x-1 ${
            copied 
              ? 'bg-green-700 text-green-200' 
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
          title="Copia codice connessione"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              <span>Copiato!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copia Codice</span>
            </>
          )}
        </button>
      </div>
      
      <div className="bg-black/30 p-2 rounded text-xs font-mono text-gray-300 break-all">
        {generateConnectionCode()}
      </div>
      
      <div className="text-xs text-green-200 mt-2">
        💡 Il DJ può incollare questo codice nel client per connettersi automaticamente
      </div>
    </div>
  )
}

export default ConnectionCode

