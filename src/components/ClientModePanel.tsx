/**
 * 🎤 CLIENT MODE PANEL
 * Pannello per DJ Collaboratore (Client)
 */

import React, { useState, useEffect, useRef } from 'react'
import { 
  Users, 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import { useCollaboration } from '../contexts/CollaborationContext'
import { useAudio } from '../contexts/AudioContext'
import WebSocketClientManager from '../utils/WebSocketClientManager'

interface ClientModePanelProps {
  onClose: () => void
}

const ClientModePanel: React.FC<ClientModePanelProps> = ({ onClose }) => {
  const { state, actions } = useCollaboration()
  const { state: audioState, actions: audioActions } = useAudio()
  const [sessionCode, setSessionCode] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [djName, setDjName] = useState('DJ Collaboratore')
  const [isConnected, setIsConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false)
  const [microphoneVolume, setMicrophoneVolume] = useState(1.0)
  
  const wsClient = useRef<WebSocketClientManager | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Float32Array | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Inizializza sistema audio per cattura microfono usando le impostazioni esistenti
  const initializeAudioCapture = async () => {
    try {
      // Usa il microfono esistente dall'AudioContext (solo in Electron)
      if (!audioState.microphone.isEnabled && audioActions?.setMicrophoneEnabled) {
        console.log('🎤 [ClientMode] Abilitando microfono per collaborazione...')
        audioActions.setMicrophoneEnabled(true)
      } else if (!audioActions?.setMicrophoneEnabled) {
        console.log('🌐 [ClientMode] Modalità browser - microfono gestito automaticamente')
      }

      // Crea AudioContext per analisi audio
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      
            // Crea AnalyserNode per catturare dati audio con parametri bilanciati
            analyserRef.current = audioContextRef.current.createAnalyser()
            analyserRef.current.fftSize = 4096 // Bilanciato per qualità e fluidità
            analyserRef.current.smoothingTimeConstant = 0.3 // Bilanciato per qualità e fluidità
            analyserRef.current.minDecibels = -90
            analyserRef.current.maxDecibels = -10
      
      // Crea array per dati audio
      const bufferLength = analyserRef.current.frequencyBinCount
      dataArrayRef.current = new Float32Array(bufferLength)
      
      // In modalità browser, ottieni il microfono direttamente se non disponibile
      if (!audioActions?.setMicrophoneEnabled && !audioState.microphone.stream) {
        console.log('🌐 [ClientMode] Ottenendo accesso microfono per browser...')
        try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                  audio: {
                    echoCancellation: true,  // Riabilitato per qualità
                    noiseSuppression: true,  // Riabilitato per qualità
                    autoGainControl: true,   // Riabilitato per qualità
                    sampleRate: 44100,       // Standard
                    channelCount: 1,         // Mono per ridurre la banda
                    latency: 0.01            // Latenza normale
                  }
                })
          console.log('🎤 [ClientMode] Microfono ottenuto per browser:', stream)
          console.log('🎤 [ClientMode] Audio tracks:', stream.getAudioTracks())
          console.log('🎤 [ClientMode] Track settings:', stream.getAudioTracks()[0]?.getSettings())
          console.log('🎤 [ClientMode] 🔍 MICROFONO IN USO:', stream.getAudioTracks()[0]?.getSettings().deviceId || 'default')
        } catch (error) {
          console.error('❌ [ClientMode] Errore accesso microfono:', error)
          setConnectionError('Errore nell\'accesso al microfono')
        }
      }
      
      console.log('🎤 [ClientMode] Sistema audio inizializzato per collaborazione')
    } catch (error) {
      console.error('❌ [ClientMode] Errore inizializzazione audio:', error)
    }
  }

  // Avvia cattura audio dal microfono con throttling per migliore qualità
  const startAudioCapture = () => {
    if (!analyserRef.current || !dataArrayRef.current || !wsClient.current) return

          let lastSendTime = 0
          const sendInterval = 33 // Invia ogni 33ms (30 FPS) per equilibrio qualità/fluidità

          const captureAudio = () => {
            if (!analyserRef.current || !dataArrayRef.current || !wsClient.current?.isAuthenticated()) {
              return
            }

            const now = Date.now()
            
            // Ottieni dati audio dal microfono
            analyserRef.current.getFloatTimeDomainData(dataArrayRef.current)
            
            // Invia dati audio ogni 33ms per equilibrio qualità/fluidità
            if (now - lastSendTime >= sendInterval) {
              // Riduci la dimensione dei dati per migliorare la qualità
              const audioData = Array.from(dataArrayRef.current)
              
              // Applica filtri minimi per massima fluidità
              const filteredData = audioData.map((sample) => {
                // Solo limitazione range per evitare distorsioni (senza filtri complessi)
                return Math.max(-0.9, Math.min(0.9, sample))
              })
              
              // Debug: verifica se c'è audio da inviare
              const hasAudio = filteredData.some(sample => Math.abs(sample) > 0.001)
              if (hasAudio) {
                console.log('🎤 [ClientMode] Inviando audio:', filteredData.slice(0, 5), '...')
              }
              
              wsClient.current.sendAudioData(filteredData)
              lastSendTime = now
            }
            
            // Continua cattura
            animationFrameRef.current = requestAnimationFrame(captureAudio)
          }

    captureAudio()
  }

  // Ferma cattura audio
  const stopAudioCapture = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  const handleConnect = async () => {
    if (!sessionCode.trim()) {
      setConnectionError('Inserisci un codice sessione')
      return
    }

    // Evita connessioni multiple
    if (isConnecting || isConnected) {
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      console.log('Connecting to session:', sessionCode)
      
      // Crea client WebSocket
      wsClient.current = new WebSocketClientManager()
      
      // URL del server (per ora localhost, in futuro sarà il tunnel)
      const serverUrl = 'ws://localhost:8081'
      
      // Connetti al server
      console.log('🔗 [ClientMode] Connecting with DJ name:', djName)
      const success = await wsClient.current.connect({
        sessionCode: sessionCode.trim(),
        serverUrl: serverUrl,
        djName: djName
      })
      
      if (success) {
        console.log('WebSocket connected, waiting for authentication...')
        setIsConnected(true) // Connesso ma non ancora autenticato
        setIsAuthenticated(false) // Non ancora autenticato
        
        // Inizializza sistema audio per cattura microfono
        await initializeAudioCapture()
        
        // Imposta listener per eventi
        setupEventListeners()
      } else {
        throw new Error('Failed to connect to server')
      }
    } catch (error) {
      console.error('Connection failed:', error)
      setConnectionError(error instanceof Error ? error.message : 'Errore di connessione')
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const setupEventListeners = () => {
    // Listener per autenticazione
    const handleAuthenticated = () => {
      console.log('✅ [ClientMode] Authentication successful')
      setIsAuthenticated(true)
      setIsConnected(true) // Ora è veramente connesso e autenticato
      setConnectionError(null)
    }

    // Listener per errore di autenticazione
    const handleAuthError = (event: any) => {
      console.error('❌ [ClientMode] Authentication failed:', event.detail?.message)
      setConnectionError(event.detail?.message || 'Codice sessione non valido')
      setIsAuthenticated(false)
      setIsConnected(false) // Non è più connesso se l'autenticazione fallisce
    }


    // Aggiungi listener (solo per autenticazione nel client)
    window.addEventListener('websocket-authenticated', handleAuthenticated)
    window.addEventListener('websocket-authError', handleAuthError)
    // I listener per DJ sono solo per il host, non per il client

    // Cleanup function
    return () => {
      window.removeEventListener('websocket-authenticated', handleAuthenticated)
      window.removeEventListener('websocket-authError', handleAuthError)
    }
  }

  const handleDisconnect = async () => {
    try {
      console.log('Disconnecting...')
      
      // Ferma la cattura audio
      stopAudioCapture()
      
      // Pulisci risorse audio
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }
      analyserRef.current = null
      dataArrayRef.current = null
      
      if (wsClient.current) {
        wsClient.current.disconnect()
        wsClient.current = null
      }
      
      setIsConnected(false)
      setIsAuthenticated(false)
      setIsMicrophoneOn(false)
      setConnectionError(null)
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

  const handleStartMicrophone = async () => {
    try {
      if (!analyserRef.current) {
        console.error('Audio system not ready')
        setConnectionError('Sistema audio non pronto')
        return
      }

      // Abilita il microfono se non è già abilitato (solo in Electron)
      if (!audioState.microphone.isEnabled && audioActions?.setMicrophoneEnabled) {
        console.log('🎤 [ClientMode] Abilitando microfono...')
        audioActions.setMicrophoneEnabled(true)
        
        // Aspetta che il microfono sia pronto
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else if (!audioActions?.setMicrophoneEnabled) {
        console.log('🌐 [ClientMode] Modalità browser - microfono gestito automaticamente')
      }

      // Connetti il microfono all'analyser
      let micStream = audioState.microphone.stream
      
      // In modalità browser, ottieni il microfono direttamente se non disponibile
      if (!micStream && !audioActions?.setMicrophoneEnabled) {
        console.log('🌐 [ClientMode] Ottenendo microfono per browser...')
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          })
          console.log('🎤 [ClientMode] Microfono ottenuto per browser')
        } catch (error) {
          console.error('❌ [ClientMode] Errore accesso microfono:', error)
          setConnectionError('Errore nell\'accesso al microfono')
          return
        }
      }
      
      if (micStream && audioContextRef.current) {
        console.log('🎤 [ClientMode] Microfono trovato:', micStream)
        console.log('🎤 [ClientMode] Audio tracks:', micStream.getAudioTracks())
        console.log('🎤 [ClientMode] Track settings:', micStream.getAudioTracks()[0]?.getSettings())
        console.log('🎤 [ClientMode] 🔍 MICROFONO IN USO:', micStream.getAudioTracks()[0]?.getSettings().deviceId || 'default')
        
        const source = audioContextRef.current.createMediaStreamSource(micStream)
        source.connect(analyserRef.current)
        console.log('🎤 [ClientMode] Microfono connesso all\'analyser')
        
        // Test immediato per verificare che l'audio venga catturato
        setTimeout(() => {
          if (analyserRef.current && dataArrayRef.current) {
            analyserRef.current.getFloatTimeDomainData(dataArrayRef.current)
            const hasAudio = dataArrayRef.current.some(sample => Math.abs(sample) > 0.001)
            console.log('🎤 [ClientMode] Test audio cattura:', hasAudio ? '✅ AUDIO RILEVATO' : '❌ NESSUN AUDIO')
            if (hasAudio) {
              console.log('🎤 [ClientMode] Primi valori audio:', dataArrayRef.current.slice(0, 10))
            }
          }
        }, 1000)
      } else {
        console.error('❌ [ClientMode] Stream microfono non disponibile')
        setConnectionError('Stream microfono non disponibile')
        return
      }

      startAudioCapture()
      setIsMicrophoneOn(true)
      
      // Invia stato microfono al server
      if (wsClient.current) {
        wsClient.current.sendMicrophoneStatus(true)
      }
      
      console.log('🎤 [ClientMode] Microfono avviato per collaborazione')
    } catch (error) {
      console.error('❌ [ClientMode] Errore avvio microfono:', error)
      setConnectionError('Errore nell\'avvio del microfono')
    }
  }

  const handleStopMicrophone = () => {
    try {
      stopAudioCapture()
      setIsMicrophoneOn(false)
      
      // Invia stato microfono al server
      if (wsClient.current) {
        wsClient.current.sendMicrophoneStatus(false)
      }
      
      console.log('🔇 [ClientMode] Microfono fermato')
    } catch (error) {
      console.error('❌ [ClientMode] Errore fermata microfono:', error)
    }
  }

  const handleVolumeChange = (volume: number) => {
    setMicrophoneVolume(volume)
    // Il volume del microfono è gestito dalle impostazioni esistenti
    console.log('🎤 [ClientMode] Volume microfono cambiato:', volume)
  }


  // Usa lo stato locale per la connessione

  return (
    <div className="client-mode-panel">
      {/* Header */}
      <div className="client-header">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-dj-accent" />
          <h3 className="text-lg font-semibold text-white">🎤 DJ Collaboratore</h3>
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

      {/* Connection Status */}
      <div className="client-section">
        <div className="section-header">
          <Wifi className="w-5 h-5 text-blue-400" />
          <h4>🔗 Connessione</h4>
        </div>
        
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot"></div>
            <span>
              {isConnected ? 'Connesso alla sessione' : 'Non connesso'}
            </span>
          </div>
        </div>

        {/* Session Code Input */}
        {!isConnected && (
          <div className="session-input">
            <div className="input-field">
              <label htmlFor="dj-name">Nome DJ:</label>
              <input
                id="dj-name"
                type="text"
                value={djName}
                onChange={(e) => setDjName(e.target.value)}
                placeholder="Il tuo nome DJ"
                className="dj-name-input"
              />
            </div>
            
            <div className="input-field">
              <label htmlFor="session-code">Codice Sessione:</label>
              <div className="input-group">
                <input
                  id="session-code"
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Inserisci il codice sessione"
                  className="session-code-input"
                  maxLength={8}
                />
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || isConnected || !sessionCode.trim() || !djName.trim()}
                  className="connect-button"
                >
                  {isConnecting ? (
                    <>
                      <div className="loading-spinner"></div>
                      Connessione...
                    </>
                  ) : isConnected && isAuthenticated ? (
                    <>
                      <div className="w-4 h-4 rounded-full bg-green-500"></div>
                      ✅ Connesso
                    </>
                  ) : isConnected ? (
                    <>
                      <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                      Autenticazione...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Connetti
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connected Info */}
        {isConnected && isAuthenticated && (
          <div className="connected-info">
            <div className="connection-details">
              <div className="detail-item">
                <span className="detail-label">Sessione:</span>
                <span className="detail-value">{sessionCode}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Stato:</span>
                <span className="detail-value connected">✅ Connesso e Autenticato</span>
              </div>
            </div>
            
            <button
              onClick={handleDisconnect}
              className="disconnect-button"
            >
              <Square className="w-4 h-4" />
              Disconnetti
            </button>
          </div>
        )}

        {/* Connection Error */}
        {connectionError && (
          <div className="connection-error">
            <AlertCircle className="w-4 h-4" />
            <span>{connectionError}</span>
          </div>
        )}
      </div>

      {/* Audio Controls */}
      <div className="client-section">
        <div className="section-header">
          <Volume2 className="w-5 h-5 text-green-400" />
          <h4>🎛️ Controlli Audio</h4>
        </div>
        
        {/* Microphone Controls */}
        <div className="microphone-controls">
          <div className="mic-status">
            <span className={`mic-indicator ${isMicrophoneOn ? 'active' : 'inactive'}`}>
              {isMicrophoneOn ? '🎤' : '🔇'}
            </span>
            <span>Microfono: {isMicrophoneOn ? 'Attivo' : 'Inattivo'}</span>
          </div>
          
          <div className="mic-buttons">
            {!isMicrophoneOn ? (
              <button 
                onClick={handleStartMicrophone}
                className="start-mic-button"
                disabled={!isConnected}
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
        </div>

        {/* Volume Control */}
        {isMicrophoneOn && (
          <div className="volume-control">
            <label>Volume Microfono:</label>
            <div className="volume-slider">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={microphoneVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="volume-range"
                title="Volume microfono"
                aria-label="Volume microfono"
              />
              <span className="volume-text">{Math.round(microphoneVolume * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Connected DJs */}
      <div className="client-section">
        <div className="section-header">
          <Users className="w-5 h-5 text-green-400" />
          <h4>🎤 DJ in Sessione ({state.connectedDJs.length + 1})</h4>
        </div>
        
        <div className="djs-list">
          {/* Tu stesso */}
          <div className="dj-item local-dj">
            <div className="dj-info">
              <div className="dj-name">🎤 Tu (Collaboratore)</div>
              <div className="dj-status">
                <span className={`mic-status ${state.localMicrophone ? 'active' : 'inactive'}`}>
                  {state.localMicrophone ? '🎤 Attivo' : '🔇 Inattivo'}
                </span>
                <span className="connection-status online">🟢 Online</span>
              </div>
            </div>
          </div>

          {/* Altri DJ */}
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
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="client-section">
        <div className="section-header">
          <h4>📋 Come partecipare</h4>
        </div>
        
        <div className="instructions-list">
          <div className="instruction-item">
            <span className="step-number">1</span>
            <span>Inserisci il codice sessione del DJ titolare</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">2</span>
            <span>Clicca "Connetti" per unirti alla sessione</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">3</span>
            <span>Attiva il tuo microfono</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">4</span>
            <span>Partecipa al mixing audio collaborativo</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientModePanel
