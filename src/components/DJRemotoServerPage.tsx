import React, { useState, useEffect, useRef } from 'react'
import DJChat from './DJChat'
import ConnectionCode from './ConnectionCode'
import { useAudio } from '../contexts/AudioContext'
import { useSettings } from '../contexts/SettingsContext'
import { useDJRemotoServer } from '../contexts/DJRemotoServerContext'
import { getDJColor, releaseDJColor } from '../utils/djColors'

interface ConnectedDJ {
  id: string
  djName: string
  ip: string
  connectedAt: Date
  audioLevel: number
  isMuted: boolean
  volume: number
  color?: string // ✅ NEW: Colore del DJ
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

const DJRemotoServerPage: React.FC = () => {
  // ✅ CRITICAL FIX: Controlla se il pannello è stato chiuso manualmente
  if ((window as any).__djRemotoServerWasManuallyClosed__) {
    console.log('🔄 [DJRemotoServerPage] Pannello chiuso manualmente - componente non renderizzato')
    return null
  }
  
  const { settings } = useSettings()
  const settingsRef = useRef(settings)
  
  // ✅ CRITICAL FIX: Reset completo dello stato quando il componente viene montato dopo chiusura manuale
  const [hasBeenReset, setHasBeenReset] = useState(false)
  
  // Aggiorna il ref quando le impostazioni cambiano
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  
  // ✅ CRITICAL FIX: Reset completo dello stato quando il componente viene montato
  useEffect(() => {
    if (!hasBeenReset) {
      console.log('🔄 [DJRemotoServerPage] Reset completo stato pannello - stato vergine')
      
      // Reset completo di tutti gli stati
      setIsServerRunning(false)
      setServerInfo(null)
      setConnectedDJs([])
      setChatMessages([])
      setIsPTTDJActive(false)
      setIsPTTLiveActive(false)
      setClientsWithPTTLive(new Set())
      setIsStarting(false)
      
      // Reset dei ref
      hostMicStreamRef.current = null
      peerConnectionsRef.current.clear()
      
      // Reset flag di navigazione
      wasManuallyClosedRef.current = false
      
      setHasBeenReset(true)
      console.log('✅ [DJRemotoServerPage] Reset completo completato - pannello in stato vergine')
    }
  }, [hasBeenReset])
  
  // ✅ CRITICAL FIX: Inizializzazione stati sempre a stato vergine
  const [isServerRunning, setIsServerRunning] = useState(false)
  const [serverInfo, setServerInfo] = useState<any>(null)
  const [connectedDJs, setConnectedDJs] = useState<ConnectedDJ[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isPTTDJActive, setIsPTTDJActive] = useState(false)
  const [isPTTLiveActive, setIsPTTLiveActive] = useState(false)

  // ✅ NEW: Minimize state from context
  const { showPanel, isMinimized, setIsMinimized, setShowPanel } = useDJRemotoServer()

  // ✅ NEW: Track which clients have PTT Live active
  const [clientsWithPTTLive, setClientsWithPTTLive] = useState<Set<string>>(new Set())
  
  // ✅ NEW: Track which clients have PTT DJ active
  const [clientsWithPTTDJ, setClientsWithPTTDJ] = useState<Set<string>>(new Set())

  const { addRemoteDJStream, removeRemoteDJStream, setRemoteDJVolume } = useAudio()
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const hostMicStreamRef = useRef<MediaStream | null>(null)
  
  // ✅ NEW: Host microphone restoration state
  // ✅ REMOVED: isRestoringHostMic state - no longer needed
  
  // ✅ NEW: Navigation state to prevent PTT disconnection during page changes
  const [isNavigating, setIsNavigating] = useState(false)

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]

  // ✅ CRITICAL FIX: Funzioni per aggiornare e salvare lo stato in sessionStorage
  const updateServerRunning = (running: boolean) => {
    setIsServerRunning(running)
    sessionStorage.setItem('djRemotoServer_isRunning', running.toString())
  }

  const updateServerInfo = (info: any) => {
    setServerInfo(info)
    sessionStorage.setItem('djRemotoServer_info', JSON.stringify(info))
  }

  const updateConnectedDJs = (djs: ConnectedDJ[] | ((prev: ConnectedDJ[]) => ConnectedDJ[])) => {
    setConnectedDJs(prev => {
      const newDJs = typeof djs === 'function' ? djs(prev) : djs
      sessionStorage.setItem('djRemotoServer_connectedDJs', JSON.stringify(newDJs))
      return newDJs
    })
  }

  const updateChatMessages = (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setChatMessages(prev => {
      const newMessages = typeof messages === 'function' ? messages(prev) : messages
      sessionStorage.setItem('djRemotoServer_chatMessages', JSON.stringify(newMessages))
      return newMessages
    })
  }

  const updatePTTDJActive = (active: boolean) => {
    setIsPTTDJActive(active)
    sessionStorage.setItem('djRemotoServer_pttDJActive', active.toString())
  }

  const updatePTTLiveActive = (active: boolean) => {
    setIsPTTLiveActive(active)
    sessionStorage.setItem('djRemotoServer_pttLiveActive', active.toString())
  }

  // ✅ REMOVED: updateMinimized - now handled by context

  // ✅ NEW: Flag per prevenire loop infinito di chiusura
  const isClosingRef = useRef(false)
  
  // ✅ NEW: Flag per prevenire riavvio automatico dopo chiusura intenzionale
  const wasManuallyClosedRef = useRef(false)
  
  // ✅ NEW: Funzione per chiudere il pannello e disconnettere tutto
  const handleClosePanel = async () => {
    // ✅ CRITICAL FIX: Prevenire loop infinito di chiusura
    if (isClosingRef.current) {
      console.log('🔄 [DJRemotoServerPage] Chiusura già in corso, ignorando chiamata duplicata')
      return
    }
    
    isClosingRef.current = true
    wasManuallyClosedRef.current = true
    // ✅ CRITICAL FIX: Imposta flag globale per prevenire riavvio automatico
    ;(window as any).__djRemotoServerWasManuallyClosed__ = true
    console.log('🔄 [DJRemotoServerPage] Inizio chiusura pannello e disconnessione completa')
    
    try {
      // 1. Disattiva PTT se attivo
      if (isPTTDJActive) {
        console.log('🔄 [DJRemotoServerPage] Disattivazione PTT DJ')
        updatePTTDJActive(false)
        if (hostMicStreamRef.current) {
          hostMicStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = false
          })
        }
      }
      
      if (isPTTLiveActive) {
        console.log('🔄 [DJRemotoServerPage] Disattivazione PTT Live')
        updatePTTLiveActive(false)
        if (hostMicStreamRef.current) {
          hostMicStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = false
          })
        }
        // Disattiva anche il sistema PTT dell'AudioContext
        if (typeof (window as any).updatePTTVolumesOnly === 'function') {
          (window as any).updatePTTVolumesOnly(false).catch(console.error)
        }
      }
      
      // 2. Ferma il server se attivo
      if (isServerRunning) {
        console.log('🔄 [DJRemotoServerPage] Fermata server')
        await stopServer()
      } else {
        // ✅ CRITICAL FIX: Ferma il server anche se non sembra attivo per sicurezza
        console.log('🔄 [DJRemotoServerPage] Fermata server per sicurezza')
        try {
          if ((window as any).electronAPI?.webrtcServerAPI) {
            await (window as any).electronAPI.webrtcServerAPI.stopServer()
            console.log('✅ [DJRemotoServerPage] Server fermato per sicurezza')
          }
        } catch (error) {
          console.log('ℹ️ [DJRemotoServerPage] Server già fermato o non attivo')
        }
      }
      
      // ✅ CRITICAL FIX: Forza la fermata completa del server per evitare sessioni persistenti
      console.log('🔄 [DJRemotoServerPage] Forzatura fermata completa server')
      try {
        if ((window as any).electronAPI?.webrtcServerAPI) {
          await (window as any).electronAPI.webrtcServerAPI.stopServer()
          console.log('✅ [DJRemotoServerPage] Server fermato completamente')
        }
      } catch (error) {
        console.log('⚠️ [DJRemotoServerPage] Errore fermata completa server:', error)
      }
      
      // 3. Disconnetti tutti i client
      if (connectedDJs.length > 0) {
        console.log('🔄 [DJRemotoServerPage] Disconnessione client:', connectedDJs.length)
        connectedDJs.forEach(dj => {
          disconnectDJ(dj.id)
        })
      }
      
      // 4. Pulisci tutti i riferimenti
      hostMicStreamRef.current = null
      peerConnectionsRef.current.clear()
      
      // 5. Reset stato locale PRIMA di rimuovere sessionStorage
      console.log('🔄 [DJRemotoServerPage] Reset stato locale')
      updateServerRunning(false)
      updateServerInfo(null)
      updateConnectedDJs([])
      updateChatMessages([])
      updatePTTDJActive(false)
      updatePTTLiveActive(false)
      
      // 6. Svuota IMMEDIATAMENTE la sessione PRIMA di chiudere il pannello
      console.log('🔄 [DJRemotoServerPage] Svuotamento sessione IMMEDIATO')
      sessionStorage.removeItem('djRemotoServer_showPanel')
      sessionStorage.removeItem('djRemotoServer_minimized')
      sessionStorage.removeItem('djRemotoServer_isRunning')
      sessionStorage.removeItem('djRemotoServer_info')
      sessionStorage.removeItem('djRemotoServer_connectedDJs')
      sessionStorage.removeItem('djRemotoServer_chatMessages')
      sessionStorage.removeItem('djRemotoServer_pttDJActive')
      sessionStorage.removeItem('djRemotoServer_pttLiveActive')
      console.log('✅ [DJRemotoServerPage] SessionStorage svuotato')
      
           // 7. Chiudi il pannello DOPO aver svuotato la sessione
           console.log('🔄 [DJRemotoServerPage] Chiusura pannello')
           setShowPanel(false)
           setIsMinimized(false)
           
           // ✅ CRITICAL FIX: Reset del flag del context per nascondere il pallino
           ;(window as any).__djRemotoServerWasManuallyClosed__ = true
      
      console.log('✅ [DJRemotoServerPage] Chiusura pannello completata')
      
    } catch (error) {
      console.error('❌ [DJRemotoServerPage] Errore durante chiusura pannello:', error)
    } finally {
      // ✅ CRITICAL FIX: Reset del flag per permettere future chiusure con delay
      setTimeout(() => {
        console.log('🔄 [DJRemotoServerPage] Reset flag isClosingRef - chiusura completata')
        isClosingRef.current = false
      }, 200)
    }
  }

  // ✅ REMOVED: Function to restore host microphone stream - causing conflicts
  // Il ripristino automatico del microfono causava interferenze con il PTT
  // Il microfono viene gestito direttamente dalle funzioni PTT

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


  // Funzioni per gestire WebRTC e audio mixing
  const handleWebRTCOffer = async (data: any, currentSettings: any) => {
    const { clientId, djName, sdp } = data
    console.log(`🎵 [RemoteDJHost] Gestione WebRTC Offer da ${djName}`)
    
    // Debug: verifica le impostazioni correnti
    console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: Impostazioni correnti in handleWebRTCOffer:`)
    console.log(`🎤 [RemoteDJHost] 🔍 DEBUG: currentSettings.microphone?.inputDevice:`, currentSettings.microphone?.inputDevice)

    try {
      // ✅ CRITICAL FIX: Check if we already have a connection for this client
      const existingConnection = peerConnectionsRef.current.get(clientId)
      if (existingConnection) {
        console.log(`🎵 [RemoteDJHost] Existing connection found for ${djName}, checking state...`)
        console.log(`🎵 [RemoteDJHost] Current signaling state:`, existingConnection.signalingState)
        console.log(`🎵 [RemoteDJHost] Current connection state:`, existingConnection.connectionState)
        
        // ✅ CRITICAL FIX: Permetti rinegoziazione durante cambi microfono
        // Se siamo in 'have-local-offer' potrebbe essere una rinegoziazione necessaria per cambio microfono
        if (existingConnection.signalingState === 'stable') {
          console.warn(`⚠️ [RemoteDJHost] Ignoring offer from ${djName} - connection already stable`)
          return
        } else if (existingConnection.signalingState === 'have-local-offer') {
          console.log(`🔄 [RemoteDJHost] Stato 'have-local-offer' rilevato - potrebbe essere rinegoziazione per cambio microfono`)
          console.log(`🔄 [RemoteDJHost] Permettendo rinegoziazione con ${djName}`)
          // Resetta la connessione per permettere la rinegoziazione pulita
          existingConnection.close()
          peerConnectionsRef.current.delete(clientId)
          peerConnectionsRef.current.delete(`${clientId}_dataChannel`)
          console.log(`🔄 [RemoteDJHost] Connessione esistente chiusa per rinegoziazione pulita`)
        } else if (existingConnection.signalingState === 'have-remote-offer') {
          console.warn(`⚠️ [RemoteDJHost] Ignoring offer from ${djName} - already processing remote offer`)
          return
        }
      }
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
              } else if (command.type === 'pttDJ') {
                console.log(`📡 [DataChannel] PTT DJ ${command.active ? 'attivato' : 'disattivato'} da ${djName}`)
                // ✅ NEW: Update client PTT DJ state
                updateConnectedDJs(prev => prev.map(dj => 
                  dj.id === clientId 
                    ? { ...dj, isPTTDJActive: command.active }
                    : dj
                ))
                
                // ✅ NEW: Update clients with PTT DJ active
                if (command.active) {
                  setClientsWithPTTDJ(prev => new Set([...prev, clientId]))
                  console.log(`🎤 [PTT DJ Client] Client ${djName} aggiunto alla lista PTT DJ attivi`)
                } else {
                  setClientsWithPTTDJ(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(clientId)
                    return newSet
                  })
                  console.log(`🎤 [PTT DJ Client] Client ${djName} rimosso dalla lista PTT DJ attivi`)
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
                  
                  // ✅ STEP 2: ATTIVA l'audio del client nel live streaming (volume 1)
                  // Lo stream è già stato aggiunto automaticamente alla connessione con volume 0
                  setRemoteDJVolume(clientId, 1.0)
                  console.log(`🎤 [PTT Live Client] Audio del client ${djName} attivato nel live streaming (volume 100%)`)
                  
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
                  
                  // ✅ STEP 2: DISATTIVA l'audio del client nel live streaming (volume 0) invece di rimuovere lo stream
                  setRemoteDJVolume(clientId, 0)
                  console.log(`🎤 [PTT Live Client] Audio del client ${djName} disattivato nel live streaming (volume 0)`)
                  
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
          if (event.candidate && (window as any).electronAPI?.webrtcServerAPI) {
            console.log(`🧊 [RemoteDJHost] Invio ICE candidate per ${djName}`)
            // Invia ICE candidate al client tramite il server
            ;(window as any).electronAPI.webrtcServerAPI.sendICECandidate({ clientId, candidate: event.candidate })
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

        // ✅ CRITICAL FIX: Add connection state change handler
        peerConnection.onconnectionstatechange = () => {
          console.log(`🎵 [RemoteDJHost] Connection state changed for ${djName}:`, peerConnection.connectionState)
          if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            console.warn(`⚠️ [RemoteDJHost] Connection failed/disconnected for ${djName}, cleaning up...`)
            // Clean up the connection
            peerConnection.close()
            peerConnectionsRef.current.delete(clientId)
          }
        }

        // ✅ CRITICAL FIX: Add signaling state change handler
        peerConnection.onsignalingstatechange = () => {
          console.log(`🎵 [RemoteDJHost] Signaling state changed for ${djName}:`, peerConnection.signalingState)
        }

        peerConnectionsRef.current.set(clientId, peerConnection)
      }

      const peerConnection = peerConnectionsRef.current.get(clientId)!
      
      // ✅ CRITICAL FIX: Check if we already have a remote description
      if (peerConnection.remoteDescription) {
        console.warn(`⚠️ [RemoteDJHost] Remote description already set for ${djName}, ignoring duplicate offer`)
        return
      }
      
      // Imposta remote description
      console.log(`🎵 [RemoteDJHost] SDP ricevuto:`, sdp)
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
      console.log(`✅ [RemoteDJHost] Remote description set for ${djName}`)
      
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
            } catch (specificDeviceError: any) {
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

      // ✅ CRITICAL FIX: Check connection state before creating answer
      console.log(`🎵 [RemoteDJHost] Connection state before createAnswer:`, peerConnection.connectionState)
      console.log(`🎵 [RemoteDJHost] Signaling state before createAnswer:`, peerConnection.signalingState)
      
      // Only create answer if we're in the correct state
      if (peerConnection.signalingState === 'have-remote-offer') {
        console.log(`🎵 [RemoteDJHost] Creating answer for ${djName}...`)
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        console.log(`✅ [RemoteDJHost] Answer created and set for ${djName}`)
      } else {
        console.warn(`⚠️ [RemoteDJHost] Cannot create answer for ${djName} - signaling state: ${peerConnection.signalingState}`)
        return // Exit early if we can't create an answer
      }
      
      if ((window as any).electronAPI?.webrtcServerAPI) {
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
        
        // ✅ CRITICAL FIX: Only send answer if we successfully created one
        if (peerConnection.localDescription) {
          ;(window as any).electronAPI.webrtcServerAPI.sendWebRTCAnswer({ clientId, sdp: peerConnection.localDescription.sdp })
          console.log(`✅ [RemoteDJHost] WebRTC Answer sent to ${djName}`)
        } else {
          console.error(`❌ [RemoteDJHost] No local description available to send to ${djName}`)
        }
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
      
      
      // ✅ CRITICAL FIX: Aggiungi automaticamente al live streaming ma con volume 0 (silenzioso)
      // Lo stream sarà disponibile per PTT Live ma silenzioso fino all'attivazione
      addRemoteDJStream(clientId, stream)
      setRemoteDJVolume(clientId, 0) // Volume 0 = silenzioso
      console.log(`🎵 [RemoteDJHost] Stream del client ${clientId} aggiunto al live streaming con volume 0 (silenzioso)`)
      
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
    console.log('🎤 [PTT DJ] PRESS - Inizio attivazione PTT DJ')
    console.log('🎤 [PTT DJ] DEBUG - Server attivo:', isServerRunning)
    console.log('🎤 [PTT DJ] DEBUG - Client connessi:', connectedDJs.length)
    console.log('🎤 [PTT DJ] DEBUG - Stream microfono:', !!hostMicStreamRef.current)
    
    // ✅ CRITICAL FIX: Se PTT Live è attivo, disattivalo prima di attivare PTT DJ
    if (isPTTLiveActive) {
      console.log('🎤 [PTT DJ] Disattivando PTT Live per attivare PTT DJ')
      updatePTTLiveActive(false)
      // ✅ CRITICAL FIX: PTT DJ NON deve toccare il volume del live stream
      // ✅ CRITICAL FIX: PTT Live usa solo il sistema PTT dell'AudioContext
      console.log('🎤 [PTT DJ] Ducking gestito dal sistema PTT AudioContext')
      // Invia comando ducking via DataChannel a tutti i client
      sendDuckingCommandToClients(false)
    }
    
    // ✅ CRITICAL FIX: Ricrea il microfono host se è null
    if (!hostMicStreamRef.current) {
      console.log('🎤 [PTT DJ] Microfono host null, ricreazione...')
      createHostMicrophone()
    }

    updatePTTDJActive(true)
    console.log('🎤 [PTT DJ] Attivato - Comunicazione DJ-to-DJ (NON live streaming)')
    // ✅ CRITICAL FIX: PTT DJ deve attivare il microfono per comunicazione DJ-to-DJ
    if (hostMicStreamRef.current) {
      hostMicStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
        console.log(`🎤 [PTT DJ] Track ${track.id} abilitato per comunicazione DJ-to-DJ`)
      })
    } else {
      console.error('❌ [PTT DJ] ERRORE: hostMicStreamRef.current è ancora null dopo ricreazione!')
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
    
    updatePTTDJActive(false)
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
    console.log('📡 [PTT Live] PRESS - Inizio attivazione PTT Live')
    console.log('📡 [PTT Live] DEBUG - Server attivo:', isServerRunning)
    console.log('📡 [PTT Live] DEBUG - Client connessi:', connectedDJs.length)
    console.log('📡 [PTT Live] DEBUG - Stream microfono:', !!hostMicStreamRef.current)
    
    // ✅ CRITICAL FIX: Se PTT DJ è attivo, disattivalo prima di attivare PTT Live
    if (isPTTDJActive) {
      console.log('📡 [PTT Live] Disattivando PTT DJ per attivare PTT Live')
      updatePTTDJActive(false)
    }
    
    // ✅ CRITICAL FIX: Ricrea il microfono host se è null
    if (!hostMicStreamRef.current) {
      console.log('📡 [PTT Live] Microfono host null, ricreazione...')
      createHostMicrophone()
    }

    updatePTTLiveActive(true)
    console.log('📡 [PTT Live] Attivato - Streaming Live + Ducking')
    
    // ✅ CRITICAL FIX: Imposta il flag globale PTT per l'AudioMixer
    ;(window as any).__pttActive__ = true
    console.log('📡 [PTT Live] Flag __pttActive__ impostato a true per AudioMixer')
    
    // Attiva il microfono per streaming live
    if (hostMicStreamRef.current) {
      hostMicStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
        console.log(`📡 [PTT Live] Track ${track.id} abilitato`)
      })
    } else {
      console.error('❌ [PTT Live] ERRORE: hostMicStreamRef.current è ancora null dopo ricreazione!')
    }
    // ✅ CRITICAL FIX: Attiva il sistema PTT dell'AudioContext per live streaming
    if (typeof (window as any).updatePTTVolumesOnly === 'function') {
      (window as any).updatePTTVolumesOnly(true).catch(console.error)
      console.log('📡 [PTT Live] Sistema PTT AudioContext attivato per live streaming')
    } else {
      console.error('❌ [PTT Live] ERRORE: updatePTTVolumesOnly non disponibile!')
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
    
    updatePTTLiveActive(false)
    console.log('📡 [PTT Live] Disattivato')
    
    // ✅ CRITICAL FIX: Reset del flag globale PTT per l'AudioMixer
    ;(window as any).__pttActive__ = false
    console.log('📡 [PTT Live] Flag __pttActive__ impostato a false per AudioMixer')
    
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
    
    // ✅ DEBUG: Controlla stato DataChannel references
    console.log(`🔍 [DataChannel DEBUG] Connessioni totali: ${peerConnectionsRef.current.size}`)
    Array.from(peerConnectionsRef.current.keys()).forEach(key => {
      console.log(`🔍 [DataChannel DEBUG] Key: ${key}`)
    })
    
    // Invia a tutti i client connessi tramite DataChannel
    // ✅ FIX: Usa peerConnectionsRef invece di remoteDJs
    peerConnectionsRef.current.forEach((_peerConnection, clientId) => {
      if (clientId.includes('_dataChannel')) return // Skip dataChannel entries
      
      const dataChannelKey = `${clientId}_dataChannel`
      const dataChannel = peerConnectionsRef.current.get(dataChannelKey) as unknown as RTCDataChannel
      
      console.log(`🔍 [DataChannel DEBUG] Client: ${clientId}, DataChannel key: ${dataChannelKey}`)
      console.log(`🔍 [DataChannel DEBUG] DataChannel exists: ${!!dataChannel}`)
      if (dataChannel) {
        console.log(`🔍 [DataChannel DEBUG] DataChannel readyState: ${dataChannel.readyState}`)
      }
      
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
    peerConnectionsRef.current.forEach((_peerConnection, clientId) => {
      if (clientId.includes('_dataChannel')) return // Skip dataChannel entries
      
      const dataChannel = peerConnectionsRef.current.get(`${clientId}_dataChannel`) as unknown as RTCDataChannel
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
    peerConnectionsRef.current.forEach((_peerConnection, clientId) => {
      if (clientId.includes('_dataChannel')) return // Skip dataChannel entries
      
      const dataChannel = peerConnectionsRef.current.get(`${clientId}_dataChannel`) as unknown as RTCDataChannel
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
      
      // ✅ FIX: NON riprodurre l'audio registrato - usa solo lo streaming live
      // audioElement.play().then(() => {
      //   console.log(`🎤 [PTT Live Audio] Riproduzione avviata per ${djName}`)
      //   
      //   // ✅ CRITICAL: Aggiungi automaticamente l'audio PTT Live al destination stream
      //   addPTTLiveAudioToDestinationStream(audioElement, clientId, djName)
      // }).catch(error => {
      //   console.error(`❌ [PTT Live Audio] Errore avvio riproduzione per ${djName}:`, error)
      //   cleanupPTTLiveAudio(clientId)
      // })
      
      // ✅ FIX: Pulisci immediatamente l'audio registrato per evitare doppia riproduzione
      console.log(`🎤 [PTT Live Audio] Audio registrato ignorato per ${djName} - uso solo streaming live`)
      cleanupPTTLiveAudio(clientId)
      
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
    updateConnectedDJs(connectedDJs.map(dj => 
      dj.id === clientId 
        ? { ...dj, volume: volume }
        : dj
    ))
    
    console.log(`🔊 [RemoteDJHost] Volume DJ ${clientId} impostato a ${Math.round(volume * 100)}%`)
  }

  const disconnectDJ = (clientId: string) => {
    // ✅ NEW: Trova il DJ per liberare il colore
    const dj = connectedDJs.find(d => d.id === clientId)
    if (dj) {
      releaseDJColor(dj.djName)
    }

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

    // ✅ NEW: Cleanup PTT DJ state
    setClientsWithPTTDJ(prev => {
      const newSet = new Set(prev)
      newSet.delete(clientId)
      return newSet
    })
    
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
    updateConnectedDJs(connectedDJs.filter(dj => dj.id !== clientId))
    
    console.log(`🔌 [RemoteDJHost] DJ ${clientId} disconnesso`)
  }


  const addChatMessage = (djName: string, message: string, isSystem: boolean = false) => {
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      djName,
      message,
      timestamp: new Date(),
      isSystem
    }
    
    // ✅ PERFORMANCE: Limita a 50 messaggi massimi per evitare memory leaks
    updateChatMessages(prev => {
      const updatedMessages = [...prev, newMessage]
      return updatedMessages.slice(-50) // Mantieni solo gli ultimi 50 messaggi
    })
  }

  const handleSendChatMessage = (message: string) => {
    if (!message.trim()) return

    // ✅ FIX: NON aggiungere il messaggio localmente - verrà aggiunto dal WebSocket
    // addChatMessage('Host', message) // RIMOSSO - causa duplicazione

    // Invia il messaggio a tutti i DJ connessi
    if ((window as any).electronAPI?.webrtcServerAPI) {
      ;(window as any).electronAPI.webrtcServerAPI.sendHostMessage(message)
      console.log('💬 [RemoteDJHost] Messaggio chat inviato:', message)
    }
  }

  // 🌐 TUNNEL NGROK FUNCTIONS
  const startNgrokTunnel = async (): Promise<string | null> => {
    try {
      console.log('🚀 [NGROK] Avvio tunnel per porta 8081...')
      
      // Avvia tunnel tramite API Electron
      const result = await (window as any).electronAPI.webrtcServerAPI.startTunnel(8081)
      
      if (result.success && result.url) {
        console.log(`✅ [NGROK] Tunnel attivo: ${result.url}`)
        return result.url
      } else {
        console.error('❌ [NGROK] Errore avvio tunnel:', result.error)
        return null
      }
    } catch (error) {
      console.error('❌ [NGROK] Errore avvio tunnel:', error)
      return null
    }
  }

  const stopNgrokTunnel = async () => {
    try {
      console.log('🛑 [NGROK] Fermata tunnel...')
      const result = await (window as any).electronAPI.webrtcServerAPI.stopTunnel()
      if (result.success) {
        setTunnelUrl(null)
        console.log('✅ [NGROK] Tunnel fermato')
      }
    } catch (error) {
      console.error('❌ [NGROK] Errore fermata tunnel:', error)
    }
  }

  const stopServer = async () => {
    console.log('🔄 [RemoteDJHost] Inizio fermata server con pulizia completa')
    
    if (!(window as any).electronAPI?.webrtcServerAPI) {
      console.error('❌ [RemoteDJHost] ElectronAPI non disponibile')
      return
    }

        try {
          // 🌐 FERMA TUNNEL NGROK
          if (tunnelUrl) {
            await stopNgrokTunnel()
          }
      // 1. Disattiva PTT se attivo
      if (isPTTDJActive) {
        console.log('🔄 [RemoteDJHost] Disattivazione PTT DJ durante fermata server')
        updatePTTDJActive(false)
      }
      
      if (isPTTLiveActive) {
        console.log('🔄 [RemoteDJHost] Disattivazione PTT Live durante fermata server')
        updatePTTLiveActive(false)
        // Disattiva anche il sistema PTT dell'AudioContext
        if (typeof (window as any).updatePTTVolumesOnly === 'function') {
          (window as any).updatePTTVolumesOnly(false).catch(console.error)
        }
      }
      
      // 2. Disconnetti tutti i client prima di fermare il server
      if (connectedDJs.length > 0) {
        console.log('🔄 [RemoteDJHost] Disconnessione client prima di fermare server:', connectedDJs.length)
        connectedDJs.forEach(dj => {
          disconnectDJ(dj.id)
        })
      }
      
      // 3. Pulisci le connessioni WebRTC
      peerConnectionsRef.current.forEach((connection, clientId) => {
        console.log('🔄 [RemoteDJHost] Chiusura connessione WebRTC per:', clientId)
        connection.close()
      })
      peerConnectionsRef.current.clear()
      
      // 4. Ferma il server
      const result = await (window as any).electronAPI.webrtcServerAPI.stopServer()
      if (result.success) {
        updateServerRunning(false)
        updateServerInfo(null)
        updateConnectedDJs([])
        
        // 5. Pulisci il microfono host
        if (hostMicStreamRef.current) {
          hostMicStreamRef.current.getTracks().forEach(track => track.stop())
          hostMicStreamRef.current = null
          console.log('🎤 [RemoteDJHost] Microfono host pulito - server fermato')
        }
        
        // 6. Svuota completamente la sessione - RESET TOTALE
        console.log('🔄 [RemoteDJHost] Svuotamento completo sessione dopo fermata server')
        sessionStorage.removeItem('djRemotoServer_isRunning')
        sessionStorage.removeItem('djRemotoServer_info')
        sessionStorage.removeItem('djRemotoServer_connectedDJs')
        sessionStorage.removeItem('djRemotoServer_chatMessages')
        sessionStorage.removeItem('djRemotoServer_pttDJActive')
        sessionStorage.removeItem('djRemotoServer_pttLiveActive')
        sessionStorage.removeItem('djRemotoServer_showPanel')
        sessionStorage.removeItem('djRemotoServer_minimized')
        
        // 7. Reset completo UI - stato vergine
        console.log('🔄 [RemoteDJHost] Reset completo UI a stato vergine')
        updateChatMessages([])
        updatePTTDJActive(false)
        updatePTTLiveActive(false)
        
        // ✅ NEW: Reset PTT DJ and PTT Live client lists
        setClientsWithPTTDJ(new Set())
        setClientsWithPTTLive(new Set())
        
        // 8. Reset anche il context per chiudere il pannello
        setShowPanel(false)
        setIsMinimized(false)
        
        console.log('✅ [RemoteDJHost] Server fermato e pulizia completata - UI resettata a stato vergine')
      }
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore fermata server:', error)
    }
  }

  const startServer = async () => {
    // ✅ CRITICAL FIX: Se il pannello è visibile, resetta il flag per permettere l'avvio
    if ((window as any).__djRemotoServerWasManuallyClosed__ && showPanel) {
      console.log('🔄 [RemoteDJHost] Pannello riaperto manualmente - reset flag e permetti avvio server')
      ;(window as any).__djRemotoServerWasManuallyClosed__ = false
    }
    
    // ✅ CRITICAL FIX: Se il pannello non è visibile, blocca l'avvio
    if (!showPanel) {
      console.log('🔄 [RemoteDJHost] Pannello non visibile - skip avvio server')
      return
    }
    
    if (!(window as any).electronAPI?.webrtcServerAPI) {
      console.error('❌ [RemoteDJHost] ElectronAPI non disponibile')
      return
    }
    
    // ✅ CRITICAL FIX: Fermata server esistente solo se necessario (più veloce)
    if (isServerRunning) {
      console.log('🔄 [RemoteDJHost] Fermata server esistente prima di riavviare')
      try {
        await (window as any).electronAPI.webrtcServerAPI.stopServer()
        // Ferma anche tunnel se attivo
        if (tunnelUrl) {
          await stopNgrokTunnel()
        }
        // Ridotto il delay per velocizzare l'avvio
        await new Promise(resolve => setTimeout(resolve, 200))
        console.log('✅ [RemoteDJHost] Server esistente fermato')
      } catch (error) {
        console.log('⚠️ [RemoteDJHost] Errore fermata server esistente:', error)
      }
    }

    setIsStarting(true)

        try {
          // 🌐 AVVIA TUNNEL NGROK (sempre Internet)
          console.log('🌐 [RemoteDJHost] Avvio tunnel ngrok...')
          const url = await startNgrokTunnel()
          if (url) {
            setTunnelUrl(url)
            console.log(`✅ [RemoteDJHost] Tunnel pubblico attivo: ${url}`)
          } else {
            throw new Error('Impossibile avviare tunnel ngrok')
          }

      const result = await (window as any).electronAPI.webrtcServerAPI.startServer({
        port: 8080,
        maxConnections: 5
      })

      if (result.success) {
        updateServerRunning(true)
        updateServerInfo(result)
        console.log('✅ [RemoteDJHost] Server avviato:', result)
        
        // Mostra i dispositivi audio disponibili
        await logAvailableAudioDevices()
        
        // ✅ CRITICAL FIX: Crea il microfono host subito dopo l'avvio del server
        // per permettere l'uso dei pulsanti PTT anche senza client connessi
        await createHostMicrophone()
      } else {
        console.error('❌ [RemoteDJHost] Errore avvio server:', result.error)
        // ✅ CRITICAL FIX: Reset dello stato in caso di errore
        updateServerRunning(false)
        updateServerInfo(null)
      }
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore:', error)
      // ✅ CRITICAL FIX: Reset dello stato in caso di errore
      updateServerRunning(false)
      updateServerInfo(null)
    } finally {
      setIsStarting(false)
    }
  }


  // ✅ NEW: Funzione per aggiornare le connessioni WebRTC (SENZA doppia ricreazione)
  const updateExistingWebRTCConnections_PROPER = async () => {
    console.log('🔄 [DJRemotoServerPage] Aggiornamento connessioni WebRTC con stream esistente')
    
    // NON ricreare qui - hostMicStreamRef.current è già aggiornato dal chiamante

    if (!hostMicStreamRef.current) {
      console.warn('⚠️ [DJRemotoServerPage] Nessun stream microfono disponibile per aggiornare le connessioni')
      return
    }

    const connections = Array.from(peerConnectionsRef.current.entries())
    console.log(`🔄 [DJRemotoServerPage] Aggiornamento di ${connections.length} connessioni WebRTC con stream esistente`)

    const newMicTrack = hostMicStreamRef.current.getAudioTracks()[0]
    if (!newMicTrack) {
      console.error('❌ [DJRemotoServerPage] Nessun track audio nel stream ricreato')
      return
    }

    for (const [clientId, peerConnection] of connections) {
      // Salta i DataChannel
      if (clientId.includes('_dataChannel')) continue

      try {
        console.log(`🔄 [DJRemotoServerPage] Aggiornamento connessione per ${clientId}`)

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
          console.log(`🔄 [DJRemotoServerPage] Sostituzione track con quello del stream principale per ${clientId}`)
          console.log(`🔍 [REPLACE DEBUG] Track PRIMA di replaceTrack: ${micSender.track?.id} (enabled: ${micSender.track?.enabled})`)
          console.log(`🔍 [REPLACE DEBUG] Track NUOVO per replaceTrack: ${newMicTrack.id} (enabled: ${newMicTrack.enabled})`)
          
          await micSender.replaceTrack(newMicTrack)
          
          console.log(`🔍 [REPLACE DEBUG] Track DOPO replaceTrack: ${micSender.track?.id} (enabled: ${micSender.track?.enabled})`)
          console.log(`✅ [DJRemotoServerPage] Track sostituito per ${clientId}`)
        } else {
          // Se non c'è un sender esistente, aggiungi il track
          console.log(`➕ [DJRemotoServerPage] Aggiunta nuovo track per ${clientId}`)
          peerConnection.addTrack(newMicTrack, hostMicStreamRef.current)
          console.log(`✅ [DJRemotoServerPage] Nuovo track aggiunto per ${clientId}`)
        }

      } catch (error) {
        console.error(`❌ [DJRemotoServerPage] Errore aggiornamento ${clientId}:`, error)
      }
    }
    
    // ✅ CRITICAL FIX: Sincronizza hostMicStreamRef con i track effettivi in WebRTC
    console.log('🔄 [DJRemotoServerPage] Sincronizzazione finale hostMicStreamRef con track WebRTC')
    if (hostMicStreamRef.current) {
      // Ottieni un track di riferimento da una delle connessioni WebRTC
      let referenceTrack = null
      for (const [clientId, peerConnection] of connections) {
        if (clientId.includes('_dataChannel')) continue
        
        const senders = peerConnection.getSenders()
        for (const sender of senders) {
          if (sender.track && sender.track.kind === 'audio') {
            referenceTrack = sender.track
            break
          }
        }
        if (referenceTrack) break
      }
      
      if (referenceTrack) {
        // Sostituisci tutti i track in hostMicStreamRef con il track di riferimento WebRTC
        const currentTracks = hostMicStreamRef.current.getAudioTracks()
        currentTracks.forEach(track => {
          hostMicStreamRef.current?.removeTrack(track)
        })
        hostMicStreamRef.current.addTrack(referenceTrack)
        console.log(`✅ [DJRemotoServerPage] hostMicStreamRef sincronizzato con track WebRTC: ${referenceTrack.id}`)
      }
    }
    
    console.log('✅ [DJRemotoServerPage] Connessioni WebRTC aggiornate - PTT mantiene latenza normale')
  }



  // ✅ CRITICAL FIX: Funzione per creare il microfono host
  const createHostMicrophone = async () => {
    try {
      const currentSettings = settingsRef.current
      const micDeviceId = currentSettings.microphone?.inputDevice !== 'default' ? currentSettings.microphone.inputDevice : undefined
      
      console.log('🎤 [RemoteDJHost] Creazione microfono host per PTT...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
          echoCancellation: currentSettings.microphone?.echoCancellation ?? false,
          noiseSuppression: currentSettings.microphone?.noiseSuppression ?? true,
          autoGainControl: currentSettings.microphone?.autoGainControl ?? true,
          sampleRate: 44100,
          channelCount: 1
        }
      })
      
      hostMicStreamRef.current = stream
      console.log('✅ [RemoteDJHost] Microfono host creato per PTT:', stream.id)
      
      // Muta il microfono di default (PTT mode)
      stream.getAudioTracks().forEach(track => {
        track.enabled = false
        console.log(`🎤 [RemoteDJHost] Track ${track.id} mutato di default (PTT mode)`)
      })
    } catch (error) {
      console.error('❌ [RemoteDJHost] Errore creazione microfono host per PTT:', error)
    }
  }

  // ✅ CRITICAL FIX: Funzione per controllare lo stato del server
  const checkServerStatus = async () => {
    // ✅ CRITICAL FIX: Se il pannello è visibile, permetti il controllo del server
    if (showPanel) {
      console.log('🔄 [RemoteDJHost] Controllo server abilitato - pannello visibile')
      // ✅ CRITICAL FIX: Controllo server solo se necessario (più veloce)
      if (!isServerRunning && !isStarting) {
        console.log('🔄 [RemoteDJHost] Server non attivo - pronto per avvio manuale')
        // ✅ CRITICAL FIX: Controlla se c'è un server già attivo
        try {
          const status = await (window as any).electronAPI.webrtcServerAPI.checkServerStatus()
          if (status && status.isRunning) {
            console.log('✅ [RemoteDJHost] Server già attivo rilevato, ripristino stato')
            updateServerRunning(true)
            updateServerInfo(status.serverInfo)
            // Crea il microfono host se il server è già attivo
            await createHostMicrophone()
          }
        } catch (error) {
          console.log('ℹ️ [RemoteDJHost] Nessun server attivo rilevato')
        }
      }
    } else {
      console.log('🔄 [RemoteDJHost] Controllo server disabilitato - pannello non visibile')
    }
  }

  // ✅ CRITICAL FIX: Ripristina lo stato del server quando il componente viene montato
  useEffect(() => {
    // ✅ CRITICAL FIX: Reset del flag di chiusura al mount del componente
    isClosingRef.current = false
    
    // ✅ CRITICAL FIX: Reset del flag di chiusura manuale se il pannello viene riaperto
    if ((window as any).__djRemotoServerWasManuallyClosed__ === false) {
      wasManuallyClosedRef.current = false
    }
    
    // ✅ CRITICAL FIX: Controlla lo stato del server solo se il pannello è visibile
    if (showPanel) {
      // ✅ CRITICAL FIX: Controllo server solo se necessario (più veloce)
      if (!isServerRunning && !isStarting) {
        console.log('🔄 [RemoteDJHost] Server non attivo - pronto per avvio manuale')
      }
    }
  }, [showPanel])

  // ✅ CRITICAL FIX: Event listeners per WebRTC server
  useEffect(() => {
    if (!(window as any).electronAPI?.webrtcServerAPI) {
      console.log('⚠️ [RemoteDJHost] ElectronAPI non disponibile per event listeners')
      return
    }

    console.log('🔄 [RemoteDJHost] Configurazione event listeners WebRTC server')

    // Event listener per client autenticato
    const onClientAuthenticated = (_event: any, client: any) => {
      console.log('✅ [RemoteDJHost] Client autenticato:', client)
      // ✅ NEW: Assegna colore al DJ
      const djColor = getDJColor(client.djName)
      
      const newDJ: ConnectedDJ = {
        id: client.id,
        djName: client.djName,
        ip: client.ip || 'unknown',
        connectedAt: new Date(),
        audioLevel: 0,
        volume: 0.5,
        isMuted: false,
        color: djColor.color
      }
      // ✅ CRITICAL FIX: Use functional update to avoid stale closure
      updateConnectedDJs(prev => [...prev, newDJ])
      addChatMessage('System', `${client.djName} si è connesso`, true)
    }

    // Event listener per client disconnesso
    const onClientDisconnected = (_event: any, client: any) => {
      console.log('🔌 [RemoteDJHost] Client disconnesso:', client)
      disconnectDJ(client.id)
      addChatMessage('System', `${client.djName} si è disconnesso`, true)
    }

    // Event listener per livelli audio
    const onAudioLevel = (_event: any, data: any) => {
      // ✅ CRITICAL FIX: Use functional update to avoid stale closure
      updateConnectedDJs((prev: ConnectedDJ[]) => prev.map((dj: ConnectedDJ) => 
        dj.id === data.clientId ? { ...dj, audioLevel: data.level } : dj
      ))
    }

    // Event listener per WebRTC offer
    const onWebRTCOffer = (_event: any, data: any) => {
      console.log('🎵 [RemoteDJHost] WebRTC Offer da:', data.djName)
      console.log('🎤 [RemoteDJHost] 🔍 DEBUG: Impostazioni passate a handleWebRTCOffer:', settingsRef.current.microphone?.inputDevice)
      handleWebRTCOffer(data, settingsRef.current)
    }

    // Event listener per WebRTC answer
    const onWebRTCAnswer = (_event: any, data: any) => {
      console.log('🎵 [RemoteDJHost] WebRTC Answer da:', data.djName)
      handleWebRTCAnswer(data)
    }

    // Event listener per ICE candidate
    const onICECandidate = (_event: any, data: any) => {
      console.log('🧊 [RemoteDJHost] ICE Candidate da:', data.djName)
      handleICECandidate(data)
    }

    // Event listener per messaggi chat
    const onChatMessage = (_event: any, data: any) => {
      console.log('💬 [RemoteDJHost] Messaggio chat ricevuto:', {
        djName: data.djName,
        message: data.message,
        timestamp: data.timestamp
      })
      addChatMessage(data.djName, data.message)
    }

    // Event listener per messaggi host
    const onHostChatMessage = (_event: any, data: any) => {
      console.log('💬 [RemoteDJHost] Messaggio host ricevuto:', {
        djName: data.djName,
        message: data.message,
        timestamp: data.timestamp
      })
      addChatMessage(data.djName, data.message)
    }

    // Event listener per ripristino server
    const onServerRestored = (_event: any, data: any) => {
      console.log('🔄 [RemoteDJHost] Server ripristinato:', data)
      if (data && data.isRunning && data.serverInfo) {
        console.log('✅ [RemoteDJHost] Server già attivo, ripristino stato')
        updateServerRunning(true)
        updateServerInfo(data.serverInfo)
        // ✅ CRITICAL FIX: Use functional update to avoid stale closure
        if (data.clients && Array.isArray(data.clients)) {
          updateConnectedDJs(data.clients.map((client: any) => ({
            id: client.id,
            djName: client.djName,
            ip: client.ip || 'unknown',
            connectedAt: new Date(),
            audioLevel: 0,
            volume: 0.5,
            isMuted: false
          })))
        }
        // ✅ CRITICAL FIX: Crea il microfono host se il server è già attivo
        createHostMicrophone()
      }
    }

    // Registra gli event listeners
    ;(window as any).electronAPI.webrtcServerAPI.onClientAuthenticated(onClientAuthenticated)
    ;(window as any).electronAPI.webrtcServerAPI.onClientDisconnected(onClientDisconnected)
    ;(window as any).electronAPI.webrtcServerAPI.onAudioLevel(onAudioLevel)
    ;(window as any).electronAPI.webrtcServerAPI.onWebRTCOffer(onWebRTCOffer)
    ;(window as any).electronAPI.webrtcServerAPI.onWebRTCAnswer(onWebRTCAnswer)
    ;(window as any).electronAPI.webrtcServerAPI.onICECandidate(onICECandidate)
    ;(window as any).electronAPI.webrtcServerAPI.onChatMessage(onChatMessage)
    ;(window as any).electronAPI.webrtcServerAPI.onHostChatMessage(onHostChatMessage)
    ;(window as any).electronAPI.webrtcServerAPI.onServerRestored(onServerRestored)

    console.log('✅ [RemoteDJHost] Event listeners WebRTC server configurati')

    // Cleanup function
    return () => {
      console.log('🧹 [RemoteDJHost] Rimozione event listeners WebRTC server')
      if ((window as any).electronAPI?.webrtcServerAPI) {
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('clientAuthenticated')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('clientDisconnected')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('audioLevel')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('webRTCOffer')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('webRTCAnswer')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('iceCandidate')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('chatMessage')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('hostChatMessage')
        ;(window as any).electronAPI.webrtcServerAPI.removeAllListeners('serverRestored')
      }
    }
  }, [])

  // ✅ CRITICAL FIX: Ripristina lo stato PTT quando il componente viene montato
  useEffect(() => {
    // Ripristina lo stato PTT solo se il server è attivo e ci sono client connessi
    if (isServerRunning && connectedDJs.length > 0 && hostMicStreamRef.current) {
      // Delay per assicurarsi che tutto sia inizializzato
      const restorePTTState = () => {
        if (isPTTDJActive) {
          console.log('🔄 [DJRemotoServerPage] Ripristino stato PTT DJ attivo')
          hostMicStreamRef.current?.getAudioTracks().forEach(track => {
            track.enabled = true
          })
          // Invia comando PTT DJ ai client
          sendPTTDJCommandToClients(true)
        }
        
        if (isPTTLiveActive) {
          console.log('🔄 [DJRemotoServerPage] Ripristino stato PTT Live attivo')
          hostMicStreamRef.current?.getAudioTracks().forEach(track => {
            track.enabled = true
          })
          // Attiva anche il sistema PTT dell'AudioContext
          if (typeof (window as any).updatePTTVolumesOnly === 'function') {
            (window as any).updatePTTVolumesOnly(true).catch(console.error)
          }
          // Invia comando PTT Live ai client
          sendHostPTTLiveCommandToClients(true)
        }
      }
      
      // Ripristina immediatamente
      restorePTTState()
      
      // Ripristina anche dopo un delay per sicurezza
      const timeoutId = setTimeout(restorePTTState, 1000)
      
      return () => clearTimeout(timeoutId)
    }
  }, [isServerRunning, connectedDJs.length])

  // ✅ NEW: Listener per cambiamenti delle settings del microfono
  useEffect(() => {
    const handleSettingsChange = async () => {
      console.log('🔄 [DJRemotoServerPage] Settings microfono cambiate - aggiornamento stream')
      
      // Se il server è attivo, ricrea sempre il microfono host con le nuove settings
      if (isServerRunning) {
        console.log('🔄 [DJRemotoServerPage] Ricreazione stream microfono con nuove settings')
        
        // Salva lo stato PTT corrente
        const wasPTTDJActive = isPTTDJActive
        const wasPTTLiveActive = isPTTLiveActive
        
        // Ferma lo stream corrente se esiste
        if (hostMicStreamRef.current) {
          hostMicStreamRef.current.getTracks().forEach(track => track.stop())
          hostMicStreamRef.current = null
        }
        
        // Ricrea lo stream con le nuove settings
        setTimeout(async () => {
          try {
            await logAvailableAudioDevices()
            await createHostMicrophone()
            console.log('✅ [DJRemotoServerPage] Stream microfono ricreato con nuove settings')
            
            // ✅ FINAL FIX: Usa replaceTrack() - è stato progettato per questo!
            await updateExistingWebRTCConnections_PROPER()
            
            // ✅ FIX: Ripristina lo stato PTT SOLO se era effettivamente attivo dall'utente
            if (wasPTTDJActive) {
              console.log('🔄 [DJRemotoServerPage] Ripristino PTT DJ dopo cambio settings')
              handlePTTDJPress()
            }
            // ✅ CRITICAL FIX: NON riattivare automaticamente PTT Live - deve essere attivato manualmente dall'utente
            // if (wasPTTLiveActive) {
            //   console.log('🔄 [DJRemotoServerPage] Ripristino PTT Live dopo cambio settings')
            //   handlePTTLivePress()
            // }
          } catch (error) {
            console.error('❌ [DJRemotoServerPage] Errore ricreazione stream microfono:', error)
          }
        }, 500)
      }
    }

    // Ascolta i cambiamenti delle settings del microfono
    window.addEventListener('djconsole:microphone-settings-changed', handleSettingsChange)
    window.addEventListener('djconsole:settings-updated', handleSettingsChange)
    
    return () => {
      window.removeEventListener('djconsole:microphone-settings-changed', handleSettingsChange)
      window.removeEventListener('djconsole:settings-updated', handleSettingsChange)
    }
  }, [isServerRunning])

  // ✅ REMOVED: useEffect duplicato rimosso - gestito solo dall'event listener sopra
  // Il cambio microfono è gestito dal custom event 'djconsole:microphone-settings-changed'
  // Non serve un secondo listener basato su settings dependency

  // ✅ CRITICAL FIX: Gestisci la navigazione SENZA ripristino automatico dello stato
  useEffect(() => {
    const handlePageShow = () => {
      // ✅ CRITICAL FIX: Se il pannello è visibile, permetti il controllo del server
      if (showPanel) {
        console.log('🔄 [DJRemotoServerPage] Pagina tornata visibile - pannello visibile, controllo server')
        // ✅ CRITICAL FIX: Controllo server solo se necessario (più veloce)
        if (!isServerRunning && !isStarting) {
          checkServerStatus()
        }
      } else {
        console.log('🔄 [DJRemotoServerPage] Pagina tornata visibile - pannello non visibile, mantengo stato vergine')
      }
    }

    const handlePageHide = () => {
      console.log('🔄 [DJRemotoServerPage] Pagina nascosta - mantengo stato in sessionStorage')
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [showPanel])

  // ✅ SIMPLIFIED: Gestione focus senza ripristino automatico del microfono
  useEffect(() => {
    const handleWindowFocus = async () => {
      // ✅ CRITICAL FIX: Se il pannello è visibile, permetti il controllo del server
      if (showPanel) {
        console.log('🔄 [RemoteDJHost] Finestra in focus - pannello visibile, controllo server')
        // ✅ CRITICAL FIX: Controllo server solo se necessario (più veloce)
        if (!isServerRunning && !isStarting) {
          checkServerStatus()
        }
      } else {
        console.log('🔄 [RemoteDJHost] Finestra in focus - pannello non visibile, mantengo stato vergine')
      }
    }

    // ✅ CRITICAL FIX: Reset navigation state after a delay
    const resetNavigationState = () => {
      setTimeout(() => {
        setIsNavigating(false)
        console.log('🔄 [RemoteDJHost] Stato navigazione resettato')
      }, 1000)
    }

    window.addEventListener('focus', handleWindowFocus)
    
    // Reset navigation state on page load
    resetNavigationState()

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [connectedDJs.length, showPanel])

  useEffect(() => {
    if (connectedDJs.length > 0) {
      console.log(`🎤 [AutoDucking] ${connectedDJs.length} DJ connessi - SISTEMA AUTOMATICO DISATTIVATO`)
      console.log(`🎤 [AutoDucking] Usare PTT DJ o PTT Live per attivare ducking manualmente`)
    } else {
      console.log('🎤 [AutoDucking] Nessun DJ connesso - SISTEMA AUTOMATICO DISATTIVATO')
      
      // ✅ CRITICAL FIX: NON pulire il microfono host quando non ci sono client
      // Il microfono deve rimanere attivo per permettere l'uso dei pulsanti PTT
      // anche quando non ci sono client connessi
      console.log('🎤 [RemoteDJHost] Microfono host mantenuto attivo per PTT - nessun client connesso')
    }
  }, [connectedDJs.length])

  // ✅ CRITICAL FIX: Cleanup separato solo per il dismount del componente
  useEffect(() => {
    return () => {
      // Pulisci il microfono host solo quando il componente viene smontato
      if (hostMicStreamRef.current) {
        console.log('🧹 [RemoteDJHost] Cleanup microfono host al dismount del componente')
        hostMicStreamRef.current.getTracks().forEach(track => track.stop())
        hostMicStreamRef.current = null
      }
    }
  }, [])


  return (
    <div className={`fixed bottom-4 right-4 bg-dj-primary border border-dj-accent rounded-lg shadow-2xl z-50 transition-all duration-300 ${
      isMinimized 
        ? 'w-12 h-12' 
        : 'w-[700px] max-h-[700px] overflow-hidden'
    }`}>
      {isMinimized ? (
        // ✅ Minimized state - just icon
        <div className="relative w-full h-full">
          {/* Pulsante di chiusura */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              console.log('🔄 [DJRemotoServerPage] Chiusura pannello da icona minimizzata - disconnessione completa')
              handleClosePanel()
            }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white text-xs rounded-full flex items-center justify-center z-10 transition-colors"
            title="Chiudi pannello e disconnetti tutto"
          >
            ✕
          </button>
          
          {/* Icona principale */}
          <div 
            className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-dj-accent/40 rounded-lg transition-all duration-200 border-2 border-dj-accent/50 hover:border-dj-accent hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            onClick={(e) => {
              e.stopPropagation()
              console.log('🔄 [DJRemotoServerPage] Click su icona minimizzata - espansione')
              setIsMinimized(false)
            }}
            title={`DJ Remoto Server - ${isServerRunning ? 'ATTIVO' : 'INATTIVO'} - Click per espandere`}
          >
            <div className="relative flex flex-col items-center">
              <span className="text-xl">🎤</span>
              <span className="text-xs text-white/80 mt-1">DJ</span>
              {isServerRunning && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white animate-pulse"></span>
              )}
              {clientsWithPTTLive.size > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border border-white"></span>
              )}
              {connectedDJs.length > 0 && (
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white text-xs flex items-center justify-center text-white font-bold">
                  {connectedDJs.length}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ✅ Expanded state - full panel
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-dj-dark border-b border-dj-accent">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🎤</span>
              <span className="text-sm font-medium text-white">DJ Remoto Server</span>
              {isServerRunning && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                  ATTIVO
                </span>
              )}
              {clientsWithPTTDJ.size > 0 && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-600 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                  <span className="text-xs text-white font-medium">
                    🎤 DJ ({clientsWithPTTDJ.size})
                  </span>
                </div>
              )}
              {clientsWithPTTLive.size > 0 && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-red-600 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping"></span>
                  <span className="text-xs text-white font-medium">
                    🔴 LIVE ({clientsWithPTTLive.size})
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="text-dj-light hover:text-white text-sm"
                title="Riduci a icona"
              >
                −
              </button>
              <button
                onClick={() => {
                  console.log('🔄 [DJRemotoServerPage] Chiusura pannello espanso - disconnessione completa')
                  handleClosePanel()
                }}
                className="text-dj-light hover:text-white text-sm"
                title="Chiudi pannello e disconnetti tutto"
              >
                ✕
              </button>
            </div>
          </div>

      {/* Contenuto */}
      <div className="overflow-y-auto max-h-[500px] p-3">
        {/* 🌐 MODALITÀ SERVER */}

        <div className="flex justify-end items-center mb-4">
          <div className="flex space-x-2">
          {!isServerRunning ? (
            <button
              onClick={startServer}
              disabled={isStarting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white text-sm font-medium py-3 px-6 rounded transition-colors"
            >
              {isStarting ? '🌐 Avvio Internet...' : '🌐 Avvia Internet'}
            </button>
          ) : (
            <div className="flex space-x-2">
              {/* PTT DJ-to-DJ Button */}
              <button
                onMouseDown={handlePTTDJPress}
                onMouseUp={handlePTTDJRelease}
                onMouseLeave={handlePTTDJRelease}
                className={`py-3 px-6 text-sm rounded font-medium transition-colors ${
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
                className={`py-3 px-6 text-sm rounded font-medium transition-colors ${
                  isPTTLiveActive ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                } text-white`}
              >
                {isPTTLiveActive ? '📡 PTT Live (ON)' : '📡 PTT Live'}
              </button>
              
              <button
                onClick={stopServer}
                className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium py-3 px-6 rounded transition-colors"
              >
                🛑 Stop
              </button>
            </div>
          )}
        </div>
      </div>


      {/* 🚀 CODICE CONNESSIONE */}
      {isServerRunning && serverInfo && (
        <div className="mb-4">
          <ConnectionCode
            serverUrl={tunnelUrl || `${serverInfo.host}:${serverInfo.port}`}
            sessionCode={serverInfo.sessionCode}
            serverMode="internet"
            webrtcPort={serverInfo.port}
          />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">
          👥 DJ Connessi ({connectedDJs.length})
        </h3>

        {connectedDJs.length === 0 ? (
          <div className="text-center py-4 text-dj-light">
            <div className="text-2xl mb-1">🎤</div>
            <div className="text-xs">Nessun DJ connesso</div>
            <div className="text-xs mt-1">
              Condividi il codice sessione
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {connectedDJs.map((dj) => (
              <div
                key={dj.id}
                className="bg-dj-dark border border-dj-accent rounded-md p-2"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-semibold text-white">{dj.djName}</h4>
                    {dj.isPTTDJActive && (
                      <span className="px-1 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium animate-pulse">
                        🎤 DJ
                      </span>
                    )}
                    {clientsWithPTTLive.has(dj.id) && (
                      <span className="px-1 py-0.5 bg-red-600 text-white text-xs rounded-full font-medium animate-pulse">
                        🔴 LIVE
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => disconnectDJ(dj.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                    title="Disconnetti DJ"
                  >
                    🔌
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-dj-light">Vol:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={dj.volume * 100}
                    onChange={(e) => setDJVolume(dj.id, parseFloat(e.target.value) / 100)}
                    className="flex-1 h-1 bg-dj-light rounded-lg appearance-none cursor-pointer slider"
                    title={`Volume DJ ${dj.djName}: ${Math.round(dj.volume * 100)}%`}
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${dj.volume * 100}%, #374151 ${dj.volume * 100}%, #374151 100%)`
                    } as React.CSSProperties}
                  />
                  <span className="text-xs text-dj-light w-6">
                    {Math.round(dj.volume * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat DJ */}
      {isServerRunning && connectedDJs.length > 0 && (
        <div className="mt-4 border-t border-dj-accent">
          <DJChat
            connectedDJs={connectedDJs}
            onSendMessage={handleSendChatMessage}
            messages={chatMessages}
          />
        </div>
      )}

      {isServerRunning && (
        <div className="mt-4 p-2 bg-blue-900/20 border border-blue-500/30 rounded-md">
          <h4 className="text-blue-400 font-semibold mb-1 text-xs">📋 Istruzioni</h4>
          <div className="text-xs text-blue-300 space-y-1">
            <div>1. Apri client DJ Remoto</div>
            <div>2. Usa il codice di connessione sopra</div>
            <div>3. Clicca "Connetti"</div>
          </div>
        </div>
      )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-dj-dark border-t border-dj-accent">
        <div className="text-xs text-dj-light/60 text-center">
          💡 Server DJ Remoto - {connectedDJs.length} DJ connessi
        </div>
      </div>
        </>
      )}
    </div>
  )
}

export default DJRemotoServerPage

