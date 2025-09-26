import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Mic, MicOff, Users, Settings, MessageSquare } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import DJChat from './DJChat'

interface RemoteDJConsolePanelProps {
  isVisible: boolean
  onClose: () => void
}

interface ChatMessage {
  id: string
  djName: string
  message: string
  timestamp: Date
  isSystem: boolean
}

const RemoteDJConsolePanel: React.FC<RemoteDJConsolePanelProps> = ({
  isVisible,
  onClose
}) => {
  const { settings } = useSettings()
  
  // ✅ CRITICAL FIX: Mantieni i dati anche quando il pannello viene chiuso/riaperto
  const [djName, setDjName] = useState(() => {
    // Carica il nome DJ salvato o usa quello dalle settings
    const saved = localStorage.getItem('remoteDJ_name')
    return saved || settings.streaming?.metadata?.djName || 'DJ Remoto'
  })
  
  const [sessionCode, setSessionCode] = useState(() => {
    // Carica il codice sessione salvato
    const saved = localStorage.getItem('remoteDJ_sessionCode')
    return saved || ''
  })
  
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isMuted, setIsMuted] = useState(false)
  
  // WebRTC refs
  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const hostAudioElementRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  // ✅ CRITICAL FIX: Salva i dati quando cambiano
  useEffect(() => {
    if (djName) {
      localStorage.setItem('remoteDJ_name', djName)
    }
  }, [djName])
  
  useEffect(() => {
    if (sessionCode) {
      localStorage.setItem('remoteDJ_sessionCode', sessionCode)
    }
  }, [sessionCode])

  const logAvailableAudioDevices = async () => {
    try {
      console.log(`🎤 [RemoteDJConsolePanel] ===== DISPOSITIVI AUDIO DISPONIBILI =====`)
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      
      console.log(`🎤 [RemoteDJConsolePanel] Trovati ${audioInputs.length} dispositivi audio input:`)
      audioInputs.forEach((device, index) => {
        console.log(`🎤 [RemoteDJConsolePanel] ${index + 1}. ${device.label || 'Dispositivo sconosciuto'} (ID: ${device.deviceId})`)
      })
      
      console.log(`🎤 [RemoteDJConsolePanel] Device ID selezionato dalle settings: ${settings.microphone?.inputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJConsolePanel] Echo Cancellation: ${settings.microphone?.echoCancellation ?? true}`)
      console.log(`🎤 [RemoteDJConsolePanel] Noise Suppression: ${settings.microphone?.noiseSuppression ?? true}`)
      console.log(`🎤 [RemoteDJConsolePanel] Auto Gain Control: ${settings.microphone?.autoGainControl ?? true}`)
      console.log(`🎤 [RemoteDJConsolePanel] ===========================================`)
    } catch (error) {
      console.error('❌ [RemoteDJConsolePanel] Errore enumerazione dispositivi:', error)
    }
  }

  useEffect(() => {
    return () => {
      // ✅ CRITICAL FIX: Cleanup solo se non è minimizzato (per mantenere connessione)
      const isMinimized = (window as any).__remoteDJMinimized__
      if (isMinimized) {
        console.log('🎤 [RemoteDJConsolePanel] Pannello minimizzato - mantengo connessione attiva')
        return
      }
      
      console.log('🎤 [RemoteDJConsolePanel] Cleanup completo - disconnessione')
      
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

  // ✅ NEW: Listener per aggiornamenti del microfono dalle settings
  useEffect(() => {
    const handleMicrophoneSettingsChange = async (event: Event) => {
      const customEvent = event as CustomEvent
      const newDeviceId = customEvent?.detail?.inputDevice
      
      console.log('🔄 [RemoteDJConsolePanel] Impostazioni microfono cambiate:', newDeviceId)
      
      // Se il pannello è visibile e c'è uno stream del microfono, ricrearlo con le nuove settings
      if (isVisible && localStreamRef.current) {
        console.log('🔄 [RemoteDJConsolePanel] Ricreazione stream microfono con nuove settings')
        
        // Ferma lo stream corrente
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
        
        // Ricrea lo stream con le nuove settings dopo un piccolo delay
        setTimeout(async () => {
          try {
            await initializeAudioCapture()
            console.log('✅ [RemoteDJConsolePanel] Stream microfono ricreato con nuove settings')
          } catch (error) {
            console.error('❌ [RemoteDJConsolePanel] Errore ricreazione stream microfono:', error)
          }
        }, 500)
      }
    }

    // Ascolta i cambiamenti delle settings del microfono
    window.addEventListener('djconsole:microphone-settings-changed', handleMicrophoneSettingsChange)
    window.addEventListener('djconsole:settings-updated', handleMicrophoneSettingsChange)
    
    return () => {
      window.removeEventListener('djconsole:microphone-settings-changed', handleMicrophoneSettingsChange)
      window.removeEventListener('djconsole:settings-updated', handleMicrophoneSettingsChange)
    }
  }, [isVisible])

  const initializeAudioCapture = async () => {
    try {
      // Cattura microfono usando le impostazioni dalle settings
      const micDeviceId = settings.microphone?.inputDevice === 'default' ? undefined : settings.microphone?.inputDevice
      
      console.log(`🎤 [RemoteDJConsolePanel] ===== INIZIALIZZAZIONE AUDIO CAPTURE =====`)
      console.log(`🎤 [RemoteDJConsolePanel] Device ID dalle settings: ${settings.microphone?.inputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJConsolePanel] Device ID per getUserMedia:`, micDeviceId)
      console.log(`🎤 [RemoteDJConsolePanel] Echo Cancellation: ${settings.microphone?.echoCancellation ?? true}`)
      console.log(`🎤 [RemoteDJConsolePanel] Noise Suppression: ${settings.microphone?.noiseSuppression ?? true}`)
      console.log(`🎤 [RemoteDJConsolePanel] Auto Gain Control: ${settings.microphone?.autoGainControl ?? true}`)
      console.log(`🎤 [RemoteDJConsolePanel] Sample Rate: 44100`)
      console.log(`🎤 [RemoteDJConsolePanel] Channel Count: 1`)
      
      // Log dispositivi disponibili
      await logAvailableAudioDevices()
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
          echoCancellation: settings.microphone?.echoCancellation ?? true,
          noiseSuppression: settings.microphone?.noiseSuppression ?? true,
          autoGainControl: settings.microphone?.autoGainControl ?? true,
          sampleRate: 44100,
          channelCount: 1
        }
      })
      
      localStreamRef.current = stream
      console.log(`🎤 [RemoteDJConsolePanel] ✅ Stream microfono ottenuto con impostazioni corrette:`, stream)
      console.log(`🎤 [RemoteDJConsolePanel] Tracks audio:`, stream.getAudioTracks().map(track => ({
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        settings: track.getSettings()
      })))
      
      return stream
    } catch (error: any) {
      console.error('❌ [RemoteDJConsolePanel] Errore accesso microfono:', error)
      setConnectionError(`Errore accesso microfono: ${error.message}`)
      throw error
    }
  }

  const connectToHost = async () => {
    if (!sessionCode.trim()) {
      setConnectionError('Inserisci un codice sessione')
      return
    }
    
    if (!djName.trim()) {
      setConnectionError('Inserisci un nome DJ')
      return
    }
    
    setIsConnecting(true)
    setConnectionError(null)
    
    try {
      console.log(`🔌 [RemoteDJConsolePanel] Connessione a sessione: ${sessionCode}`)
      
      // Inizializza audio capture
      await initializeAudioCapture()
      
      // Crea WebSocket connection
      const ws = new WebSocket('ws://localhost:8080')
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('🔌 [RemoteDJConsolePanel] WebSocket connesso')
        ws.send(JSON.stringify({
          type: 'joinSession',
          sessionCode: sessionCode.trim(),
          djName: djName.trim()
        }))
      }
      
      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data)
        console.log('📨 [RemoteDJConsolePanel] Messaggio ricevuto:', data)
        
        switch (data.type) {
          case 'sessionJoined':
            console.log('✅ [RemoteDJConsolePanel] Sessione unita con successo')
            setIsConnected(true)
            setIsConnecting(false)
            addChatMessage('Sistema', 'Connesso alla sessione!', true)
            break
            
          case 'sessionNotFound':
            setConnectionError('Sessione non trovata')
            setIsConnecting(false)
            break
            
          case 'sessionFull':
            setConnectionError('Sessione piena')
            setIsConnecting(false)
            break
            
          case 'webRTCOffer':
            await handleWebRTCOffer(data)
            break
            
          case 'webRTCAnswer':
            await handleWebRTCAnswer(data)
            break
            
          case 'iceCandidate':
            await handleICECandidate(data)
            break
            
          case 'chatMessage':
            addChatMessage(data.djName, data.message, false)
            break
            
          case 'hostDisconnected':
            addChatMessage('Sistema', 'Host disconnesso', true)
            disconnect()
            break
        }
      }
      
      ws.onerror = (error) => {
        console.error('❌ [RemoteDJConsolePanel] Errore WebSocket:', error)
        setConnectionError('Errore connessione WebSocket')
        setIsConnecting(false)
      }
      
      ws.onclose = () => {
        console.log('🔌 [RemoteDJConsolePanel] WebSocket chiuso')
        if (isConnected) {
          setConnectionError('Connessione persa')
          disconnect()
        }
      }
      
    } catch (error: any) {
      console.error('❌ [RemoteDJConsolePanel] Errore connessione:', error)
      setConnectionError(error.message)
      setIsConnecting(false)
    }
  }

  const handleWebRTCOffer = async (data: any) => {
    try {
      console.log('🎥 [RemoteDJConsolePanel] Ricevuto offer WebRTC')
      
      // Crea PeerConnection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      peerConnectionRef.current = peerConnection
      
      // Aggiungi stream locale
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current!)
        })
      }
      
      // Gestisci ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'iceCandidate',
            candidate: event.candidate
          }))
        }
      }
      
      // Gestisci stream remoto
      peerConnection.ontrack = (event) => {
        console.log('🎥 [RemoteDJConsolePanel] Stream remoto ricevuto')
        const [remoteStream] = event.streams
        
        // Crea elemento audio per l'host
        if (!hostAudioElementRef.current) {
          hostAudioElementRef.current = document.createElement('audio')
          hostAudioElementRef.current.autoplay = true
          hostAudioElementRef.current.volume = 0.8
          document.body.appendChild(hostAudioElementRef.current)
        }
        
        hostAudioElementRef.current.srcObject = remoteStream
      }
      
      // Imposta offer remoto
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
      
      // Crea answer
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      
      // Invia answer
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'webRTCAnswer',
          answer: answer
        }))
      }
      
    } catch (error) {
      console.error('❌ [RemoteDJConsolePanel] Errore WebRTC offer:', error)
    }
  }

  const handleWebRTCAnswer = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
    }
  }

  const handleICECandidate = async (data: any) => {
    if (peerConnectionRef.current && data.candidate) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
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
      
      console.log(`🎤 [RemoteDJConsolePanel] Microfono client ${newMutedState ? 'mutato' : 'attivato'}`)
    }
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden ${!isVisible ? 'hidden' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">🎤 DJ Remoto</span>
          {isConnected && (
            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">CONNESSO</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          title="Chiudi pannello DJ"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
        {!isConnected ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Nome DJ
              </label>
              <input
                type="text"
                value={djName}
                onChange={(e) => setDjName(e.target.value)}
                placeholder="Inserisci il tuo nome"
                className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-sm"
                disabled={isConnecting}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Codice Sessione
              </label>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="Codice sessione"
                className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-sm"
                disabled={isConnecting}
              />
            </div>

            {connectionError && (
              <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
                <div className="text-xs text-red-400">
                  ❌ {connectionError}
                </div>
              </div>
            )}

            <button
              onClick={connectToHost}
              disabled={isConnecting || !sessionCode.trim() || !djName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-3 rounded text-sm font-medium transition-colors"
            >
              {isConnecting ? 'Connessione...' : 'Connetti'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Status e controlli */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-300">
                Connesso come: <span className="text-white font-medium">{djName}</span>
              </div>
              <button
                onClick={toggleMute}
                className={`p-2 rounded transition-colors ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-500 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title={isMuted ? 'Riattiva microfono' : 'Muta microfono'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {/* Chat */}
            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center space-x-2 mb-2">
                <MessageSquare className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-300">Chat</span>
              </div>
              <DJChat
                messages={chatMessages}
                onSendMessage={handleSendChatMessage}
                djName={djName}
                isConnected={isConnected}
                className="text-xs"
              />
            </div>

            <button
              onClick={disconnect}
              className="w-full bg-red-600 hover:bg-red-500 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
            >
              Disconnetti
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(RemoteDJConsolePanel)
