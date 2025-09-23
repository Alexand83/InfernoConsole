import React, { useState, useEffect, useRef } from 'react'
import DJChat from './DJChat'
import { useSettings } from '../contexts/SettingsContext'

interface RemoteDJClientProps {
  onClose?: () => void
  onMinimize?: () => void
}

interface ChatMessage {
  id: string
  djName: string
  message: string
  timestamp: Date
  isSystem: boolean
}

const RemoteDJClient: React.FC<RemoteDJClientProps> = ({ onClose, onMinimize }) => {
  const { settings } = useSettings()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [djName, setDjName] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [hostIP, setHostIP] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const hostAudioElementRef = useRef<HTMLAudioElement | null>(null)

  // Configurazione WebRTC
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  }

  // Funzione per mostrare tutti i dispositivi audio disponibili
  const logAvailableAudioDevices = async () => {
    try {
      console.log(`🎤 [RemoteDJClient] ===== DISPOSITIVI AUDIO DISPONIBILI =====`)
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
      
      console.log(`🎤 [RemoteDJClient] Dispositivi di INPUT audio (${audioInputs.length}):`)
      audioInputs.forEach((device, index) => {
        console.log(`🎤 [RemoteDJClient]   ${index + 1}. ID: ${device.deviceId}`)
        console.log(`🎤 [RemoteDJClient]      Label: ${device.label || 'Dispositivo sconosciuto'}`)
        console.log(`🎤 [RemoteDJClient]      Group ID: ${device.groupId}`)
      })
      
      console.log(`🎤 [RemoteDJClient] Dispositivi di OUTPUT audio (${audioOutputs.length}):`)
      audioOutputs.forEach((device, index) => {
        console.log(`🎤 [RemoteDJClient]   ${index + 1}. ID: ${device.deviceId}`)
        console.log(`🎤 [RemoteDJClient]      Label: ${device.label || 'Dispositivo sconosciuto'}`)
        console.log(`🎤 [RemoteDJClient]      Group ID: ${device.groupId}`)
      })
      
      // Log delle impostazioni correnti
      console.log(`🎤 [RemoteDJClient] ===== IMPOSTAZIONI MICROFONO CORRENTI =====`)
      console.log(`🎤 [RemoteDJClient] Input Device: ${settings.microphone?.inputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJClient] Output Device: ${settings.audio?.outputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJClient] Echo Cancellation: ${settings.microphone?.echoCancellation ?? true}`)
      console.log(`🎤 [RemoteDJClient] Noise Suppression: ${settings.microphone?.noiseSuppression ?? true}`)
      console.log(`🎤 [RemoteDJClient] Auto Gain Control: ${settings.microphone?.autoGainControl ?? true}`)
      console.log(`🎤 [RemoteDJClient] ===========================================`)
    } catch (error) {
      console.error('❌ [RemoteDJClient] Errore enumerazione dispositivi:', error)
    }
  }

  useEffect(() => {
    return () => {
      // ✅ CRITICAL FIX: Cleanup solo se non è minimizzato (per mantenere connessione)
      const isMinimized = (window as any).__remoteDJMinimized__
      if (isMinimized) {
        console.log('🎤 [RemoteDJClient] Pannello minimizzato - mantengo connessione attiva')
        return
      }
      
      console.log('🎤 [RemoteDJClient] Cleanup completo - disconnessione')
      
      // Cleanup completo solo se non minimizzato
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (hostAudioElementRef.current) {
        hostAudioElementRef.current.pause()
        hostAudioElementRef.current.srcObject = null
        if (hostAudioElementRef.current.parentNode) {
          hostAudioElementRef.current.parentNode.removeChild(hostAudioElementRef.current)
        }
      }
    }
  }, [])

  const initializeAudioCapture = async () => {
    try {
      // Cattura microfono usando le impostazioni dalle settings
      const micDeviceId = settings.microphone?.inputDevice === 'default' ? undefined : settings.microphone?.inputDevice
      console.log(`🎤 [RemoteDJClient] ===== CONFIGURAZIONE MICROFONO CLIENT =====`)
      console.log(`🎤 [RemoteDJClient] Device ID dalle settings: ${settings.microphone?.inputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJClient] Device ID per getUserMedia:`, micDeviceId)
      console.log(`🎤 [RemoteDJClient] Echo Cancellation: ${settings.microphone?.echoCancellation ?? true}`)
      console.log(`🎤 [RemoteDJClient] Noise Suppression: ${settings.microphone?.noiseSuppression ?? true}`)
      console.log(`🎤 [RemoteDJClient] Auto Gain Control: ${settings.microphone?.autoGainControl ?? true}`)
      console.log(`🎤 [RemoteDJClient] Sample Rate: 44100`)
      console.log(`🎤 [RemoteDJClient] Channel Count: 1`)
      
      // Try to get the exact device first
      let stream: MediaStream
      let actualDeviceUsed = 'unknown'
      
      if (micDeviceId && micDeviceId !== 'default') {
        try {
          console.log(`🎤 [RemoteDJClient] Tentativo di usare il dispositivo specifico: ${micDeviceId}`)
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: micDeviceId },
              echoCancellation: settings.microphone?.echoCancellation ?? true,
              noiseSuppression: settings.microphone?.noiseSuppression ?? true,
              autoGainControl: settings.microphone?.autoGainControl ?? true,
              sampleRate: 44100,
              channelCount: 1
            }
          })
          actualDeviceUsed = 'specific device'
          console.log(`🎤 [RemoteDJClient] ✅ Dispositivo specifico utilizzato con successo`)
        } catch (specificDeviceError) {
          console.warn(`🎤 [RemoteDJClient] ⚠️ Dispositivo specifico non disponibile, fallback a default:`, specificDeviceError)
          // Fallback to default device
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: settings.microphone?.echoCancellation ?? true,
              noiseSuppression: settings.microphone?.noiseSuppression ?? true,
              autoGainControl: settings.microphone?.autoGainControl ?? true,
              sampleRate: 44100,
              channelCount: 1
            }
          })
          actualDeviceUsed = 'default (fallback)'
          console.log(`🎤 [RemoteDJClient] ✅ Fallback a dispositivo default completato`)
        }
      } else {
        console.log(`🎤 [RemoteDJClient] Utilizzo dispositivo default`)
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: settings.microphone?.echoCancellation ?? true,
            noiseSuppression: settings.microphone?.noiseSuppression ?? true,
            autoGainControl: settings.microphone?.autoGainControl ?? true,
            sampleRate: 44100,
            channelCount: 1
          }
        })
        actualDeviceUsed = 'default'
      }
      
      // Log dettagliato del stream creato
      console.log(`🎤 [RemoteDJClient] ===== STREAM MICROFONO CLIENT CREATO =====`)
      console.log(`🎤 [RemoteDJClient] Dispositivo effettivamente utilizzato: ${actualDeviceUsed}`)
      console.log(`🎤 [RemoteDJClient] Stream ID: ${stream.id}`)
      console.log(`🎤 [RemoteDJClient] Numero di track audio: ${stream.getAudioTracks().length}`)
      
      stream.getAudioTracks().forEach((track, index) => {
        console.log(`🎤 [RemoteDJClient] Track ${index + 1}:`)
        console.log(`🎤 [RemoteDJClient]   - ID: ${track.id}`)
        console.log(`🎤 [RemoteDJClient]   - Label: ${track.label}`)
        console.log(`🎤 [RemoteDJClient]   - Kind: ${track.kind}`)
        console.log(`🎤 [RemoteDJClient]   - Enabled: ${track.enabled}`)
        console.log(`🎤 [RemoteDJClient]   - Muted: ${track.muted}`)
        console.log(`🎤 [RemoteDJClient]   - Ready State: ${track.readyState}`)
        
        // Prova a ottenere le impostazioni del track
        const trackSettings = track.getSettings()
        console.log(`🎤 [RemoteDJClient]   - Device ID: ${trackSettings.deviceId || 'N/A'}`)
        console.log(`🎤 [RemoteDJClient]   - Sample Rate: ${trackSettings.sampleRate || 'N/A'}`)
        console.log(`🎤 [RemoteDJClient]   - Channel Count: ${trackSettings.channelCount || 'N/A'}`)
        console.log(`🎤 [RemoteDJClient]   - Echo Cancellation: ${trackSettings.echoCancellation || 'N/A'}`)
        console.log(`🎤 [RemoteDJClient]   - Noise Suppression: ${trackSettings.noiseSuppression || 'N/A'}`)
        console.log(`🎤 [RemoteDJClient]   - Auto Gain Control: ${trackSettings.autoGainControl || 'N/A'}`)
        
        // Check if the actual device matches what was requested
        if (micDeviceId && micDeviceId !== 'default') {
          if (trackSettings.deviceId === micDeviceId) {
            console.log(`🎤 [RemoteDJClient]   ✅ DISPOSITIVO CORRETTO: Il track usa il dispositivo richiesto`)
          } else {
            console.log(`🎤 [RemoteDJClient]   ⚠️ DISPOSITIVO DIVERSO: Richiesto ${micDeviceId}, ottenuto ${trackSettings.deviceId}`)
          }
        }
      })
      console.log(`🎤 [RemoteDJClient] ===========================================`)

      localStreamRef.current = stream

      // Crea AudioContext per analisi
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.3

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Avvia monitoraggio audio level
      startAudioLevelMonitoring()

      console.log('🎤 [RemoteDJ] Audio capture inizializzato')
    } catch (error) {
      console.error('❌ [RemoteDJ] Errore inizializzazione audio:', error)
      setConnectionError('Errore accesso microfono')
    }
  }

  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) return

    const dataArray = new Float32Array(analyserRef.current.frequencyBinCount)
    let frameCount = 0

    const monitor = () => {
      if (!analyserRef.current) return
      
      frameCount++
      
      // ✅ FIX: Processa audio solo ogni 2 frame per ridurre CPU usage
      if (frameCount % 2 !== 0) {
        animationFrameRef.current = requestAnimationFrame(monitor)
        return
      }

      analyserRef.current.getFloatTimeDomainData(dataArray)
      
      // ✅ FIX: Ottimizza calcolo usando solo una parte del buffer
      const step = Math.max(1, Math.floor(dataArray.length / 64)) // Usa solo 64 campioni
      let sum = 0
      let count = 0
      for (let i = 0; i < dataArray.length; i += step) {
        sum += Math.abs(dataArray[i])
        count++
      }
      const average = sum / count
      const level = Math.min(100, Math.max(0, average * 200))

      setAudioLevel(level)

      // ✅ FIX: Invia audio level al server ogni 200ms per ridurre spam
      const now = Date.now()
      if (wsRef.current?.readyState === WebSocket.OPEN && now % 200 < 16) {
        wsRef.current.send(JSON.stringify({
          type: 'audio-level',
          level: level
        }))
      }

      animationFrameRef.current = requestAnimationFrame(monitor)
    }

    monitor()
  }

  const connectToHost = async () => {
    if (isConnecting || isConnected) return

    if (!djName.trim()) {
      setConnectionError('Inserisci il nome DJ')
      return
    }

    if (!sessionCode.trim()) {
      setConnectionError('Inserisci il codice sessione')
      return
    }

    if (!hostIP.trim()) {
      setConnectionError('Inserisci l\'IP del DJ Host')
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      // Mostra i dispositivi audio disponibili
      await logAvailableAudioDevices()
      
      // Inizializza audio capture
      await initializeAudioCapture()

      // Connetti WebSocket
      const wsUrl = `ws://${hostIP}:8081`
      console.log(`🔗 [RemoteDJ] Connessione a: ${wsUrl}`)

      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('✅ [RemoteDJ] WebSocket connesso')
        setIsConnected(true)
        setIsConnecting(false)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('❌ [RemoteDJ] Errore parsing messaggio:', error)
        }
      }

      wsRef.current.onclose = () => {
        console.log('🔌 [RemoteDJ] WebSocket disconnesso')
        setIsConnected(false)
        setIsConnecting(false)
      }

      wsRef.current.onerror = (error) => {
        console.error('❌ [RemoteDJ] Errore WebSocket:', error)
        setConnectionError('Errore connessione al DJ Host')
        setIsConnecting(false)
      }

    } catch (error) {
      console.error('❌ [RemoteDJ] Errore connessione:', error)
      setConnectionError('Errore durante la connessione')
      setIsConnecting(false)
    }
  }

  const handleWebSocketMessage = (message: any) => {
    console.log('📨 [RemoteDJ] Messaggio ricevuto:', message.type)

    switch (message.type) {
      case 'welcome':
        console.log('👋 [RemoteDJ] Benvenuto ricevuto, invio autenticazione')
        authenticate()
        break
      case 'auth-success':
        console.log('✅ [RemoteDJ] Autenticazione riuscita')
        startWebRTCConnection()
        break
      case 'auth-error':
        console.error('❌ [RemoteDJ] Errore autenticazione:', message.message)
        setConnectionError(message.message)
        setIsConnected(false)
        break
      case 'webrtc-offer':
        handleWebRTCOffer(message.sdp)
        break
      case 'webrtc-answer':
        handleWebRTCAnswer(message.sdp)
        break
      case 'ice-candidate':
        handleICECandidate(message.candidate)
        break
      case 'chatMessage':
        console.log('💬 [RemoteDJ] Messaggio chat ricevuto:', message)
        addChatMessage(message.djName, message.message)
        break
    }
  }

  const authenticate = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const authMessage = {
      type: 'authenticate',
      djName: djName.trim(),
      sessionCode: sessionCode.trim()
    }

    console.log('🔐 [RemoteDJ] Invio autenticazione:', authMessage)
    wsRef.current.send(JSON.stringify(authMessage))
  }

  const startWebRTCConnection = async () => {
    try {
      // Crea peer connection
      peerConnectionRef.current = new RTCPeerConnection(rtcConfig)

      // Aggiungi stream locale
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current!.addTrack(track, localStreamRef.current!)
        })
      }

      // Gestisci ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }))
        }
      }

      // Gestisci connessione
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('🔗 [RemoteDJ] Stato connessione:', peerConnectionRef.current?.connectionState)
      }

      // Gestisci audio dell'host
      peerConnectionRef.current.ontrack = (event) => {
        console.log('🎵 [RemoteDJ] Ricevuto audio dell\'host:', event.streams[0])
        const hostAudioStream = event.streams[0]
        
        // Crea elemento audio per riprodurre l'audio dell'host
        const hostAudioElement = document.createElement('audio')
        hostAudioElement.srcObject = hostAudioStream
        hostAudioElement.autoplay = true
        hostAudioElement.volume = 0.8 // Volume dell'host
        
        // Aggiungi al DOM (nascosto)
        hostAudioElement.style.display = 'none'
        document.body.appendChild(hostAudioElement)
        
        // Salva il riferimento per cleanup
        hostAudioElementRef.current = hostAudioElement
        
        console.log('🔊 [RemoteDJ] Audio dell\'host riprodotto')
      }

      // Crea offer
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)

      // Invia offer
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc-offer',
          sdp: offer.sdp
        }))
      }

      console.log('🎵 [RemoteDJ] WebRTC offer inviata')

    } catch (error) {
      console.error('❌ [RemoteDJ] Errore WebRTC:', error)
      setConnectionError('Errore WebRTC')
    }
  }

  const handleWebRTCOffer = async (sdp: string) => {
    if (!peerConnectionRef.current) return

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
      const answer = await peerConnectionRef.current.createAnswer()
      await peerConnectionRef.current.setLocalDescription(answer)

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc-answer',
          sdp: answer.sdp
        }))
      }

      console.log('🎵 [RemoteDJ] WebRTC answer inviata')
    } catch (error) {
      console.error('❌ [RemoteDJ] Errore gestione offer:', error)
    }
  }

  const handleWebRTCAnswer = async (sdp: string) => {
    if (!peerConnectionRef.current) return

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
      console.log('🎵 [RemoteDJ] WebRTC answer ricevuta')
    } catch (error) {
      console.error('❌ [RemoteDJ] Errore gestione answer:', error)
    }
  }

  const handleICECandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return

    try {
      await peerConnectionRef.current.addIceCandidate(candidate)
      console.log('🧊 [RemoteDJ] ICE candidate aggiunto')
    } catch (error) {
      console.error('❌ [RemoteDJ] Errore ICE candidate:', error)
    }
  }

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    setIsConnected(false)
    setIsConnecting(false)
    setConnectionError(null)
  }

  const addChatMessage = (djName: string, message: string, isSystem: boolean = false) => {
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      djName,
      message,
      timestamp: new Date(),
      isSystem
    }
    setChatMessages(prev => [...prev, newMessage])
  }

  const handleSendChatMessage = (message: string) => {
    if (!message.trim()) return

    // Invia messaggio al server (il server lo rimanderà indietro)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chatMessage',
        djName: djName || 'DJ Remoto',
        message,
        timestamp: Date.now()
      }))
    }
    
    // NON aggiungere il messaggio alla chat locale qui
    // Il server lo rimanderà indietro e verrà gestito dal case 'chatMessage'
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const newMutedState = !isMuted
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState // Inverti: se muted=true, track.enabled=false
      })
      setIsMuted(newMutedState)
      
      // Imposta il flag globale per il controllo dello streaming
      ;(window as any).__isMicMuted__ = newMutedState
      
      console.log(`🎤 [RemoteDJClient] Microfono client ${newMutedState ? 'mutato' : 'attivato'}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dj-dark border border-dj-accent rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">🎤 DJ Remoto</h2>
          <div className="flex space-x-2">
            {onMinimize && (
              <button
                onClick={onMinimize}
                className="text-dj-light hover:text-white"
                title="Minimizza"
              >
                −
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-dj-light hover:text-white"
                title="Chiudi"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isConnected ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dj-light mb-2">
                Nome DJ
              </label>
              <input
                type="text"
                value={djName}
                onChange={(e) => setDjName(e.target.value)}
                placeholder="Inserisci il tuo nome"
                className="w-full px-3 py-2 bg-dj-primary border border-dj-accent rounded-md text-white placeholder-dj-light/50"
                disabled={isConnecting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light mb-2">
                Codice Sessione
              </label>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="Codice sessione"
                className="w-full px-3 py-2 bg-dj-primary border border-dj-accent rounded-md text-white placeholder-dj-light/50"
                disabled={isConnecting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light mb-2">
                IP DJ Host
              </label>
              <input
                type="text"
                value={hostIP}
                onChange={(e) => setHostIP(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full px-3 py-2 bg-dj-primary border border-dj-accent rounded-md text-white placeholder-dj-light/50"
                disabled={isConnecting}
              />
            </div>

            {connectionError && (
              <div className="text-red-400 text-sm">
                ❌ {connectionError}
              </div>
            )}

            <button
              onClick={connectToHost}
              disabled={isConnecting}
              className="w-full bg-dj-accent hover:bg-dj-accent/80 disabled:bg-dj-accent/50 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isConnecting ? '🔄 Connessione...' : '🔗 Connetti'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-green-400 text-sm mb-2">
                ✅ Connesso a {hostIP}
              </div>
              <div className="text-dj-light text-sm">
                Nome: {djName}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-dj-light">Microfono</span>
                <span className="text-sm text-dj-light">{audioLevel.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-dj-primary rounded-full h-2">
                <div
                  className="bg-dj-accent h-2 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={toggleMute}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  isMuted
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
              </button>
              <button
                onClick={disconnect}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                🔌 Disconnetti
              </button>
            </div>
          </div>
        )}

        {/* Chat DJ */}
        {isConnected && (
          <div className="mt-6">
            <DJChat
              connectedDJs={[{ id: 'host', djName: 'Host' }]}
              onSendMessage={handleSendChatMessage}
              messages={chatMessages}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default RemoteDJClient
