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
  // ✅ CRITICAL FIX: Salva anche lo stato di connessione e i messaggi della chat (solo sessione)
  const [isConnected, setIsConnected] = useState(() => {
    return sessionStorage.getItem('remoteDJ_isConnected') === 'true'
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('remoteDJ_chatMessages')
      if (saved) {
        const parsed = JSON.parse(saved)
        // ✅ FIX: Converti i timestamp da stringhe a oggetti Date
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }
      return []
    } catch {
      return []
    }
  })
  // ✅ CRITICAL FIX: Salva i dati del form in sessionStorage per mantenerli durante minimizzazione (solo sessione)
  const [djName, setDjName] = useState(() => {
    return sessionStorage.getItem('remoteDJ_djName') || ''
  })
  const [sessionCode, setSessionCode] = useState(() => {
    return sessionStorage.getItem('remoteDJ_sessionCode') || ''
  })
  const [hostIP, setHostIP] = useState(() => {
    return sessionStorage.getItem('remoteDJ_hostIP') || '192.168.1.100'
  })
  const [connectionMode, setConnectionMode] = useState<'locale' | 'internet'>('locale')
  
  // ✅ NEW: Volume control for host audio
  const [hostVolume, setHostVolume] = useState(() => {
    const saved = sessionStorage.getItem('remoteDJ_hostVolume')
    return saved ? parseFloat(saved) : 1.0 // ✅ CRITICAL FIX: Volume di default 100% per qualità massima
  })
  
  // ✅ NEW: Track if host is using PTT Live
  const [isHostPTTLiveActive, setIsHostPTTLiveActive] = useState(() => {
    return sessionStorage.getItem('remoteDJ_hostPTTLiveActive') === 'true'
  })
  
  const [isHostPTTDJActive, setIsHostPTTDJActive] = useState(() => {
    return sessionStorage.getItem('remoteDJ_hostPTTDJActive') === 'true'
  })

  // ✅ NEW: Reconnection state management
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [maxReconnectAttempts] = useState(5)
  const [reconnectDelay, setReconnectDelay] = useState(1000) // Start with 1 second
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ✅ CRITICAL FIX: Funzioni per aggiornare i valori e salvarli in sessionStorage (solo sessione)
  const updateDjName = (value: string) => {
    setDjName(value)
    sessionStorage.setItem('remoteDJ_djName', value)
  }

  const updateSessionCode = (value: string) => {
    setSessionCode(value)
    sessionStorage.setItem('remoteDJ_sessionCode', value)
  }

  const updateHostIP = (value: string) => {
    setHostIP(value)
    sessionStorage.setItem('remoteDJ_hostIP', value)
  }
  
  // ✅ NEW: Update host volume
  const updateHostVolume = (volume: number) => {
    setHostVolume(volume)
    sessionStorage.setItem('remoteDJ_hostVolume', volume.toString())
    
    // Apply volume to host audio element
    if (hostAudioElementRef.current) {
      hostAudioElementRef.current.volume = volume
      console.log(`🔊 [RemoteDJClient] Volume host aggiornato a: ${Math.round(volume * 100)}%`)
    }
  }

  // ✅ NEW: Update host PTT Live state
  const updateHostPTTLiveState = (active: boolean) => {
    setIsHostPTTLiveActive(active)
    sessionStorage.setItem('remoteDJ_hostPTTLiveActive', active.toString())
    console.log(`📡 [RemoteDJClient] Host PTT Live stato aggiornato: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
  }
  
  // ✅ NEW: Update host PTT DJ state
  const updateHostPTTDJState = (active: boolean) => {
    setIsHostPTTDJActive(active)
    sessionStorage.setItem('remoteDJ_hostPTTDJActive', active.toString())
    console.log(`📡 [RemoteDJClient] Host PTT DJ stato aggiornato: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
  }
  
  // ✅ NEW: Handle host PTT DJ command
  const handleHostPTTDJCommand = (active: boolean) => {
    updateHostPTTDJState(active)
    console.log(`🎤 [RemoteDJClient] Host PTT DJ ${active ? 'attivato' : 'disattivato'}`)
  }
  
  // ✅ NEW: Send PTT DJ command to host via DataChannel
  const sendPTTDJCommand = (active: boolean) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const command = {
        type: 'pttDJ',
        active: active,
        timestamp: Date.now()
      }
      
      try {
        dataChannelRef.current.send(JSON.stringify(command))
        console.log(`📡 [DataChannel] Comando PTT DJ inviato all'host: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
      } catch (error) {
        console.error('📡 [DataChannel] Errore invio comando PTT DJ all\'host:', error)
      }
    } else {
      console.warn('📡 [DataChannel] DataChannel non disponibile per invio comando PTT DJ')
    }
  }

  // ✅ NEW: Request host PTT Live state
  const requestHostPTTLiveState = () => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const command = {
        type: 'requestHostPTTLiveState',
        timestamp: Date.now()
      }
      
      try {
        dataChannelRef.current.send(JSON.stringify(command))
        console.log('📡 [RemoteDJClient] Richiesta stato PTT Live host inviata')
      } catch (error) {
        console.error('📡 [RemoteDJClient] Errore richiesta stato PTT Live host:', error)
      }
    } else {
      console.warn('📡 [RemoteDJClient] DataChannel non disponibile per richiesta stato PTT Live host')
    }
  }
  
  // ✅ NEW: Request host PTT DJ state
  const requestHostPTTDJState = () => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const command = {
        type: 'requestHostPTTDJState',
        timestamp: Date.now()
      }
      
      try {
        dataChannelRef.current.send(JSON.stringify(command))
        console.log('📡 [RemoteDJClient] Richiesta stato PTT DJ host inviata')
      } catch (error) {
        console.error('📡 [RemoteDJClient] Errore richiesta stato PTT DJ host:', error)
      }
    } else {
      console.warn('📡 [RemoteDJClient] DataChannel non disponibile per richiesta stato PTT DJ host')
    }
  }

  // ✅ NEW: Robust reconnection system
  const attemptReconnection = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('❌ [RemoteDJClient] Massimo numero di tentativi di riconnessione raggiunto')
      setConnectionError('Impossibile riconnettersi al server')
      return
    }

    if (isConnecting) {
      console.log('🔄 [RemoteDJClient] Connessione già in corso, salto tentativo')
      return
    }

    console.log(`🔄 [RemoteDJClient] Tentativo di riconnessione ${reconnectAttempts + 1}/${maxReconnectAttempts} in ${reconnectDelay}ms`)
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1)
      setReconnectDelay(prev => Math.min(prev * 2, 10000)) // Exponential backoff, max 10 seconds
      connectToHost()
    }, reconnectDelay)
  }

  const resetReconnectionState = () => {
    setReconnectAttempts(0)
    setReconnectDelay(1000)
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }

  // ✅ CRITICAL FIX: Funzioni per aggiornare lo stato di connessione e i messaggi (solo sessione)
  const updateIsConnected = (connected: boolean) => {
    setIsConnected(connected)
    sessionStorage.setItem('remoteDJ_isConnected', connected.toString())
  }

  const [audioLevel, setAudioLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  
  // ✅ NEW: PTT Button States
  const [isPTTDJActive, setIsPTTDJActive] = useState(false)
  const [isPTTLiveActive, setIsPTTLiveActive] = useState(false)

  // ✅ CRITICAL FIX: Inizializza i flag globali all'avvio
  useEffect(() => {
    // Inizializza i flag globali se non esistono
    if ((window as any).__isMicMuted__ === undefined) {
      ;(window as any).__isMicMuted__ = false
    }
    if ((window as any).__isHostMicMuted__ === undefined) {
      ;(window as any).__isHostMicMuted__ = false
    }
    if ((window as any).isCurrentlyStreaming === undefined) {
      ;(window as any).isCurrentlyStreaming = false
    }
    
    console.log(`🎤 [RemoteDJClient] ✅ Flag globali inizializzati:`)
    console.log(`🎤 [RemoteDJClient] - __isMicMuted__: ${(window as any).__isMicMuted__}`)
    console.log(`🎤 [RemoteDJClient] - __isHostMicMuted__: ${(window as any).__isHostMicMuted__}`)
    console.log(`🎤 [RemoteDJClient] - isCurrentlyStreaming: ${(window as any).isCurrentlyStreaming}`)
  }, [])

  // ✅ NEW: Auto-reconnect when returning to page
  useEffect(() => {
    const handlePageShow = () => {
      // Se eravamo connessi e ora non lo siamo più, prova a riconnettere
      if (sessionStorage.getItem('remoteDJ_isConnected') === 'true' && !isConnected && !isConnecting) {
        console.log('🔄 [RemoteDJClient] Pagina tornata visibile - tentativo riconnessione automatica')
        setTimeout(() => {
          connectToHost()
        }, 1000) // Aspetta 1 secondo prima di riconnettere
      } else if (isConnected && peerConnectionRef.current?.connectionState === 'connected') {
        // ✅ NEW: Se siamo connessi ma l'audio dell'host è perso, richiedi lo stato PTT Live
        console.log('🔄 [RemoteDJClient] Pagina tornata visibile - verifica stato audio host')
        setTimeout(() => {
          requestHostPTTLiveState()
          requestHostPTTDJState()
        }, 500)
      }
    }

    const handlePageHide = () => {
      console.log('👁️ [RemoteDJClient] Pagina nascosta - salvataggio stato')
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [isConnected, isConnecting])

  // ✅ NEW: Periodic audio health check
  useEffect(() => {
    if (!isConnected) return

    const audioHealthCheck = setInterval(() => {
      if (peerConnectionRef.current?.connectionState === 'connected') {
        // Verifica se l'elemento audio host è ancora funzionante
        if (hostAudioElementRef.current) {
          const audio = hostAudioElementRef.current
          if (audio.srcObject === null || audio.paused || audio.ended) {
            console.log('🔄 [RemoteDJ] Audio host non funzionante - tentativo ripristino')
            // Cerca stream audio attivo nella connessione
            const receivers = peerConnectionRef.current?.getReceivers()
            if (receivers) {
              receivers.forEach(receiver => {
                if (receiver.track && receiver.track.kind === 'audio' && receiver.track.readyState === 'live') {
                  console.log('🔄 [RemoteDJ] Ripristino elemento audio host')
                  const stream = new MediaStream([receiver.track])
                  audio.srcObject = stream
                  audio.volume = hostVolume
                  audio.play().catch(console.error)
                }
              })
            }
          }
        }
      }
    }, 5000) // Controlla ogni 5 secondi

    return () => clearInterval(audioHealthCheck)
  }, [isConnected, hostVolume])

  // ✅ NEW: Cleanup reconnection timeout on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const hostAudioElementRef = useRef<HTMLAudioElement | null>(null)
  // ✅ NEW: PTT Live recording (record-then-send via DataChannel)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<BlobPart[]>([])
  const pttLiveQueueRef = useRef<boolean>(false) // Coda per evitare sovrapposizioni

  // ✅ RIMOSSO: rtcConfig non più utilizzato (sostituito da optimizedRtcConfig)

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

  // ✅ NEW: Listener per aggiornamenti del microfono dalle settings
  useEffect(() => {
    const handleMicrophoneSettingsChange = async (event: Event) => {
      const customEvent = event as CustomEvent
      const newDeviceId = customEvent?.detail?.inputDevice
      
      console.log('🔄 [RemoteDJClient] Impostazioni microfono cambiate:', newDeviceId)
      
      // Se siamo connessi e c'è uno stream del microfono, ricrearlo con le nuove settings
      if (isConnected && localStreamRef.current) {
        console.log('🔄 [RemoteDJClient] Ricreazione stream microfono con nuove settings')
        
        // Salva lo stato PTT corrente
        const wasPTTDJActive = isPTTDJActive
        // const wasPTTLiveActive = isPTTLiveActive // ❌ RIMOSSO: Non utilizzato
        
        // Ferma lo stream corrente
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
        
        // ✅ ELEGANTE: Aggiornamento microfono senza disconnessioni
        setTimeout(async () => {
          try {
            await updateClientMicrophoneStream()
            console.log('✅ [RemoteDJClient] Stream microfono aggiornato elegantemente con nuove settings')
            
            // ✅ FIX: Ripristina lo stato PTT SOLO se era effettivamente attivo dall'utente
            if (wasPTTDJActive) {
              console.log('🔄 [RemoteDJClient] Ripristino PTT DJ dopo cambio settings')
              handlePTTDJPress()
            }
            // ✅ CRITICAL FIX: NON riattivare automaticamente PTT Live - deve essere attivato manualmente dall'utente
            // if (wasPTTLiveActive) {
            //   console.log('🔄 [RemoteDJClient] Ripristino PTT Live dopo cambio settings')
            //   handlePTTLivePress()
            // }
          } catch (error) {
            console.error('❌ [RemoteDJClient] Errore aggiornamento elegante stream microfono:', error)
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
  }, [isConnected, isPTTDJActive, isPTTLiveActive])

  // ✅ NEW: Funzione per aggiornare il microfono client usando replaceTrack (ELEGANTE)
  const updateClientMicrophoneStream = async () => {
    if (!peerConnectionRef.current || !isConnected) {
      console.warn('⚠️ [RemoteDJClient] Nessuna connessione WebRTC per aggiornare microfono')
      return
    }

    try {
      console.log('🔄 [RemoteDJClient] Aggiornamento elegante microfono client con replaceTrack')

      // Crea nuovo stream microfono con le settings aggiornate
      const micDeviceId = settings.microphone?.inputDevice === 'default' ? undefined : settings.microphone?.inputDevice
      console.log(`🎤 [RemoteDJClient] Creazione nuovo stream con device: ${micDeviceId || 'default'}`)

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micDeviceId,
          echoCancellation: settings.microphone?.echoCancellation ?? true,
          noiseSuppression: settings.microphone?.noiseSuppression ?? true,
          autoGainControl: settings.microphone?.autoGainControl ?? false,
          sampleRate: 48000,
          channelCount: 1
        }
      })

      const newMicTrack = newStream.getAudioTracks()[0]
      if (!newMicTrack) {
        console.error('❌ [RemoteDJClient] Nessun track audio nel nuovo stream microfono')
        return
      }

      // Trova il sender del microfono client esistente
      const senders = peerConnectionRef.current.getSenders()
      let micSender = null
      
      for (const sender of senders) {
        if (sender.track && sender.track.kind === 'audio') {
          micSender = sender
          break
        }
      }

      if (micSender) {
        // ✅ ELEGANTE: Usa replaceTrack invece di rimuovere/aggiungere
        console.log(`🔄 [RemoteDJClient] Sostituzione track microfono usando replaceTrack`)
        await micSender.replaceTrack(newMicTrack)
        
        // ✅ OPTIMIZATION: Pre-warmup del track per ridurre latenza PTT
        newMicTrack.enabled = true
        await new Promise(resolve => setTimeout(resolve, 50)) // Mini warm-up
        newMicTrack.enabled = false // Muta di default (PTT mode)
        
        console.log(`✅ [RemoteDJClient] Track microfono sostituito elegantemente`)
      } else {
        // Se non c'è un sender esistente, aggiungi il track
        console.log(`➕ [RemoteDJClient] Aggiunta nuovo track microfono`)
        newMicTrack.enabled = false // Muta di default (PTT mode)
        peerConnectionRef.current.addTrack(newMicTrack, newStream)
        console.log(`✅ [RemoteDJClient] Nuovo track microfono aggiunto`)
      }

      // Aggiorna il riferimento allo stream locale
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      localStreamRef.current = newStream

      console.log('✅ [RemoteDJClient] Microfono client aggiornato elegantemente senza disconnessioni')

    } catch (error) {
      console.error('❌ [RemoteDJClient] Errore aggiornamento elegante microfono client:', error)
    }
  }

  const initializeAudioCapture = async () => {
    try {
      // Cattura microfono usando le impostazioni dalle settings
      const micDeviceId = settings.microphone?.inputDevice === 'default' ? undefined : settings.microphone?.inputDevice
      console.log(`🎤 [RemoteDJClient] ===== CONFIGURAZIONE MICROFONO CLIENT OTTIMIZZATA =====`)
      console.log(`🎤 [RemoteDJClient] Device ID dalle settings: ${settings.microphone?.inputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJClient] Device ID per getUserMedia:`, micDeviceId)
      console.log(`🎤 [RemoteDJClient] Echo Cancellation: ${settings.microphone?.echoCancellation ?? true}`)
      console.log(`🎤 [RemoteDJClient] Noise Suppression: ${settings.microphone?.noiseSuppression ?? true}`)
      console.log(`🎤 [RemoteDJClient] Auto Gain Control: ${settings.microphone?.autoGainControl ?? true}`)
      console.log(`🎤 [RemoteDJClient] Sample Rate: 48000 (OTTIMIZZATO)`)
      console.log(`🎤 [RemoteDJClient] Channel Count: 1`)
      
      // Try to get the exact device first
      let stream: MediaStream
      let actualDeviceUsed = 'unknown'
      
      if (micDeviceId && micDeviceId !== 'default') {
        try {
          console.log(`🎤 [RemoteDJClient] Tentativo di usare il dispositivo specifico: ${micDeviceId}`)
          // ✅ QUALITÀ PTT: Configurazione audio ottimizzata per qualità massima
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: micDeviceId },
              // ✅ PARAMETRI BASE per qualità massima
              echoCancellation: true,             // ✅ FORZATO: Sempre attivo per qualità
              noiseSuppression: true,             // ✅ FORZATO: Sempre attivo per pulizia
              autoGainControl: false,             // ✅ DISABILITATO: Controllo manuale
              // latency: 0,                         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              sampleRate: 48000,                  // ✅ OTTIMIZZATO: 48kHz per qualità superiore
              channelCount: 1,                    // Mono per ridurre latenza
              sampleSize: 16,                     // 16-bit per compatibilità
              
              // ✅ PARAMETRI GOOGLE AGGIUNTIVI per qualità massima (rimossi per compatibilità)
              // googEchoCancellation: true,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googNoiseSuppression: true,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAutoGainControl: false,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googHighpassFilter: true,           // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googTypingNoiseDetection: true,     // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAudioMirroring: false,          // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              
              // ✅ PARAMETRI AGGIUNTIVI per qualità massima (rimossi per compatibilità)
              // googDAEchoCancellation: true,       // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googNoiseReduction: true,           // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googBeamforming: true,              // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              
              // ✅ PARAMETRI SPECIFICI per qualità PTT (rimossi per compatibilità)
              // suppressLocalAudioPlayback: true,   // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googEchoCancellation2: true,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googNoiseSuppression2: true,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googHighpassFilter2: true,          // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googTypingNoiseDetection2: true,    // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAudioMirroring2: false,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAutoGainControl2: false,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            }
          })
          actualDeviceUsed = 'specific device'
          console.log(`🎤 [RemoteDJClient] ✅ Dispositivo specifico utilizzato con successo`)
        } catch (specificDeviceError) {
          console.warn(`🎤 [RemoteDJClient] ⚠️ Dispositivo specifico non disponibile, fallback a default:`, specificDeviceError)
          // ✅ QUALITÀ PTT: Fallback con configurazione audio ottimizzata
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // ✅ PARAMETRI BASE per qualità massima
              echoCancellation: true,             // ✅ FORZATO: Sempre attivo per qualità
              noiseSuppression: true,             // ✅ FORZATO: Sempre attivo per pulizia
              autoGainControl: false,             // ✅ DISABILITATO: Controllo manuale
              // latency: 0,                         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              sampleRate: 48000,                  // ✅ OTTIMIZZATO: 48kHz per qualità superiore
              channelCount: 1,                    // Mono per ridurre latenza
              sampleSize: 16,                     // 16-bit per compatibilità
              
              // ✅ PARAMETRI GOOGLE AGGIUNTIVI per qualità massima (rimossi per compatibilità)
              // googEchoCancellation: true,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googNoiseSuppression: true,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAutoGainControl: false,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googHighpassFilter: true,           // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googTypingNoiseDetection: true,     // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAudioMirroring: false,          // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              
              // ✅ PARAMETRI AGGIUNTIVI per qualità massima (rimossi per compatibilità)
              // googDAEchoCancellation: true,       // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googNoiseReduction: true,           // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googBeamforming: true,              // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              
              // ✅ PARAMETRI SPECIFICI per qualità PTT (rimossi per compatibilità)
              // suppressLocalAudioPlayback: true,   // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googEchoCancellation2: true,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googNoiseSuppression2: true,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googHighpassFilter2: true,          // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googTypingNoiseDetection2: true,    // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAudioMirroring2: false,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
              // googAutoGainControl2: false,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            }
          })
          actualDeviceUsed = 'default (fallback)'
          console.log(`🎤 [RemoteDJClient] ✅ Fallback a dispositivo default completato`)
        }
      } else {
        console.log(`🎤 [RemoteDJClient] Utilizzo dispositivo default`)
        // ✅ QUALITÀ PTT: Configurazione audio ottimizzata per dispositivo default
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // ✅ PARAMETRI BASE per qualità massima
            echoCancellation: true,             // ✅ FORZATO: Sempre attivo per qualità
            noiseSuppression: true,             // ✅ FORZATO: Sempre attivo per pulizia
            autoGainControl: false,             // ✅ DISABILITATO: Controllo manuale
            // latency: 0,                         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            sampleRate: 48000,                  // ✅ OTTIMIZZATO: 48kHz per qualità superiore
            channelCount: 1,                    // Mono per ridurre latenza
            sampleSize: 16,                     // 16-bit per compatibilità
            
            // ✅ PARAMETRI GOOGLE AGGIUNTIVI per qualità massima (rimossi per compatibilità)
            // googEchoCancellation: true,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googNoiseSuppression: true,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googAutoGainControl: false,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googHighpassFilter: true,           // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googTypingNoiseDetection: true,     // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googAudioMirroring: false,          // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            
            // ✅ PARAMETRI AGGIUNTIVI per qualità massima (rimossi per compatibilità)
            // googDAEchoCancellation: true,       // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googNoiseReduction: true,           // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googBeamforming: true,              // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            
            // ✅ PARAMETRI SPECIFICI per qualità PTT (rimossi per compatibilità)
            // suppressLocalAudioPlayback: true,   // ❌ RIMOSSO: Potrebbe interferire con qualità audio
            // googEchoCancellation2: true,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googNoiseSuppression2: true,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googHighpassFilter2: true,          // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googTypingNoiseDetection2: true,    // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googAudioMirroring2: false,         // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
            // googAutoGainControl2: false,        // ❌ RIMOSSO: Non supportato in MediaTrackConstraints
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

      // ✅ CRITICAL FIX: Muta il microfono di default (PTT mode)
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false
        console.log(`🎤 [RemoteDJClient] Track ${track.id} mutato di default (PTT mode)`)
      })

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
      
      // ✅ PERFORMANCE: Processa audio solo ogni 4 frame per ridurre CPU usage (15fps invece di 30fps)
      if (frameCount % 4 !== 0) {
        animationFrameRef.current = requestAnimationFrame(monitor)
        return
      }

      analyserRef.current.getFloatTimeDomainData(dataArray)
      
      // ✅ PERFORMANCE: Ottimizza calcolo usando solo una parte del buffer
      const step = Math.max(1, Math.floor(dataArray.length / 32)) // Usa solo 32 campioni (era 64)
      let sum = 0
      let count = 0
      for (let i = 0; i < dataArray.length; i += step) {
        sum += Math.abs(dataArray[i])
        count++
      }
      const average = sum / count
      const level = Math.min(100, Math.max(0, average * 200))

      setAudioLevel(level)

      // ✅ PERFORMANCE: Invia audio level al server ogni 500ms per ridurre spam (era 200ms)
      const now = Date.now()
      if (wsRef.current?.readyState === WebSocket.OPEN && now % 500 < 32) {
        wsRef.current.send(JSON.stringify({
          type: 'audio-level',
          level: level
        }))
      }

      animationFrameRef.current = requestAnimationFrame(monitor)
    }

    monitor()
  }

  // ✅ NEW: Funzione per gestire l'incolla automatico del codice di connessione
  const handlePasteConnectionCode = async () => {
    try {
      const text = await navigator.clipboard.readText()
      console.log('📋 [RemoteDJClient] Testo incollato:', text)
      
      // Verifica se è un codice di connessione valido
      if (text.startsWith('DJCONNECT:')) {
        const parts = text.replace('DJCONNECT:', '').split('|')
        if (parts.length === 2) {
          const [serverUrl, sessionCode] = parts
          
          console.log('🔗 [RemoteDJClient] Codice connessione rilevato:', { serverUrl, sessionCode })
          
          // Determina la modalità di connessione
          const isInternet = serverUrl.includes('ngrok') || serverUrl.includes('http')
          setConnectionMode(isInternet ? 'internet' : 'locale')
          
          // Aggiorna i campi
          updateHostIP(serverUrl)
          updateSessionCode(sessionCode)
          
          console.log('✅ [RemoteDJClient] Campi compilati automaticamente')
          return true
        }
      }
      
      console.log('⚠️ [RemoteDJClient] Testo non riconosciuto come codice di connessione')
      return false
    } catch (error) {
      console.error('❌ [RemoteDJClient] Errore lettura clipboard:', error)
      return false
    }
  }

  const connectToHost = async () => {
    console.log(`🎤 [RemoteDJClient] ===== CONNESSIONE AL HOST =====`)
    console.log(`🎤 [RemoteDJClient] Timestamp: ${new Date().toISOString()}`)
    console.log(`🎤 [RemoteDJClient] Parametri connessione:`)
    console.log(`🎤 [RemoteDJClient] - DJ Name: '${djName}'`)
    console.log(`🎤 [RemoteDJClient] - Session Code: '${sessionCode}'`)
    console.log(`🎤 [RemoteDJClient] - Host IP: '${hostIP}'`)
    console.log(`🎤 [RemoteDJClient] - Stato attuale: isConnecting=${isConnecting}, isConnected=${isConnected}`)
    
    if (isConnecting || isConnected) {
      console.log(`🎤 [RemoteDJClient] ⏭️ Connessione già in corso o già connesso`)
      return
    }

    if (!djName.trim()) {
      setConnectionError('Inserisci il nome DJ')
      console.log(`🎤 [RemoteDJClient] ❌ Connessione fallita: nome DJ mancante`)
      return
    }

    if (!sessionCode.trim()) {
      setConnectionError('Inserisci il codice sessione')
      console.log(`🎤 [RemoteDJClient] ❌ Connessione fallita: codice sessione mancante`)
      return
    }

    if (!hostIP.trim()) {
      setConnectionError('Inserisci l\'IP del DJ Host')
      console.log(`🎤 [RemoteDJClient] ❌ Connessione fallita: IP host mancante`)
      return
    }

    setIsConnecting(true)
    setConnectionError(null)
    console.log(`🎤 [RemoteDJClient] ✅ Inizio connessione...`)

    try {
      // Mostra i dispositivi audio disponibili
      await logAvailableAudioDevices()
      
      // Inizializza audio capture
      await initializeAudioCapture()

      // Connetti WebSocket - Supporto TUNNEL NGROK
      let wsUrl: string
      
      if (hostIP.includes('ngrok')) {
        // URL tunnel pubblico ngrok (già completo)
        wsUrl = hostIP.startsWith('ws') ? hostIP : `wss://${hostIP.replace('https://', '')}`
        console.log(`🌐 [RemoteDJClient] 🔗 Connessione TUNNEL PUBBLICO: ${wsUrl}`)
      } else {
        // IP locale tradizionale - estrai porta dall'IP se presente
        let webrtcPort = 8080 // Porta di default
        let cleanIP = hostIP
        
        // Se l'IP contiene una porta (es: 192.168.1.100:8082), estraila
        if (hostIP.includes(':')) {
          const parts = hostIP.split(':')
          cleanIP = parts[0]
          webrtcPort = parseInt(parts[1]) || 8080
          console.log(`🔍 [RemoteDJClient] Porta estratta dall'IP: ${webrtcPort}`)
        }
        
        wsUrl = `ws://${cleanIP}:${webrtcPort}`
        console.log(`🏠 [RemoteDJClient] 🔗 Connessione LAN locale: ${wsUrl}`)
      }

      wsRef.current = new WebSocket(wsUrl)
      console.log(`🎤 [RemoteDJClient] WebSocket creato, stato iniziale: ${wsRef.current.readyState}`)

      wsRef.current.onopen = () => {
        console.log(`🎤 [RemoteDJClient] ✅ WebSocket connesso - stato: ${wsRef.current?.readyState}`)
        console.log(`🎤 [RemoteDJClient] ✅ Connessione stabilita con successo`)
        updateIsConnected(true)
        setIsConnecting(false)
        setConnectionError(null)
        
        // ✅ NEW: Reset reconnection state on successful connection
        resetReconnectionState()
        
        // ✅ CRITICAL FIX: Sincronizza lo stato locale con i flag globali
        const globalMicMuted = (window as any).__isMicMuted__ || false
        if (isMuted !== globalMicMuted) {
          console.log(`🎤 [RemoteDJClient] 🔄 Sincronizzazione stato mute: locale=${isMuted} -> globale=${globalMicMuted}`)
          setIsMuted(globalMicMuted)
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('❌ [RemoteDJ] Errore parsing messaggio:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        console.log(`🎤 [RemoteDJClient] 🔌 WebSocket disconnesso`)
        console.log(`🎤 [RemoteDJClient] - Code: ${event.code}`)
        console.log(`🎤 [RemoteDJClient] - Reason: ${event.reason}`)
        console.log(`🎤 [RemoteDJClient] - WasClean: ${event.wasClean}`)
        updateIsConnected(false)
        setIsConnecting(false)
        
        // ✅ NEW: Attempt reconnection if not a clean close and we were connected
        if (!event.wasClean && isConnected) {
          console.log('🔄 [RemoteDJClient] WebSocket chiuso inaspettatamente - tentativo riconnessione')
          attemptReconnection()
        }
      }

      wsRef.current.onerror = (error: Event) => {
        console.error(`🎤 [RemoteDJClient] ❌ Errore WebSocket:`, error)
        console.error(`🎤 [RemoteDJClient] - Tipo errore: ${error.type}`)
        console.error(`🎤 [RemoteDJClient] - Target: ${error.target}`)
        setConnectionError('Errore connessione al DJ Host')
        
        // ✅ NEW: Attempt reconnection on WebSocket error
        if (isConnected) {
          console.log('🔄 [RemoteDJClient] Errore WebSocket - tentativo riconnessione')
          attemptReconnection()
        }
        setIsConnecting(false)
      }

    } catch (error) {
      console.error(`🎤 [RemoteDJClient] ❌ Errore connessione generale:`, error)
      if (error instanceof Error) {
        console.error(`🎤 [RemoteDJClient] - Stack trace:`, error.stack)
      }
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
        updateIsConnected(false)
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
      // ✅ QUALITÀ PTT: Configurazione WebRTC ottimizzata per qualità audio massima
      const optimizedRtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10, // ✅ OTTIMIZZATO: Più candidati ICE per connessione migliore
        bundlePolicy: 'max-bundle' as RTCBundlePolicy, // ✅ OTTIMIZZATO: Bundle per efficienza
        rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy, // ✅ OTTIMIZZATO: RTCP multiplexing obbligatorio
        iceTransportPolicy: 'all' as RTCIceTransportPolicy, // ✅ OTTIMIZZATO: Usa tutti i trasporti ICE
        iceConnectionTimeout: 30000, // ✅ OTTIMIZZATO: Timeout più lungo per connessione
        iceGatheringTimeout: 10000, // ✅ OTTIMIZZATO: Timeout raccolta ICE
        // ✅ QUALITÀ AUDIO: Configurazione codec audio per qualità massima
        sdpSemantics: 'unified-plan', // ✅ OTTIMIZZATO: Piano unificato per migliore compatibilità
      }
      
      // Crea peer connection con configurazione ottimizzata
      peerConnectionRef.current = new RTCPeerConnection(optimizedRtcConfig)

      // ✅ QUALITÀ PTT: Configurazione codec audio per qualità massima
      const transceivers = peerConnectionRef.current.getTransceivers()
      if (transceivers.length > 0) {
        // Configura il primo transceiver per audio con codec ottimizzato
        const audioTransceiver = transceivers.find(t => t.sender.track?.kind === 'audio')
        if (audioTransceiver) {
          // ✅ OTTIMIZZATO: Configurazione codec audio per qualità massima
          audioTransceiver.setCodecPreferences([
            { mimeType: 'audio/opus', clockRate: 48000, channels: 2 }, // ✅ OPUS 48kHz stereo per qualità massima
            { mimeType: 'audio/opus', clockRate: 48000, channels: 1 }, // ✅ OPUS 48kHz mono per compatibilità
            { mimeType: 'audio/PCMU', clockRate: 8000, channels: 1 },  // ✅ Fallback PCMU
            { mimeType: 'audio/PCMA', clockRate: 8000, channels: 1 },  // ✅ Fallback PCMA
          ])
          console.log('🎤 [RemoteDJClient] ✅ Codec audio configurati per qualità massima')
        }
      }

      // ✅ NEW: Crea DataChannel per comunicazione con l'host
      const dataChannel = peerConnectionRef.current.createDataChannel('ducking', {
        ordered: true
      })
      dataChannelRef.current = dataChannel
      
      dataChannel.onopen = () => {
        console.log('📡 [DataChannel] Connesso all\'host')
      }
      
      dataChannel.onmessage = (event) => {
        try {
          const command = JSON.parse(event.data)
          console.log('📡 [DataChannel] Ricevuto comando:', command)
          
          if (command.type === 'ducking') {
            handleDuckingCommand(command.active)
          } else if (command.type === 'hostPTTLive') {
            // ✅ NEW: Handle host PTT Live indicator
            updateHostPTTLiveState(command.active)
            console.log(`📡 [DataChannel] Host PTT Live ${command.active ? 'attivato' : 'disattivato'}`)
          } else if (command.type === 'pttDJ') {
            // ✅ NEW: Handle host PTT DJ indicator
            handleHostPTTDJCommand(command.active)
            console.log(`📡 [DataChannel] Host PTT DJ ${command.active ? 'attivato' : 'disattivato'}`)
          } else if (command.type === 'microphoneChanged' && command.action === 'renegotiate') {
            // ✅ NEW: Handle microphone change from host - force WebRTC renegotiation
            console.log(`🔄 [DataChannel] Host ha cambiato microfono - forzatura rinegoziazione WebRTC`)
            handleMicrophoneChangeRenegotiation_OLD()
          } else if (command.type === 'hostMicrophoneChanged' && command.action === 'reconnect') {
            // ✅ DISABLED: Riconnessione disattivata - ora usiamo replaceTrack elegante
            console.log(`📡 [DataChannel] Host ha cambiato microfono - nessuna riconnessione necessaria (replaceTrack gestisce tutto)`)
            // handleHostMicrophoneChangeReconnect() // DISATTIVATO
          }
        } catch (error) {
          console.error('📡 [DataChannel] Errore parsing comando:', error)
        }
      }
      
      dataChannel.onerror = (error) => {
        console.error('📡 [DataChannel] Errore:', error)
      }

      // ✅ QUALITÀ PTT: Aggiungi stream locale con configurazione ottimizzata
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (track.kind === 'audio') {
            // ✅ CRITICAL FIX: Track audio DISABILITATO di default per PTT mode
            track.enabled = false // ✅ PTT MODE: Microfono muto di default, si attiva solo con PTT
            // track.muted = false  // ❌ RIMOSSO: Proprietà read-only
            
            // ✅ OTTIMIZZATO: Aggiungi track con configurazione ottimizzata
            const sender = peerConnectionRef.current!.addTrack(track, localStreamRef.current!)
            
            // ✅ QUALITÀ PTT: Configurazione parametri di trasmissione per qualità massima
            if (sender && sender.track) {
              // Configura parametri di trasmissione per qualità audio massima
              const params = sender.getParameters()
              if (params.encodings && params.encodings.length > 0) {
                // ✅ OTTIMIZZATO: Configurazione encoding per qualità massima
                params.encodings[0].maxBitrate = 128000 // ✅ 128kbps per qualità massima
                params.encodings[0].maxFramerate = 30   // ✅ 30fps per qualità massima
                params.encodings[0].scaleResolutionDownBy = 1 // ✅ Nessuna riduzione risoluzione
                // params.encodings[0].adaptivePtime = false // ❌ RIMOSSO: Proprietà non supportata
                params.encodings[0].priority = 'high' // ✅ Priorità alta per qualità
                params.encodings[0].networkPriority = 'high' // ✅ Priorità rete alta
                
                sender.setParameters(params)
                console.log('🎤 [RemoteDJClient] ✅ Parametri audio configurati per qualità massima')
              }
            }
          } else {
            // Per track non audio, aggiungi normalmente
            peerConnectionRef.current!.addTrack(track, localStreamRef.current!)
          }
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
        const connectionState = peerConnectionRef.current?.connectionState
        console.log('🔗 [RemoteDJ] Stato connessione:', connectionState)
        
        if (connectionState === 'connected') {
          console.log('📡 [RemoteDJ] Connessione stabilita - richiesta stato PTT Live host')
          requestHostPTTLiveState()
          requestHostPTTDJState()
          
          // ✅ NEW: Verifica e ripristina elemento audio host se necessario
          setTimeout(() => {
            if (!hostAudioElementRef.current || hostAudioElementRef.current.srcObject === null) {
              console.log('🔄 [RemoteDJ] Elemento audio host perso - tentativo ripristino')
              // Cerca stream audio attivo nella connessione
              const receivers = peerConnectionRef.current?.getReceivers()
              if (receivers) {
                receivers.forEach(receiver => {
                  if (receiver.track && receiver.track.kind === 'audio' && receiver.track.readyState === 'live') {
                    console.log('🔄 [RemoteDJ] Trovato stream audio host - ripristino elemento')
                    const stream = new MediaStream([receiver.track])
                    if (hostAudioElementRef.current) {
                      hostAudioElementRef.current.srcObject = stream
                      hostAudioElementRef.current.volume = hostVolume
                      hostAudioElementRef.current.play().catch(console.error)
                    }
                  }
                })
              }
            }
          }, 1000)
        } else if (connectionState === 'disconnected' || connectionState === 'failed' || connectionState === 'closed') {
          console.log(`🔗 [RemoteDJ] Connessione WebRTC ${connectionState} - tentativo riconnessione`)
          updateIsConnected(false)
          
          // ✅ NEW: Attempt reconnection for WebRTC failures
          if (isConnected) {
            attemptReconnection()
          }
        }
      }

      // Gestisci audio dell'host
      peerConnectionRef.current.ontrack = (event) => {
        console.log('🎵 [RemoteDJ] Ricevuto audio dell\'host:', event.streams[0])
        const hostAudioStream = event.streams[0]
        
        // Crea elemento audio per riprodurre l'audio dell'host
        const hostAudioElement = document.createElement('audio')
        hostAudioElement.srcObject = hostAudioStream
        hostAudioElement.autoplay = true
        hostAudioElement.volume = hostVolume // Volume dell'host dal controllo
        
        // Aggiungi al DOM (nascosto)
        hostAudioElement.style.display = 'none'
        document.body.appendChild(hostAudioElement)
        
        // Salva il riferimento per cleanup
        hostAudioElementRef.current = hostAudioElement
        
        console.log('🔊 [RemoteDJ] Audio dell\'host riprodotto')
      }

      // ✅ QUALITÀ PTT: Crea offer con configurazione ottimizzata per qualità massima
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        // voiceActivityDetection: true, // ❌ RIMOSSO: Non supportato in RTCOfferOptions
        iceRestart: false // ✅ OTTIMIZZATO: Non riavviare ICE per stabilità
      })
      
      // ✅ QUALITÀ PTT: Ottimizza SDP per qualità audio massima
      let optimizedSdp = offer.sdp || ''
      
      // ✅ OTTIMIZZATO: Configurazione OPUS per qualità massima
      optimizedSdp = optimizedSdp.replace(
        /a=fmtp:111 (.*)/g,
        'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;maxplaybackrate=48000;maxaveragebitrate=128000'
      )
      
      // ✅ OTTIMIZZATO: Configurazione OPUS per mono (fallback)
      optimizedSdp = optimizedSdp.replace(
        /a=fmtp:109 (.*)/g,
        'a=fmtp:109 minptime=10;useinbandfec=1;stereo=0;maxplaybackrate=48000;maxaveragebitrate=128000'
      )
      
      // ✅ OTTIMIZZATO: Configurazione PCMA/PCMU per qualità massima
      optimizedSdp = optimizedSdp.replace(
        /a=fmtp:8 (.*)/g,
        'a=fmtp:8 ptime=20;maxptime=20'
      )
      optimizedSdp = optimizedSdp.replace(
        /a=fmtp:0 (.*)/g,
        'a=fmtp:0 ptime=20;maxptime=20'
      )
      
      // ✅ OTTIMIZZATO: Configurazione generale per qualità massima
      optimizedSdp = optimizedSdp.replace(
        /a=rtcp-fb:111 (.*)/g,
        'a=rtcp-fb:111 goog-remb\na=rtcp-fb:111 transport-cc\na=rtcp-fb:111 ccm fir\na=rtcp-fb:111 nack\na=rtcp-fb:111 nack pli'
      )
      
      // ✅ OTTIMIZZATO: Configurazione bandwidth per qualità massima
      optimizedSdp = optimizedSdp.replace(
        /m=audio \d+ RTP\/SAVPF/g,
        'm=audio 9 RTP/SAVPF 111 109 8 0'
      )
      
      // Crea offer ottimizzato
      const optimizedOffer = new RTCSessionDescription({
        type: 'offer',
        sdp: optimizedSdp
      })
      
      await peerConnectionRef.current.setLocalDescription(optimizedOffer)
      console.log('🎤 [RemoteDJClient] ✅ Offer SDP ottimizzato per qualità massima')

      // ✅ QUALITÀ PTT: Invia offer ottimizzato
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc-offer',
          sdp: optimizedSdp // ✅ OTTIMIZZATO: Usa SDP ottimizzato per qualità massima
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
      
      // ✅ QUALITÀ PTT: Crea answer con configurazione ottimizzata
      const answer = await peerConnectionRef.current.createAnswer({
        // voiceActivityDetection: true, // ❌ RIMOSSO: Non supportato in RTCOfferOptions
        iceRestart: false // ✅ OTTIMIZZATO: Non riavviare ICE per stabilità
      })
      
      // ✅ QUALITÀ PTT: Ottimizza SDP answer per qualità audio massima
      let optimizedAnswerSdp = answer.sdp || ''
      
      // ✅ OTTIMIZZATO: Configurazione OPUS per qualità massima
      optimizedAnswerSdp = optimizedAnswerSdp.replace(
        /a=fmtp:111 (.*)/g,
        'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;maxplaybackrate=48000;maxaveragebitrate=128000'
      )
      
      // ✅ OTTIMIZZATO: Configurazione OPUS per mono (fallback)
      optimizedAnswerSdp = optimizedAnswerSdp.replace(
        /a=fmtp:109 (.*)/g,
        'a=fmtp:109 minptime=10;useinbandfec=1;stereo=0;maxplaybackrate=48000;maxaveragebitrate=128000'
      )
      
      // Crea answer ottimizzato
      const optimizedAnswer = new RTCSessionDescription({
        type: 'answer',
        sdp: optimizedAnswerSdp
      })
      
      await peerConnectionRef.current.setLocalDescription(optimizedAnswer)
      console.log('🎤 [RemoteDJClient] ✅ Answer SDP ottimizzato per qualità massima')

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc-answer',
          sdp: optimizedAnswerSdp // ✅ OTTIMIZZATO: Usa SDP ottimizzato per qualità massima
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
    // ✅ NEW: Clean up reconnection timeout
    resetReconnectionState()
    
    // ✅ PERFORMANCE: Cleanup completo WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Client disconnecting') // Codice di chiusura normale
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onclose = null
        wsRef.current.onerror = null
      } catch (error) {
        console.warn('⚠️ [RemoteDJClient] Errore chiusura WebSocket:', error)
      }
      wsRef.current = null
    }
    
    // ✅ PERFORMANCE: Cleanup completo WebRTC
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close()
        peerConnectionRef.current.ondatachannel = null
        peerConnectionRef.current.onicecandidate = null
        peerConnectionRef.current.onconnectionstatechange = null
      } catch (error) {
        console.warn('⚠️ [RemoteDJClient] Errore chiusura WebRTC:', error)
      }
      peerConnectionRef.current = null
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    updateIsConnected(false)
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
    console.log(`💬 [RemoteDJClient] Aggiungendo messaggio:`, newMessage)
    
    // ✅ PERFORMANCE: Usa functional update per evitare stale closure
    setChatMessages(prevMessages => {
      console.log(`💬 [RemoteDJClient] Messaggi precedenti:`, prevMessages.length)
      const updatedMessages = [...prevMessages, newMessage]
      
      // ✅ PERFORMANCE: Limita a 50 messaggi massimi per evitare memory leaks
      const limitedMessages = updatedMessages.slice(-50)
      console.log(`💬 [RemoteDJClient] Messaggi aggiornati:`, limitedMessages.length, `(limite: 50)`)
      
      // Salva in sessionStorage
      sessionStorage.setItem('remoteDJ_chatMessages', JSON.stringify(limitedMessages))
      
      return limitedMessages
    })
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

  // ✅ NEW: PTT DJ-to-DJ Functions
  const handlePTTDJPress = () => {
    setIsPTTDJActive(true)
    console.log('🎤 [PTT DJ] Attivato - Comunicazione DJ-to-DJ')
    // ✅ FIX: PTT DJ deve attivare il microfono per comunicazione DJ-to-DJ
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
        console.log(`🎤 [PTT DJ] Track ${track.id} abilitato per comunicazione DJ-to-DJ`)
      })
    }
    console.log('🎤 [PTT DJ] Ducking NON attivato - solo comunicazione DJ-to-DJ')
    
    // ✅ CRITICAL FIX: Invia comando PTT DJ all'host via DataChannel
    sendPTTDJCommand(true)
  }

  const handlePTTDJRelease = () => {
    setIsPTTDJActive(false)
    console.log('🎤 [PTT DJ] Disattivato')
    // ✅ CRITICAL FIX: Disattiva il microfono quando si rilascia PTT DJ, ma solo se PTT Live non è attivo
    if (!isPTTLiveActive && localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false
        console.log(`🎤 [PTT DJ] Track ${track.id} disabilitato`)
      })
    } else if (isPTTLiveActive) {
      console.log('🎤 [PTT DJ] Microfono mantenuto attivo per PTT Live')
    }
    
    // ✅ CRITICAL FIX: Invia comando PTT DJ all'host via DataChannel
    sendPTTDJCommand(false)
  }

  // ✅ NEW: PTT Live Functions
  const handlePTTLivePress = () => {
    // ✅ NEW: Controlla se c'è già una registrazione in corso
    if (pttLiveQueueRef.current) {
      console.log('📡 [PTT Live] Registrazione già in corso - ignoro pressione')
      return
    }
    
    setIsPTTLiveActive(true)
    console.log('📡 [PTT Live] Attivato - Solo Streaming Live (no registrazione)')
    // Attiva il microfono per streaming live
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
        console.log(`📡 [PTT Live] Track ${track.id} abilitato`)
      })
    }
    // ✅ FIX: NON avviare registrazione locale per evitare doppia riproduzione
    // startPTTLiveAudioRecording() // RIMOSSO - causa doppia riproduzione
    // ✅ NEW: Invia comando PTT Live all'host via DataChannel
    sendPTTLiveCommandToHost(true)
  }

  const handlePTTLiveRelease = () => {
    setIsPTTLiveActive(false)
    console.log('📡 [PTT Live] Disattivato')
    // ✅ CRITICAL FIX: Disattiva SEMPRE il microfono quando si rilascia PTT Live, a meno che PTT DJ non sia attivo
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        if (!isPTTDJActive) {
          track.enabled = false
          console.log(`📡 [PTT Live] Track ${track.id} disabilitato`)
        } else {
          console.log(`📡 [PTT Live] Track ${track.id} mantenuto attivo per PTT DJ`)
        }
      })
    }
    // ✅ FIX: NON fermare registrazione (non avviata) per evitare errori
    // stopPTTLiveAudioRecording() // RIMOSSO - non più necessario
    // ✅ NEW: Invia comando PTT Live all'host via DataChannel
    sendPTTLiveCommandToHost(false)
  }

  // ✅ NEW: Send PTT Live command to host via DataChannel
  const sendPTTLiveCommandToHost = (active: boolean) => {
    console.log(`📡 [DataChannel] Invio comando PTT Live all'host: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
    
    const command = {
      type: 'pttLive',
      active: active,
      timestamp: Date.now()
    }
    
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(command))
        console.log(`📡 [DataChannel] Comando PTT Live inviato all'host`)
      } catch (error) {
        console.error(`📡 [DataChannel] Errore invio comando PTT Live:`, error)
      }
    } else {
      console.warn(`📡 [DataChannel] DataChannel non disponibile per inviare comando PTT Live`)
    }
  }

  // ===== PTT Live: Record then send in chunks over DataChannel =====
  const startPTTLiveAudioRecording = () => {
    try {
      if (!localStreamRef.current) {
        console.warn('📡 [PTT Live] Nessuno stream microfono per registrazione')
        return
      }
      
      // ✅ NEW: Imposta flag coda per evitare sovrapposizioni
      pttLiveQueueRef.current = true
      console.log('📡 [PTT Live] Flag coda impostato - registrazione in corso')
      
      recordedChunksRef.current = []
      const mimeType = 'audio/webm'
      const rec = new MediaRecorder(localStreamRef.current, { mimeType })
      mediaRecorderRef.current = rec
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data)
        }
      }
      rec.onerror = (e) => {
        console.error('📡 [PTT Live] MediaRecorder error:', e)
        // ✅ NEW: Reset flag coda in caso di errore
        pttLiveQueueRef.current = false
      }
      rec.start()
      console.log('📡 [PTT Live] Registrazione avviata (MediaRecorder)')
    } catch (error) {
      console.error('📡 [PTT Live] Errore avvio registrazione:', error)
      // ✅ NEW: Reset flag coda in caso di errore
      pttLiveQueueRef.current = false
    }
  }

  const stopPTTLiveAudioRecording = async () => {
    try {
      const rec = mediaRecorderRef.current
      if (!rec) return
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve()
        try { rec.stop() } catch { resolve() }
      })
      mediaRecorderRef.current = null

      const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
      recordedChunksRef.current = []
      const arrayBuffer = await blob.arrayBuffer()
      const audioId = `ptt_${Date.now()}_${Math.random().toString(36).slice(2)}`
      console.log(`📡 [PTT Live Recording] Audio pronto da inviare: ${arrayBuffer.byteLength} bytes, id=${audioId}`)
      
      // ✅ NEW: Invia audio in chunk e poi reset flag coda
      await sendAudioInChunks(new Uint8Array(arrayBuffer), audioId)
      
      // ✅ NEW: Reset flag coda dopo invio completato
      pttLiveQueueRef.current = false
      console.log('📡 [PTT Live] Flag coda resettato - registrazione completata')
    } catch (error) {
      console.error('📡 [PTT Live] Errore stop registrazione/invio:', error)
      // ✅ NEW: Reset flag coda anche in caso di errore
      pttLiveQueueRef.current = false
    }
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const sendAudioInChunks = async (data: Uint8Array, audioId: string) => {
    const channel = dataChannelRef.current
    if (!channel || channel.readyState !== 'open') {
      console.warn('📡 [PTT Live] DataChannel non disponibile per invio chunk')
      return
    }
    const chunkSize = 8 * 1024 // 8KB
    const totalChunks = Math.ceil(data.length / chunkSize)
    const djNameSafe = djName || 'RemoteDJ'
    console.log(`📡 [PTT Live] Invio in chunk: ${totalChunks} pezzi da ${chunkSize} bytes (tot=${data.length})`)
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, data.length)
      const chunk = data.slice(start, end)
      const payload = {
        type: 'pttLiveAudioChunk',
        audioId,
        chunkIndex: i,
        totalChunks: totalChunks,
        chunkSize: chunk.length,
        totalSize: data.length,
        djName: djNameSafe,
        chunkData: Array.from(chunk) // serialize as array of numbers
      }
      try {
        channel.send(JSON.stringify(payload))
      } catch (err) {
        console.error('📡 [PTT Live] Errore invio chunk:', err)
        // Riprova breve
        await sleep(20)
        try { channel.send(JSON.stringify(payload)) } catch {}
      }
      // Piccola pausa per non saturare il DataChannel
      await sleep(10)
    }
    console.log('📡 [PTT Live] Invio chunk completato')
  }

  // ✅ REMOVED: Handle ducking command from host
  // Il ducking per PTT Live deve essere gestito solo dall'host, non dal client
  const handleDuckingCommand = (active: boolean) => {
    console.log(`📡 [DataChannel] Ricevuto comando ducking dall'host: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
    console.log(`📡 [DataChannel] Ducking gestito solo dall'host - nessuna azione locale necessaria`)
    
    // ✅ CRITICAL FIX: NON applicare ducking locale per PTT Live
    // Il ducking deve essere gestito solo dall'host per mantenere la sincronizzazione
  }

  // ✅ RIMOSSO: handleHostMicrophoneChangeReconnect non più utilizzato

  // ✅ OLD: Handle microphone change renegotiation from host (DEPRECATA)
  const handleMicrophoneChangeRenegotiation_OLD = async () => {
    console.log(`🔄 [RemoteDJClient] Inizio rinegoziazione WebRTC per cambio microfono host`)
    
    try {
      if (!peerConnectionRef.current || !localStreamRef.current) {
        console.log(`⚠️ [RemoteDJClient] Connessione non disponibile per rinegoziazione`)
        return
      }

      // Crea un nuovo offer dal client per forzare la rinegoziazione
      console.log(`🔄 [RemoteDJClient] Creazione nuovo offer per rinegoziazione`)
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      })

      await peerConnectionRef.current.setLocalDescription(offer)
      console.log(`✅ [RemoteDJClient] Nuovo offer locale impostato per rinegoziazione`)

      // Invia il nuovo offer all'host
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc-offer',
          sdp: offer.sdp,
          djName: djName
        }))
        console.log(`📡 [RemoteDJClient] Nuovo offer inviato all'host per rinegoziazione microfono`)
      }

    } catch (error) {
      console.error(`❌ [RemoteDJClient] Errore durante rinegoziazione microfono:`, error)
    }
  }


  return (
    <div className="fixed bottom-4 right-4 w-[500px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-[600px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🎤</span>
          <span className="text-sm font-medium text-white">DJ Remoto</span>
          {isConnected && (
            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
              CONNESSO
            </span>
          )}
          {isHostPTTLiveActive && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-red-600 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping"></span>
              <span className="text-xs text-white font-medium">
                🔴 HOST LIVE
              </span>
            </div>
          )}
          {isHostPTTDJActive && (
            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-600 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
              <span className="text-xs text-white font-medium">
                🎤 HOST DJ
              </span>
            </div>
          )}
        </div>
        <div className="flex space-x-1">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
              title="Minimizza"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
              title="Chiudi"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {!isConnected ? (
          <div className="p-3 space-y-3">
            {/* 🚀 PULSANTE INCOLLA AUTOMATICO */}
            <div className="p-2 bg-blue-900/30 border border-blue-500/50 rounded">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 mr-4">
                  <div className="text-blue-300 font-medium text-xs mb-1">
                    🔗 Incolla Codice Connessione
                  </div>
                  <div className="text-blue-200 text-xs">
                    Incolla il codice ricevuto dall'host per compilare automaticamente i campi
                  </div>
                </div>
                <button
                  onClick={handlePasteConnectionCode}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors flex-shrink-0"
                  title="Incolla codice connessione"
                >
                  📋 Incolla
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Nome DJ
              </label>
              <input
                type="text"
                value={djName}
                onChange={(e) => updateDjName(e.target.value)}
                placeholder="Inserisci il tuo nome"
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
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
                onChange={(e) => updateSessionCode(e.target.value.toUpperCase())}
                placeholder="Codice sessione"
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                disabled={isConnecting}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                IP DJ Host {connectionMode === 'internet' && <span className="text-green-400">🌐 Internet</span>}
              </label>
              <input
                type="text"
                value={hostIP}
                onChange={(e) => updateHostIP(e.target.value)}
                placeholder={connectionMode === 'internet' ? 'ngrok-url.com' : '192.168.1.100'}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400"
                disabled={isConnecting}
              />
              {connectionMode === 'internet' && (
                <div className="text-xs text-green-400 mt-1">
                  💡 Modalità Internet rilevata - URL tunnel ngrok
                </div>
              )}
            </div>

            {connectionError && (
              <div className="text-red-400 text-xs bg-red-900/20 border border-red-500/30 rounded p-2">
                ❌ {connectionError}
              </div>
            )}

            <button
              onClick={connectToHost}
              disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-medium py-2 px-3 rounded transition-colors"
            >
              {isConnecting ? '🔄 Connessione...' : '🔗 Connetti'}
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="text-center">
              <div className="text-green-400 text-xs mb-1">
                ✅ Connesso a {hostIP}
              </div>
              <div className="text-gray-300 text-xs">
                Nome: {djName}
              </div>
              {/* ✅ NEW: Reconnection status indicator */}
              {reconnectAttempts > 0 && reconnectAttempts < maxReconnectAttempts && (
                <div className="text-yellow-400 text-xs mt-1 animate-pulse">
                  🔄 Riconnessione... ({reconnectAttempts}/{maxReconnectAttempts})
                </div>
              )}
              {reconnectAttempts >= maxReconnectAttempts && (
                <div className="text-red-400 text-xs mt-1">
                  ❌ Riconnessione fallita
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-300">Microfono</span>
                <span className="text-xs text-gray-400">{audioLevel.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>

            <div className="flex space-x-2">
              {/* PTT DJ-to-DJ Button */}
              <button
                onMouseDown={handlePTTDJPress}
                onMouseUp={handlePTTDJRelease}
                onMouseLeave={handlePTTDJRelease}
                className={`flex-1 py-1.5 px-2 text-xs rounded font-medium transition-colors ${
                  isPTTDJActive ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {isPTTDJActive ? '🎤 PTT DJ (ON)' : '🎤 PTT DJ'}
              </button>
              
              {/* PTT Live Button */}
              <button
                onMouseDown={handlePTTLivePress}
                onMouseUp={handlePTTLiveRelease}
                onMouseLeave={handlePTTLiveRelease}
                className={`flex-1 py-1.5 px-2 text-xs rounded font-medium transition-colors ${
                  isPTTLiveActive ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                } text-white`}
              >
                {isPTTLiveActive ? '📡 PTT Live (ON)' : '📡 PTT Live'}
              </button>
              
              <button
                onClick={disconnect}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium py-1.5 px-2 rounded transition-colors"
              >
                🔌 Disconnetti
              </button>
            </div>
          </div>
        )}

        {/* Chat DJ */}
        {isConnected && (
          <div className="border-t border-gray-700">
            <DJChat
              connectedDJs={[{ id: 'host', djName: 'Host' }]}
              onSendMessage={handleSendChatMessage}
              messages={chatMessages}
              onMessagesChange={(messages) => {
                setChatMessages(messages)
                sessionStorage.setItem('remoteDJ_chatMessages', JSON.stringify(messages))
              }}
            />
          </div>
        )}
      </div>

      {/* Host Volume Control */}
      {isConnected && (
        <div className="p-3 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">Volume Host:</span>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max="100"
                value={hostVolume * 100}
                onChange={(e) => updateHostVolume(parseFloat(e.target.value) / 100)}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${hostVolume * 100}%, #374151 ${hostVolume * 100}%, #374151 100%)`
                }}
              />
              <span className="text-xs text-gray-300 w-8">
                {Math.round(hostVolume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-2 bg-gray-800 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          💡 Pannello DJ Remoto - Dati salvati solo per questa sessione
        </div>
      </div>
    </div>
  )
}

export default RemoteDJClient
