/**
 * 🎯 COLLABORATION MODE SELECTOR
 * Selettore per scegliere modalità Host o Client
 */

import React from 'react'
import { Server, Users, Play, Wifi } from 'lucide-react'
import { useCollaboration } from '../contexts/CollaborationContext'

interface CollaborationModeSelectorProps {
  onModeSelected: (mode: 'host' | 'client') => void
}

const CollaborationModeSelector: React.FC<CollaborationModeSelectorProps> = ({ onModeSelected }) => {
  const { state } = useCollaboration()

  return (
    <div className="collaboration-mode-selector">
      <div className="mode-selector-header">
        <h3 className="text-xl font-bold text-white mb-2">🤝 Scegli Modalità Collaborazione</h3>
        <p className="text-dj-light/70 mb-6">Seleziona come vuoi partecipare alla sessione DJ</p>
      </div>

      <div className="mode-options">
        {/* Modalità Host */}
        <div className="mode-option host-mode">
          <div className="mode-icon">
            <Server className="w-8 h-8 text-dj-accent" />
          </div>
          <div className="mode-content">
            <h4 className="mode-title">🖥️ DJ Titolare (Host)</h4>
            <p className="mode-description">
              Sei il DJ principale che gestisce la sessione. Avvii il server e condividi il codice con altri DJ.
            </p>
            <div className="mode-features">
              <div className="feature-item">
                <Play className="w-4 h-4 text-green-400" />
                <span>Avvia server collaborativo</span>
              </div>
              <div className="feature-item">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span>Crea tunnel per accesso remoto</span>
              </div>
              <div className="feature-item">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Gestisci DJ connessi</span>
              </div>
            </div>
            <button
              onClick={() => onModeSelected('host')}
              className="mode-button host-button"
            >
              <Server className="w-4 h-4" />
              Diventa DJ Titolare
            </button>
          </div>
        </div>

        {/* Modalità Client */}
        <div className="mode-option client-mode">
          <div className="mode-icon">
            <Users className="w-8 h-8 text-dj-accent" />
          </div>
          <div className="mode-content">
            <h4 className="mode-title">🎤 DJ Collaboratore (Client)</h4>
            <p className="mode-description">
              Ti unisci a una sessione esistente. Inserisci il codice sessione per connetterti al DJ titolare.
            </p>
            <div className="mode-features">
              <div className="feature-item">
                <Play className="w-4 h-4 text-green-400" />
                <span>Connettiti a sessione esistente</span>
              </div>
              <div className="feature-item">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span>Accesso via codice sessione</span>
              </div>
              <div className="feature-item">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Partecipa al mixing audio</span>
              </div>
            </div>
            <button
              onClick={() => onModeSelected('client')}
              className="mode-button client-button"
            >
              <Users className="w-4 h-4" />
              Diventa DJ Collaboratore
            </button>
          </div>
        </div>
      </div>

      <div className="mode-info">
        <div className="info-box">
          <h5>💡 Come funziona:</h5>
          <ol className="info-steps">
            <li><strong>DJ Titolare</strong> avvia il server e condivide il codice</li>
            <li><strong>DJ Collaboratore</strong> inserisce il codice per connettersi</li>
            <li>Entrambi attivano i microfoni per il mixing collaborativo</li>
            <li>Il sistema mixa automaticamente l'audio di tutti i DJ</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default CollaborationModeSelector


