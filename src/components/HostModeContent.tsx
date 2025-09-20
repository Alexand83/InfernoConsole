/**
 * 🖥️ HOST MODE CONTENT
 * Contenuto per la modalità DJ Titolare (Server)
 */

import React, { useState, useEffect } from 'react'
import { Server, Users, Mic, MicOff, Play, Square, Copy, Share2, Wifi, WifiOff, CheckCircle, AlertCircle, Volume2, Settings } from 'lucide-react'
import { useCollaborativeMode } from '../contexts/CollaborativeModeContext'
import { useStreaming } from '../contexts/StreamingContext'
import { useCollaborativeAudio } from '../hooks/useCollaborativeAudio'
import { testSTUNConnectivity, detectBestConnectionType } from '../config/webrtc.config'
import { CloudflareConfigPanel } from './CloudflareConfigPanel'
import { BrowserTunnelManager } from '../utils/BrowserTunnelManager'

const HostModeContent: React.FC = () => {
  const { state, actions } = useCollaborativeMode()
  const { state: streamingState } = useStreaming()
  const { state: audioState, actions: audioActions } = useCollaborativeAudio()
  const [localMicVolume, setLocalMicVolume] = useState(80)
  const [remoteVoicesVolume, setRemoteVoicesVolume] = useState(80)
  const [stunStatus, setStunStatus] = useState<'checking' | 'connected' | 'failed' | 'offline'>('checking')
  const [connectionType, setConnectionType] = useState<'local' | 'remote' | 'offline'>('local')
  const [showCloudflareConfig, setShowCloudflareConfig] = useState(false)
  const [isCloudflareConfigured, setIsCloudflareConfigured] = useState(false)

  // Testa connettività STUN all'avvio
  useEffect(() => {
    const testConnection = async () => {
      setStunStatus('checking')
      try {
        const isConnected = await testSTUNConnectivity()
        if (isConnected) {
          setStunStatus('connected')
          const bestType = await detectBestConnectionType()
          setConnectionType(bestType)
        } else {
          setStunStatus('offline')
          setConnectionType('offline')
        }
      } catch (error) {
        console.error('Errore test connessione:', error)
        setStunStatus('offline')
        setConnectionType('offline')
      }
    }
    
    testConnection()
  }, [])

  // Verifica configurazione Cloudflare
  useEffect(() => {
    const tunnelManager = new BrowserTunnelManager()
    setIsCloudflareConfigured(tunnelManager.isCloudflareConfigured())
  }, [])

  const handleStartServer = async () => {
    try {
      await actions.startServer()
    } catch (error) {
      console.error('Errore avvio server:', error)
    }
  }

  const handleStopServer = () => {
    actions.stopServer()
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

  const copySessionCode = async () => {
    if (state.connectionInfo) {
      const success = await actions.copyConnectionInfo()
      if (success) {
        // TODO: Mostrare notifica di copia
        console.log('✅ Informazioni connessione copiate!')
      }
    }
  }

  const shareSession = async () => {
    if (state.connectionInfo) {
      const success = await actions.shareConnectionInfo()
      if (success) {
        console.log('✅ Informazioni connessione condivise!')
      }
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      console.log('✅ Testo copiato:', text)
    } catch (error) {
      console.error('❌ Errore copia:', error)
    }
  }

  return (
    <div className="host-mode-content">
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
                <span>STUN Server Connesso</span>
              </>
            )}
            {stunStatus === 'failed' && (
              <>
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>STUN Server Non Raggiungibile</span>
              </>
            )}
            {stunStatus === 'offline' && (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <span>Modalità Offline - Solo rete locale</span>
              </>
            )}
          </div>
          
          <div className="connection-type">
            <span className="type-label">Tipo Connessione:</span>
            <span className={`type-value ${connectionType}`}>
              {connectionType === 'local' ? '🏠 Locale (stessa rete)' : 
               connectionType === 'remote' ? '🌐 Remota (internet)' : 
               '📱 Offline (solo locale)'}
            </span>
          </div>
        </div>
      </div>

      {/* Server Status */}
      <div className="server-status-section">
        <div className="status-header">
          <Server className="w-6 h-6 text-blue-400" />
          <h4>🖥️ Server Collaborativo</h4>
        </div>
        
        <div className={`status-indicator ${state.serverStatus}`}>
          <div className="status-dot"></div>
          <span>
            {state.serverStatus === 'stopped' ? 'Server Fermo' :
             state.serverStatus === 'running' ? 'Server Attivo' :
             state.serverStatus === 'error' ? 'Errore Server' : 'Sconosciuto'}
          </span>
        </div>

        {/* Plug-and-Play Status */}
        {state.serverStatus === 'running' && (
          <div className="plug-and-play-status">
            <div className="plug-and-play-header">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h5>🚀 Modalità PLUG-AND-PLAY Attiva</h5>
            </div>
            <div className="plug-and-play-info">
              <p>✅ Nessuna configurazione richiesta</p>
              <p>✅ Tunnel automatico creato</p>
              <p>✅ Accessibile da internet</p>
              <p>✅ Condividi solo il codice sessione</p>
            </div>
            
            {/* Informazioni per il Collaboratore */}
            {state.tunnelInfo && (
              <div className="collaborator-info">
                <h6>📤 Per il DJ Collaboratore:</h6>
                <div className="collaborator-details">
                  <div className="info-item">
                    <span className="info-label">Codice Sessione:</span>
                    <div className="info-value">
                      <code>{state.sessionCode}</code>
                      <button onClick={copySessionCode} className="copy-button" title="Copia codice">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-label">URL Server:</span>
                    <div className="info-value">
                      <code>{state.tunnelInfo.publicUrl}</code>
                      <button onClick={() => copyToClipboard(state.tunnelInfo!.publicUrl)} className="copy-button" title="Copia URL">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="collaborator-instructions">
                  <p>💡 <strong>Istruzioni per DJ Collaboratore:</strong></p>
                  <p>1. Apri la stessa app in modalità "DJ Collaboratore"</p>
                  <p>2. Inserisci il codice: <code>{state.sessionCode}</code></p>
                  <p>3. Il sistema troverà automaticamente il server</p>
                </div>
              </div>
            )}
          </div>
        )}

        {state.isCreatingTunnel && (
          <div className="tunnel-creating">
            <div className="tunnel-creating-header">
              <div className="loading-spinner"></div>
              <h5>🚇 Creazione Tunnel PLUG-AND-PLAY...</h5>
            </div>
            <div className="tunnel-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="progress-text">Configurazione automatica in corso...</div>
            </div>
          </div>
        )}

        {/* Configurazione Cloudflare */}
        <div className="cloudflare-config-section">
          <div className="config-header">
            <h5>☁️ Configurazione Cloudflare (Opzionale)</h5>
            <button
              onClick={() => setShowCloudflareConfig(true)}
              className="config-button"
              title="Configura Cloudflare per tunnel più stabili"
            >
              <Settings className="w-4 h-4" />
              {isCloudflareConfigured ? 'Configurato' : 'Configura'}
            </button>
          </div>
          <div className="config-info">
            <p className="text-sm text-dj-light/70">
              {isCloudflareConfigured 
                ? '✅ Cloudflare configurato - Tunnel più stabili e veloci'
                : 'Configura Cloudflare per tunnel più stabili e veloci (opzionale)'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Session Info */}
      {state.serverStatus === 'running' && state.sessionCode && (
        <div className="session-info-section">
          <div className="session-header">
            <h5>📋 Informazioni Sessione</h5>
          </div>
          
          <div className="session-details">
            <div className="session-item">
              <label htmlFor="session-code">Codice Sessione:</label>
              <div className="session-code">
                <code id="session-code">{state.sessionCode}</code>
                <button onClick={copySessionCode} className="copy-button" title="Copia codice" aria-label="Copia codice sessione">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="session-item">
              <label htmlFor="session-url">URL Connessione:</label>
              <div className="session-url">
                <code id="session-url">
                  {(() => {
                    switch (state.connectionType) {
                      case 'public':
                        return state.publicIP ? `ws://${state.publicIP}:${state.serverPort}` : 'IP pubblico non disponibile'
                      case 'tunnel':
                        if (state.isCreatingTunnel) {
                          return '🔄 Creazione tunnel in corso...'
                        }
                        return state.tunnelInfo ? state.tunnelInfo.publicUrl : 'Tunnel non creato'
                      default:
                        return state.localIP ? `ws://${state.localIP}:${state.serverPort}` : `ws://tuo-ip:${state.serverPort}`
                    }
                  })()}
                </code>
                <button onClick={copySessionCode} className="copy-button" title="Copia URL" aria-label="Copia URL connessione">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* IP Information */}
            <div className="ip-information">
              <div className="ip-section">
                <h6>🌐 Informazioni IP</h6>
                
                {state.localIP && (
                  <div className="ip-item">
                    <label>IP Locale (stessa rete):</label>
                    <div className="ip-details">
                      <code className="ip-code">{state.localIP}</code>
                      <span className="ip-description">Solo stessa WiFi</span>
                    </div>
                  </div>
                )}
                
                {state.publicIP && (
                  <div className="ip-item">
                    <label>IP Pubblico (internet):</label>
                    <div className="ip-details">
                      <code className="ip-code">{state.publicIP}</code>
                      <span className="ip-description">Accessibile da ovunque</span>
                    </div>
                  </div>
                )}
                
                {!state.publicIP && state.connectionType !== 'tunnel' && (
                  <div className="ip-warning">
                    <span className="warning-icon">⚠️</span>
                    <span>IP pubblico non rilevato. Usa "Tunnel" per connessioni esterne automatiche.</span>
                  </div>
                )}
                
                {state.isCreatingTunnel && (
                  <div className="tunnel-creating">
                    <label>🚇 Creazione Tunnel:</label>
                    <div className="tunnel-progress">
                      <div className="progress-bar">
                        <div className="progress-fill"></div>
                      </div>
                      <span className="progress-text">Creazione tunnel in corso...</span>
                    </div>
                  </div>
                )}
                
                {state.tunnelInfo && (
                  <div className="tunnel-info">
                    <label>Tunnel Attivo:</label>
                    <div className="tunnel-details">
                      <code className="tunnel-url">{state.tunnelInfo.publicUrl}</code>
                      <span className="tunnel-status">
                        {state.tunnelInfo.status === 'connected' ? '✅ Connesso' : '🔄 Connessione...'}
                      </span>
                      {state.tunnelInfo.expiresAt && (
                        <span className="tunnel-expiry">
                          Scade: {state.tunnelInfo.expiresAt.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* PLUG-AND-PLAY: Connessione automatica */}
              <div className="auto-connection-info">
                <div className="auto-connection-header">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span>🚀 Connessione Automatica PLUG-AND-PLAY</span>
                </div>
                <div className="auto-connection-details">
                  <p>✅ Il sistema creerà automaticamente un tunnel</p>
                  <p>✅ Nessuna configurazione richiesta</p>
                  <p>✅ Accessibile da internet</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="session-actions">
            <button onClick={shareSession} className="share-button">
              <Share2 className="w-4 h-4" />
              Condividi Sessione
            </button>
          </div>
        </div>
      )}

      {/* Connected DJs */}
      <div className="connected-djs-section">
        <div className="djs-header">
          <Users className="w-5 h-5 text-green-400" />
          <h5>🎤 DJ Connessi: {state.connectedDJs.length}</h5>
        </div>
        
        {state.connectedDJs.length > 0 ? (
          <div className="djs-list">
            {state.connectedDJs.map(dj => (
              <div key={dj.id} className="dj-item">
                <div className="dj-info">
                  <div className="dj-name">🎤 {dj.name || 'DJ Remoto'}</div>
                  <div className="dj-status">
                    <span className={`mic-status ${dj.microphone ? 'active' : 'inactive'}`}>
                      {dj.microphone ? '🎤 Attivo' : '🔇 Inattivo'}
                    </span>
                    <span className={`quality-status ${dj.quality}`}>
                      {dj.quality === 'excellent' ? '🟢' :
                       dj.quality === 'good' ? '🟡' :
                       dj.quality === 'fair' ? '🟠' : '🔴'}
                    </span>
                  </div>
                </div>
                <div className="dj-actions">
                  <button className="mute-button" title="Muta DJ">
                    🔇
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

      {/* Collaborative Audio Mixing */}
      <div className="audio-controls-section">
        <div className="controls-header">
          <Volume2 className="w-5 h-5 text-green-400" />
          <h5>🎛️ Mixing Audio Collaborativo</h5>
        </div>
        
        {/* Streaming Status */}
        <div className="streaming-status">
          <div className={`status-indicator ${streamingState.isStreaming ? 'active' : 'inactive'}`}>
            <div className="status-dot"></div>
            <span>
              {streamingState.isStreaming ? '📡 Live Streaming Attivo' : '📡 Live Streaming Inattivo'}
            </span>
          </div>
          {streamingState.isStreaming && (
            <div className="streaming-info">
              <span>🎵 Musica + Microfoni Mixati → Live Stream</span>
            </div>
          )}
        </div>

        {/* Mixing Controls */}
        <div className="mixing-controls">
          {!audioState.isMixing ? (
            <button 
              onClick={audioActions.startMixing}
              className="start-mixing-button"
              disabled={!state.localMicrophone || state.connectedDJs.length === 0}
            >
              <Volume2 className="w-4 h-4" />
              Avvia Mixing Audio
            </button>
          ) : (
            <button 
              onClick={audioActions.stopMixing}
              className="stop-mixing-button"
            >
              <Square className="w-4 h-4" />
              Ferma Mixing Audio
            </button>
          )}
        </div>

        {/* Volume Controls */}
        {audioState.isMixing && (
          <div className="volume-controls">
            <div className="volume-control">
              <label>
                <Mic className="w-4 h-4" />
                Microfono Locale (TU)
              </label>
              <div className="volume-slider">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={audioState.localMicVolume}
                  onChange={(e) => audioActions.setLocalMicVolume(parseInt(e.target.value))}
                  title="Volume microfono locale"
                />
                <span>{audioState.localMicVolume}%</span>
              </div>
            </div>
            
            <div className="volume-control">
              <label>
                <Volume2 className="w-4 h-4" />
                Volume Master
              </label>
              <div className="volume-slider">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={audioState.masterVolume}
                  onChange={(e) => audioActions.setMasterVolume(parseInt(e.target.value))}
                  title="Volume master"
                />
                <span>{audioState.masterVolume}%</span>
              </div>
            </div>

            {/* Remote DJ Volumes */}
            {state.connectedDJs.map(dj => (
              <div key={dj.id} className="volume-control">
                <label>
                  <Users className="w-4 h-4" />
                  {dj.name} (DJ Remoto)
                </label>
                <div className="volume-slider">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={audioState.remoteMicVolumes.get(dj.id) || 80}
                    onChange={(e) => audioActions.setRemoteMicVolume(dj.id, parseInt(e.target.value))}
                    disabled={!dj.microphone}
                    title={`Volume microfono ${dj.name}`}
                  />
                  <span>{audioState.remoteMicVolumes.get(dj.id) || 80}%</span>
                </div>
                <button 
                  className={`mute-button ${dj.microphone ? 'active' : 'inactive'}`}
                  disabled={!dj.microphone}
                >
                  {dj.microphone ? '🎤' : '🔇'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error Display */}
        {audioState.error && (
          <div className="error-message" onClick={audioActions.clearError}>
            <AlertCircle className="w-4 h-4" />
            {audioState.error}
          </div>
        )}

        {/* Instructions */}
        <div className="mixing-instructions">
          <h6>📋 Come funziona:</h6>
          <div className="instruction-list">
            <div className="instruction-item">
              <span className="step-number">1</span>
              <span>Assicurati di essere in Live Streaming</span>
            </div>
            <div className="instruction-item">
              <span className="step-number">2</span>
              <span>Attiva il tuo microfono</span>
            </div>
            <div className="instruction-item">
              <span className="step-number">3</span>
              <span>Fai connettere il DJ collaboratore</span>
            </div>
            <div className="instruction-item">
              <span className="step-number">4</span>
              <span>Clicca "Avvia Mixing Audio"</span>
            </div>
            <div className="instruction-item">
              <span className="step-number">5</span>
              <span>Regola i volumi individuali</span>
            </div>
            <div className="instruction-item">
              <span className="step-number">6</span>
              <span>Il mix va automaticamente in Live Stream!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Server Controls */}
      <div className="server-controls-section">
        <div className="controls-header">
          <h5>🎮 Controlli Server</h5>
        </div>
        
        <div className="server-buttons">
          {state.serverStatus === 'stopped' ? (
            <button onClick={handleStartServer} className="start-server-button">
              <Play className="w-4 h-4" />
              Avvia Server Collaborativo
            </button>
          ) : (
            <button onClick={handleStopServer} className="stop-server-button">
              <Square className="w-4 h-4" />
              Ferma Server
            </button>
          )}
        </div>
      </div>

      {/* Microphone Controls */}
      <div className="microphone-controls-section">
        <div className="controls-header">
          <h5>🎤 Controlli Microfono</h5>
        </div>
        
        <div className="microphone-buttons">
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

      {/* Instructions */}
      <div className="instructions-section">
        <div className="instructions-header">
          <h5>📋 Come usare</h5>
        </div>
        
        <div className="instructions-list">
          <div className="instruction-item">
            <span className="step-number">1</span>
            <span>🚀 Clicca "Avvia Server Collaborativo" (PLUG-AND-PLAY automatico)</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">2</span>
            <span>⏳ Attendi creazione tunnel automatico (5-10 secondi)</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">3</span>
            <span>📋 Copia e condividi il codice sessione con DJ 2</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">4</span>
            <span>🔗 DJ 2 si connette con la stessa app (modalità Client)</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">5</span>
            <span>🎤 Entrambi attivano i microfoni per il mixing</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">6</span>
            <span>📡 Inizia lo streaming live con audio mixato</span>
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

export default HostModeContent
