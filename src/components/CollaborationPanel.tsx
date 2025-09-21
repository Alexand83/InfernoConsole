/**
 * 🤝 COLLABORATION PANEL
 * Pannello per gestire la collaborazione DJ
 */

import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Copy, 
  Share2, 
  Settings, 
  Volume2, 
  VolumeX,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react'
import { useCollaboration } from '../contexts/CollaborationContext'
import CloudflareConfigPanel from './CloudflareConfigPanel'
import CollaborationModeSelector from './CollaborationModeSelector'
import ClientModePanel from './ClientModePanel'

interface CollaborationPanelProps {
  onClose: () => void
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ onClose }) => {
  const { state, actions } = useCollaboration()
  const [showCloudflareConfig, setShowCloudflareConfig] = useState(false)
  const [isCloudflareConfigured, setIsCloudflareConfigured] = useState(false)

  // Verifica configurazione Cloudflare
  useEffect(() => {
    const checkCloudflareConfig = () => {
      const apiToken = localStorage.getItem('cloudflare_api_token')
      const accountId = localStorage.getItem('cloudflare_account_id')
      setIsCloudflareConfigured(!!(apiToken && accountId))
    }
    
    checkCloudflareConfig()
  }, [])

  const handleStartServer = async () => {
    try {
      await actions.startServer()
      
      // Se Cloudflare è configurato, crea tunnel automaticamente
      if (isCloudflareConfigured) {
        await actions.createTunnel(state.serverPort)
      }
    } catch (error) {
      console.error('Failed to start server:', error)
    }
  }

  const handleStopServer = async () => {
    try {
      await actions.closeTunnel()
      await actions.stopServer()
    } catch (error) {
      console.error('Failed to stop server:', error)
    }
  }

  const handleStartMicrophone = async () => {
    try {
      await actions.setLocalMicrophone(true)
    } catch (error) {
      console.error('Failed to start microphone:', error)
    }
  }

  const handleStopMicrophone = async () => {
    try {
      await actions.setLocalMicrophone(false)
    } catch (error) {
      console.error('Failed to stop microphone:', error)
    }
  }

  const handleStartMixing = async () => {
    try {
      await actions.startMixing()
    } catch (error) {
      console.error('Failed to start mixing:', error)
    }
  }

  const handleStopMixing = () => {
    actions.stopMixing()
  }

  const copySessionCode = async () => {
    const success = await actions.copySessionCode()
    if (success) {
      // TODO: Mostra notifica di successo
      console.log('✅ Session code copied!')
    }
  }

  const shareSession = async () => {
    const success = await actions.shareSession()
    if (success) {
      console.log('✅ Session shared!')
    }
  }

  const getServerStatusColor = () => {
    switch (state.serverStatus) {
      case 'running': return 'text-green-400'
      case 'starting': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getServerStatusIcon = () => {
    switch (state.serverStatus) {
      case 'running': return <CheckCircle className="w-4 h-4" />
      case 'starting': return <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      case 'error': return <AlertCircle className="w-4 h-4" />
      default: return <Square className="w-4 h-4" />
    }
  }

  // Se non è stata selezionata una modalità, mostra il selettore
  if (!state.mode) {
    return (
      <div className="collaboration-panel">
        <div className="collaboration-header">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-dj-accent" />
            <h3 className="text-lg font-semibold text-white">🤝 Collaborazione DJ</h3>
          </div>
          <button
            onClick={onClose}
            className="text-dj-light hover:text-white transition-colors"
            title="Chiudi pannello"
            aria-label="Chiudi pannello"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <CollaborationModeSelector 
          onModeSelected={(mode) => actions.setMode(mode)}
        />
      </div>
    )
  }

  // Se è modalità client, mostra il pannello client
  if (state.mode === 'client') {
    return (
      <div className="collaboration-panel">
        <ClientModePanel onClose={onClose} />
      </div>
    )
  }

  // Modalità host - mostra il pannello host completo
  return (
    <div className="collaboration-panel">
      {/* Header */}
      <div className="collaboration-header">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-dj-accent" />
          <h3 className="text-lg font-semibold text-white">🖥️ DJ Titolare</h3>
        </div>
        <button
          onClick={onClose}
          className="text-dj-light hover:text-white transition-colors"
          title="Chiudi pannello"
          aria-label="Chiudi pannello"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Server Status */}
      <div className="collaboration-section">
        <div className="section-header">
          <Wifi className="w-5 h-5 text-blue-400" />
          <h4>🖥️ Server Collaborativo</h4>
        </div>
        
        <div className="status-indicator">
          <div className={`status-dot ${state.serverStatus}`}></div>
          <span className={getServerStatusColor()}>
            {getServerStatusIcon()}
            {state.serverStatus === 'stopped' ? 'Server Fermo' :
             state.serverStatus === 'starting' ? 'Avvio Server...' :
             state.serverStatus === 'running' ? 'Server Attivo' :
             state.serverStatus === 'error' ? 'Errore Server' : 'Sconosciuto'}
          </span>
        </div>

        {/* Server Controls */}
        <div className="server-controls">
          {state.serverStatus === 'stopped' ? (
            <button 
              onClick={handleStartServer}
              className="start-server-button"
            >
              <Play className="w-4 h-4" />
              Avvia Server
            </button>
          ) : (
            <button 
              onClick={handleStopServer}
              className="stop-server-button"
            >
              <Square className="w-4 h-4" />
              Ferma Server
            </button>
          )}
        </div>

        {/* Session Info */}
        {state.serverStatus === 'running' && state.sessionCode && (
          <div className="session-info">
            <div className="session-item">
              <label>Codice Sessione:</label>
              <div className="session-code">
                <code>{state.sessionCode}</code>
                <button onClick={copySessionCode} className="copy-button" title="Copia codice">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="session-actions">
              <button onClick={shareSession} className="share-button">
                <Share2 className="w-4 h-4" />
                Condividi
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tunnel Status */}
      {state.serverStatus === 'running' && (
        <div className="collaboration-section">
          <div className="section-header">
            <Wifi className="w-5 h-5 text-blue-400" />
            <h4>🌐 Tunnel Cloudflare</h4>
          </div>
          
          {state.isCreatingTunnel ? (
            <div className="tunnel-creating">
              <div className="loading-spinner"></div>
              <span>Creazione tunnel in corso...</span>
            </div>
          ) : state.tunnelInfo ? (
            <div className="tunnel-active">
              <div className="tunnel-url">
                <label>URL Pubblico:</label>
                <div className="url-display">
                  <code>{state.tunnelInfo.publicUrl}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(state.tunnelInfo!.publicUrl)}
                    className="copy-button"
                    title="Copia URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="tunnel-status">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Tunnel Attivo</span>
              </div>
            </div>
          ) : (
            <div className="tunnel-config">
              <div className="config-info">
                <p>Configura Cloudflare per accesso remoto</p>
                <button
                  onClick={() => setShowCloudflareConfig(true)}
                  className="config-button"
                >
                  <Settings className="w-4 h-4" />
                  {isCloudflareConfigured ? 'Configurato' : 'Configura'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connected DJs */}
      <div className="collaboration-section">
        <div className="section-header">
          <Users className="w-5 h-5 text-green-400" />
          <h4>🎤 DJ Connessi ({state.connectedDJs.length})</h4>
        </div>
        
        {state.connectedDJs.length > 0 ? (
          <div className="djs-list">
            {state.connectedDJs.map(dj => (
              <div key={dj.id} className="dj-item">
                <div className="dj-info">
                  <div className="dj-name">🎤 {dj.name}</div>
                  <div className="dj-status">
                    <span className={`mic-status ${dj.microphone ? 'active' : 'inactive'}`}>
                      {dj.microphone ? '🎤 Attivo' : '🔇 Inattivo'}
                    </span>
                    <span className={`connection-status ${dj.isOnline ? 'online' : 'offline'}`}>
                      {dj.isOnline ? '🟢 Online' : '🔴 Offline'}
                    </span>
                  </div>
                </div>
                <div className="dj-actions">
                  <button 
                    className={`mute-button ${dj.microphone ? 'active' : 'inactive'}`}
                    title={dj.microphone ? 'Muta DJ' : 'Attiva DJ'}
                    aria-label={dj.microphone ? 'Muta DJ' : 'Attiva DJ'}
                  >
                    {dj.microphone ? '🔇' : '🎤'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-djs">
            <p>Nessun DJ connesso</p>
            <p className="help-text">Condividi il codice sessione per far connettere altri DJ</p>
          </div>
        )}
      </div>

      {/* Audio Controls */}
      <div className="collaboration-section">
        <div className="section-header">
          <Volume2 className="w-5 h-5 text-green-400" />
          <h4>🎛️ Controlli Audio</h4>
        </div>
        
        {/* Microphone Controls */}
        <div className="microphone-controls">
          <div className="mic-status">
            <span className={`mic-indicator ${state.localMicrophone ? 'active' : 'inactive'}`}>
              {state.localMicrophone ? '🎤' : '🔇'}
            </span>
            <span>Microfono Locale: {state.localMicrophone ? 'Attivo' : 'Inattivo'}</span>
          </div>
          
          <div className="mic-buttons">
            {!state.localMicrophone ? (
              <button onClick={handleStartMicrophone} className="start-mic-button">
                <Mic className="w-4 h-4" />
                Attiva Microfono
              </button>
            ) : (
              <button onClick={handleStopMicrophone} className="stop-mic-button">
                <MicOff className="w-4 h-4" />
                Disattiva Microfono
              </button>
            )}
          </div>
        </div>

        {/* Mixing Controls */}
        <div className="mixing-controls">
          <div className="mixing-status">
            <span className={`mixing-indicator ${state.isMixing ? 'active' : 'inactive'}`}>
              {state.isMixing ? '🎛️' : '⏸️'}
            </span>
            <span>Mixing: {state.isMixing ? 'Attivo' : 'Inattivo'}</span>
          </div>
          
          <div className="mixing-buttons">
            {!state.isMixing ? (
              <button 
                onClick={handleStartMixing}
                className="start-mixing-button"
                disabled={!state.localMicrophone && state.connectedDJs.length === 0}
              >
                <Volume2 className="w-4 h-4" />
                Avvia Mixing
              </button>
            ) : (
              <button onClick={handleStopMixing} className="stop-mixing-button">
                <VolumeX className="w-4 h-4" />
                Ferma Mixing
              </button>
            )}
          </div>
        </div>

        {/* Volume Controls */}
        {state.isMixing && (
          <div className="volume-controls">
            <div className="volume-control">
              <label>Microfono Locale:</label>
              <div className="volume-slider">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={state.audioConfig.localMicVolume}
                  onChange={(e) => actions.updateAudioConfig({ localMicVolume: parseInt(e.target.value) })}
                  title="Volume microfono locale"
                  aria-label="Volume microfono locale"
                />
                <span>{state.audioConfig.localMicVolume}%</span>
              </div>
            </div>
            
            <div className="volume-control">
              <label>Microfono Remoto:</label>
              <div className="volume-slider">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={state.audioConfig.remoteMicVolume}
                  onChange={(e) => actions.updateAudioConfig({ remoteMicVolume: parseInt(e.target.value) })}
                  title="Volume microfono remoto"
                  aria-label="Volume microfono remoto"
                />
                <span>{state.audioConfig.remoteMicVolume}%</span>
              </div>
            </div>
            
            <div className="volume-control">
              <label>Volume Master:</label>
              <div className="volume-slider">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={state.audioConfig.masterVolume}
                  onChange={(e) => actions.updateAudioConfig({ masterVolume: parseInt(e.target.value) })}
                  title="Volume master"
                  aria-label="Volume master"
                />
                <span>{state.audioConfig.masterVolume}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {state.audioError && (
        <div className="error-message" onClick={actions.clearError}>
          <AlertCircle className="w-4 h-4" />
          {state.audioError}
        </div>
      )}

      {/* Instructions */}
      <div className="collaboration-section">
        <div className="section-header">
          <h4>📋 Come usare</h4>
        </div>
        
        <div className="instructions-list">
          <div className="instruction-item">
            <span className="step-number">1</span>
            <span>Avvia il server collaborativo</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">2</span>
            <span>Configura Cloudflare (opzionale)</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">3</span>
            <span>Condividi il codice sessione</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">4</span>
            <span>Attiva il microfono</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">5</span>
            <span>Avvia il mixing audio</span>
          </div>
        </div>
      </div>

      {/* Cloudflare Configuration Panel */}
      <CloudflareConfigPanel
        isOpen={showCloudflareConfig}
        onClose={() => setShowCloudflareConfig(false)}
        onConfigured={() => {
          setIsCloudflareConfigured(true)
          setShowCloudflareConfig(false)
        }}
      />
    </div>
  )
}

export default CollaborationPanel
