/**
 * 🤝 COLLABORATIVE MODE PANEL
 * Pannello principale per gestire le modalità DJ collaborativo
 */

import React, { useState } from 'react'
import { X, Users, Server, Wifi, Mic, MicOff, Settings } from 'lucide-react'
import { useCollaborativeMode } from '../contexts/CollaborativeModeContext'
import HostModeContent from './HostModeContent'
import ClientModeContent from './ClientModeContent'
import SoloModeContent from './SoloModeContent'

interface CollaborativeModePanelProps {
  onClose: () => void
}

const CollaborativeModePanel: React.FC<CollaborativeModePanelProps> = ({ onClose }) => {
  const { state, actions } = useCollaborativeMode()
  const [showSettings, setShowSettings] = useState(false)

  // Determina il colore dello status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400'
      case 'connecting': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  // Determina l'icona dello status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Wifi className="w-4 h-4" />
      case 'connecting': return <Wifi className="w-4 h-4 animate-pulse" />
      case 'error': return <X className="w-4 h-4" />
      default: return <Wifi className="w-4 h-4" />
    }
  }

  return (
    <div className="collaborative-mode-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-left">
          <Users className="w-6 h-6 text-blue-400" />
          <h3>🤝 Modalità Collaborativa</h3>
        </div>
        
        <div className="header-right">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="settings-button"
            title="Impostazioni"
            aria-label="Impostazioni"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={onClose}
            className="close-button"
            title="Chiudi"
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">Modalità:</span>
          <span className={`status-value ${state.mode === 'solo' ? 'text-gray-400' : 'text-blue-400'}`}>
            {state.mode === 'solo' ? '🎵 Solo DJ' : 
             state.mode === 'host' ? '🖥️ DJ Titolare' : '🔗 DJ Collaboratore'}
          </span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Connessione:</span>
          <span className={`status-value ${getStatusColor(state.serverStatus)}`}>
            {getStatusIcon(state.serverStatus)}
            {state.serverStatus === 'stopped' ? 'Disconnesso' :
             state.serverStatus === 'running' ? 'Connesso' :
             state.serverStatus === 'connecting' ? 'Connessione...' : 'Errore'}
          </span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Microfono:</span>
          <span className={`status-value ${state.localMicrophone ? 'text-green-400' : 'text-gray-400'}`}>
            {state.localMicrophone ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {state.localMicrophone ? 'Attivo' : 'Inattivo'}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {state.errorMessage && (
        <div className="error-message">
          <div className="error-content">
            <X className="w-4 h-4 text-red-400" />
            <span>{state.errorMessage}</span>
            <button onClick={actions.clearError} className="error-close">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Mode Selector */}
      <div className="mode-selector">
        <button 
          className={`mode-button ${state.mode === 'solo' ? 'active' : ''}`}
          onClick={() => actions.setMode('solo')}
        >
          <div className="mode-icon">🎵</div>
          <div className="mode-info">
            <div className="mode-title">Solo DJ</div>
            <div className="mode-description">Modalità normale</div>
          </div>
        </button>
        
        <button 
          className={`mode-button ${state.mode === 'host' ? 'active' : ''}`}
          onClick={() => actions.setMode('host')}
        >
          <div className="mode-icon">🖥️</div>
          <div className="mode-info">
            <div className="mode-title">DJ Titolare</div>
            <div className="mode-description">Avvia server collaborativo</div>
          </div>
        </button>
        
        <button 
          className={`mode-button ${state.mode === 'client' ? 'active' : ''}`}
          onClick={() => actions.setMode('client')}
        >
          <div className="mode-icon">🔗</div>
          <div className="mode-info">
            <div className="mode-title">DJ Collaboratore</div>
            <div className="mode-description">Connetti a server</div>
          </div>
        </button>
      </div>

      {/* Content Area */}
      <div className="content-area">
        {state.mode === 'solo' && <SoloModeContent />}
        {state.mode === 'host' && <HostModeContent />}
        {state.mode === 'client' && <ClientModeContent />}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h4>⚙️ Impostazioni Collaborativo</h4>
            <button onClick={() => setShowSettings(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="settings-content">
            <div className="setting-item">
              <label htmlFor="server-port">Porta Server:</label>
              <input 
                id="server-port"
                type="number" 
                value={state.serverPort}
                onChange={(e) => actions.setServerPort(parseInt(e.target.value))}
                min="1024"
                max="65535"
                placeholder="8080"
              />
            </div>
            
            <div className="setting-item">
              <label htmlFor="audio-quality">Qualità Audio:</label>
              <select id="audio-quality" aria-label="Qualità Audio">
                <option value="high">Alta (48kHz)</option>
                <option value="medium">Media (44.1kHz)</option>
                <option value="low">Bassa (22kHz)</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label htmlFor="buffer-size">Buffer Size:</label>
              <select id="buffer-size" aria-label="Buffer Size">
                <option value="1024">1024 samples</option>
                <option value="2048">2048 samples</option>
                <option value="4096">4096 samples</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CollaborativeModePanel
