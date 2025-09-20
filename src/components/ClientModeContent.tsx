/**
 * 🔗 CLIENT MODE CONTENT
 * Contenuto per la modalità DJ Collaboratore (Client)
 */

import React, { useState, useEffect } from 'react'
import { Wifi, Mic, MicOff, Play, Square, Copy, AlertCircle, CheckCircle } from 'lucide-react'
import { useCollaborativeMode } from '../contexts/CollaborativeModeContext'
import { testSTUNConnectivity } from '../config/webrtc.config'

const ClientModeContent: React.FC = () => {
  const { state, actions } = useCollaborativeMode()
  const [sessionCode, setSessionCode] = useState('')
  const [manualIP, setManualIP] = useState('')
  const [connectionMode, setConnectionMode] = useState<'auto' | 'manual'>('auto')
  const [stunStatus, setStunStatus] = useState<'checking' | 'connected' | 'failed' | 'offline'>('checking')

  // Testa connettività STUN all'avvio
  useEffect(() => {
    const testConnection = async () => {
      setStunStatus('checking')
      try {
        const isConnected = await testSTUNConnectivity()
        setStunStatus(isConnected ? 'connected' : 'offline')
      } catch (error) {
        console.error('Errore test connessione:', error)
        setStunStatus('offline')
      }
    }
    
    testConnection()
  }, [])

  const handleConnect = async () => {
    if (!sessionCode) {
      alert('Inserisci il codice sessione!')
      return
    }

    if (connectionMode === 'manual' && !manualIP) {
      alert('Inserisci l\'IP del server host!')
      return
    }

    try {
      if (connectionMode === 'manual') {
        // Connessione manuale con IP specifico
        await actions.connectToServerWithIP(sessionCode, manualIP)
      } else {
        // Auto-discovery del server basato sul codice sessione
        await actions.connectToServer(sessionCode)
      }
    } catch (error) {
      console.error('Errore connessione:', error)
    }
  }

  const handleDisconnect = () => {
    actions.disconnectFromServer()
  }

  const handleStartMicrophone = async () => {
    try {
      await actions.startLocalMicrophone()
    } catch (error) {
      console.error('Errore avvio microfono:', error)
    }
  }

  const handleStopMicrophone = () => {
    actions.stopLocalMicrophone()
  }

  const copyConnectionInfo = () => {
    const info = `URL: ${serverUrl}\nCodice: ${sessionCode}`
    navigator.clipboard.writeText(info)
    // TODO: Mostrare notifica di copia
  }

  return (
    <div className="client-mode-content">
      {/* WebRTC Connection Status */}
      <div className="webrtc-status-section">
        <div className="status-header">
          <Wifi className="w-6 h-6 text-blue-400" />
          <h4>🌐 Connessione WebRTC</h4>
        </div>
        
        <div className="connection-status">
          <div className={`stun-status ${stunStatus}`}>
            {stunStatus === 'checking' && (
              <>
                <div className="loading-spinner"></div>
                <span>Test connessione STUN...</span>
              </>
            )}
            {stunStatus === 'connected' && (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>STUN Server Connesso - Pronto per P2P</span>
              </>
            )}
            {stunStatus === 'failed' && (
              <>
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>STUN Server Non Raggiungibile - Solo rete locale</span>
              </>
            )}
            {stunStatus === 'offline' && (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <span>Modalità Offline - Solo connessioni locali</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Connection Section */}
      <div className="connection-section">
        <div className="connection-header">
          <Wifi className="w-6 h-6 text-blue-400" />
          <h4>🔗 Connessione al Server</h4>
        </div>
        
        <div className="connection-form">
          {/* Modalità di connessione */}
          <div className="connection-mode-selector">
            <label>Modalità di connessione:</label>
            <div className="mode-buttons">
              <button 
                className={`mode-button ${connectionMode === 'auto' ? 'active' : ''}`}
                onClick={() => setConnectionMode('auto')}
                disabled={state.serverStatus === 'connecting' || state.serverStatus === 'running'}
              >
                🔍 Auto-Discovery
              </button>
              <button 
                className={`mode-button ${connectionMode === 'manual' ? 'active' : ''}`}
                onClick={() => setConnectionMode('manual')}
                disabled={state.serverStatus === 'connecting' || state.serverStatus === 'running'}
              >
                🎯 IP Manuale
              </button>
            </div>
          </div>

          {connectionMode === 'auto' ? (
            <div className="simple-connection">
              <div className="connection-info">
                <h5>🎯 Connessione Semplice</h5>
                <p>Inserisci solo il codice sessione che ti ha fornito il DJ Titolare</p>
              </div>
              
              <div className="input-group">
                <label htmlFor="session-code">Codice Sessione:</label>
                <input 
                  id="session-code"
                  type="text" 
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Es: ABC123"
                  disabled={state.serverStatus === 'connecting' || state.serverStatus === 'running'}
                  maxLength={6}
                />
              </div>
            </div>
          ) : (
            <div className="manual-connection">
              <div className="connection-info">
                <h5>🎯 Connessione Manuale</h5>
                <p>Inserisci il codice sessione e l'IP del server host</p>
              </div>
              
              <div className="input-group">
                <label htmlFor="session-code-manual">Codice Sessione:</label>
                <input 
                  id="session-code-manual"
                  type="text" 
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Es: ABC123"
                  disabled={state.serverStatus === 'connecting' || state.serverStatus === 'running'}
                  maxLength={6}
                />
              </div>
              
              <div className="input-group">
                <label htmlFor="server-ip">IP Server Host:</label>
                <input 
                  id="server-ip"
                  type="text" 
                  value={manualIP}
                  onChange={(e) => setManualIP(e.target.value)}
                  placeholder="Es: 192.168.1.100:8080 o 87.11.92.204:8080"
                  disabled={state.serverStatus === 'connecting' || state.serverStatus === 'running'}
                />
              </div>
            </div>
          )}
          
          <div className="connection-actions">
            {state.serverStatus === 'stopped' ? (
              <button 
                onClick={handleConnect}
                className="connect-button"
                disabled={!sessionCode}
              >
                <Play className="w-4 h-4" />
                Connetti al Server
              </button>
            ) : (
              <button 
                onClick={handleDisconnect}
                className="disconnect-button"
              >
                <Square className="w-4 h-4" />
                Disconnetti
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="connection-status-section">
        <div className="status-header">
          <h5>📊 Status Connessione</h5>
        </div>
        
        <div className={`status-indicator ${state.serverStatus}`}>
          <div className="status-dot"></div>
          <span>
            {state.serverStatus === 'stopped' ? 'Disconnesso' :
             state.serverStatus === 'connecting' ? 'Connessione in corso...' :
             state.serverStatus === 'running' ? 'Connesso al server' :
             state.serverStatus === 'error' ? 'Errore connessione' : 'Sconosciuto'}
          </span>
        </div>
        
        {state.serverStatus === 'running' && (
          <div className="connection-info">
            <div className="info-item">
              <span className="info-label">Server:</span>
              <span className="info-value">{state.serverUrl}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Sessione:</span>
              <span className="info-value">{state.sessionCode}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Connesso da:</span>
              <span className="info-value">Ora</span>
            </div>
          </div>
        )}
      </div>

      {/* Microphone Section */}
      <div className="microphone-section">
        <div className="microphone-header">
          <Mic className="w-5 h-5 text-green-400" />
          <h5>🎤 Microfono</h5>
        </div>
        
        <div className="microphone-status">
          <div className={`mic-indicator ${state.localMicrophone ? 'active' : 'inactive'}`}>
            <div className="mic-dot"></div>
            <span>
              {state.localMicrophone ? 'Microfono Attivo' : 'Microfono Inattivo'}
            </span>
          </div>
        </div>
        
        <div className="microphone-controls">
          {!state.localMicrophone ? (
            <button 
              onClick={handleStartMicrophone}
              className="start-mic-button"
              disabled={state.serverStatus !== 'running'}
            >
              <Mic className="w-4 h-4" />
              Attiva Microfono
            </button>
          ) : (
            <button 
              onClick={handleStopMicrophone}
              className="stop-mic-button"
            >
              <MicOff className="w-4 h-4" />
              Disattiva Microfono
            </button>
          )}
        </div>
        
        {state.serverStatus !== 'running' && (
          <div className="mic-warning">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span>Connettiti al server per attivare il microfono</span>
          </div>
        )}
      </div>

      {/* Audio Quality */}
      {state.localMicrophone && (
        <div className="audio-quality-section">
          <div className="quality-header">
            <h5>🎵 Qualità Audio</h5>
          </div>
          
          <div className="quality-indicators">
            <div className="quality-item">
              <span className="quality-label">Bitrate:</span>
              <span className="quality-value">128 kbps</span>
            </div>
            <div className="quality-item">
              <span className="quality-label">Sample Rate:</span>
              <span className="quality-value">44.1 kHz</span>
            </div>
            <div className="quality-item">
              <span className="quality-label">Latency:</span>
              <span className="quality-value">~50ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="instructions-section">
        <div className="instructions-header">
          <h5>📋 Come usare</h5>
        </div>
        
        <div className="instructions-list">
          <div className="instruction-item">
            <span className="step-number">1</span>
            <span>Inserisci URL server e codice sessione</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">2</span>
            <span>Clicca "Connetti al Server"</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">3</span>
            <span>Attendi la connessione</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">4</span>
            <span>Clicca "Attiva Microfono"</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">5</span>
            <span>Parla nel microfono!</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="tips-section">
        <div className="tips-header">
          <h5>💡 Consigli</h5>
        </div>
        
        <div className="tips-list">
          <div className="tip-item">
            <span className="tip-icon">🎤</span>
            <span>Usa un microfono di buona qualità per risultati migliori</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔇</span>
            <span>Evita ambienti rumorosi per ridurre il feedback</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📶</span>
            <span>Assicurati di avere una connessione internet stabile</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚡</span>
            <span>Chiudi altre applicazioni per ridurre la latenza</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientModeContent
