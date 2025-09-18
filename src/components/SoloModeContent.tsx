/**
 * 🎵 SOLO MODE CONTENT
 * Contenuto per la modalità DJ normale (solo)
 */

import React from 'react'
import { Music, Mic, Volume2 } from 'lucide-react'

const SoloModeContent: React.FC = () => {
  return (
    <div className="solo-mode-content">
      <div className="solo-header">
        <div className="solo-icon">
          <Music className="w-12 h-12 text-blue-400" />
        </div>
        <div className="solo-info">
          <h4>🎵 Modalità Solo DJ</h4>
          <p>Modalità normale per DJ singolo</p>
        </div>
      </div>

      <div className="solo-features">
        <div className="feature-item">
          <div className="feature-icon">
            <Music className="w-6 h-6 text-green-400" />
          </div>
          <div className="feature-info">
            <h5>Controllo Tracce</h5>
            <p>Riproduci e mixa le tue tracce</p>
          </div>
        </div>

        <div className="feature-item">
          <div className="feature-icon">
            <Mic className="w-6 h-6 text-blue-400" />
          </div>
          <div className="feature-info">
            <h5>Microfono</h5>
            <p>Usa il microfono per commentare</p>
          </div>
        </div>

        <div className="feature-item">
          <div className="feature-icon">
            <Volume2 className="w-6 h-6 text-purple-400" />
          </div>
          <div className="feature-info">
            <h5>Controlli Audio</h5>
            <p>Regola volumi e effetti</p>
          </div>
        </div>
      </div>

      <div className="solo-actions">
        <div className="action-info">
          <h5>🚀 Pronto per collaborare?</h5>
          <p>Seleziona "DJ Titolare" per avviare una sessione collaborativa o "DJ Collaboratore" per unirti a una sessione esistente.</p>
        </div>
      </div>

      <div className="solo-stats">
        <div className="stat-item">
          <div className="stat-label">Tracce Caricate</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Tempo Trasmissione</div>
          <div className="stat-value">00:00:00</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Ascoltatori</div>
          <div className="stat-value">0</div>
        </div>
      </div>
    </div>
  )
}

export default SoloModeContent
