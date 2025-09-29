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
  isPTTDJActive?: boolean
  isPTTLiveActive?: boolean
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
  
  // ✅ NEW: PTT Button States
  const [isPTTDJActive, setIsPTTDJActive] = useState(false)
  const [isPTTLiveActive, setIsPTTLiveActive] = useState(false)

  // ✅ NEW: Track which clients have PTT Live active
  const [clientsWithPTTLive, setClientsWithPTTLive] = useState<Set<string>>(new Set())

  const { addRemoteDJStream, removeRemoteDJStream, setRemoteDJVolume } = useAudio()
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const hostMicStreamRef = useRef<MediaStream | null>(null)
  
  // ✅ NEW: Host microphone restoration state
  const [isRestoringHostMic, setIsRestoringHostMic] = useState(false)
  
  // ✅ NEW: Navigation state to prevent PTT disconnection during page changes
  const [isNavigating, setIsNavigating] = useState(false)

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]

  // ✅ REMOVED: Listener duplicato rimosso - gestito solo da DJRemotoServerPage.tsx
  // Non serve listener qui perché DJRemotoServerPage.tsx gestisce già tutto:
  // 1. Ricrea hostMicStreamRef.current con createHostMicrophone()  
  // 2. Aggiorna connessioni WebRTC con updateExistingWebRTCConnections_PROPER()
  // Questo evita ricreazioni doppie del microfono che causano ritardi PTT

  // ✅ NEW: Funzione per aggiornare le connessioni WebRTC (STRATEGIA CORRETTA)
  const updateExistingWebRTCConnections_PROPER = async () => {
    console.log('🔄 [RemoteDJHost] STRATEGIA CORRETTA: Ricreare hostMicStreamRef e aggiornare tutte le connessioni')
    
    // Prima ricreiamo completamente il microfono host con le nuove settings
    // Questo aggiorna automaticamente hostMicStreamRef.current
    // (la funzione createNewMicrophoneStreamForceUpdate fa già questo)
    
    if (!hostMicStreamRef.current) {
      console.warn('⚠️ [RemoteDJHost] Nessun stream microfono disponibile per aggiornare le connessioni')
      return
    }

    const connections = Array.from(peerConnectionsRef.current.entries())
    console.log(`🔄 [RemoteDJHost] Aggiornamento di ${connections.length} connessioni WebRTC con stream ricreato`)

    const newMicTrack = hostMicStreamRef.current.getAudioTracks()[0]
    if (!newMicTrack) {
      console.error('❌ [RemoteDJHost] Nessun track audio nel stream ricreato')
      return
    }

    for (const [clientId, peerConnection] of connections) {
      // Salta i DataChannel
      if (clientId.includes('_dataChannel')) continue

      try {
        console.log(`🔄 [RemoteDJHost] Aggiornamento connessione per ${clientId}`)

        // Trova il sender del microfono host esistente
        const senders = peerConnection.getSenders()
        let micSender = null
        
        for (const sender of senders) {
          if (sender.track && sender.track.kind === 'audio') {
            micSender = sender
            break
          }
        }

        if (micSender) {
          // ✅ STRATEGIA CORRETTA: Usa replaceTrack con il track del stream principale
          console.log(`🔄 [RemoteDJHost] Sostituzione track con quello del stream principale per ${clientId}`)
          await micSender.replaceTrack(newMicTrack)
          console.log(`✅ [RemoteDJHost] Track sostituito per ${clientId}`)
        } else {
          // Se non c'è un sender esistente, aggiungi il track
          console.log(`➕ [RemoteDJHost] Aggiunta nuovo track per ${clientId}`)
          peerConnection.addTrack(newMicTrack, hostMicStreamRef.current)
          console.log(`✅ [RemoteDJHost] Nuovo track aggiunto per ${clientId}`)
        }

      } catch (error) {
        console.error(`❌ [RemoteDJHost] Errore aggiornamento ${clientId}:`, error)
      }
    }
    
    console.log('✅ [RemoteDJHost] Aggiornamento completato - PTT ora funziona con stream aggiornato')
  }

  // ✅ OLD: Funzione per aggiornare tutte le connessioni WebRTC esistenti con il nuovo stream (DEPRECATA)
  const updateExistingWebRTCConnections_OLD = async () => {
    if (!hostMicStreamRef.current) {
      console.warn('⚠️ [RemoteDJHost] Nessun stream microfono disponibile per aggiornare le connessioni')
      return
    }

    const connections = Array.from(peerConnectionsRef.current.entries())
    console.log(`🔄 [RemoteDJHost] Aggiornamento ${connections.length} connessioni WebRTC con nuovo stream microfono`)

    for (const [clientId, peerConnection] of connections) {
      // Salta i DataChannel (che hanno il suffisso "_dataChannel")
      if (clientId.includes('_dataChannel')) continue

      try {
        console.log(`🔄 [RemoteDJHost] Aggiornamento connessione WebRTC per client: ${clientId}`)

        // Rimuovi tutti i sender audio esistenti (microfono host)
        const senders = peerConnection.getSenders()
        for (const sender of senders) {
          if (sender.track && sender.track.kind === 'audio') {
            console.log(`🗑️ [RemoteDJHost] Rimozione track audio esistente: ${sender.track.id}`)
            peerConnection.removeTrack(sender)
          }
        }

        // Aggiungi i nuovi track dal nuovo stream microfono
        for (const track of hostMicStreamRef.current.getTracks()) {
          console.log(`➕ [RemoteDJHost] Aggiunta nuovo track microfono: ${track.id} per client ${clientId}`)
          
          // Muta il track di default (PTT mode)
          track.enabled = false
          
          peerConnection.addTrack(track, hostMicStreamRef.current)
          console.log(`✅ [RemoteDJHost] Track ${track.id} aggiunto e mutato per client ${clientId}`)
        }

        // Crea e invia nuovo offer se necessario
        if (peerConnection.signalingState === 'stable') {
          console.log(`🔄 [RemoteDJHost] Creazione nuovo offer per client ${clientId}`)
          const offer = await peerConnection.createOffer()
          await peerConnection.setLocalDescription(offer)

          // Invia il nuovo offer al client tramite il server
          if ((window as any).electronAPI?.webrtcServerAPI) {
            ;(window as any).electronAPI.webrtcServerAPI.sendOffer({
              clientId,
              sdp: offer.sdp
            })
            console.log(`✅ [RemoteDJHost] Nuovo offer inviato al client ${clientId}`)
          }
        }

      } catch (error) {
        console.error(`❌ [RemoteDJHost] Errore aggiornamento connessione WebRTC per ${clientId}:`, error)
      }
    }

    console.log(`✅ [RemoteDJHost] Aggiornamento connessioni WebRTC completato`)
  }

  // ✅ NEW: Function to force creation of new microphone stream (for settings changes)
  const createNewMicrophoneStreamForceUpdate = async () => {
    console.log('🔄 [RemoteDJHost] Creazione forzata nuovo stream microfono...')
    
    try {
      // Get current microphone settings
      const currentSettings = settingsRef.current
      const micDeviceId = currentSettings?.microphone?.inputDevice || 'default'
      
      console.log('🎤 [RemoteDJHost] Creazione microfono con device:', micDeviceId)
      
      // Create new microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micDeviceId,
          echoCancellation: currentSettings?.microphone?.echoCancellation ?? false,
          noiseSuppression: currentSettings?.microphone?.noiseSuppression ?? true,
          autoGainControl: currentSettings?.microphone?.autoGainControl ?? true,
          sampleRate: currentSettings?.microphone?.sampleRate ?? 44100,
          channelCount: 1
        }
      })
      
      // Store the new stream
      hostMicStreamRef.current = stream
      
      console.log('✅ [RemoteDJHost] Nuovo stream microfono creato forzatamente')
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore creazione forzata stream microfono:', error)
    }
  }

  // ✅ NEW: Function to restore host microphone stream
  const restoreHostMicrophoneStream = async () => {
    if (isRestoringHostMic || connectedDJs.length === 0) return
    
    // ✅ NEW: Check if we actually need to restore (stream might still be working)
    if (hostMicStreamRef.current && hostMicStreamRef.current.active) {
      console.log('ℹ️ [RemoteDJHost] Stream microfono già attivo, ripristino non necessario')
      return
    }
    
    // ✅ NEW: Don't restore if PTT is active to avoid interference
    if (isPTTDJActive || isPTTLiveActive) {
      console.log('ℹ️ [RemoteDJHost] PTT attivo, ripristino microfono saltato per evitare interferenze')
      return
    }
    
    console.log('🔄 [RemoteDJHost] Ripristino stream microfono host...')
    setIsRestoringHostMic(true)
    
    try {
      // Get current microphone settings
      const currentSettings = settingsRef.current
      const micDeviceId = currentSettings?.microphone?.inputDevice || 'default'
      
      console.log('🎤 [RemoteDJHost] Ripristino microfono con device:', micDeviceId)
      
      // Create new microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micDeviceId,
          echoCancellation: currentSettings?.microphone?.echoCancellation ?? false,
          noiseSuppression: currentSettings?.microphone?.noiseSuppression ?? true,
          autoGainControl: currentSettings?.microphone?.autoGainControl ?? true,
          sampleRate: currentSettings?.microphone?.sampleRate ?? 44100,
          channelCount: 1
        }
      })
      
      // Store the new stream
      hostMicStreamRef.current = stream
      
  // ✅ NEW: Update PTT track references to use the new stream
  if (isPTTDJActive || isPTTLiveActive) {
    console.log('🔄 [RemoteDJHost] Aggiornamento riferimenti PTT con nuovo stream')
    // The track will be enabled/disabled in the loop above based on PTT state
  }
  
  // ✅ NEW: Send PTT state to clients after restoration
  if (isPTTDJActive) {
    console.log('🔄 [RemoteDJHost] Reinvio stato PTT DJ dopo ripristino microfono')
    sendPTTDJCommandToClients(true)
  }
  if (isPTTLiveActive) {
    console.log('🔄 [RemoteDJHost] Reinvio stato PTT Live dopo ripristino microfono')
    sendHostPTTLiveCommandToClients(true)
  }
      
      // Add the stream to all existing peer connections
      for (const [clientId, peerConnection] of peerConnectionsRef.current) {
        try {
          // Check if this is actually a RTCPeerConnection (not a DataChannel)
          if (peerConnection && typeof peerConnection.getSenders === 'function') {
            // Remove old audio tracks
            const senders = peerConnection.getSenders()
            for (const sender of senders) {
              if (sender.track && sender.track.kind === 'audio') {
                peerConnection.removeTrack(sender)
              }
            }
            
            // Add new audio track
            const audioTrack = stream.getAudioTracks()[0]
            if (audioTrack) {
              peerConnection.addTrack(audioTrack, stream)
              
              // ✅ NEW: Preserve PTT state after restoration
              if (isPTTDJActive || isPTTLiveActive) {
                audioTrack.enabled = true
                console.log(`✅ [RemoteDJHost] Stream microfono ripristinato per client ${clientId} - PTT attivo, track abilitato`)
              } else {
                audioTrack.enabled = false
                console.log(`✅ [RemoteDJHost] Stream microfono ripristinato per client ${clientId} - PTT disattivo, track disabilitato`)
              }
            }
          } else {
            console.log(`⚠️ [RemoteDJHost] Saltando ${clientId} - non è una RTCPeerConnection`)
          }
        } catch (error) {
          console.error(`❌ [RemoteDJHost] Errore ripristino stream per client ${clientId}:`, error)
        }
      }
      
      console.log('✅ [RemoteDJHost] Stream microfono host ripristinato con successo')
      
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore ripristino stream microfono host:', error)
    } finally {
      setIsRestoringHostMic(false)
    }
  }

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

      // ✅ MANTENUTO: Listener audio level SOLO per visualizzazione UI (NON per monitoraggio automatico)
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

      // ✅ CRITICAL FIX: Il ducking viene gestito solo dal sistema PTT dell'AudioContext
      // Non abbiamo bisogno di gestione WebSocket separata per PTT Live

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
        
        // ✅ NEW: Gestisci DataChannel dal client
        peerConnection.ondatachannel = (event) => {
          const dataChannel = event.channel
          console.log(`📡 [DataChannel] Ricevuto DataChannel da ${djName}`)
          
          dataChannel.onopen = () => {
            console.log(`📡 [DataChannel] DataChannel aperto con ${djName}`)
          }
          
          dataChannel.onmessage = (event) => {
            try {
              const command = JSON.parse(event.data)
              console.log(`📡 [DataChannel] Ricevuto comando da ${djName}:`, command)
              
              if (command.type === 'requestHostPTTLiveState') {
                // ✅ NEW: Send current host PTT Live state to client
                console.log(`📡 [DataChannel] Richiesta stato PTT Live host da ${djName}`)
                const responseCommand = {
                  type: 'hostPTTLive',
                  active: isPTTLiveActive,
                  timestamp: Date.now()
                }
                
                try {
                  dataChannel.send(JSON.stringify(responseCommand))
                  console.log(`📡 [DataChannel] Stato PTT Live host inviato a ${djName}: ${isPTTLiveActive ? 'ATTIVO' : 'DISATTIVO'}`)
                } catch (error) {
                  console.error(`📡 [DataChannel] Errore invio stato PTT Live host a ${djName}:`, error)
                }
              } else if (command.type === 'requestHostPTTDJState') {
                // ✅ NEW: Send current host PTT DJ state to client
                console.log(`📡 [DataChannel] Richiesta stato PTT DJ host da ${djName}`)
                const responseCommand = {
                  type: 'pttDJ',
                  active: isPTTDJActive,
                  timestamp: Date.now()
                }
                
                try {
                  dataChannel.send(JSON.stringify(responseCommand))
                  console.log(`📡 [DataChannel] Stato PTT DJ host inviato a ${djName}: ${isPTTDJActive ? 'ATTIVO' : 'DISATTIVO'}`)
                } catch (error) {
                  console.error(`📡 [DataChannel] Errore invio stato PTT DJ host a ${djName}:`, error)
                }
              } else if (command.type === 'pttLive') {
                console.log(`📡 [DataChannel] PTT Live ${command.active ? 'attivato' : 'disattivato'} da ${djName}`)
                
                // ✅ DEBUG: Controlla lo stato dell'audio del client
                const peerConnection = peerConnectionsRef.current.get(clientId)
                if (peerConnection) {
                  const receivers = peerConnection.getReceivers()
                  receivers.forEach(receiver => {
                    if (receiver.track && receiver.track.kind === 'audio') {
                      console.log(`🎤 [DEBUG] Audio track del client ${djName}:`, {
                        id: receiver.track.id,
                        enabled: receiver.track.enabled,
                        muted: receiver.track.muted,
                        readyState: receiver.track.readyState
                      })
                    }
                  })
                }
                
                // ✅ CRITICAL FIX: Gestisci SOLO l'audio del client nel live streaming - NON attivare PTT Live dell'host
                if (command.active) {
                  // ✅ STEP 1: Aggiungi client alla lista PTT Live attivi
                  setClientsWithPTTLive(prev => {
                    const newSet = new Set([...prev, clientId])
                    console.log(`🎤 [PTT Live Client] Client ${djName} aggiunto alla lista PTT Live attivi (totale: ${newSet.size})`)
                    return newSet
                  })
                  
                  // ✅ STEP 2: Aggiungi lo stream del client al live streaming
                  const peerConnection = peerConnectionsRef.current.get(clientId)
                  if (peerConnection) {
                    const receivers = peerConnection.getReceivers()
                    receivers.forEach(receiver => {
                      if (receiver.track && receiver.track.kind === 'audio') {
                        // Crea uno stream temporaneo per il live streaming
                        const liveStream = new MediaStream([receiver.track])
                        addRemoteDJStream(clientId, liveStream)
                        console.log(`🎤 [PTT Live Client] Stream del client ${djName} aggiunto al live streaming`)
                      }
                    })
                  }
                  
                  // ✅ CRITICAL FIX: NON attivare PTT Live dell'host - il client gestisce il suo PTT Live
                  console.log(`🎤 [PTT Live Client] Client ${djName} gestisce il suo PTT Live - host NON coinvolto`)
                  
                  console.log(`🎤 [PTT Live Client] Sistema attivato per client ${djName} - solo audio client nel live streaming`)
                } else {
                  // ✅ STEP 1: Rimuovi client dalla lista PTT Live attivi
                  setClientsWithPTTLive(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(clientId)
                    console.log(`🎤 [PTT Live Client] Client ${djName} rimosso dalla lista PTT Live attivi (rimanenti: ${newSet.size})`)
                    return newSet
                  })
                  
                  // ✅ STEP 2: Rimuovi lo stream del client dal live streaming
                  removeRemoteDJStream(clientId)
                  console.log(`🎤 [PTT Live Client] Stream del client ${djName} rimosso dal live streaming`)
                  
                  // ✅ CRITICAL FIX: NON disattivare PTT Live dell'host - il client gestisce il suo PTT Live
                  console.log(`🎤 [PTT Live Client] Client ${djName} gestisce il suo PTT Live - host NON coinvolto`)
                  
                  console.log(`🎤 [PTT Live Client] Sistema disattivato per client ${djName} - solo audio client nel live streaming`)
                }
              } else if (command.type === 'pttLiveAudio') {
                // ✅ NEW: Gestisci audio PTT Live ricevuto dal client
                console.log(`🎤 [PTT Live Audio] Ricevuto audio da ${djName}: ${command.audioSize} bytes`)
                handlePTTLiveAudioFromClient(clientId, djName, command.audioData, command.audioSize)
              } else if (command.type === 'pttLiveAudioChunk') {
                // ✅ NEW: Gestisci chunk audio PTT Live ricevuto dal client
                console.log(`🎤 [PTT Live Audio Chunk] Ricevuto chunk ${command.chunkIndex + 1}/${command.totalChunks} da ${djName}: ${command.chunkSize} bytes`)
                handlePTTLiveAudioChunkFromClient(clientId, djName, command)
              }
            } catch (error) {
              console.error(`📡 [DataChannel] Errore parsing comando da ${djName}:`, error)
            }
          }
          
          dataChannel.onerror = (error) => {
            console.error(`📡 [DataChannel] Errore con ${djName}:`, error)
          }
          
          // Salva il DataChannel per inviare comandi
          peerConnectionsRef.current.set(`${clientId}_dataChannel`, dataChannel as any)
        }
        
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && window.electronAPI?.webrtcServerAPI) {
            console.log(`🧊 [RemoteDJHost] Invio ICE candidate per ${djName}`)
            // Invia ICE candidate al client tramite il server
            window.electronAPI.webrtcServerAPI.sendICECandidate({ clientId, candidate: event.candidate })
          }
        }

        peerConnection.ontrack = (event) => {
          console.log(`🎵 [RemoteDJHost] Ricevuto remote track da ${djName}:`, event.streams[0])
          console.log(`🎵 [RemoteDJHost] Track info:`, {
            id: event.track.id,
            kind: event.track.kind,
            enabled: event.track.enabled,
            muted: event.track.muted,
            readyState: event.track.readyState
          })
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
          
          // ✅ CRITICAL FIX: Muta il microfono di default (PTT mode)
          track.enabled = false
          console.log(`🎤 [RemoteDJHost]   🔇 Track ${track.id} mutato di default (PTT mode)`)
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
      const audioElement = document.createElement('audio')
      audioElement.srcObject = stream
      audioElement.autoplay = true
      audioElement.volume = 1.0 // ✅ CRITICAL FIX: Volume al 100% per sentire chiaramente il client
      audioElement.style.display = 'none'
      document.body.appendChild(audioElement)
      
      console.log(`🎵 [RemoteDJHost] Audio del client ${clientId} configurato con volume 100%`)
      
      // Salva l'elemento audio per controllo successivo
      remoteAudioElementsRef.current.set(clientId, audioElement)
      
      
      // ✅ CRITICAL FIX: NON aggiungere automaticamente al live streaming
      // Lo stream verrà aggiunto solo quando il client attiva PTT Live
      console.log(`🎵 [RemoteDJHost] Stream del client ${clientId} ricevuto ma NON aggiunto al live streaming (solo per comunicazione DJ-to-DJ)`)
      
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


  // ✅ NEW: PTT DJ-to-DJ Functions
  const handlePTTDJPress = () => {
    // ✅ CRITICAL FIX: Se PTT Live è attivo, disattivalo prima di attivare PTT DJ
    if (isPTTLiveActive) {
      console.log('🎤 [PTT DJ] Disattivando PTT Live per attivare PTT DJ')
      setIsPTTLiveActive(false)
      // ✅ CRITICAL FIX: PTT DJ NON deve toccare il volume del live stream
      // ✅ CRITICAL FIX: PTT Live usa solo il sistema PTT dell'AudioContext
      console.log('🎤 [PTT DJ] Ducking gestito dal sistema PTT AudioContext')
      // Invia comando ducking via DataChannel a tutti i client
      sendDuckingCommandToClients(false)
    }
    
    setIsPTTDJActive(true)
    console.log('🎤 [PTT DJ] Attivato - Comunicazione DJ-to-DJ (NON live streaming)')
    // ✅ CRITICAL FIX: PTT DJ deve attivare il microfono per comunicazione DJ-to-DJ
    if (hostMicStreamRef.current) {
      hostMicStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
        console.log(`🎤 [PTT DJ] Track ${track.id} abilitato per comunicazione DJ-to-DJ`)
      })
    }
    // ✅ CRITICAL FIX: PTT DJ NON deve attivare il sistema PTT dell'AudioContext
    // Il microfono sarà disponibile solo per WebRTC, NON per live streaming
    console.log('🎤 [PTT DJ] Microfono attivato SOLO per WebRTC - NON per live streaming')
    // ✅ CRITICAL FIX: PTT DJ NON deve attivare il ducking automatico
    console.log('🎤 [PTT DJ] Ducking automatico NON attivato - solo comunicazione DJ-to-DJ')
    
    // ✅ NEW: Invia comando PTT DJ ai client via DataChannel
    sendPTTDJCommandToClients(true)
  }

  const handlePTTDJRelease = () => {
    // ✅ NEW: Don't release PTT if we're navigating
    if (isNavigating) {
      console.log('🎤 [PTT DJ] Rilascio saltato - navigazione in corso')
      return
    }
    
    setIsPTTDJActive(false)
    console.log('🎤 [PTT DJ] Disattivato')
    // ✅ CRITICAL FIX: Disattiva il microfono quando si rilascia PTT DJ, ma solo se PTT Live non è attivo
    if (hostMicStreamRef.current) {
      hostMicStreamRef.current.getAudioTracks().forEach(track => {
        if (!isPTTLiveActive) {
        track.enabled = false
        console.log(`🎤 [PTT DJ] Track ${track.id} disabilitato`)
        } else {
          console.log(`🎤 [PTT DJ] Track ${track.id} mantenuto attivo per PTT Live`)
        }
      })
    }
    console.log('🎤 [PTT DJ] Microfono disattivato - solo WebRTC, NON live streaming')
    
    // ✅ NEW: Invia comando PTT DJ ai client via DataChannel
    sendPTTDJCommandToClients(false)
  }

  // ✅ NEW: PTT Live Functions
  const handlePTTLivePress = () => {
    // ✅ CRITICAL FIX: Se PTT DJ è attivo, disattivalo prima di attivare PTT Live
    if (isPTTDJActive) {
      console.log('📡 [PTT Live] Disattivando PTT DJ per attivare PTT Live')
      setIsPTTDJActive(false)
    }
    
    setIsPTTLiveActive(true)
    console.log('📡 [PTT Live] Attivato - Streaming Live + Ducking')
    // Attiva il microfono per streaming live
    if (hostMicStreamRef.current) {
      hostMicStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
        console.log(`📡 [PTT Live] Track ${track.id} abilitato`)
      })
    }
    // ✅ CRITICAL FIX: Attiva il sistema PTT dell'AudioContext per live streaming
    if (typeof (window as any).updatePTTVolumesOnly === 'function') {
      (window as any).updatePTTVolumesOnly(true).catch(console.error)
      console.log('📡 [PTT Live] Sistema PTT AudioContext attivato per live streaming')
    }
    // ✅ CRITICAL FIX: PTT Live usa solo il sistema PTT dell'AudioContext
    console.log('📡 [PTT Live] Ducking gestito dal sistema PTT AudioContext')
    // ✅ NEW: Invia comando ducking via DataChannel a tutti i client
    sendDuckingCommandToClients(true)
    // ✅ NEW: Invia comando PTT Live dell'host ai client
    sendHostPTTLiveCommandToClients(true)
  }

  const handlePTTLiveRelease = () => {
    // ✅ NEW: Don't release PTT if we're navigating
    if (isNavigating) {
      console.log('📡 [PTT Live] Rilascio saltato - navigazione in corso')
      return
    }
    
    setIsPTTLiveActive(false)
    console.log('📡 [PTT Live] Disattivato')
    // ✅ CRITICAL FIX: Disattiva il microfono quando si rilascia PTT Live, ma solo se PTT DJ non è attivo
    if (hostMicStreamRef.current) {
      hostMicStreamRef.current.getAudioTracks().forEach(track => {
        if (!isPTTDJActive) {
        track.enabled = false
        console.log(`📡 [PTT Live] Track ${track.id} disabilitato`)
        } else {
          console.log(`📡 [PTT Live] Track ${track.id} mantenuto attivo per PTT DJ`)
        }
      })
    }
    // ✅ CRITICAL FIX: Disattiva il sistema PTT dell'AudioContext
    if (typeof (window as any).updatePTTVolumesOnly === 'function') {
      (window as any).updatePTTVolumesOnly(false).catch(console.error)
      console.log('📡 [PTT Live] Sistema PTT AudioContext disattivato')
    }
    // ✅ CRITICAL FIX: PTT Live usa solo il sistema PTT dell'AudioContext
    console.log('📡 [PTT Live] Ducking gestito dal sistema PTT AudioContext')
    // ✅ NEW: Invia comando ducking via DataChannel a tutti i client
    sendDuckingCommandToClients(false)
    // ✅ NEW: Invia comando PTT Live dell'host ai client
    sendHostPTTLiveCommandToClients(false)
  }

  // ✅ NEW: Send ducking command to all clients via DataChannel
  const sendDuckingCommandToClients = (active: boolean) => {
    console.log(`📡 [DataChannel] Invio comando ducking: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
    
    const command = {
      type: 'ducking',
      active: active,
      timestamp: Date.now()
    }
    
    // Invia a tutti i client connessi tramite DataChannel
    // ✅ FIX: Usa peerConnectionsRef invece di remoteDJs
    peerConnectionsRef.current.forEach((peerConnection, clientId) => {
      if (clientId.includes('_dataChannel')) return // Skip dataChannel entries
      
      const dataChannel = peerConnectionsRef.current.get(`${clientId}_dataChannel`)
      if (dataChannel && dataChannel.readyState === 'open') {
        try {
          dataChannel.send(JSON.stringify(command))
          console.log(`📡 [DataChannel] Comando ducking inviato a ${clientId}`)
        } catch (error) {
          console.error(`📡 [DataChannel] Errore invio comando a ${clientId}:`, error)
        }
      } else {
        console.warn(`📡 [DataChannel] DataChannel non disponibile per ${clientId}`)
      }
    })
  }

  // ✅ NEW: Send host PTT Live command to all clients via DataChannel
  const sendHostPTTLiveCommandToClients = (active: boolean) => {
    console.log(`📡 [DataChannel] Invio comando host PTT Live: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
    
    const command = {
      type: 'hostPTTLive',
      active: active,
      timestamp: Date.now()
    }
    
    // Invia a tutti i client connessi tramite DataChannel
    peerConnectionsRef.current.forEach((peerConnection, clientId) => {
      if (clientId.includes('_dataChannel')) return // Skip dataChannel entries
      
      const dataChannel = peerConnectionsRef.current.get(`${clientId}_dataChannel`)
      if (dataChannel && dataChannel.readyState === 'open') {
        try {
          dataChannel.send(JSON.stringify(command))
          console.log(`📡 [DataChannel] Comando host PTT Live inviato a ${clientId}`)
    } catch (error) {
          console.error(`📡 [DataChannel] Errore invio comando host PTT Live a ${clientId}:`, error)
        }
      } else {
        console.warn(`📡 [DataChannel] DataChannel non disponibile per ${clientId}`)
      }
    })
  }

  // ✅ NEW: Send PTT DJ command to all clients via DataChannel
  const sendPTTDJCommandToClients = (active: boolean) => {
    console.log(`📡 [DataChannel] Invio comando PTT DJ: ${active ? 'ATTIVO' : 'DISATTIVO'}`)
    
    const command = {
      type: 'pttDJ',
      active: active,
      timestamp: Date.now()
    }
    
    // Invia a tutti i client connessi tramite DataChannel
    peerConnectionsRef.current.forEach((peerConnection, clientId) => {
      if (clientId.includes('_dataChannel')) return // Skip dataChannel entries
      
      const dataChannel = peerConnectionsRef.current.get(`${clientId}_dataChannel`)
      if (dataChannel && dataChannel.readyState === 'open') {
        try {
          dataChannel.send(JSON.stringify(command))
          console.log(`📡 [DataChannel] Comando PTT DJ inviato a ${clientId}`)
    } catch (error) {
          console.error(`📡 [DataChannel] Errore invio comando PTT DJ a ${clientId}:`, error)
        }
      } else {
        console.warn(`📡 [DataChannel] DataChannel non disponibile per ${clientId}`)
      }
    })
  }

  // ✅ NEW: PTT Live Audio Management Functions
  const pttLiveAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const pttLiveAudioChunksRef = useRef<Map<string, { chunks: Uint8Array[], totalChunks: number, totalSize: number, djName: string }>>(new Map())
  const pttLiveProcessingRef = useRef<Set<string>>(new Set()) // Coda per evitare sovrapposizioni

  const handlePTTLiveAudioFromClient = (clientId: string, djName: string, audioData: number[], audioSize: number) => {
    try {
      console.log(`🎤 [PTT Live Audio] Elaborazione audio da ${djName}: ${audioSize} bytes`)
      
      // Converte l'array di numeri in Uint8Array
      const uint8Array = new Uint8Array(audioData)
      
      // Crea un blob dall'audio ricevuto
      const audioBlob = new Blob([uint8Array], { type: 'audio/webm;codecs=opus' })
      
      // Crea un URL per il blob
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Crea un elemento audio per riprodurre l'audio PTT Live
      const audioElement = document.createElement('audio')
      audioElement.src = audioUrl
      audioElement.volume = 1.0 // Volume al 100% per l'audio PTT Live
      audioElement.style.display = 'none'
      document.body.appendChild(audioElement)
      
      // Salva l'elemento audio per cleanup successivo
      pttLiveAudioElementsRef.current.set(clientId, audioElement)
      
      // Gestisce la fine della riproduzione
      audioElement.onended = () => {
        console.log(`🎤 [PTT Live Audio] Riproduzione completata per ${djName}`)
        cleanupPTTLiveAudio(clientId)
      }
      
      // Gestisce errori di riproduzione
      audioElement.onerror = (error) => {
        console.error(`❌ [PTT Live Audio] Errore riproduzione audio per ${djName}:`, error)
        cleanupPTTLiveAudio(clientId)
      }
      
      // Avvia la riproduzione
      audioElement.play().then(() => {
        console.log(`🎤 [PTT Live Audio] Riproduzione avviata per ${djName}`)
        
        // ✅ CRITICAL: Aggiungi automaticamente l'audio PTT Live al destination stream
        addPTTLiveAudioToDestinationStream(audioElement, clientId, djName)
      }).catch(error => {
        console.error(`❌ [PTT Live Audio] Errore avvio riproduzione per ${djName}:`, error)
        cleanupPTTLiveAudio(clientId)
      })
      
    } catch (error) {
      console.error(`❌ [PTT Live Audio] Errore elaborazione audio da ${djName}:`, error)
    }
  }

  // ✅ NEW: Gestisci chunk audio PTT Live ricevuti dal client
  const handlePTTLiveAudioChunkFromClient = (clientId: string, djName: string, command: any) => {
    try {
      const { audioId, chunkIndex, totalChunks, chunkData, chunkSize, totalSize } = command
      
      // ✅ NEW: Controlla se questo audio è già in elaborazione
      if (pttLiveProcessingRef.current.has(audioId)) {
        console.log(`🎤 [PTT Live Audio Chunk] Audio ${audioId} già in elaborazione - ignoro chunk`)
        return
      }
      
      // Inizializza la struttura per questo audio se non esiste
      if (!pttLiveAudioChunksRef.current.has(audioId)) {
        pttLiveAudioChunksRef.current.set(audioId, {
          chunks: new Array(totalChunks),
          totalChunks: totalChunks,
          totalSize: totalSize,
          djName: djName
        })
        console.log(`🎤 [PTT Live Audio Chunk] Inizializzato buffer per audio ${audioId} da ${djName} (${totalChunks} chunk, ${totalSize} bytes)`)
      }
      
      // Salva il chunk nella posizione corretta
      const audioBuffer = pttLiveAudioChunksRef.current.get(audioId)!
      audioBuffer.chunks[chunkIndex] = new Uint8Array(chunkData)
      
      console.log(`🎤 [PTT Live Audio Chunk] Chunk ${chunkIndex + 1}/${totalChunks} salvato per audio ${audioId}`)
      
      // Controlla se tutti i chunk sono stati ricevuti
      const receivedChunks = audioBuffer.chunks.filter(chunk => chunk !== undefined).length
      if (receivedChunks === totalChunks) {
        console.log(`🎤 [PTT Live Audio Chunk] Tutti i chunk ricevuti per audio ${audioId} - ricostruzione audio`)
        
        // ✅ NEW: Aggiungi alla coda elaborazione
        pttLiveProcessingRef.current.add(audioId)
        
        // Ricostruisci l'audio completo
        const completeAudioData = new Uint8Array(totalSize)
        let offset = 0
        
        for (let i = 0; i < totalChunks; i++) {
          const chunk = audioBuffer.chunks[i]
          completeAudioData.set(chunk, offset)
          offset += chunk.length
        }
        
        console.log(`🎤 [PTT Live Audio Chunk] Audio ricostruito: ${completeAudioData.length} bytes`)
        
        // Elabora l'audio ricostruito
        processReconstructedAudio(clientId, djName, completeAudioData, totalSize)
        
        // Pulisci il buffer e rimuovi dalla coda
        pttLiveAudioChunksRef.current.delete(audioId)
        pttLiveProcessingRef.current.delete(audioId)
      }
      
    } catch (error) {
      console.error(`❌ [PTT Live Audio Chunk] Errore elaborazione chunk da ${djName}:`, error)
      // ✅ NEW: Rimuovi dalla coda in caso di errore
      const { audioId } = command
      if (audioId) {
        pttLiveProcessingRef.current.delete(audioId)
      }
    }
  }

  // ✅ NEW: Elabora l'audio ricostruito dai chunk
  const processReconstructedAudio = (clientId: string, djName: string, audioData: Uint8Array, audioSize: number) => {
    try {
      console.log(`🎤 [PTT Live Audio] Elaborazione audio ricostruito da ${djName}: ${audioSize} bytes`)
      
      // Crea un blob dall'audio ricostruito
      const audioBlob = new Blob([audioData], { type: 'audio/webm;codecs=opus' })
      
      // Crea un URL per il blob
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Crea un elemento audio per riprodurre l'audio PTT Live
      const audioElement = document.createElement('audio')
      audioElement.src = audioUrl
      audioElement.volume = 1.0 // Volume al 100% per l'audio PTT Live
      audioElement.style.display = 'none'
      document.body.appendChild(audioElement)
      
      // Salva l'elemento audio per cleanup successivo
      pttLiveAudioElementsRef.current.set(clientId, audioElement)
      
      // Gestisce la fine della riproduzione
      audioElement.onended = () => {
        console.log(`🎤 [PTT Live Audio] Riproduzione completata per ${djName}`)
        cleanupPTTLiveAudio(clientId)
      }
      
      // Gestisce errori di riproduzione
      audioElement.onerror = (error) => {
        console.error(`❌ [PTT Live Audio] Errore riproduzione audio per ${djName}:`, error)
        cleanupPTTLiveAudio(clientId)
      }
      
      // Avvia la riproduzione
      audioElement.play().then(() => {
        console.log(`🎤 [PTT Live Audio] Riproduzione avviata per ${djName}`)
        
        // ✅ CRITICAL: Aggiungi automaticamente l'audio PTT Live al destination stream
        addPTTLiveAudioToDestinationStream(audioElement, clientId, djName)
      }).catch(error => {
        console.error(`❌ [PTT Live Audio] Errore avvio riproduzione per ${djName}:`, error)
        cleanupPTTLiveAudio(clientId)
      })
      
    } catch (error) {
      console.error(`❌ [PTT Live Audio] Errore elaborazione audio ricostruito da ${djName}:`, error)
    }
  }

  const addPTTLiveAudioToDestinationStream = (audioElement: HTMLAudioElement, _clientId: string, djName: string) => {
    try {
      console.log(`🎤 [PTT Live Audio] Aggiunta al destination stream per ${djName}`)
      
      // Verifica che l'AudioContext e il destination stream siano disponibili
      const audioContext = (window as any).globalAudioContext
      const destinationStream = (window as any).destinationStream
      const mixerGain = (window as any).mixerGain
      
      if (!audioContext || !destinationStream || !mixerGain) {
        console.warn(`⚠️ [PTT Live Audio] AudioContext o destination stream non disponibili per ${djName}`)
        return
      }
      
      // ✅ NEW: Attiva ducking per l'audio PTT Live usando le impostazioni dell'host
      const duckingPercent = settings?.microphone?.duckingPercent ?? 75
      console.log(`🎤 [PTT Live Audio] Attivazione ducking per ${djName}: ${duckingPercent}%`)
      
      // Attiva il ducking globale per abbassare la musica
      if (typeof (window as any).updatePTTVolumesOnly === 'function') {
        (window as any).updatePTTVolumesOnly(true)
        console.log(`🎤 [PTT Live Audio] Ducking attivato per ${djName} - musica abbassata al ${100 - duckingPercent}%`)
      }
      
      // Crea un source node dall'elemento audio
      const sourceNode = audioContext.createMediaElementSource(audioElement)
      
      // ✅ CRITICAL FIX: Crea un gain node con volume fisso al 100% per evitare che il ducking influenzi l'audio PTT Live
      const gainNode = audioContext.createGain()
      gainNode.gain.setValueAtTime(1.0, audioContext.currentTime) // Volume fisso al 100%
      
      // ✅ CRITICAL FIX: Collega DIRETTAMENTE al destination stream, bypassando il mixer per evitare ducking
      sourceNode.connect(gainNode)
      gainNode.connect(destinationStream) // Collegamento diretto, non tramite mixerGain
      
      console.log(`✅ [PTT Live Audio] Audio PTT Live di ${djName} collegato DIRETTAMENTE al destination stream (bypass ducking)`)
      
      // Salva i riferimenti per cleanup
      ;(audioElement as any).pttLiveSourceNode = sourceNode
      ;(audioElement as any).pttLiveGainNode = gainNode
      
    } catch (error) {
      console.error(`❌ [PTT Live Audio] Errore aggiunta al destination stream per ${djName}:`, error)
    }
  }

  const cleanupPTTLiveAudio = (clientId: string) => {
    const audioElement = pttLiveAudioElementsRef.current.get(clientId)
    if (audioElement) {
      try {
        // ✅ NEW: Disattiva ducking quando l'audio PTT Live finisce
        console.log(`🎤 [PTT Live Audio] Disattivazione ducking per client ${clientId}`)
        if (typeof (window as any).updatePTTVolumesOnly === 'function') {
          (window as any).updatePTTVolumesOnly(false)
          console.log(`🎤 [PTT Live Audio] Ducking disattivato - musica ripristinata al 100%`)
        }
        
        // Pausa e pulisci l'elemento audio
        audioElement.pause()
        audioElement.src = ''
        
        // Cleanup dei nodi audio se esistono
        if ((audioElement as any).pttLiveSourceNode) {
          (audioElement as any).pttLiveSourceNode.disconnect()
        }
        if ((audioElement as any).pttLiveGainNode) {
          (audioElement as any).pttLiveGainNode.disconnect()
        }
        
        // Rimuovi dall'DOM
        if (audioElement.parentNode) {
          audioElement.parentNode.removeChild(audioElement)
        }
        
        // Revoca l'URL del blob
        if (audioElement.src) {
          URL.revokeObjectURL(audioElement.src)
        }
        
        // Rimuovi dalla mappa
        pttLiveAudioElementsRef.current.delete(clientId)
        
        console.log(`🧹 [PTT Live Audio] Cleanup completato per client ${clientId}`)
      } catch (error) {
        console.error(`❌ [PTT Live Audio] Errore cleanup per client ${clientId}:`, error)
      }
    }
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

    // Rimuovi stream audio
    removeRemoteDJStream(clientId)

    // ✅ NEW: Cleanup PTT Live state
    setClientsWithPTTLive(prev => {
      const newSet = new Set(prev)
      const hadPTTLive = newSet.has(clientId)
      newSet.delete(clientId)
      
      // Se questo client aveva PTT Live attivo e non ci sono più client attivi, disattiva PTT Live host
      if (hadPTTLive && newSet.size === 0) {
        console.log(`🎤 [PTT Live Client] Ultimo client PTT Live disconnesso - disattivazione PTT Live host`)
          if (typeof (window as any).updatePTTVolumesOnly === 'function') {
            (window as any).updatePTTVolumesOnly(false).catch(console.error)
          }
      }
      
      return newSet
    })

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
            
            if (status.clients.length > 0) {
              console.log(`🎤 [AutoDucking] Sistema automatico disattivato - ${status.clients.length} DJ connessi`)
              setTimeout(() => {
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

  useEffect(() => {
    let isRestoring = false // Flag per evitare riavvii multipli

    const handleWindowFocus = async () => {
      if (isRestoring) return // Evita riavvii multipli
      
      console.log('🔄 [RemoteDJHost] Finestra in focus - controllo stato server')
      
      // ✅ NEW: Set navigating state to prevent PTT disconnection
      setIsNavigating(true)
      
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
            
            if (status.clients.length > 0) {
              console.log('🔄 [RemoteDJHost] Finestra in focus - sistema automatico disattivato')
              
  // ✅ NEW: Restore host microphone stream when returning to page (only if needed)
  setTimeout(() => {
    // Only restore if no PTT is active and microphone might need restoration
    if (!isPTTDJActive && !isPTTLiveActive) {
      restoreHostMicrophoneStream()
    } else {
      console.log('ℹ️ [RemoteDJHost] PTT attivo, ripristino microfono saltato per evitare interferenze')
    }
  }, 1000) // Small delay to ensure page is fully loaded
              
              isRestoring = true
              setTimeout(() => {
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
      
      // ✅ NEW: Clear navigating state after a delay
      setTimeout(() => {
        setIsNavigating(false)
        console.log('🔄 [RemoteDJHost] Stato navigazione resettato')
      }, 2000) // 2 second delay to ensure all navigation events are complete
    }

    const handleVisibilityChange = async () => {
      if (document.hidden || isRestoring) return // Evita riavvii multipli
      
      console.log('🔄 [RemoteDJHost] Pagina visibile - controllo stato server')
      
      // ✅ NEW: Set navigating state to prevent PTT disconnection
      setIsNavigating(true)
      
      // Controlla lo stato del server quando la pagina torna visibile
      if (window.electronAPI?.webrtcServerAPI) {
        try {
          const status = await window.electronAPI.webrtcServerAPI.checkServerStatus()
          if (status.success && status.isRunning) {
            console.log('✅ [RemoteDJHost] Server ancora attivo dopo visibility change')
            if (status.clients.length > 0) {
              console.log('🔄 [RemoteDJHost] Pagina visibile - sistema automatico disattivato')
              
  // ✅ NEW: Restore host microphone stream when page becomes visible (only if needed)
  setTimeout(() => {
    // Only restore if no PTT is active and microphone might need restoration
    if (!isPTTDJActive && !isPTTLiveActive) {
      restoreHostMicrophoneStream()
    } else {
      console.log('ℹ️ [RemoteDJHost] PTT attivo, ripristino microfono saltato per evitare interferenze')
    }
  }, 1000) // Small delay to ensure page is fully loaded
              
              isRestoring = true
              setTimeout(() => {
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
      
      // ✅ NEW: Clear navigating state after a delay
      setTimeout(() => {
        setIsNavigating(false)
        console.log('🔄 [RemoteDJHost] Stato navigazione resettato (visibility)')
      }, 2000) // 2 second delay to ensure all navigation events are complete
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isServerRunning, connectedDJs.length])

  useEffect(() => {
    if (connectedDJs.length > 0) {
      console.log(`🎤 [AutoDucking] ${connectedDJs.length} DJ connessi - SISTEMA AUTOMATICO DISATTIVATO`)
      console.log(`🎤 [AutoDucking] Usare PTT DJ o PTT Live per attivare ducking manualmente`)
    } else {
      console.log('🎤 [AutoDucking] Nessun DJ connesso - SISTEMA AUTOMATICO DISATTIVATO')
      
      // Pulisci il microfono host quando non ci sono più client
      if (hostMicStreamRef.current) {
        hostMicStreamRef.current.getTracks().forEach(track => track.stop())
        hostMicStreamRef.current = null
        console.log('🎤 [RemoteDJHost] Microfono host pulito - nessun client connesso')
      }
    }

    // ✅ CRITICAL FIX: Cleanup semplificato - sistema automatico disattivato
    return () => {
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
        <div className="flex items-center space-x-3">
        <h2 className="text-xl font-bold text-white">🎤 DJ Remoti</h2>
          {clientsWithPTTLive.size > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-red-600 rounded-full animate-pulse">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-ping"></span>
              <span className="text-white text-sm font-medium">
                🔴 LIVE ({clientsWithPTTLive.size} client{clientsWithPTTLive.size > 1 ? 'i' : ''})
              </span>
            </div>
          )}
        </div>
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
              {/* PTT DJ-to-DJ Button */}
              <button
                tabIndex={0}
                onMouseDown={handlePTTDJPress}
                onMouseUp={(e) => {
                  // Only release if we're not navigating
                  if (!isNavigating) {
                    handlePTTDJRelease()
                  } else {
                    console.log('🎤 [PTT DJ] MouseUp saltato - navigazione in corso')
                  }
                }}
                onTouchStart={handlePTTDJPress}
                onTouchEnd={(e) => {
                  // Only release if we're not navigating
                  if (!isNavigating) {
                    handlePTTDJRelease()
                  } else {
                    console.log('🎤 [PTT DJ] TouchEnd saltato - navigazione in corso')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    handlePTTDJPress()
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    if (!isNavigating) {
                      handlePTTDJRelease()
                    } else {
                      console.log('🎤 [PTT DJ] KeyUp saltato - navigazione in corso')
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  // Only release if the mouse actually left the button area
                  // and we're not in the middle of a page navigation
                  if (!isNavigating && (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget as Node))) {
                    handlePTTDJRelease()
                  } else if (isNavigating) {
                    console.log('🎤 [PTT DJ] MouseLeave saltato - navigazione in corso')
                  }
                }}
                className={`${isPTTDJActive ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium py-2 px-4 rounded-md transition-all duration-200 relative`}
              >
                {isPTTDJActive && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></span>
                )}
                {isPTTDJActive ? '🎤 PTT DJ 🔴 LIVE' : '🎤 PTT DJ'}
              </button>
              
              {/* PTT Live Button */}
              <button
                tabIndex={0}
                onMouseDown={handlePTTLivePress}
                onMouseUp={(e) => {
                  // Only release if we're not navigating
                  if (!isNavigating) {
                    handlePTTLiveRelease()
                  } else {
                    console.log('📡 [PTT Live] MouseUp saltato - navigazione in corso')
                  }
                }}
                onTouchStart={handlePTTLivePress}
                onTouchEnd={(e) => {
                  // Only release if we're not navigating
                  if (!isNavigating) {
                    handlePTTLiveRelease()
                  } else {
                    console.log('📡 [PTT Live] TouchEnd saltato - navigazione in corso')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    handlePTTLivePress()
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    if (!isNavigating) {
                      handlePTTLiveRelease()
                    } else {
                      console.log('📡 [PTT Live] KeyUp saltato - navigazione in corso')
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  // Only release if the mouse actually left the button area
                  // and we're not in the middle of a page navigation
                  if (!isNavigating && (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget as Node))) {
                    handlePTTLiveRelease()
                  } else if (isNavigating) {
                    console.log('📡 [PTT Live] MouseLeave saltato - navigazione in corso')
                  }
                }}
                className={`${isPTTLiveActive ? 'bg-orange-600 hover:bg-orange-700 animate-pulse' : 'bg-red-600 hover:bg-red-700'} text-white font-medium py-2 px-4 rounded-md transition-all duration-200 relative`}
              >
                {isPTTLiveActive && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-ping"></span>
                )}
                {isPTTLiveActive ? '📡 PTT Live 🔴 LIVE' : '📡 PTT Live'}
              </button>
              <button
                onClick={stopServer}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                🛑 Ferma Server
              </button>
              
              {/* ✅ NEW: Host Microphone Restoration Indicator */}
              {isRestoringHostMic && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-600 text-white rounded-md">
                  <div className="animate-spin">🔄</div>
                  <span className="text-sm font-medium">Ripristino microfono...</span>
                </div>
              )}
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
                    <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-white">{dj.djName}</h4>
                      {clientsWithPTTLive.has(dj.id) && (
                        <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium animate-pulse">
                          🔴 LIVE
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-dj-light">
                      IP: {dj.ip} | Connesso: {dj.connectedAt ? dj.connectedAt.toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* Volume Control */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-dj-light">Vol:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={dj.volume * 100}
                        onChange={(e) => setRemoteDJVolume(dj.id, parseFloat(e.target.value) / 100)}
                        className="w-16 h-1 bg-dj-light rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${dj.volume * 100}%, #374151 ${dj.volume * 100}%, #374151 100%)`
                        }}
                      />
                      <span className="text-xs text-dj-light w-8">
                        {Math.round(dj.volume * 100)}%
                      </span>
                    </div>
                    
                    {/* Disconnect Button */}
                    <button
                      onClick={() => disconnectDJ(dj.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                      title="Disconnetti DJ"
                    >
                      🔌
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  
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

