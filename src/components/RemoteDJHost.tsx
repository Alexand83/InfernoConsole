import React, { useState, useEffect, useRef } from 'react'
import DJChat from './DJChat'
import { useAudio } from '../contexts/AudioContext'
import { useSettings } from '../contexts/SettingsContext'

interface ConnectedDJ {
  id: string
  djName: string
  ip: string
  connectedAt: Date
  audioLevel: number
  isMuted: boolean
  volume: number
}

interface ChatMessage {
  id: string
  djName: string
  message: string
  timestamp: Date
  isSystem: boolean
}

const RemoteDJHost: React.FC = () => {
  const { settings } = useSettings()
  const settingsRef = useRef(settings)
  
  // Aggiorna il ref quando le impostazioni cambiano
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  
  const [isServerRunning, setIsServerRunning] = useState(false)
  const [serverInfo, setServerInfo] = useState<any>(null)
  const [connectedDJs, setConnectedDJs] = useState<ConnectedDJ[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isHostMuted, setIsHostMuted] = useState(false)
  const [isAutoDuckingActive, setIsAutoDuckingActive] = useState(false)
  const [activeSpeaker, setActiveSpeaker] = useState<string>('')

  const { addRemoteDJStream, removeRemoteDJStream, setRemoteDJVolume, setStreamDucking } = useAudio()
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const hostMicStreamRef = useRef<MediaStream | null>(null)
  const hostAudioContextRef = useRef<AudioContext | null>(null)
  const hostAnalyserRef = useRef<AnalyserNode | null>(null)
  const hostAnimationFrameRef = useRef<number | null>(null)
  const remoteAudioAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map())

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]

  // Funzione per mostrare tutti i dispositivi audio disponibili
  const logAvailableAudioDevices = async () => {
    try {
      console.log(`🎤 [RemoteDJHost] ===== DISPOSITIVI AUDIO DISPONIBILI =====`)
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
      
      console.log(`🎤 [RemoteDJHost] Dispositivi di INPUT audio (${audioInputs.length}):`)
      audioInputs.forEach((device, index) => {
        console.log(`🎤 [RemoteDJHost]   ${index + 1}. ID: ${device.deviceId}`)
        console.log(`🎤 [RemoteDJHost]      Label: ${device.label || 'Dispositivo sconosciuto'}`)
        console.log(`🎤 [RemoteDJHost]      Group ID: ${device.groupId}`)
      })
      
      console.log(`🎤 [RemoteDJHost] Dispositivi di OUTPUT audio (${audioOutputs.length}):`)
      audioOutputs.forEach((device, index) => {
        console.log(`🎤 [RemoteDJHost]   ${index + 1}. ID: ${device.deviceId}`)
        console.log(`🎤 [RemoteDJHost]      Label: ${device.label || 'Dispositivo sconosciuto'}`)
        console.log(`🎤 [RemoteDJHost]      Group ID: ${device.groupId}`)
      })
      
      // Log delle impostazioni correnti
      console.log(`🎤 [RemoteDJHost] ===== IMPOSTAZIONI MICROFONO CORRENTI =====`)
      console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: Oggetto settings completo:`, settings)
      console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: settings.microphone:`, settings.microphone)
      console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: settings.microphone?.inputDevice:`, settings.microphone?.inputDevice)
      console.log(`🎤 [RemoteDJHost] Input Device: ${settings.microphone?.inputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJHost] Output Device: ${settings.audio?.outputDevice || 'default'}`)
      console.log(`🎤 [RemoteDJHost] Echo Cancellation: ${settings.microphone?.echoCancellation ?? true}`)
      console.log(`🎤 [RemoteDJHost] Noise Suppression: ${settings.microphone?.noiseSuppression ?? true}`)
      console.log(`🎤 [RemoteDJHost] Auto Gain Control: ${settings.microphone?.autoGainControl ?? true}`)
      console.log(`🎤 [RemoteDJHost] Ducking Percent: ${settings.microphone?.duckingPercent ?? 75}%`)
      console.log(`🎤 [RemoteDJHost] ==========================================`)
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore enumerazione dispositivi:', error)
    }
  }

  useEffect(() => {
    // Setup event listeners
    if (window.electronAPI?.webrtcServerAPI) {
      const { webrtcServerAPI } = window.electronAPI

      webrtcServerAPI.onClientAuthenticated((event: any, client: any) => {
        console.log('✅ [RemoteDJHost] Client autenticato:', client)
        
        const newDJ: ConnectedDJ = {
          id: client.id,
          djName: client.djName,
          ip: client.ip,
          connectedAt: new Date(client.connectedAt),
          audioLevel: 0,
          isMuted: false,
          volume: 0.5
        }

        setConnectedDJs(prev => [...prev, newDJ])
      })

      webrtcServerAPI.onClientDisconnected((event: any, client: any) => {
        console.log('🔌 [RemoteDJHost] Client disconnesso:', client)
        setConnectedDJs(prev => prev.filter(dj => dj.id !== client.id))
      })

      webrtcServerAPI.onAudioLevel((event: any, data: any) => {
        setConnectedDJs(prev => prev.map(dj => 
          dj.id === data.clientId 
            ? { ...dj, audioLevel: data.level }
            : dj
        ))
      })

      webrtcServerAPI.onWebRTCOffer(async (event: any, data: any) => {
        console.log('🎵 [RemoteDJHost] WebRTC Offer da:', data.djName)
        // Usa le impostazioni correnti dal ref
        const currentSettings = settingsRef.current
        console.log('🎤 [RemoteDJHost] 🔍 DEBUG: Impostazioni passate a handleWebRTCOffer:', currentSettings.microphone?.inputDevice)
        await handleWebRTCOffer(data, currentSettings)
      })

      webrtcServerAPI.onWebRTCAnswer((event: any, data: any) => {
        console.log('🎵 [RemoteDJHost] WebRTC Answer da:', data.djName)
        handleWebRTCAnswer(data)
      })

      webrtcServerAPI.onICECandidate((event: any, data: any) => {
        console.log('🧊 [RemoteDJHost] ICE Candidate da:', data.djName)
        handleICECandidate(data)
      })

      // Gestione messaggi di chat
      webrtcServerAPI.onChatMessage((event: any, data: any) => {
        console.log('💬 [RemoteDJHost] Messaggio chat ricevuto:', data)
        addChatMessage(data.djName, data.message)
      })

      // Gestione messaggi di chat dall'host
      webrtcServerAPI.onHostChatMessage((event: any, data: any) => {
        console.log('💬 [RemoteDJHost] Messaggio host chat ricevuto:', data)
        addChatMessage(data.djName, data.message)
      })

      // Gestione ripristino stato server
      webrtcServerAPI.onServerRestored((event: any, data: any) => {
        console.log('🔄 [RemoteDJHost] Server ripristinato:', data)
        if (data.isRunning) {
          setIsServerRunning(true)
          setServerInfo(data.serverInfo)
          setConnectedDJs(data.clients.map((client: any) => ({
            id: client.id,
            djName: client.djName,
            audioLevel: 0,
            volume: 0.5,
            isMuted: false
          })))
        }
      })

      // Cleanup
      return () => {
        webrtcServerAPI.removeAllListeners()
      }
    }
  }, [])

  // Funzioni per gestire WebRTC e audio mixing
  const handleWebRTCOffer = async (data: any, currentSettings: any) => {
    const { clientId, djName, sdp } = data
    console.log(`🎵 [RemoteDJHost] Gestione WebRTC Offer da ${djName}`)
    
    // Debug: verifica le impostazioni correnti
    console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: Impostazioni correnti in handleWebRTCOffer:`)
    console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: currentSettings.microphone?.inputDevice:`, currentSettings.microphone?.inputDevice)

    try {
      // Crea PeerConnection se non esiste
      if (!peerConnectionsRef.current.has(clientId)) {
        const peerConnection = new RTCPeerConnection({ iceServers })
        
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && window.electronAPI?.webrtcServerAPI) {
            console.log(`🧊 [RemoteDJHost] Invio ICE candidate per ${djName}`)
            // Invia ICE candidate al client tramite il server
            window.electronAPI.webrtcServerAPI.sendICECandidate({ clientId, candidate: event.candidate })
          }
        }

        peerConnection.ontrack = (event) => {
          console.log(`🎵 [RemoteDJHost] Ricevuto remote track da ${djName}:`, event.streams[0])
          addRemoteAudioToMixer(clientId, event.streams[0])
        }

        peerConnectionsRef.current.set(clientId, peerConnection)
      }

      const peerConnection = peerConnectionsRef.current.get(clientId)!
      
      // Imposta remote description
      console.log(`🎵 [RemoteDJHost] SDP ricevuto:`, sdp)
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
      
      // Aggiungi il microfono dell'host alla connessione WebRTC usando le settings corrette
      try {
        // Usa un singolo stream del microfono condiviso per tutti i client
        if (!hostMicStreamRef.current) {
          console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: currentSettings.microphone prima del controllo:`, currentSettings.microphone)
          const micDeviceId = currentSettings.microphone?.inputDevice !== 'default' ? currentSettings.microphone.inputDevice : undefined
          console.log(`🎤 [RemoteDJHost] ===== CONFIGURAZIONE MICROFONO HOST =====`)
          console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: currentSettings.microphone?.inputDevice:`, currentSettings.microphone?.inputDevice)
          console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: micDeviceId calcolato:`, micDeviceId)
          console.log(`🎤 [RemoteDJHost] Device ID dalle settings: ${currentSettings.microphone?.inputDevice || 'default'}`)
          console.log(`🎤 [RemoteDJHost] Device ID per getUserMedia:`, micDeviceId)
          console.log(`🎤 [RemoteDJHost] Echo Cancellation: ${currentSettings.microphone?.echoCancellation ?? true}`)
          console.log(`🎤 [RemoteDJHost] Noise Suppression: ${currentSettings.microphone?.noiseSuppression ?? true}`)
          console.log(`🎤 [RemoteDJHost] Auto Gain Control: ${currentSettings.microphone?.autoGainControl ?? true}`)
          console.log(`🎤 [RemoteDJHost] Sample Rate: 44100`)
          console.log(`🎤 [RemoteDJHost] Channel Count: 1`)
          
          // Try to get the exact device first
          let actualDeviceUsed = 'unknown'
          
          if (micDeviceId && micDeviceId !== 'default') {
            // Verifica se il dispositivo è disponibile
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioInputs = devices.filter(device => device.kind === 'audioinput')
            const requestedDevice = audioInputs.find(device => device.deviceId === micDeviceId)
            
            console.log(`🎤 [RemoteDJHost] Dispositivi audio input disponibili: ${audioInputs.length}`)
            console.log(`🎤 [RemoteDJHost] Dispositivo richiesto trovato: ${requestedDevice ? 'SÌ' : 'NO'}`)
            if (requestedDevice) {
              console.log(`🎤 [RemoteDJHost] Dispositivo richiesto: ${requestedDevice.label} (${requestedDevice.deviceId})`)
            }
            
            try {
              console.log(`🎤 [RemoteDJHost] Tentativo di usare il dispositivo specifico: ${micDeviceId}`)
              hostMicStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                  deviceId: { exact: micDeviceId },
                  echoCancellation: currentSettings.microphone?.echoCancellation ?? true,
                  noiseSuppression: currentSettings.microphone?.noiseSuppression ?? true,
                  autoGainControl: currentSettings.microphone?.autoGainControl ?? true,
                  sampleRate: 44100,
                  channelCount: 1
                } 
              })
              actualDeviceUsed = 'specific device'
              console.log(`🎤 [RemoteDJHost] ✅ Dispositivo specifico utilizzato con successo`)
            } catch (specificDeviceError) {
              console.error(`🎤 [RemoteDJHost] ❌ ERRORE DISPOSITIVO SPECIFICO:`, specificDeviceError)
              console.error(`🎤 [RemoteDJHost] ❌ Nome errore: ${specificDeviceError.name}`)
              console.error(`🎤 [RemoteDJHost] ❌ Messaggio errore: ${specificDeviceError.message}`)
              console.error(`🎤 [RemoteDJHost] ❌ Constraint che ha fallito:`, specificDeviceError.constraint)
              console.warn(`🎤 [RemoteDJHost] ⚠️ Dispositivo specifico non disponibile, fallback a default`)
              // Fallback to default device
              hostMicStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                  echoCancellation: currentSettings.microphone?.echoCancellation ?? true,
                  noiseSuppression: currentSettings.microphone?.noiseSuppression ?? true,
                  autoGainControl: currentSettings.microphone?.autoGainControl ?? true,
                  sampleRate: 44100,
                  channelCount: 1
                } 
              })
              actualDeviceUsed = 'default (fallback)'
              console.log(`🎤 [RemoteDJHost] ✅ Fallback a dispositivo default completato`)
            }
          } else {
            console.log(`🎤 [RemoteDJHost] Utilizzo dispositivo default`)
            hostMicStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: currentSettings.microphone?.echoCancellation ?? true,
                noiseSuppression: currentSettings.microphone?.noiseSuppression ?? true,
                autoGainControl: currentSettings.microphone?.autoGainControl ?? true,
                sampleRate: 44100,
                channelCount: 1
              } 
            })
            actualDeviceUsed = 'default'
          }
          
          // Log dettagliato del stream creato
          console.log(`🎤 [RemoteDJHost] ===== STREAM MICROFONO HOST CREATO =====`)
          console.log(`🎤 [RemoteDJHost] Dispositivo effettivamente utilizzato: ${actualDeviceUsed}`)
          console.log(`🎤 [RemoteDJHost] Stream ID: ${hostMicStreamRef.current.id}`)
          console.log(`🎤 [RemoteDJHost] Numero di track audio: ${hostMicStreamRef.current.getAudioTracks().length}`)
          
          hostMicStreamRef.current.getAudioTracks().forEach((track, index) => {
            console.log(`🎤 [RemoteDJHost] Track ${index + 1}:`)
            console.log(`🎤 [RemoteDJHost]   - ID: ${track.id}`)
            console.log(`🎤 [RemoteDJHost]   - Label: ${track.label}`)
            console.log(`🎤 [RemoteDJHost]   - Kind: ${track.kind}`)
            console.log(`🎤 [RemoteDJHost]   - Enabled: ${track.enabled}`)
            console.log(`🎤 [RemoteDJHost]   - Muted: ${track.muted}`)
            console.log(`🎤 [RemoteDJHost]   - Ready State: ${track.readyState}`)
            
            // Prova a ottenere le impostazioni del track
            const trackSettings = track.getSettings()
            console.log(`🎤 [RemoteDJHost]   - Device ID: ${trackSettings.deviceId || 'N/A'}`)
            console.log(`🎤 [RemoteDJHost]   - Sample Rate: ${trackSettings.sampleRate || 'N/A'}`)
            console.log(`🎤 [RemoteDJHost]   - Channel Count: ${trackSettings.channelCount || 'N/A'}`)
            console.log(`🎤 [RemoteDJHost]   - Echo Cancellation: ${trackSettings.echoCancellation || 'N/A'}`)
            console.log(`🎤 [RemoteDJHost]   - Noise Suppression: ${trackSettings.noiseSuppression || 'N/A'}`)
            console.log(`🎤 [RemoteDJHost]   - Auto Gain Control: ${trackSettings.autoGainControl || 'N/A'}`)
            
            // Check if the actual device matches what was requested
            if (micDeviceId && micDeviceId !== 'default') {
              if (trackSettings.deviceId === micDeviceId) {
                console.log(`🎤 [RemoteDJHost]   ✅ DISPOSITIVO CORRETTO: Il track usa il dispositivo richiesto`)
              } else {
                console.log(`🎤 [RemoteDJHost]   ⚠️ DISPOSITIVO DIVERSO: Richiesto ${micDeviceId}, ottenuto ${trackSettings.deviceId}`)
              }
            }
          })
          console.log(`🎤 [RemoteDJHost] ==========================================`)
        }
        
        console.log(`🎤 [RemoteDJHost] Aggiungendo microfono host alla connessione WebRTC per ${djName}`)
        console.log(`🎤 [RemoteDJHost] ===== STREAM HOST PER CLIENT ${djName} =====`)
        console.log(`🎤 [RemoteDJHost] Stream ID: ${hostMicStreamRef.current.id}`)
        console.log(`🎤 [RemoteDJHost] Numero di track: ${hostMicStreamRef.current.getTracks().length}`)
        
        hostMicStreamRef.current.getTracks().forEach((track, index) => {
          console.log(`🎤 [RemoteDJHost] Track ${index + 1} per client ${djName}:`)
          console.log(`🎤 [RemoteDJHost]   - ID: ${track.id}`)
          console.log(`🎤 [RemoteDJHost]   - Label: ${track.label}`)
          console.log(`🎤 [RemoteDJHost]   - Kind: ${track.kind}`)
          console.log(`🎤 [RemoteDJHost]   - Enabled: ${track.enabled}`)
          console.log(`🎤 [RemoteDJHost]   - Muted: ${track.muted}`)
          console.log(`🎤 [RemoteDJHost]   - Ready State: ${track.readyState}`)
          
          const trackSettings = track.getSettings()
          console.log(`🎤 [RemoteDJHost]   - Device ID: ${trackSettings.deviceId || 'N/A'}`)
          console.log(`🎤 [RemoteDJHost]   - Sample Rate: ${trackSettings.sampleRate || 'N/A'}`)
          console.log(`🎤 [RemoteDJHost]   - Channel Count: ${trackSettings.channelCount || 'N/A'}`)
          console.log(`🎤 [RemoteDJHost]   - Echo Cancellation: ${trackSettings.echoCancellation || 'N/A'}`)
          console.log(`🎤 [RemoteDJHost]   - Noise Suppression: ${trackSettings.noiseSuppression || 'N/A'}`)
          console.log(`🎤 [RemoteDJHost]   - Auto Gain Control: ${trackSettings.autoGainControl || 'N/A'}`)
          
          // Verifica se il dispositivo è quello corretto
          const expectedDeviceId = currentSettings.microphone?.inputDevice
          if (expectedDeviceId && expectedDeviceId !== 'default') {
            if (trackSettings.deviceId === expectedDeviceId) {
              console.log(`🎤 [RemoteDJHost]   ✅ DISPOSITIVO CORRETTO per client ${djName}: Il track usa il dispositivo richiesto`)
            } else {
              console.log(`🎤 [RemoteDJHost]   ⚠️ DISPOSITIVO DIVERSO per client ${djName}: Richiesto ${expectedDeviceId}, ottenuto ${trackSettings.deviceId}`)
            }
          }
          
          peerConnection.addTrack(track, hostMicStreamRef.current!)
          console.log(`🎤 [RemoteDJHost]   ✅ Track aggiunto alla connessione WebRTC per client ${djName}`)
        })
        console.log(`🎤 [RemoteDJHost] ===== FINE STREAM HOST PER CLIENT ${djName} =====`)
      } catch (error) {
        console.error(`❌ [RemoteDJHost] Errore accesso microfono host per ${djName}:`, error)
        // Se c'è un errore con il microfono, continua senza audio host
        console.warn(`⚠️ [RemoteDJHost] Continuando senza audio host per ${djName}`)
      }

      // Crea e invia answer
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      
      if (window.electronAPI?.webrtcServerAPI) {
        console.log(`🎵 [RemoteDJHost] Invio WebRTC Answer per ${djName}`)
        console.log(`🎤 [HOST TO CLIENT] ===== INVIO AUDIO HOST A CLIENT ${djName} =====`)
        if (hostMicStreamRef.current) {
          const tracks = hostMicStreamRef.current.getAudioTracks()
          console.log(`🎤 [HOST TO CLIENT] Numero di track audio inviati: ${tracks.length}`)
          tracks.forEach((track, index) => {
            const settings = track.getSettings()
            console.log(`🎤 [HOST TO CLIENT] Track ${index + 1} inviato a ${djName}:`)
            console.log(`🎤 [HOST TO CLIENT]   - Label: ${track.label}`)
            console.log(`🎤 [HOST TO CLIENT]   - Device ID: ${settings.deviceId}`)
            console.log(`🎤 [HOST TO CLIENT]   - Sample Rate: ${settings.sampleRate}`)
            console.log(`🎤 [HOST TO CLIENT]   - Channel Count: ${settings.channelCount}`)
            console.log(`🎤 [HOST TO CLIENT]   - Echo Cancellation: ${settings.echoCancellation}`)
            console.log(`🎤 [HOST TO CLIENT]   - Noise Suppression: ${settings.noiseSuppression}`)
            console.log(`🎤 [HOST TO CLIENT]   - Auto Gain Control: ${settings.autoGainControl}`)
          })
        } else {
          console.log(`🎤 [HOST TO CLIENT] ⚠️ Nessun stream microfono host disponibile per ${djName}`)
        }
        console.log(`🎤 [HOST TO CLIENT] ===== FINE INVIO AUDIO HOST A CLIENT ${djName} =====`)
        
        window.electronAPI.webrtcServerAPI.sendWebRTCAnswer({ clientId, sdp: answer.sdp })
      }
    } catch (error) {
      console.error(`❌ [RemoteDJHost] Errore gestione offerta WebRTC per ${djName}:`, error)
    }
  }

  const handleWebRTCAnswer = async (data: any) => {
    const { clientId, djName, sdp } = data
    console.log(`🎵 [RemoteDJHost] Gestione WebRTC Answer da ${djName}`)

    try {
      const peerConnection = peerConnectionsRef.current.get(clientId)
      if (peerConnection && sdp) {
        console.log(`🎵 [RemoteDJHost] SDP Answer ricevuto:`, sdp)
        await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
        console.log(`✅ [RemoteDJHost] WebRTC Answer impostata per ${djName}`)
      }
    } catch (error) {
      console.error(`❌ [RemoteDJHost] Errore gestione risposta WebRTC per ${djName}:`, error)
    }
  }

  const handleICECandidate = async (data: any) => {
    const { clientId, djName, candidate } = data
    console.log(`🧊 [RemoteDJHost] Gestione ICE Candidate da ${djName}`)

    try {
      const peerConnection = peerConnectionsRef.current.get(clientId)
      if (peerConnection && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        console.log(`✅ [RemoteDJHost] ICE candidate aggiunto per ${djName}`)
      }
    } catch (error) {
      console.error(`❌ [RemoteDJHost] Errore aggiunta ICE candidate per ${djName}:`, error)
    }
  }

  const addRemoteAudioToMixer = (clientId: string, stream: MediaStream) => {
    console.log(`🎵 [RemoteDJHost] Aggiungendo audio remoto al mixer per ${clientId}`)

    try {
      // Crea un elemento audio dedicato per il monitoraggio locale
      const audioElement = document.createElement('audio')
      audioElement.srcObject = stream
      audioElement.autoplay = true
      audioElement.volume = 0.5
      audioElement.style.display = 'none'
      document.body.appendChild(audioElement)
      
      // Salva l'elemento audio per controllo successivo
      remoteAudioElementsRef.current.set(clientId, audioElement)
      
      // Crea AudioContext per monitorare l'audio del DJ remoto
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      
      // Connetti lo stream all'analyser
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      
      // Salva l'analyser per il monitoraggio
      remoteAudioAnalysersRef.current.set(clientId, analyser)
      
      // Usa l'AudioContext per aggiungere lo stream
      addRemoteDJStream(clientId, stream)
      
      // Imposta il dispositivo di output se specificato nelle settings
      if (settings.audio?.outputDevice && settings.audio.outputDevice !== 'default') {
        console.log(`🔊 [RemoteDJHost] Usando dispositivo output: ${settings.audio.outputDevice}`)
        // L'AudioContext gestirà automaticamente il dispositivo di output
      }
      
      console.log(`✅ [RemoteDJHost] Audio remoto aggiunto al mixer per ${clientId}`)
    } catch (error) {
      console.error(`❌ [RemoteDJHost] Errore aggiunta audio al mixer per ${clientId}:`, error)
    }
  }

  const toggleMuteDJ = (clientId: string) => {
    setConnectedDJs(prev => prev.map(dj => {
      if (dj.id === clientId) {
        const newMutedState = !dj.isMuted
        const newVolume = newMutedState ? 0 : 0.5
        
        // Muta il track WebRTC ricevuto dal client
        const peerConnection = peerConnectionsRef.current.get(clientId)
        if (peerConnection) {
          const receivers = peerConnection.getReceivers()
          receivers.forEach(receiver => {
            if (receiver.track && receiver.track.kind === 'audio') {
              receiver.track.enabled = !newMutedState
              console.log(`🎤 [RemoteDJHost] Track WebRTC ricevuto da ${clientId} ${newMutedState ? 'mutato' : 'attivato'}`)
            }
          })
        }
        
        // Muta anche l'elemento audio locale
        const audioElement = remoteAudioElementsRef.current.get(clientId)
        if (audioElement) {
          audioElement.muted = newMutedState
        }
        
        // Muta anche l'analyser per evitare feedback/rumble
        const analyser = remoteAudioAnalysersRef.current.get(clientId)
        if (analyser) {
          // Disconnetti l'analyser quando mutato per evitare feedback
          if (newMutedState) {
            try {
              analyser.disconnect()
              console.log(`🎤 [RemoteDJHost] Analyser disconnesso per ${clientId} (muted)`)
            } catch (error) {
              console.log(`🎤 [RemoteDJHost] Analyser già disconnesso per ${clientId}`)
            }
          } else {
            // Riconnetti l'analyser quando unmuted
            try {
              const peerConnection = peerConnectionsRef.current.get(clientId)
              if (peerConnection) {
                const receivers = peerConnection.getReceivers()
                receivers.forEach(receiver => {
                  if (receiver.track && receiver.track.kind === 'audio' && receiver.track.enabled) {
                    // Ricrea la connessione dell'analyser
                    const audioContext = new AudioContext()
                    const newAnalyser = audioContext.createAnalyser()
                    newAnalyser.fftSize = 256
                    newAnalyser.smoothingTimeConstant = 0.8
                    
                    const source = audioContext.createMediaStreamSource(new MediaStream([receiver.track]))
                    source.connect(newAnalyser)
                    
                    remoteAudioAnalysersRef.current.set(clientId, newAnalyser)
                    console.log(`🎤 [RemoteDJHost] Analyser riconnesso per ${clientId} (unmuted)`)
                  }
                })
              }
            } catch (error) {
              console.error(`❌ [RemoteDJHost] Errore riconnessione analyser per ${clientId}:`, error)
            }
          }
        }
        
        setRemoteDJVolume(clientId, newVolume)
        console.log(`🎤 [RemoteDJHost] DJ ${clientId} ${newMutedState ? 'mutato' : 'attivato'}`)
        return { ...dj, isMuted: newMutedState }
      }
      return dj
    }))
  }

  const toggleHostMute = () => {
    const newMutedState = !isHostMuted
    setIsHostMuted(newMutedState)
    
    // Imposta il flag globale per il controllo dello streaming
    ;(window as any).__isHostMicMuted__ = newMutedState
    
    // Muta il stream del microfono dell'host condiviso
    if (hostMicStreamRef.current) {
      hostMicStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState // Inverti: se muted=true, track.enabled=false
      })
    }
    
    console.log(`🎤 [RemoteDJHost] Host microfono ${newMutedState ? 'mutato' : 'attivato'}`)
  }

  // Funzione per monitorare l'audio dell'host e applicare ducking automatico
  const startHostAudioMonitoring = async () => {
    try {
      // Usa lo stesso stream del microfono condiviso se esiste già
      if (!hostMicStreamRef.current) {
        console.log(`🎤 [RemoteDJHost] ===== MONITORAGGIO AUDIO HOST =====`)
        console.log(`🎤 [RemoteDJHost] Stream microfono host non disponibile per monitoraggio`)
        console.log(`🎤 [RemoteDJHost] Il monitoraggio verrà avviato quando un client si connette`)
        return
      }

      // Crea AudioContext per monitorare l'audio dell'host
      if (!hostAudioContextRef.current) {
        hostAudioContextRef.current = new AudioContext()
        hostAnalyserRef.current = hostAudioContextRef.current.createAnalyser()
        hostAnalyserRef.current.fftSize = 256
        hostAnalyserRef.current.smoothingTimeConstant = 0.8

        // Connetti il microfono all'analyser
        const source = hostAudioContextRef.current.createMediaStreamSource(hostMicStreamRef.current)
        source.connect(hostAnalyserRef.current)
        console.log(`🎤 [RemoteDJHost] AudioContext creato per monitoraggio host`)
      }

      // ✅ FIX: Ottimizza il monitoraggio audio riducendo la frequenza
      let frameCount = 0
      const monitor = () => {
        frameCount++
        
        // ✅ FIX: Processa l'audio solo ogni 3 frame per ridurre CPU usage
        if (frameCount % 3 !== 0) {
          hostAnimationFrameRef.current = requestAnimationFrame(monitor)
          return
        }
        
        let maxAudioLevel = 0
        let activeSpeaker = ''

        // Monitora l'audio dell'host
        if (hostAnalyserRef.current && !isHostMuted) {
          const bufferLength = hostAnalyserRef.current.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)
          hostAnalyserRef.current.getByteFrequencyData(dataArray)

          // ✅ FIX: Ottimizza il calcolo usando solo una parte del buffer
          const step = Math.max(1, Math.floor(bufferLength / 32)) // Usa solo 32 campioni
          let sum = 0
          let count = 0
          for (let i = 0; i < bufferLength; i += step) {
            sum += dataArray[i]
            count++
          }
          const average = sum / count
          const audioLevel = (average / 255) * 100

          // ✅ FIX: Aggiorna sempre il livello audio massimo (non solo se più alto)
          if (audioLevel > maxAudioLevel) {
            maxAudioLevel = audioLevel
            activeSpeaker = 'Host'
          }
          
          // ✅ FIX: Controlla il microfono host meno frequentemente
          if (frameCount % 30 === 0) { // Ogni 30 frame (circa 1 secondo)
            if (hostMicStreamRef.current) {
              const tracks = hostMicStreamRef.current.getAudioTracks()
              const activeTracks = tracks.filter(track => track.readyState === 'live' && track.enabled)
              
              if (activeTracks.length === 0) {
                // Prova a riattivare il microfono silenziosamente
                setTimeout(() => {
                  if (hostMicStreamRef.current) {
                    hostMicStreamRef.current.getTracks().forEach(track => {
                      if (track.readyState === 'ended') {
                        track.enabled = true
                      }
                    })
                  }
                }, 1000)
              }
            }
          }
        }

        // Monitora l'audio dei DJ remoti
        remoteAudioAnalysersRef.current.forEach((analyser, clientId) => {
          const dj = connectedDJs.find(d => d.id === clientId)
          if (analyser && dj && !dj.isMuted) {
            const bufferLength = analyser.frequencyBinCount
            const dataArray = new Uint8Array(bufferLength)
            analyser.getByteFrequencyData(dataArray)

            // ✅ FIX: Ottimizza il calcolo usando solo una parte del buffer
            const step = Math.max(1, Math.floor(bufferLength / 32)) // Usa solo 32 campioni
            let sum = 0
            let count = 0
            for (let i = 0; i < bufferLength; i += step) {
              sum += dataArray[i]
              count++
            }
            const average = sum / count
            const audioLevel = (average / 255) * 100

            // Aggiorna il livello audio massimo se necessario (soglia più alta per DJ remoti)
            if (audioLevel > 20 && audioLevel > maxAudioLevel) {
              maxAudioLevel = audioLevel
              activeSpeaker = dj.djName
            }
          }
        })

        // ✅ FIX: Debug ridotto - mostra i livelli audio solo quando cambia significativamente
        const lastAudioLevel = (window as any).__lastAudioLevel__ || 0
        const levelChanged = Math.abs(maxAudioLevel - lastAudioLevel) > 5 // Cambio significativo di 5%
        if (maxAudioLevel > 5 && levelChanged) { // Solo se c'è attività audio e cambia significativamente
          console.log(`🎤 [AudioLevels] Host: ${hostAnalyserRef.current && !isHostMuted ? 'attivo' : 'inattivo'}, DJ Remoti: ${remoteAudioAnalysersRef.current.size}, Max: ${maxAudioLevel.toFixed(1)}%, Speaker: ${activeSpeaker}`)
          ;(window as any).__lastAudioLevel__ = maxAudioLevel
        }

        // Soglia per attivare il ducking
        const threshold = 25 // 25% di livello audio
        const shouldDuck = maxAudioLevel > threshold

        // Attiva ducking se necessario
        if (shouldDuck && !isAutoDuckingActive) {
          setIsAutoDuckingActive(true)
          setActiveSpeaker(activeSpeaker)
          applyAutoDucking(true)
          console.log(`🎤 [AutoDucking] Attivato da ${activeSpeaker} - livello audio: ${maxAudioLevel.toFixed(1)}%`)
        }
        
        // Disattiva ducking se il livello audio è troppo basso
        if (isAutoDuckingActive && maxAudioLevel < 5) {
          setIsAutoDuckingActive(false)
          setActiveSpeaker('')
          applyAutoDucking(false)
          console.log(`🎤 [AutoDucking] Disattivato - livello audio troppo basso: ${maxAudioLevel.toFixed(1)}%`)
        }


        // Controlla i flag globali per i microfoni mutati
        const isMicMuted = (window as any).__isMicMuted__ || false
        const isHostMicMuted = (window as any).__isHostMicMuted__ || false
        
        // Se tutti i microfoni sono mutati tramite flag, disattiva il ducking
        if ((isMicMuted && isHostMicMuted) && isAutoDuckingActive) {
          setIsAutoDuckingActive(false)
          setActiveSpeaker('')
          applyAutoDucking(false)
          console.log(`🎤 [AutoDucking] Disattivato - tutti i microfoni sono mutati`)
        }

        hostAnimationFrameRef.current = requestAnimationFrame(monitor)
      }

      monitor()
      console.log('🎤 [RemoteDJHost] Monitoraggio audio host avviato per ducking automatico')

    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore monitoraggio audio host:', error)
    }
  }

  // Funzione per applicare/rimuovere il ducking automatico
  const applyAutoDucking = (active: boolean) => {
    // ✅ FIX: Log solo quando cambia stato per evitare spam
    const lastAutoDuckingState = (window as any).__lastAutoDuckingState__
    if (lastAutoDuckingState !== active) {
      if (active) {
        console.log(`🎤 [AutoDucking] Attivato - Ducking: ${settings?.microphone?.duckingPercent ?? 75}%`)
      } else {
        console.log(`🎤 [AutoDucking] Disattivato`)
      }
      ;(window as any).__lastAutoDuckingState__ = active
    }
    
    // Usa la funzione di ducking dell'AudioContext
    if (setStreamDucking) {
      setStreamDucking(active)
    } else {
      console.warn('⚠️ [AutoDucking] Funzione setStreamDucking non disponibile')
    }
  }

  // Cleanup del monitoraggio audio
  const stopHostAudioMonitoring = () => {
    if (hostAnimationFrameRef.current) {
      cancelAnimationFrame(hostAnimationFrameRef.current)
      hostAnimationFrameRef.current = null
    }
    if (hostAudioContextRef.current) {
      hostAudioContextRef.current.close()
      hostAudioContextRef.current = null
    }
    hostAnalyserRef.current = null
    
    // Cleanup degli analyser remoti
    remoteAudioAnalysersRef.current.forEach((analyser, clientId) => {
      try {
        analyser.disconnect()
        console.log(`🎤 [RemoteDJHost] Analyser disconnesso per ${clientId} (stop monitoring)`)
      } catch (error) {
        console.log(`🎤 [RemoteDJHost] Analyser già disconnesso per ${clientId}`)
      }
    })
    remoteAudioAnalysersRef.current.clear()
    
    console.log('🎤 [RemoteDJHost] Monitoraggio audio fermato (host + remoti)')
  }

  const setDJVolume = (clientId: string, volume: number) => {
    setRemoteDJVolume(clientId, volume)
    
    // Aggiorna l'elemento audio locale
    const audioElement = remoteAudioElementsRef.current.get(clientId)
    if (audioElement) {
      audioElement.volume = volume
    }
    
    // Aggiorna lo stato locale
    setConnectedDJs(prev => prev.map(dj => 
      dj.id === clientId 
        ? { ...dj, volume: volume }
        : dj
    ))
    
    console.log(`🔊 [RemoteDJHost] Volume DJ ${clientId} impostato a ${Math.round(volume * 100)}%`)
  }

  const disconnectDJ = (clientId: string) => {
    // Chiudi PeerConnection
    const peerConnection = peerConnectionsRef.current.get(clientId)
    if (peerConnection) {
      peerConnection.close()
      peerConnectionsRef.current.delete(clientId)
    }

    // Rimuovi elemento audio locale
    const audioElement = remoteAudioElementsRef.current.get(clientId)
    if (audioElement) {
      audioElement.pause()
      audioElement.srcObject = null
      document.body.removeChild(audioElement)
      remoteAudioElementsRef.current.delete(clientId)
    }

    // Non cleanup del microfono host qui - è condiviso tra tutti i client

    // Cleanup remote audio analyser
    const remoteAnalyser = remoteAudioAnalysersRef.current.get(clientId)
    if (remoteAnalyser) {
      try {
        remoteAnalyser.disconnect()
        console.log(`🎤 [RemoteDJHost] Analyser disconnesso per ${clientId} (disconnect)`)
      } catch (error) {
        console.log(`🎤 [RemoteDJHost] Analyser già disconnesso per ${clientId}`)
      }
      remoteAudioAnalysersRef.current.delete(clientId)
    }

    // Rimuovi stream audio
    removeRemoteDJStream(clientId)

    // Rimuovi dalla lista
    setConnectedDJs(prev => prev.filter(dj => dj.id !== clientId))
    
    console.log(`🔌 [RemoteDJHost] DJ ${clientId} disconnesso`)
  }

  const copySessionCode = () => {
    if (serverInfo?.sessionCode) {
      navigator.clipboard.writeText(serverInfo.sessionCode)
      alert('Codice sessione copiato!')
    }
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

    // Aggiungi il messaggio alla chat locale
    addChatMessage('Host', message)

    // Invia il messaggio a tutti i DJ connessi
    if (window.electronAPI?.webrtcServerAPI) {
      window.electronAPI.webrtcServerAPI.sendHostMessage(message)
      console.log('💬 [RemoteDJHost] Messaggio chat inviato:', message)
    }
  }

  const stopServer = async () => {
    if (!window.electronAPI?.webrtcServerAPI) {
      console.error('❌ [RemoteDJHost] ElectronAPI non disponibile')
      return
    }

    try {
      const result = await window.electronAPI.webrtcServerAPI.stopServer()
      if (result.success) {
        setIsServerRunning(false)
        setServerInfo(null)
        setConnectedDJs([])
        
        // Pulisci il microfono host quando il server si ferma
        if (hostMicStreamRef.current) {
          hostMicStreamRef.current.getTracks().forEach(track => track.stop())
          hostMicStreamRef.current = null
          console.log('🎤 [RemoteDJHost] Microfono host pulito - server fermato')
        }
        
        console.log('✅ [RemoteDJHost] Server fermato')
      }
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore fermata server:', error)
    }
  }

  const startServer = async () => {
    if (!window.electronAPI?.webrtcServerAPI) {
      console.error('❌ [RemoteDJHost] ElectronAPI non disponibile')
      return
    }

    setIsStarting(true)

    try {
      const result = await window.electronAPI.webrtcServerAPI.startServer({
        port: 8080,
        maxConnections: 5
      })

      if (result.success) {
        setIsServerRunning(true)
        setServerInfo(result)
        console.log('✅ [RemoteDJHost] Server avviato:', result)
        
        // Mostra i dispositivi audio disponibili
        await logAvailableAudioDevices()
      } else {
        console.error('❌ [RemoteDJHost] Errore avvio server:', result.error)
      }
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore:', error)
    } finally {
      setIsStarting(false)
    }
  }

  // Controlla se il server è già attivo al mount del componente (solo per ripristinare lo stato UI)
  useEffect(() => {
    const checkServerStatus = async () => {
      if (window.electronAPI?.webrtcServerAPI) {
        try {
          // Controlla solo se il server è già attivo, senza avviarlo
          const status = await window.electronAPI.webrtcServerAPI.checkServerStatus()
          if (status.success && status.isRunning) {
            setIsServerRunning(true)
            setServerInfo(status.serverInfo)
            setConnectedDJs(status.clients.map((client: any) => ({
              id: client.id,
              djName: client.djName,
              audioLevel: 0,
              volume: 0.5,
              isMuted: false
            })))
            console.log('✅ [RemoteDJHost] Server già attivo, stato UI ripristinato:', status)
            
            // Ripristina il monitoraggio audio se ci sono client connessi
            if (status.clients.length > 0) {
              console.log(`🎤 [AutoDucking] Ripristino monitoraggio audio dopo ripristino server - ${status.clients.length} DJ connessi`)
              setTimeout(() => {
                startHostAudioMonitoring()
              }, 1000)
            }
          } else {
            console.log('ℹ️ [RemoteDJHost] Server non attivo, pronto per avvio manuale')
          }
        } catch (error) {
          console.log('ℹ️ [RemoteDJHost] Server non attivo, pronto per avvio manuale')
        }
      }
    }

    checkServerStatus()
  }, [])

  // ✅ FIX: Ripristina monitoraggio audio quando la finestra torna in focus
  useEffect(() => {
    let isRestoring = false // Flag per evitare riavvii multipli

    const handleWindowFocus = async () => {
      if (isRestoring) return // Evita riavvii multipli
      
      console.log('🔄 [RemoteDJHost] Finestra in focus - controllo stato server')
      
      // Controlla sempre lo stato del server quando la finestra torna in focus
      if (window.electronAPI?.webrtcServerAPI) {
        try {
          const status = await window.electronAPI.webrtcServerAPI.checkServerStatus()
          if (status.success && status.isRunning) {
            console.log('✅ [RemoteDJHost] Server ancora attivo dopo focus')
            if (status.clients.length > 0 && connectedDJs.length === 0) {
              // Ripristina i client connessi se mancanti
              setConnectedDJs(status.clients.map((client: any) => ({
                id: client.id,
                djName: client.djName,
                audioLevel: 0,
                volume: 0.5,
                isMuted: false
              })))
              console.log(`🔄 [RemoteDJHost] Ripristinati ${status.clients.length} client dopo focus`)
            }
            
            // Ripristina monitoraggio audio solo se non è già attivo
            if (status.clients.length > 0 && !hostAnimationFrameRef.current) {
              console.log('🔄 [RemoteDJHost] Finestra in focus - ripristino monitoraggio audio')
              isRestoring = true
              setTimeout(() => {
                startHostAudioMonitoring()
                isRestoring = false
              }, 500)
            }
          } else {
            console.log('⚠️ [RemoteDJHost] Server non più attivo dopo focus')
            setIsServerRunning(false)
            setConnectedDJs([])
          }
        } catch (error) {
          console.log('⚠️ [RemoteDJHost] Errore controllo server dopo focus:', error)
        }
      }
    }

    const handleVisibilityChange = async () => {
      if (document.hidden || isRestoring) return // Evita riavvii multipli
      
      console.log('🔄 [RemoteDJHost] Pagina visibile - controllo stato server')
      
      // Controlla lo stato del server quando la pagina torna visibile
      if (window.electronAPI?.webrtcServerAPI) {
        try {
          const status = await window.electronAPI.webrtcServerAPI.checkServerStatus()
          if (status.success && status.isRunning) {
            console.log('✅ [RemoteDJHost] Server ancora attivo dopo visibility change')
            if (status.clients.length > 0 && !hostAnimationFrameRef.current) {
              console.log('🔄 [RemoteDJHost] Pagina visibile - ripristino monitoraggio audio')
              isRestoring = true
              setTimeout(() => {
                startHostAudioMonitoring()
                isRestoring = false
              }, 500)
            }
          } else {
            console.log('⚠️ [RemoteDJHost] Server non più attivo dopo visibility change')
            setIsServerRunning(false)
            setConnectedDJs([])
          }
        } catch (error) {
          console.log('⚠️ [RemoteDJHost] Errore controllo server dopo visibility change:', error)
        }
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isServerRunning, connectedDJs.length])

  // Avvia/ferma il monitoraggio audio automatico quando ci sono DJ connessi
  useEffect(() => {
    if (connectedDJs.length > 0) {
      // Ci sono DJ connessi, avvia il monitoraggio audio per ducking automatico
      console.log(`🎤 [AutoDucking] ${connectedDJs.length} DJ connessi, avvio monitoraggio audio automatico`)
      // Aspetta un po' per assicurarsi che il microfono host sia stato creato
      setTimeout(() => {
        startHostAudioMonitoring()
      }, 1000)
    } else {
      // Nessun DJ connesso, ferma il monitoraggio audio
      console.log('🎤 [AutoDucking] Nessun DJ connesso, fermo monitoraggio audio automatico')
      stopHostAudioMonitoring()
      // Disattiva anche il ducking se era attivo
      if (isAutoDuckingActive) {
        setIsAutoDuckingActive(false)
        applyAutoDucking(false)
      }
      
      // Pulisci il microfono host quando non ci sono più client
      if (hostMicStreamRef.current) {
        hostMicStreamRef.current.getTracks().forEach(track => track.stop())
        hostMicStreamRef.current = null
        console.log('🎤 [RemoteDJHost] Microfono host pulito - nessun client connesso')
      }
    }

    // Cleanup quando il componente si smonta
    return () => {
      stopHostAudioMonitoring()
      // Pulisci anche il microfono host al dismount
      if (hostMicStreamRef.current) {
        hostMicStreamRef.current.getTracks().forEach(track => track.stop())
        hostMicStreamRef.current = null
      }
    }
  }, [connectedDJs.length])


  return (
    <div className="bg-dj-primary border border-dj-accent rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">🎤 DJ Remoti</h2>
        <div className="flex space-x-2">
          {!isServerRunning ? (
            <button
              onClick={startServer}
              disabled={isStarting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isStarting ? '🔄 Avvio...' : '🚀 Avvia Server'}
            </button>
          ) : (
            <>
              <button
                onClick={toggleHostMute}
                className={`${isHostMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium py-2 px-4 rounded-md transition-colors`}
              >
                {isHostMuted ? '🔇 Unmute Host' : '🔊 Mute Host'}
              </button>
              {connectedDJs.length > 0 && (
                <div className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isAutoDuckingActive ? 'bg-orange-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  {isAutoDuckingActive ? `🎤 Auto Ducking ON (${activeSpeaker})` : '🎤 Auto Ducking Ready'}
                </div>
              )}
              <button
                onClick={stopServer}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                🛑 Ferma Server
              </button>
            </>
          )}
        </div>
      </div>

      {isServerRunning && serverInfo && (
        <div className="mb-6 p-4 bg-dj-dark border border-dj-accent rounded-md">
          <h3 className="text-lg font-semibold text-white mb-3">📡 Server Attivo</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-dj-light">Porta:</span>
              <span className="text-white ml-2">{serverInfo.port}</span>
            </div>
            <div>
              <span className="text-dj-light">Max DJ:</span>
              <span className="text-white ml-2">{serverInfo.maxConnections}</span>
            </div>
            <div className="col-span-2">
              <span className="text-dj-light">Codice Sessione:</span>
              <div className="flex items-center space-x-2 mt-1">
                <code className="bg-dj-primary px-2 py-1 rounded text-dj-accent font-mono">
                  {serverInfo.sessionCode}
                </code>
                <button
                  onClick={copySessionCode}
                  className="text-dj-accent hover:text-white text-sm"
                  title="Copia codice"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">
          👥 DJ Connessi ({connectedDJs.length})
        </h3>

        {connectedDJs.length === 0 ? (
          <div className="text-center py-8 text-dj-light">
            <div className="text-4xl mb-2">🎤</div>
            <div>Nessun DJ connesso</div>
            <div className="text-sm mt-1">
              Condividi il codice sessione con i DJ remoti
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {connectedDJs.map((dj) => (
              <div
                key={dj.id}
                className="bg-dj-dark border border-dj-accent rounded-md p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-white">{dj.djName}</h4>
                    <div className="text-sm text-dj-light">
                      IP: {dj.ip} | Connesso: {dj.connectedAt ? dj.connectedAt.toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleMuteDJ(dj.id)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        dj.isMuted
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {dj.isMuted ? '🔇' : '🔊'}
                    </button>
                    <button
                      onClick={() => disconnectDJ(dj.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      🔌
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-dj-light">Audio Level</span>
                      <span className="text-sm text-dj-light">{dj.audioLevel.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-dj-primary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-100 ${
                          dj.isMuted ? 'bg-red-500' : 'bg-dj-accent'
                        }`}
                        style={{ width: `${dj.isMuted ? 0 : dj.audioLevel}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-dj-light">Volume</span>
                      <span className="text-sm text-dj-light">{Math.round(dj.volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={dj.volume}
                      onChange={(e) => setDJVolume(dj.id, Number(e.target.value))}
                      className="w-full h-2 bg-dj-primary rounded-lg appearance-none cursor-pointer accent-dj-accent"
                      title={`Volume ${dj.djName}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat DJ */}
      {isServerRunning && connectedDJs.length > 0 && (
        <div className="mt-6">
          <DJChat
            connectedDJs={connectedDJs}
            onSendMessage={handleSendChatMessage}
            messages={chatMessages}
          />
        </div>
      )}

      {isServerRunning && (
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-md">
          <h4 className="text-blue-400 font-semibold mb-2">📋 Istruzioni per DJ Remoti</h4>
          <div className="text-sm text-blue-300 space-y-1">
            <div>1. Apri il client DJ Remoto</div>
            <div>2. Inserisci il codice sessione: <code className="bg-blue-800 px-1 rounded">{serverInfo?.sessionCode}</code></div>
            <div>3. Inserisci l'IP del DJ Host</div>
            <div>4. Clicca "Connetti"</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RemoteDJHost
