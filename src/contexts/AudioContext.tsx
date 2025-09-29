import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { localDatabase } from '../database/LocalDatabase'
import { getBlob } from '../database/BlobStore'
import { useSettings } from './SettingsContext'
import { SoundEffectsManager } from '../audio/SoundEffectsManager'
import { MicrophoneEffectsManager } from '../audio/MicrophoneEffectsManager'

// ===== TIPI E INTERFACCE =====
interface AudioTrack {
  id: string
  title: string
  artist: string
  duration: number
  url: string
}

interface DeckState {
  track: AudioTrack | null
  isPlaying: boolean
  currentTime: number
  
  duration: number
  volume: number
  localVolume: number
}

interface MicrophoneState {
  isEnabled: boolean
  isMuted: boolean
}

interface RemoteDJsState {
  streams: Map<string, MediaStream>
  volumes: Map<string, number>
}

interface AudioState {
  leftDeck: DeckState
  rightDeck: DeckState
  masterVolume: number
  crossfader: number
  microphone: MicrophoneState
  remoteDJs: RemoteDJsState
  soundEffectsManager: SoundEffectsManager | null
  microphoneEffectsManager: MicrophoneEffectsManager | null
  audioContext: AudioContext | null
}

// ===== AZIONI DEL REDUCER =====
type AudioAction =
  | { type: 'SET_LEFT_DECK_TRACK'; payload: AudioTrack | null }
  | { type: 'SET_RIGHT_DECK_TRACK'; payload: AudioTrack | null }
  | { type: 'SET_LEFT_DECK_PLAYING'; payload: boolean }
  | { type: 'SET_RIGHT_DECK_PLAYING'; payload: boolean }
  | { type: 'SET_LEFT_DECK_TIME'; payload: number }
  | { type: 'SET_RIGHT_DECK_TIME'; payload: number }
  | { type: 'ADD_REMOTE_DJ_STREAM'; payload: { id: string; stream: MediaStream } }
  | { type: 'REMOVE_REMOTE_DJ_STREAM'; payload: string }
  | { type: 'SET_REMOTE_DJ_VOLUME'; payload: { id: string; volume: number } }
  | { type: 'SET_LEFT_DECK_DURATION'; payload: number }
  | { type: 'SET_RIGHT_DECK_DURATION'; payload: number }
  | { type: 'SET_LEFT_DECK_VOLUME'; payload: number }
  | { type: 'SET_RIGHT_DECK_VOLUME'; payload: number }
  | { type: 'SET_LEFT_DECK_LOCAL_VOLUME'; payload: number }
  | { type: 'SET_SOUND_EFFECTS_MANAGER'; payload: SoundEffectsManager | null }
  | { type: 'SET_MICROPHONE_EFFECTS_MANAGER'; payload: MicrophoneEffectsManager | null }
  | { type: 'SET_AUDIO_CONTEXT'; payload: AudioContext | null }
  | { type: 'SET_RIGHT_DECK_LOCAL_VOLUME'; payload: number }
  | { type: 'SET_MASTER_VOLUME'; payload: number }
  | { type: 'SET_CROSSFADER'; payload: number }
  | { type: 'SET_MICROPHONE_ENABLED'; payload: boolean }
  | { type: 'SET_MICROPHONE_MUTED'; payload: boolean }

// ===== REDUCER =====
const audioReducer = (state: AudioState, action: AudioAction): AudioState => {
  switch (action.type) {
    case 'SET_LEFT_DECK_TRACK':
      return { ...state, leftDeck: { ...state.leftDeck, track: action.payload } }
    case 'SET_RIGHT_DECK_TRACK':
      return { ...state, rightDeck: { ...state.rightDeck, track: action.payload } }
    case 'SET_LEFT_DECK_PLAYING':
      return { ...state, leftDeck: { ...state.leftDeck, isPlaying: action.payload } }
    case 'SET_RIGHT_DECK_PLAYING':
      return { ...state, rightDeck: { ...state.rightDeck, isPlaying: action.payload } }
    case 'SET_LEFT_DECK_TIME':
      return { ...state, leftDeck: { ...state.leftDeck, currentTime: action.payload } }
    case 'SET_RIGHT_DECK_TIME':
      return { ...state, rightDeck: { ...state.rightDeck, currentTime: action.payload } }
    case 'SET_LEFT_DECK_DURATION':
      return { ...state, leftDeck: { ...state.leftDeck, duration: action.payload } }
    case 'SET_RIGHT_DECK_DURATION':
      return { ...state, rightDeck: { ...state.rightDeck, duration: action.payload } }
    case 'SET_LEFT_DECK_VOLUME':
      return { ...state, leftDeck: { ...state.leftDeck, volume: action.payload } }
    case 'SET_RIGHT_DECK_VOLUME':
      return { ...state, rightDeck: { ...state.rightDeck, volume: action.payload } }
    case 'SET_LEFT_DECK_LOCAL_VOLUME':
      return { ...state, leftDeck: { ...state.leftDeck, localVolume: action.payload } }
    case 'SET_RIGHT_DECK_LOCAL_VOLUME':
      return { ...state, rightDeck: { ...state.rightDeck, localVolume: action.payload } }
    case 'SET_MASTER_VOLUME':
      return { ...state, masterVolume: action.payload }
    case 'SET_CROSSFADER':
      return { ...state, crossfader: action.payload }
    case 'SET_MICROPHONE_ENABLED':
      return { ...state, microphone: { ...state.microphone, isEnabled: action.payload } }
    case 'SET_MICROPHONE_MUTED':
      return { ...state, microphone: { ...state.microphone, isMuted: action.payload } }
    case 'ADD_REMOTE_DJ_STREAM':
      const newStreams = new Map(state.remoteDJs.streams)
      const newVolumes = new Map(state.remoteDJs.volumes)
      newStreams.set(action.payload.id, action.payload.stream)
      newVolumes.set(action.payload.id, 1.0) // ✅ CRITICAL FIX: Volume iniziale 100% per qualità massima
      return { 
        ...state, 
        remoteDJs: { 
          streams: newStreams, 
          volumes: newVolumes 
        } 
      }
    case 'REMOVE_REMOTE_DJ_STREAM':
      const updatedStreams = new Map(state.remoteDJs.streams)
      const updatedVolumes = new Map(state.remoteDJs.volumes)
      updatedStreams.delete(action.payload)
      updatedVolumes.delete(action.payload)
      return { 
        ...state, 
        remoteDJs: { 
          streams: updatedStreams, 
          volumes: updatedVolumes 
        } 
      }
    case 'SET_REMOTE_DJ_VOLUME':
      const volumeMap = new Map(state.remoteDJs.volumes)
      volumeMap.set(action.payload.id, action.payload.volume)
      return { 
        ...state, 
        remoteDJs: { 
          ...state.remoteDJs, 
          volumes: volumeMap 
        } 
      }
    case 'SET_SOUND_EFFECTS_MANAGER':
      return { ...state, soundEffectsManager: action.payload }
    case 'SET_MICROPHONE_EFFECTS_MANAGER':
      return { ...state, microphoneEffectsManager: action.payload }
    case 'SET_AUDIO_CONTEXT':
      return { ...state, audioContext: action.payload }
    default:
      return state
  }
}

// ===== STATO INIZIALE =====
const initialState: AudioState = {
        leftDeck: { 
    track: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    localVolume: 0.0
  },
  rightDeck: {
    track: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    localVolume: 0.0
  },
  masterVolume: 1.0,
  crossfader: 0.5, // 0.5 = centro, 0.0 = tutto A, 1.0 = tutto B
        microphone: { 
    isEnabled: false,
    isMuted: true
  },
  remoteDJs: {
    streams: new Map(),
    volumes: new Map()
  },
  soundEffectsManager: null,
  microphoneEffectsManager: null,
  audioContext: null
}

// ===== CONTESTO =====
const AudioContext = createContext<{
  state: AudioState
  dispatch: React.Dispatch<AudioAction>
  leftAudioRef: React.RefObject<HTMLAudioElement>
  rightAudioRef: React.RefObject<HTMLAudioElement>
  micStreamRef: React.RefObject<MediaStream | null>
  addRemoteDJStream: (id: string, stream: MediaStream) => void
  removeRemoteDJStream: (id: string) => void
  setRemoteDJVolume: (id: string, volume: number) => void
  setStreamDucking: (active: boolean) => void
  setStreamMasterVolume: (volume: number) => void
  setMasterVolume: (volume: number) => void
  setCrossfader: (value: number) => void
  addToDeck: (track: AudioTrack, deck: 'left' | 'right') => Promise<void>
  playLeftTrack: (track: AudioTrack) => void
  playRightTrack: (track: AudioTrack) => void
  pauseLeftTrack: () => void
  resumeLeftTrack: () => void
  stopLeftTrack: () => void
  pauseRightTrack: () => void
  resumeRightTrack: () => void
  stopRightTrack: () => void
  handlePlayPauseDefinitive: (side: 'left' | 'right') => Promise<void>
  setLeftLocalVolume: (volume: number) => void
  setRightLocalVolume: (volume: number) => void
  seekLeftTo: (time: number) => void
  seekRightTo: (time: number) => void
  soundEffectsManagerRef: React.RefObject<SoundEffectsManager | null>
  microphoneEffectsManagerRef: React.RefObject<MicrophoneEffectsManager | null>
  getMixedStream: (leftElement?: HTMLAudioElement | null, rightElement?: HTMLAudioElement | null, pttActive?: boolean) => Promise<MediaStream | null>
  createMicrophoneStream: () => Promise<MediaStream | null>
  createSmartMicrophoneControl: () => { enable: () => Promise<boolean>; disable: () => void; getStream: () => MediaStream | null; isActive: () => boolean }
  getAvailableAudioOutputDevices: () => Promise<MediaDeviceInfo[]>
  ensureMainAudioContext: () => AudioContext | null
  incrementPlayCount: (trackId: string) => Promise<void>
  clearLeftDeck: () => void
  clearRightDeck: () => void
} | undefined>(undefined)

// ===== PROVIDER =====
export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, initialState)
  const { settings } = useSettings()

  // ===== REFS =====
  const leftAudioRef = useRef<HTMLAudioElement | null>(null)
  const rightAudioRef = useRef<HTMLAudioElement | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const soundEffectsManagerRef = useRef<SoundEffectsManager | null>(null)
  const microphoneEffectsManagerRef = useRef<MicrophoneEffectsManager | null>(null)
  const lastMicrophoneReinitRef = useRef<number>(0) // Per debouncing delle reinizializzazioni
  
  // ✅ FIX: Esponi il micStreamRef globalmente per il test visuale
  useEffect(() => {
    ;(window as any).micStreamRef = micStreamRef
    ;(window as any).getCurrentMicStream = () => micStreamRef.current
    return () => {
      ;(window as any).micStreamRef = null
      ;(window as any).getCurrentMicStream = null
    }
  }, [])

  // ✅ FIX AUTOPLAY: Listener globale per caricamento tracce (spostato dopo le dichiarazioni delle funzioni)

  // ✅ FIX: Riconnetti l'output device immediatamente
  const reconnectOutputDevice = async (): Promise<void> => {
    try {
      const outputDevice = settings?.audio?.outputDevice
      if (!outputDevice || outputDevice === 'default') {
        console.log('🔊 [OUTPUT] Usando dispositivo output predefinito')
        return
      }

      console.log(`🔊 [OUTPUT] Riconnessione immediata a dispositivo: ${outputDevice}`)
      
      // ✅ FIX: Configura immediatamente tutti gli elementi audio
      const audioElements = [leftAudioRef.current, rightAudioRef.current].filter(Boolean)
      
      for (const audioElement of audioElements) {
        if (audioElement) {
          try {
            // ✅ FIX: Usa setSinkId per cambiare immediatamente l'output
            if ('setSinkId' in audioElement) {
              await (audioElement as any).setSinkId(outputDevice)
              console.log(`🔊 [OUTPUT] ✅ Dispositivo output riconnesso immediatamente: ${outputDevice}`)
            } else {
              console.warn('⚠️ [OUTPUT] setSinkId non supportato, usa dispositivo predefinito')
            }
          } catch (error) {
            console.warn(`⚠️ [OUTPUT] Errore riconnessione dispositivo output:`, error)
          }
        }
      }
      
      // ✅ FIX: Configura anche gli elementi audio di streaming se esistono
      const streamingElements = document.querySelectorAll('audio[data-streaming="true"]')
      for (const element of streamingElements) {
        if ('setSinkId' in element) {
          try {
            await (element as any).setSinkId(outputDevice)
            console.log(`🔊 [OUTPUT] ✅ Elemento streaming riconnesso: ${outputDevice}`)
          } catch (error) {
            console.warn(`⚠️ [OUTPUT] Errore riconnessione elemento streaming:`, error)
          }
        }
      }
      
      console.log('🔊 [OUTPUT] ✅ Riconnessione output completata con successo!')
      
    } catch (error) {
      console.error('❌ [OUTPUT] Errore durante la riconnessione output:', error)
      throw error
    }
  }

  // ✅ FIX: Riconnetti il microfono al sistema di streaming esistente
  const reconnectMicrophoneToExistingStream = async (): Promise<void> => {
    if (!micStreamRef.current) {
      console.warn('⚠️ [MIC] Nessun stream microfono disponibile per riconnessione')
      return
    }
    
    // Verifica se esiste già un sistema di streaming attivo
    const existingMicGain = (window as any).currentPTTMicGain
    const existingMixerGain = (window as any).currentPTTMixerGain
    const existingContext = (window as any).currentPTTContext
    
    if (!existingMicGain || !existingMixerGain || !existingContext) {
      console.warn('⚠️ [MIC] Sistema di streaming non trovato, impossibile riconnettere')
      return
    }
    
    try {
      console.log('🎤 [MIC] Riconnessione al sistema di streaming esistente...')
      
      // Disconnetti il vecchio microfono se esiste
      if (existingMicGain) {
        existingMicGain.disconnect()
        console.log('🎤 [MIC] Vecchio microfono disconnesso')
      }
      
      // Crea un nuovo MediaStreamSource per il nuovo microfono
      const newMicSource = existingContext.createMediaStreamSource(micStreamRef.current)
      
      // Crea un nuovo gain per il microfono
      const newMicGain = existingContext.createGain()
      newMicSource.connect(newMicGain)
      
      // Riconnetti al sistema esistente
      newMicGain.connect(existingMixerGain)
      console.log('🎤 [MIC] Microfono riconnesso al mixer esistente')
      
      // Trova il MediaStreamDestination esistente e riconnetti
      const existingDestination = (window as any).currentStreamDestination
      if (existingDestination) {
        newMicGain.connect(existingDestination)
        console.log('🎤 [MIC] Microfono riconnesso al MediaStreamDestination esistente')
      }
      
      // Aggiorna i riferimenti globali
      ;(window as any).currentPTTMicGain = newMicGain
      
      // Imposta il volume iniziale
      const pttActive = state.microphone?.isEnabled || false
      if (pttActive) {
        newMicGain.gain.setValueAtTime(1.0, existingContext.currentTime)
        console.log('🎤 [MIC] Microfono riconnesso e attivato al 100%')
      } else {
        newMicGain.gain.setValueAtTime(0.0, existingContext.currentTime)
        console.log('🎤 [MIC] Microfono riconnesso ma silenziato (PTT non attivo)')
      }
      
      console.log('🎤 [MIC] ✅ Riconnessione completata con successo!')
      
    } catch (error) {
      console.error('❌ [MIC] Errore durante la riconnessione:', error)
      throw error
    }
  }

  // ===== INIZIALIZZAZIONE MANAGER EFFETTI =====
  useEffect(() => {
    const initializeEffectsManagers = async () => {
      try {
        // Inizializza Sound Effects Manager
        const soundEffectsManager = new SoundEffectsManager()
        soundEffectsManager.setCallbacks({
          onDebug: (message) => console.log(message),
          onError: (error) => console.error(error)
        })
        soundEffectsManagerRef.current = soundEffectsManager
        dispatch({ type: 'SET_SOUND_EFFECTS_MANAGER', payload: soundEffectsManager })

        // Inizializza Microphone Effects Manager
        const microphoneEffectsManager = new MicrophoneEffectsManager()
        microphoneEffectsManager.setCallbacks({
          onDebug: (message) => console.log(message),
          onError: (error) => console.error(error)
        })
        microphoneEffectsManagerRef.current = microphoneEffectsManager
        dispatch({ type: 'SET_MICROPHONE_EFFECTS_MANAGER', payload: microphoneEffectsManager })

        console.log('🎵 [INIT] Manager effetti audio inizializzati')
      } catch (error) {
        console.error('❌ [INIT] Errore inizializzazione manager effetti:', error)
      }
    }

    initializeEffectsManagers()
  }, [])

  // ===== INIZIALIZZAZIONE MICROFONO =====
  useEffect(() => {
    const initializeMicrophone = async () => {
      try {
        console.log('🎤 [INIT] Inizializzazione microfono con impostazioni settings...')
        const micStream = await createMicrophoneStream()
        if (micStream) {
          micStreamRef.current = micStream
          console.log('✅ [INIT] Microfono inizializzato con successo con impostazioni corrette:', micStream)
        } else {
          console.warn('⚠️ [INIT] Fallback a microfono generico...')
          // ✅ FIX: Anche il fallback deve usare le impostazioni del microfono
          const fallbackStream = await createMicrophoneStream()
          if (fallbackStream) {
            micStreamRef.current = fallbackStream
            console.log('✅ [INIT] Microfono fallback inizializzato con impostazioni:', fallbackStream)
          } else {
            console.error('❌ [INIT] Impossibile inizializzare microfono anche con fallback')
          }
        }
      } catch (e: any) {
        console.warn('⚠️ [INIT] Microfono non disponibile all\'avvio:', e.message)
        // Non è un errore critico, il microfono verrà richiesto quando necessario
      }
    }

    initializeMicrophone()
  }, [])

  // ===== FUNZIONE STREAMING AUDIO COMPLETAMENTE RICOSTRUITA =====
  const getMixedStream = async (leftElement?: HTMLAudioElement | null, rightElement?: HTMLAudioElement | null, pttActive: boolean = false): Promise<MediaStream | null> => {
    console.log('🎵 [GETMIXEDSTREAM] Inizio getMixedStream...')
    console.log('🎵 [GETMIXEDSTREAM] leftElement:', !!leftElement)
    console.log('🎵 [GETMIXEDSTREAM] rightElement:', !!rightElement)
    console.log('🎵 [GETMIXEDSTREAM] pttActive:', pttActive)
    
    try {
              // Get current settings
        const settings = await localDatabase.getSettings();
        console.log('🎵 [GETMIXEDSTREAM] Settings ottenuti:', !!settings)
        // ✅ USA FORMATO DAI SETTINGS invece di hardcoding
        console.log('🔧 [DEBUG] Settings completi:', settings)
        console.log('🔧 [DEBUG] settings.streaming:', settings?.streaming)
        console.log('🔧 [DEBUG] settings.streaming?.defaultFormat:', settings?.streaming?.defaultFormat)
        
        const streamingFormat = settings?.streaming?.defaultFormat || 'opus'
        const streamingBitrate = settings?.streaming?.defaultBitrate || 128
        const streamingChannels = settings?.streaming?.channels || 2
        const audioSampleRate = settings?.audio?.sampleRate || 48000
        
        console.log('🔊 [STREAMING] Using format from settings:', streamingFormat);
        console.log('🔊 [STREAMING] Bitrate:', streamingBitrate, 'Channels:', streamingChannels, 'SampleRate:', audioSampleRate);
      
      // ✅ CRITICAL FIX: SERVER CHECK con configurazione RadioBoss
      try {
        console.log('🔍 [SERVER CHECK] Verifica connessione al server streaming...')
        
        // ✅ CRITICAL FIX: Usa le impostazioni passate come parametro o leggi dal database
        
        try {
          let s = settings // Usa le impostazioni passate come parametro
          console.log('🔍 [SERVER CHECK] Parametro settings ricevuto:', !!s)
          console.log('🔍 [SERVER CHECK] Tipo di settings:', typeof s)
          
          // ✅ CRITICAL FIX: FORZA sempre la lettura dal database per evitare problemi di timing
          console.log('🔍 [SERVER CHECK] FORZO lettura dal database per evitare problemi...')
          
          // Aspetta che il database sia inizializzato e forza lettura settings
          await localDatabase.waitForInitialization()
          s = await localDatabase.getSettings()
          console.log('🔍 [SERVER CHECK] Settings forzati dal database:', !!s)
          
          // ✅ USA SERVER DI DEFAULT SELEZIONATO
          const defaultServer = await localDatabase.getDefaultIcecastServer()
          console.log('🔍 [SERVER CHECK] DEBUG - Server di default:', defaultServer)
          
          if (!defaultServer) {
            throw new Error('IMPOSTAZIONI STREAMING INCOMPLETE: Nessun server Icecast configurato')
          }
          
          // ✅ CRITICAL FIX: Verifica che il server di default sia valido
          if (!defaultServer.host || !defaultServer.port) {
            throw new Error('IMPOSTAZIONI STREAMING INCOMPLETE: Server di default non valido')
          }
          
          if (defaultServer.host.trim() === '' || defaultServer.port === 0) {
            throw new Error('IMPOSTAZIONI STREAMING INCOMPLETE: Host vuoto o porta 0 nel server di default')
          }
          
          console.log('🔍 [SERVER CHECK] ✅ Server di default valido, procedo con test connessione...')
          
          // ✅ CRITICAL FIX: FFmpeg verrà avviato da StreamingManager.startStreaming()
          console.log('🔄 [GETMIXEDSTREAM] FFmpeg verrà avviato da StreamingManager.startStreaming()')
          
          // ✅ CRITICAL FIX: Test connessione con server di default selezionato
          const testUrl = `http://${defaultServer.host}:${defaultServer.port}${defaultServer.mount}`
          console.log('🔍 [SERVER CHECK] Connessione Icecast configurata:', testUrl)
          console.log('🔍 [SERVER CHECK] Server:', defaultServer.name, 'Host:', defaultServer.host, ', Porta:', defaultServer.port)
          
          // ✅ CRITICAL FIX: Test connessione HTTP con parametri RadioBoss
          console.log('🔍 [SERVER CHECK] Test connessione HTTP su:', testUrl)
          
          try {
            await fetch(testUrl, { 
              method: 'HEAD',
              mode: 'no-cors'
            })
            console.log('✅ [SERVER CHECK] Server Icecast raggiungibile su', testUrl)
          } catch (fetchError) {
            console.warn('⚠️ [SERVER CHECK] Test HTTP fallito, ma continuo con streaming:', fetchError)
          }
          
          console.log('✅ [STREAMING] Server streaming verificato, procedo con la cattura audio...')
          
        } catch (serverError) {
          console.error('❌ [SERVER CHECK] Errore verifica server:', serverError)
          throw serverError
        }
        
        // ✅ CORREZIONE: Assicurati che l'AudioContext principale sia disponibile
        let mixContext = ensureMainAudioContext()
        
        if (!mixContext) {
          throw new Error('Impossibile creare AudioContext per streaming')
        }
        
        console.log('🎵 [MIX] AudioContext principale disponibile per streaming')

        // Verifica che sia valido
        if (!mixContext || typeof mixContext.createMediaElementSource !== 'function') {
          throw new Error('AudioContext non valido')
        }

        if (!mixContext.destination) {
          throw new Error('AudioContext non ha destination')
        }

        // Crea destination stream
        const destinationStream = mixContext.createMediaStreamDestination()
        const mixerGain = mixContext.createGain()
        mixerGain.connect(destinationStream)

        // ✅ CRITICAL FIX: Imposta il volume iniziale del mixer per lo streaming
        mixerGain.gain.setValueAtTime(1.0, mixContext.currentTime) // Streaming sempre al 100% inizialmente
        
        // ✅ FIX: Salva il riferimento al MediaStreamDestination per riconnessioni future
        ;(window as any).currentStreamDestination = destinationStream
        
        // ✅ ESPONI nodi globali per gli effetti audio
        ;(window as any).mixerGain = mixerGain;
        ;(window as any).destinationStream = destinationStream;

        // ✅ ESPONI AudioContext e MixerGain globalmente per StreamingManager
        ;(window as any).globalAudioContext = state.audioContext
        ;(window as any).globalMixerGain = mixerGain
        
        console.log('🌍 [GLOBAL] AudioContext e MixerGain esposti globalmente per StreamingManager')
        
        // ✅ CRITICAL FIX: Connetti IMMEDIATAMENTE l'analyser se StreamingManager è disponibile
        const streamingManager = (window as any).streamingManager
        if (streamingManager && streamingManager.connectDirectly) {
          console.log('🔄 [GLOBAL] StreamingManager trovato - connessione diretta immediata...')
          streamingManager.connectDirectly(mixContext, mixerGain)
        }

        // Salva riferimenti globali
        ;(window as any).currentMixerGain = mixerGain
        ;(window as any).currentMixContext = mixContext
        
        // Esponi funzione master volume
        ;(window as any).audioContextSetMasterVolume = (volume: number) => {
          if (mixerGain && mixContext) {
            mixerGain.gain.setValueAtTime(volume, mixContext.currentTime)
          }
        }

        let hasRealAudio = false

        // 🎵 CAPTURE AUDIO REALE DAI DECK - STREAMING SEPARATO DAL MONITORING

        // ✅ CRITICAL FIX: Cerca dinamicamente gli elementi audio dei deck nel DOM
        // Questo risolve il problema dell'ordine di attivazione (streaming prima vs deck prima)
        const leftAudioElement = leftElement || leftAudioRef.current || document.querySelector('audio.deck-audio[data-deck="A"]') as HTMLAudioElement
        const rightAudioElement = rightElement || rightAudioRef.current || document.querySelector('audio.deck-audio[data-deck="B"]') as HTMLAudioElement

        console.log('🔍 [DEBUG AUDIO ELEMENTS] Elementi audio trovati:', {
          leftElement: !!leftElement,
          leftAudioRef: !!leftAudioRef.current,
          leftAudioDOM: !!document.querySelector('audio.deck-audio[data-deck="A"]'),
          leftAudioElement: !!leftAudioElement,
          leftAudioSrc: leftAudioElement?.src,
          rightElement: !!rightElement,
          rightAudioRef: !!rightAudioRef.current,
          rightAudioDOM: !!document.querySelector('audio.deck-audio[data-deck="B"]'),
          rightAudioElement: !!rightAudioElement,
          rightAudioSrc: rightAudioElement?.src
        })
        
        // ✅ CRITICAL DEBUG: Verifica tutti gli elementi audio nel DOM
        const allAudioElements = document.querySelectorAll('audio')
        console.log('🔍 [DEBUG ALL AUDIO] Tutti gli elementi audio nel DOM:', {
          total: allAudioElements.length,
          elements: Array.from(allAudioElements).map((audio, index) => ({
            index,
            tagName: audio.tagName,
            className: audio.className,
            dataDeck: audio.getAttribute('data-deck'),
            src: audio.src,
            id: audio.id
          }))
        })
        
        // ✅ CRITICAL DEBUG: Verifica se ci sono elementi audio con classi diverse
        const alternativeLeftAudio = (document.querySelector('audio[data-deck="A"]') as HTMLAudioElement) || 
                                    (document.querySelector('audio[data-deck="left"]') as HTMLAudioElement) ||
                                    (document.querySelector('audio.left-deck') as HTMLAudioElement) ||
                                    (document.querySelector('audio[data-side="left"]') as HTMLAudioElement)
        
        const alternativeRightAudio = (document.querySelector('audio[data-deck="B"]') as HTMLAudioElement) || 
                                     (document.querySelector('audio[data-deck="right"]') as HTMLAudioElement) ||
                                     (document.querySelector('audio.right-deck') as HTMLAudioElement) ||
                                     (document.querySelector('audio[data-side="right"]') as HTMLAudioElement)
        
        console.log('🔍 [DEBUG ALTERNATIVE AUDIO] Elementi audio alternativi trovati:', {
          leftAlternative: !!alternativeLeftAudio,
          leftAlternativeSrc: alternativeLeftAudio?.src,
          rightAlternative: !!alternativeRightAudio,
          rightAlternativeSrc: alternativeRightAudio?.src
        })
        
        // ✅ CRITICAL FIX: Usa elementi alternativi se quelli principali non sono disponibili
        const finalLeftAudio = leftAudioElement || alternativeLeftAudio
        const finalRightAudio = rightAudioElement || alternativeRightAudio
        
        console.log('🔍 [DEBUG FINAL AUDIO] Elementi audio finali selezionati:', {
          finalLeft: !!finalLeftAudio,
          finalLeftSrc: finalLeftAudio?.src,
          finalRight: !!finalRightAudio,
          finalRightSrc: finalRightAudio?.src
        })

        // Deck sinistro - STREAMING (sempre al 100%)
        if (finalLeftAudio && finalLeftAudio.src && finalLeftAudio.src.trim() !== '') {
          try {
            console.log('🎵 [STREAMING] Tentativo cattura deck sinistro per streaming...')
            
            // ✅ CRITICAL FIX: Notifica di inizio cattura
            if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
              ;(window as any).addStreamingNotification('info', 'Cattura Audio', 'Tentativo cattura deck sinistro per streaming...', 'audio')
            }
            
            // ✅ CRITICAL FIX: Crea un elemento audio CLONATO per lo streaming
            const leftStreamAudio = new Audio(finalLeftAudio.src)
            
            // ✅ CRITICAL FIX: Sincronizza TUTTE le proprietà dell'audio originale
            leftStreamAudio.currentTime = finalLeftAudio.currentTime
            leftStreamAudio.playbackRate = finalLeftAudio.playbackRate
            leftStreamAudio.loop = finalLeftAudio.loop
            leftStreamAudio.muted = finalLeftAudio.muted
            
            // ✅ CRITICAL FIX: Volume streaming SEMPRE al 100%, indipendentemente dal volume locale
            leftStreamAudio.volume = 1.0
            
            // ✅ CRITICAL FIX: Sincronizza lo stato di riproduzione
            if (finalLeftAudio.paused) {
              leftStreamAudio.pause()
            } else {
              leftStreamAudio.play().catch(console.error)
            }
            
        // ✅ CRITICAL FIX: Sincronizzazione continua della posizione durante la riproduzione
        const syncLeftPosition = () => {
          // ✅ CRITICAL FIX: Ottieni sempre gli elementi audio più recenti
          const currentLeftAudio = leftAudioRef.current
          
          if (leftStreamAudio && currentLeftAudio) {
            // ✅ CRITICAL FIX: Verifica se l'elemento audio locale è cambiato (nuova traccia)
            if (leftStreamAudio.src !== currentLeftAudio.src) {
              console.log(`🔄 [SYNC LEFT] Rilevato cambio traccia - aggiornando elemento audio dello streaming`)
              leftStreamAudio.src = currentLeftAudio.src
              leftStreamAudio.load()
              
              // Sincronizza tutte le proprietà
              leftStreamAudio.currentTime = currentLeftAudio.currentTime
              leftStreamAudio.playbackRate = currentLeftAudio.playbackRate
              leftStreamAudio.loop = currentLeftAudio.loop
              leftStreamAudio.muted = currentLeftAudio.muted
              leftStreamAudio.volume = 1.0
              
            // Sincronizza lo stato di riproduzione
            if (currentLeftAudio.paused) {
              console.log('🔄 [SYNC LEFT] Pausa leftStreamAudio - audio originale in pausa')
              leftStreamAudio.pause()
            } else {
              console.log('🔄 [SYNC LEFT] Riproduzione leftStreamAudio - audio originale in riproduzione')
              leftStreamAudio.play().catch((e) => {
                console.error('❌ [SYNC LEFT] Errore riproduzione leftStreamAudio:', e)
              })
            }
            } else {
              // Sincronizzazione normale della posizione
              const timeDiff = Math.abs(leftStreamAudio.currentTime - currentLeftAudio.currentTime)
              // Sincronizza solo se la differenza è significativa (> 0.05s) per maggiore precisione
              if (timeDiff > 0.05) {
                console.log(`🔄 [SYNC LEFT] Sincronizzazione posizione: ${currentLeftAudio.currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`)
                leftStreamAudio.currentTime = currentLeftAudio.currentTime
              }
            }
          }
        }
        
        // ✅ CRITICAL FIX: Salva riferimento globale per sincronizzazione
        ;(window as any).leftStreamAudio = leftStreamAudio
        
        // ✅ CRITICAL FIX: Avvia sincronizzazione continua solo se non è già attiva
        if (!(window as any).leftSyncInterval) {
          console.log('🔄 [SYNC LEFT] Avvio sincronizzazione continua per deck sinistro')
          ;(window as any).leftSyncInterval = setInterval(syncLeftPosition, 500) // ✅ PERFORMANCE: Ridotto da 200ms a 500ms
        }
            
            // ✅ RIMOSSO: Event listeners che fermavano la sincronizzazione durante cambio traccia
            // La sincronizzazione continua deve rimanere attiva per mantenere il stream audio
            
            const leftSource = mixContext.createMediaElementSource(leftStreamAudio)
            const leftStreamGain = mixContext.createGain()
            
            // ✅ CROSSFADER: Applica il crossfader al deck sinistro con logica deck vuoti
            const leftDeckEmpty = !state.leftDeck.track
            const rightDeckEmpty = !state.rightDeck.track
            let leftCrossfaderVolume: number
            
            if (leftDeckEmpty && rightDeckEmpty) {
              leftCrossfaderVolume = 0
            } else if (leftDeckEmpty) {
              leftCrossfaderVolume = 0
            } else if (rightDeckEmpty) {
              leftCrossfaderVolume = 1.0
            } else {
              leftCrossfaderVolume = 1.0 - (state.crossfader || 0.5)
            }
            
            leftStreamGain.gain.setValueAtTime(leftCrossfaderVolume, mixContext.currentTime)
            
            console.log('🔗 [STREAMING] Collegamento audio deck sinistro:', {
              leftSource: !!leftSource,
              leftStreamGain: !!leftStreamGain,
              mixerGain: !!mixerGain,
              destinationStream: !!destinationStream,
              crossfaderVolume: leftCrossfaderVolume
            })
            
            leftSource.connect(leftStreamGain)
            leftStreamGain.connect(mixerGain)
            
            console.log('✅ [STREAMING] Audio deck sinistro collegato: leftStreamAudio → leftSource → leftStreamGain → mixerGain → destinationStream')
            
            // Salva il riferimento al gain del deck sinistro per PTT e crossfader
            ;(window as any).leftDeckStreamGain = leftStreamGain
            
            // ✅ CRITICAL FIX: Notifica di successo cattura
            if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
              ;(window as any).addStreamingNotification('success', 'Audio Catturato', 'Deck sinistro catturato con successo per streaming', 'audio')
            }
            
            // ✅ CRITICAL FIX: Sincronizza il playback con l'audio locale
            leftStreamAudio.currentTime = finalLeftAudio.currentTime
            
            console.log('🔍 [STREAMING] Stato audio originale:', {
              paused: finalLeftAudio.paused,
              currentTime: finalLeftAudio.currentTime,
              duration: finalLeftAudio.duration,
              src: finalLeftAudio.src,
              volume: finalLeftAudio.volume,
              readyState: finalLeftAudio.readyState,
              networkState: finalLeftAudio.networkState
            })
            
            console.log('🔍 [STREAMING] Stato leftStreamAudio:', {
              paused: leftStreamAudio.paused,
              currentTime: leftStreamAudio.currentTime,
              duration: leftStreamAudio.duration,
              src: leftStreamAudio.src,
              volume: leftStreamAudio.volume,
              readyState: leftStreamAudio.readyState,
              networkState: leftStreamAudio.networkState
            })
            
            // ✅ CRITICAL FIX: Forza sempre il volume dell'audio clonato per lo streaming
            leftStreamAudio.volume = 1.0  // VOLUME MASSIMO per il clonato
            leftStreamAudio.muted = false // Assicurati che non sia mutato
            
            // ✅ CRITICAL FIX: Forza crossfader e gain per audio clonato
            if (state.audioContext) {
              leftStreamGain.gain.setValueAtTime(1.0, state.audioContext.currentTime)
              mixerGain.gain.setValueAtTime(1.0, state.audioContext.currentTime)
            } else {
              leftStreamGain.gain.value = 1.0
              mixerGain.gain.value = 1.0
            }
            
            console.log('🔊 [STREAMING] Gain forzati - leftStreamGain: 1.0, mixerGain: 1.0')
            
            if (!finalLeftAudio.paused) {
              console.log('🎵 [STREAMING] Avvio riproduzione leftStreamAudio...')
              leftStreamAudio.play().then(() => {
                console.log('✅ [STREAMING] leftStreamAudio riprodotto con successo')
              }).catch((e) => {
                console.error('❌ [STREAMING] Errore riproduzione leftStreamAudio:', e)
              })
            } else {
              console.log('⚠️ [STREAMING] leftStreamAudio non avviato - audio originale in pausa')
            }
            
            // ✅ CRITICAL FIX: FORZA SEMPRE riproduzione con sincronizzazione
            console.log('🎵 [STREAMING] FORZO SEMPRE riproduzione leftStreamAudio per streaming...')
            console.log('🔍 [DEBUG] finalLeftAudio:', finalLeftAudio)
            console.log('🔍 [DEBUG] leftStreamAudio:', leftStreamAudio)
            console.log('🔍 [DEBUG] finalLeftAudio.currentTime:', finalLeftAudio?.currentTime)
            console.log('🔍 [DEBUG] leftStreamAudio.src:', leftStreamAudio?.src)
            
            try {
              // ✅ SINCRONIZZA il tempo dell'audio clonato con l'originale
              leftStreamAudio.currentTime = finalLeftAudio.currentTime
              leftStreamAudio.playbackRate = finalLeftAudio.playbackRate || 1.0
              console.log('✅ [STREAMING] Sincronizzazione tempo completata')
              
              // ✅ FORZA la riproduzione SEMPRE
              await leftStreamAudio.play()
              console.log('✅ [STREAMING] leftStreamAudio FORZATO riprodotto con successo')
              
              // ✅ AVVIA monitoraggio continuo per mantenere sincronizzazione
              if (!(window as any).leftStreamAudioSync) {
                ;(window as any).leftStreamAudioSync = setInterval(() => {
                  if (finalLeftAudio && leftStreamAudio) {
                    // Sincronizza sempre il tempo
                    const timeDiff = Math.abs(leftStreamAudio.currentTime - finalLeftAudio.currentTime)
                    if (timeDiff > 0.5) { // Se differenza > 0.5 secondi
                      leftStreamAudio.currentTime = finalLeftAudio.currentTime
                      console.log('🔄 [STREAMING] Sincronizzato leftStreamAudio:', finalLeftAudio.currentTime)
                    }
                    
                    // Assicurati che stia sempre riproducendo
                    if (leftStreamAudio.paused && !finalLeftAudio.paused) {
                      leftStreamAudio.play().catch(console.warn)
                    }
                  }
                }, 1000) // Ogni secondo
              }
              
              // ✅ VERIFICA IMMEDIATA che l'audio sia effettivamente in riproduzione
              console.log('🔍 [STREAMING] Verifica leftStreamAudio FINALE:', {
                paused: leftStreamAudio.paused,
                currentTime: leftStreamAudio.currentTime,
                volume: leftStreamAudio.volume,
                muted: leftStreamAudio.muted,
                duration: leftStreamAudio.duration,
                readyState: leftStreamAudio.readyState
              })
              
            } catch (e) {
              console.error('❌ [STREAMING] Errore riproduzione FORZATA leftStreamAudio:', e)
            }
            
            hasRealAudio = true
            console.log('✅ [STREAMING] Deck sinistro catturato con successo (volume streaming: 100%, separato dal locale)')
          } catch (e: any) {
            console.error('❌ [STREAMING] Errore cattura deck sinistro:', e.message)
          }
        } else {
          console.log('⚠️ [STREAMING] Deck sinistro non disponibile per cattura')
        }

        // Deck destro - STREAMING (sempre al 100%)
        if (finalRightAudio && finalRightAudio.src && finalRightAudio.src.trim() !== '') {
          try {
            console.log('🎵 [STREAMING] Tentativo cattura deck destro per streaming...')
            
            // ✅ CRITICAL FIX: Notifica di inizio cattura
            if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
              ;(window as any).addStreamingNotification('info', 'Cattura Audio', 'Tentativo cattura deck destro per streaming...', 'audio')
            }
            
            // ✅ CRITICAL FIX: Crea un elemento audio CLONATO per lo streaming
            const rightStreamAudio = new Audio(finalRightAudio.src)
            
            // ✅ CRITICAL FIX: Sincronizza TUTTE le proprietà dell'audio originale
            rightStreamAudio.currentTime = finalRightAudio.currentTime
            rightStreamAudio.playbackRate = finalRightAudio.playbackRate
            rightStreamAudio.loop = finalRightAudio.loop
            rightStreamAudio.muted = finalRightAudio.muted
            
            // ✅ CRITICAL FIX: Volume streaming SEMPRE al 100%, indipendentemente dal volume locale
            rightStreamAudio.volume = 1.0
            
            // ✅ CRITICAL FIX: Sincronizza lo stato di riproduzione
            if (finalRightAudio.paused) {
              rightStreamAudio.pause()
            } else {
              rightStreamAudio.play().catch(console.error)
            }
            
        // ✅ CRITICAL FIX: Sincronizzazione continua della posizione durante la riproduzione
        const syncRightPosition = () => {
          // ✅ CRITICAL FIX: Ottieni sempre gli elementi audio più recenti
          const currentRightAudio = rightAudioRef.current
          
          if (rightStreamAudio && currentRightAudio) {
            // ✅ CRITICAL FIX: Verifica se l'elemento audio locale è cambiato (nuova traccia)
            if (rightStreamAudio.src !== currentRightAudio.src) {
              console.log(`🔄 [SYNC RIGHT] Rilevato cambio traccia - aggiornando elemento audio dello streaming`)
              rightStreamAudio.src = currentRightAudio.src
              rightStreamAudio.load()
              
              // Sincronizza tutte le proprietà
              rightStreamAudio.currentTime = currentRightAudio.currentTime
              rightStreamAudio.playbackRate = currentRightAudio.playbackRate
              rightStreamAudio.loop = currentRightAudio.loop
              rightStreamAudio.muted = currentRightAudio.muted
              rightStreamAudio.volume = 1.0
              
              // Sincronizza lo stato di riproduzione
              if (currentRightAudio.paused) {
                rightStreamAudio.pause()
              } else {
                rightStreamAudio.play().catch(console.error)
              }
            } else {
              // Sincronizzazione normale della posizione
              const timeDiff = Math.abs(rightStreamAudio.currentTime - currentRightAudio.currentTime)
              // Sincronizza solo se la differenza è significativa (> 0.05s) per maggiore precisione
              if (timeDiff > 0.05) {
                console.log(`🔄 [SYNC RIGHT] Sincronizzazione posizione: ${currentRightAudio.currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`)
                rightStreamAudio.currentTime = currentRightAudio.currentTime
              }
            }
          }
        }
        
        // ✅ CRITICAL FIX: Salva riferimento globale per sincronizzazione
        ;(window as any).rightStreamAudio = rightStreamAudio
        
        // ✅ CRITICAL FIX: Avvia sincronizzazione continua solo se non è già attiva
        if (!(window as any).rightSyncInterval) {
          console.log('🔄 [SYNC RIGHT] Avvio sincronizzazione continua per deck destro')
          ;(window as any).rightSyncInterval = setInterval(syncRightPosition, 500) // ✅ PERFORMANCE: Ridotto da 200ms a 500ms
        }
            
            // ✅ RIMOSSO: Event listeners che fermavano la sincronizzazione durante cambio traccia
            // La sincronizzazione continua deve rimanere attiva per mantenere il stream audio
            
            const rightSource = mixContext.createMediaElementSource(rightStreamAudio)
            const rightStreamGain = mixContext.createGain()
            
            // ✅ CROSSFADER: Applica il crossfader al deck destro con logica deck vuoti
            const leftDeckEmpty = !state.leftDeck.track
            const rightDeckEmpty = !state.rightDeck.track
            let rightCrossfaderVolume: number
            
            if (leftDeckEmpty && rightDeckEmpty) {
              rightCrossfaderVolume = 0
            } else if (leftDeckEmpty) {
              rightCrossfaderVolume = 1.0
            } else if (rightDeckEmpty) {
              rightCrossfaderVolume = 0
            } else {
              rightCrossfaderVolume = state.crossfader || 0.5
            }
            
            rightStreamGain.gain.setValueAtTime(rightCrossfaderVolume, mixContext.currentTime)
            
            rightSource.connect(rightStreamGain)
            rightStreamGain.connect(mixerGain)
            
            // Salva il riferimento al gain del deck destro per PTT e crossfader
            ;(window as any).rightDeckStreamGain = rightStreamGain
            
            // ✅ CRITICAL FIX: Notifica di successo cattura
            if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
              ;(window as any).addStreamingNotification('success', 'Audio Catturato', 'Deck destro catturato con successo per streaming', 'audio')
            }
            
            
            hasRealAudio = true
            console.log('✅ [STREAMING] Deck destro catturato con successo (volume streaming: 100%, separato dal locale)')
          } catch (e: any) {
            console.error('❌ [STREAMING] Errore cattura deck destro:', e.message)
          }
        } else {
          console.log('⚠️ [STREAMING] Deck destro non disponibile per cattura')
        }

        // 🎤 MICROFONO
        console.log('🎤 [MIC CHECK] Stato microfono:', {
          micStreamRef: !!micStreamRef.current,
          isEnabled: state.microphone.isEnabled,
          isMuted: state.microphone.isMuted,
          micStream: micStreamRef.current
        })
        
        // ✅ CORREZIONE: Usa il microfono dalle impostazioni invece di quello generico
        if (!micStreamRef.current) {
          try {
            console.log('🎤 [MIC] Richiesta accesso al microfono con impostazioni settings...')
            const micStream = await createMicrophoneStream()
            if (micStream) {
              micStreamRef.current = micStream
              console.log('🎤 [MIC] Accesso al microfono ottenuto con impostazioni corrette:', micStream)
            } else {
              console.warn('⚠️ [MIC] Fallback a microfono generico...')
              // ✅ FIX: Anche il fallback deve usare le impostazioni del microfono
              const fallbackStream = await createMicrophoneStream()
              if (fallbackStream) {
                micStreamRef.current = fallbackStream
                console.log('🎤 [MIC] Fallback microfono ottenuto con impostazioni:', fallbackStream)
              } else {
                console.error('❌ [MIC] Impossibile ottenere microfono anche con fallback')
              }
            }
          } catch (e: any) {
            console.error('❌ [MIC] Errore accesso al microfono:', e.message)
          }
        }
        
        // ✅ CRITICAL FIX: Crea SEMPRE il microfono per lo streaming (non solo per PTT)
        if (micStreamRef.current) {
          console.log('🎤 [MIC] Creazione MediaStreamSource per microfono...')
          try {
            const micSource = mixContext.createMediaStreamSource(micStreamRef.current)
            
            // ✅ CRITICAL FIX: Crea un gain separato per il microfono per gestire PTT
            const micGain = mixContext.createGain()
            micSource.connect(micGain)
            
            // ✅ CRITICAL FIX: Connetto SEMPRE il microfono al MediaStreamDestination per lo streaming
            // (La logica per distinguere PTT DJ-to-DJ vs PTT Live viene gestita nel RemoteDJHost)
            micGain.connect(destinationStream)
            console.log('🎤 [MIC] Microfono connesso al MediaStreamDestination per streaming')
            
            // ✅ FIX: Connetto anche al mixer locale per il PTT
            micGain.connect(mixerGain)
            console.log('🎤 [MIC] Microfono connesso anche al mixer locale per PTT')
            
            // ✅ FIX: Salva SEMPRE i riferimenti PTT per aggiornamenti futuri
            ;(window as any).currentPTTMicGain = micGain
            ;(window as any).currentPTTMixerGain = mixerGain
            ;(window as any).currentPTTContext = mixContext
            
            // ✅ CRITICAL FIX: Controlla se i microfoni sono mutati
            const isMicMuted = (window as any).__isMicMuted__ || false
            const isHostMicMuted = (window as any).__isHostMicMuted__ || false
            
            // ✅ CRITICAL FIX: Se entrambi i microfoni sono mutati, non inviare audio in streaming
            if (isMicMuted && isHostMicMuted) {
              micGain.gain.setValueAtTime(0.0, mixContext.currentTime) // Microfono completamente silenziato
              console.log('🎤 [MIC] 🚫 Microfono silenziato per streaming - entrambi i microfoni sono mutati')
            } else if (pttActive) {
              micGain.gain.setValueAtTime(1.0, mixContext.currentTime) // Microfono al 100%
              console.log('🎤 [PTT] Microfono attivato al 100% per PTT e streaming')
            } else {
              micGain.gain.setValueAtTime(0.0, mixContext.currentTime) // Microfono al 0%
              console.log('🎤 [MIC] Microfono creato ma silenziato (PTT non attivo) - disponibile per streaming')
            }
            
            console.log('🎤 [MIC] Riferimenti PTT salvati globalmente:', {
              currentPTTMicGain: !!(window as any).currentPTTMicGain,
              currentPTTMixerGain: !!(window as any).currentPTTMixerGain,
              currentPTTContext: !!(window as any).currentPTTContext
            })
            
            hasRealAudio = true
            console.log('✅ [MIC] Microfono creato e connesso con successo per streaming e PTT')
            
            // ✅ NUOVO: Aggiungi audio dei DJ remoti allo streaming
            if (state.remoteDJs.streams.size > 0) {
              console.log(`🎤 [REMOTE DJ] Aggiungendo ${state.remoteDJs.streams.size} DJ remoti allo streaming...`)
              
              state.remoteDJs.streams.forEach((stream, clientId) => {
                try {
                  // ✅ CRITICAL FIX: Volume al 100% per qualità massima live streaming
                  const remoteVolume = 1.0 // ✅ FORZATO: 100% per qualità massima come l'host
                  
                  // Crea MediaStreamSource per il DJ remoto
                  const remoteSource = mixContext.createMediaStreamSource(stream)
                  const remoteGain = mixContext.createGain()
                  remoteSource.connect(remoteGain)
                  
                  // Connetti al destination per lo streaming
                  remoteGain.connect(destinationStream)
                  
                  // ✅ CRITICAL FIX: Volume sempre al 100% per live streaming (come l'host)
                  remoteGain.gain.setValueAtTime(remoteVolume, mixContext.currentTime)
                  console.log(`🎤 [REMOTE DJ] DJ ${clientId} connesso allo streaming con volume ${Math.round(remoteVolume * 100)}% (QUALITÀ MASSIMA)`)
                  
                  // ✅ CRITICAL FIX: NON controllare mute per DJ remoti nel live streaming
                  // I DJ remoti devono sempre andare in live quando PTT Live è attivo
                  console.log(`🎤 [REMOTE DJ] DJ ${clientId} sempre attivo per live streaming (nessun controllo mute)`)
                  
                  hasRealAudio = true
                } catch (error) {
                  console.error(`❌ [REMOTE DJ] Errore connessione DJ ${clientId} allo streaming:`, error)
                }
              })
              
              console.log('✅ [REMOTE DJ] Tutti i DJ remoti connessi allo streaming')
            }
        
        console.log('🔄 [GETMIXEDSTREAM] Passaggio critico - prima del return...')
            
            try {
              // ✅ CRITICAL FIX: Notifica di successo microfono
              if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
                ;(window as any).addStreamingNotification('success', 'Microfono Attivo', 'Microfono creato e connesso con successo per streaming e PTT', 'audio')
              }
              console.log('🔄 [GETMIXEDSTREAM] Notifica microfono inviata...')
            } catch (error) {
              console.error('❌ [GETMIXEDSTREAM] Errore notifica microfono:', error)
            }
          } catch (e: any) {
            console.error('❌ [MIC] Errore creazione microfono:', e.message)
          }
        } else {
          console.warn('⚠️ [MIC] Microfono non disponibile per streaming:', {
            micStreamRef: !!micStreamRef.current,
            isEnabled: state.microphone.isEnabled,
            isMuted: state.microphone.isMuted
          })
        }

        // 🚨 FALLBACK OSCILLATOR SE NECESSARIO
        if (!hasRealAudio) {
          try {
            const oscillator = mixContext.createOscillator()
            const gainNode = mixContext.createGain()
            
            oscillator.frequency.setValueAtTime(440, mixContext.currentTime)
            gainNode.gain.setValueAtTime(0.1, mixContext.currentTime)
            
            oscillator.connect(gainNode)
            gainNode.connect(mixerGain)
            
            oscillator.start()
          } catch (e: any) {
            // Ignora errori per l'oscillator
          }
        }

        // 📡 NOTIFICHE FINALI
        if (hasRealAudio) {
          // ✅ CRITICAL FIX: Notifica di successo con audio reale
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('success', 'Streaming Successo', '✅ STREAMING SUCCESSO: Audio reale catturato!', 'streaming')
          } else {
            console.log('✅ [STREAMING] Audio reale catturato con successo!')
          }
        } else {
          // ✅ CRITICAL FIX: Notifica di warning per fallback
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('warning', 'Streaming Warning', '⚠️ STREAMING PROBLEMA: Solo oscillator, nessun audio reale!', 'streaming')
          } else {
            console.warn('⚠️ [STREAMING] Solo oscillator, nessun audio reale!')
          }
        }

        // ✅ CRITICAL FIX: Assicurati che ci sia sempre un stream valido
        if (!hasRealAudio) {
          console.log('⚠️ [STREAMING] Nessun audio attivo, creo stream silenzioso per mantenere connessione...')
          
          // Crea un oscillator silenzioso per mantenere la connessione
          const silentOscillator = mixContext.createOscillator()
          const silentGain = mixContext.createGain()
          silentGain.gain.setValueAtTime(0, mixContext.currentTime) // Completamente silenzioso
          silentOscillator.connect(silentGain)
          silentGain.connect(destinationStream)
          silentOscillator.start()
          
          console.log('✅ [STREAMING] Stream silenzioso creato per mantenere connessione streaming')
        }
        
        try {
          // ✅ CRITICAL FIX: Notifica di completamento
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('success', 'Streaming Ready', '🎵 Mixed stream creato con successo! Audio pronto per streaming.', 'streaming')
          }
          console.log('🔄 [GETMIXEDSTREAM] Notifica completamento inviata...')
        } catch (error) {
          console.error('❌ [GETMIXEDSTREAM] Errore notifica completamento:', error)
        }
        
        // ✅ FFmpeg già avviato all'inizio di getMixedStream
        
        console.log('✅ [STREAMING] getMixedStream completato - stream valido restituito')
        console.log('🎵 [GETMIXEDSTREAM] Stream restituito:', !!destinationStream.stream, destinationStream.stream?.active, destinationStream.stream?.getTracks().length)
        
        // ✅ CRITICAL FIX: Avvia sincronizzazione continua se non è già attiva
        if (typeof window !== 'undefined' && (window as any).startContinuousSync) {
          console.log('🔄 [GETMIXEDSTREAM] Avvio sincronizzazione continua...')
          ;(window as any).startContinuousSync()
        } else {
          console.log('⚠️ [GETMIXEDSTREAM] startContinuousSync non disponibile, riprovo tra 500ms...')
          setTimeout(() => {
            if (typeof window !== 'undefined' && (window as any).startContinuousSync) {
              console.log('🔄 [GETMIXEDSTREAM] Avvio sincronizzazione continua (ritardato)...')
              ;(window as any).startContinuousSync()
            } else {
              console.error('❌ [GETMIXEDSTREAM] startContinuousSync ancora non disponibile')
            }
          }, 500)
        }
        
        console.log('🔄 [GETMIXEDSTREAM] Ultimo passaggio - prima del return finale...')
        console.log('📡 [GETMIXEDSTREAM] Ritorno destinationStream.stream:', {
          hasDestinationStream: !!destinationStream,
          hasStream: !!destinationStream.stream,
          streamType: typeof destinationStream.stream,
          streamConstructor: destinationStream.stream?.constructor?.name,
          isMediaStream: destinationStream.stream instanceof MediaStream,
          active: destinationStream.stream?.active,
          tracks: destinationStream.stream?.getTracks()?.length
        })
        return destinationStream.stream
        
      } catch (error: any) {
        // ✅ CRITICAL FIX: Notifica di errore critico
        if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
          ;(window as any).addStreamingNotification('error', 'Errore Critico', `❌ ERRORE CRITICO STREAMING: ${error.message}`, 'streaming')
        } else {
          console.error('❌ [STREAMING] Errore critico:', error.message)
        }
        return null
      }
    } catch (error) {
      console.error('Error initializing stream:', error);
      return null;
    }
  }

  // ✅ EXPOSE: Esponi il database globalmente per compatibilità
  ;(window as any).localDatabase = localDatabase
  
  // ✅ EXPOSE: Esponi getMixedStream globalmente per uso esterno
  ;(window as any).getMixedStream = getMixedStream
  
  // ✅ EXPOSE: Funzione per avviare la sincronizzazione continua
  ;(window as any).startContinuousSync = () => {
    console.log('🔄 [SYNC] Avvio sincronizzazione continua richiesto...')
    
    // Verifica se gli elementi audio esistono
    if (!leftAudioRef.current && !rightAudioRef.current) {
      console.log('🔄 [SYNC] Nessun elemento audio disponibile per sincronizzazione')
      return
    }
    
    // Avvia sincronizzazione per deck sinistro se disponibile
    if (leftAudioRef.current && !(window as any).leftSyncInterval) {
      console.log('🔄 [SYNC] Avvio sincronizzazione deck sinistro...')
      ;(window as any).leftSyncInterval = setInterval(() => {
        const currentLeftAudio = leftAudioRef.current
        if (currentLeftAudio && (window as any).leftStreamAudio) {
          // Verifica cambio traccia
          if ((window as any).leftStreamAudio.src !== currentLeftAudio.src) {
            console.log(`🔄 [SYNC LEFT] Rilevato cambio traccia - aggiornando elemento audio dello streaming`)
            ;(window as any).leftStreamAudio.src = currentLeftAudio.src
            ;(window as any).leftStreamAudio.load()
            
            // Sincronizza tutte le proprietà
            ;(window as any).leftStreamAudio.currentTime = currentLeftAudio.currentTime
            ;(window as any).leftStreamAudio.playbackRate = currentLeftAudio.playbackRate
            ;(window as any).leftStreamAudio.loop = currentLeftAudio.loop
            ;(window as any).leftStreamAudio.muted = currentLeftAudio.muted
            ;(window as any).leftStreamAudio.volume = 1.0
            
            // Sincronizza lo stato di riproduzione
            if (currentLeftAudio.paused) {
              console.log('🔄 [SYNC LEFT] Pausa leftStreamAudio - audio originale in pausa')
              ;(window as any).leftStreamAudio.pause()
            } else {
              console.log('🔄 [SYNC LEFT] Riproduzione leftStreamAudio - audio originale in riproduzione')
              ;(window as any).leftStreamAudio.play().catch((e: any) => {
                console.error('❌ [SYNC LEFT] Errore riproduzione leftStreamAudio:', e)
              })
            }
          } else {
            // Sincronizzazione normale della posizione
            const timeDiff = Math.abs((window as any).leftStreamAudio.currentTime - currentLeftAudio.currentTime)
            if (timeDiff > 0.05) {
              console.log(`🔄 [SYNC LEFT] Sincronizzazione posizione: ${currentLeftAudio.currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`)
              ;(window as any).leftStreamAudio.currentTime = currentLeftAudio.currentTime
            }
          }
        }
      }, 200)
    }
    
    // Avvia sincronizzazione per deck destro se disponibile
    if (rightAudioRef.current && !(window as any).rightSyncInterval) {
      console.log('🔄 [SYNC] Avvio sincronizzazione deck destro...')
      ;(window as any).rightSyncInterval = setInterval(() => {
        const currentRightAudio = rightAudioRef.current
        if (currentRightAudio && (window as any).rightStreamAudio) {
          // Verifica cambio traccia
          if ((window as any).rightStreamAudio.src !== currentRightAudio.src) {
            console.log(`🔄 [SYNC RIGHT] Rilevato cambio traccia - aggiornando elemento audio dello streaming`)
            ;(window as any).rightStreamAudio.src = currentRightAudio.src
            ;(window as any).rightStreamAudio.load()
            
            // Sincronizza tutte le proprietà
            ;(window as any).rightStreamAudio.currentTime = currentRightAudio.currentTime
            ;(window as any).rightStreamAudio.playbackRate = currentRightAudio.playbackRate
            ;(window as any).rightStreamAudio.loop = currentRightAudio.loop
            ;(window as any).rightStreamAudio.muted = currentRightAudio.muted
            ;(window as any).rightStreamAudio.volume = 1.0
            
            // Sincronizza lo stato di riproduzione
            if (currentRightAudio.paused) {
              ;(window as any).rightStreamAudio.pause()
            } else {
              ;(window as any).rightStreamAudio.play().catch(console.error)
            }
          } else {
            // Sincronizzazione normale della posizione
            const timeDiff = Math.abs((window as any).rightStreamAudio.currentTime - currentRightAudio.currentTime)
            if (timeDiff > 0.05) {
              console.log(`🔄 [SYNC RIGHT] Sincronizzazione posizione: ${currentRightAudio.currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`)
              ;(window as any).rightStreamAudio.currentTime = currentRightAudio.currentTime
            }
          }
        }
      }, 200)
    }
    
    console.log('🔄 [SYNC] Sincronizzazione continua avviata')
  }

  // ✅ EXPOSE: Funzione per fermare la sincronizzazione continua
  ;(window as any).stopContinuousSync = () => {
    if ((window as any).leftSyncInterval) {
      clearInterval((window as any).leftSyncInterval)
      ;(window as any).leftSyncInterval = null
      console.log('🔄 [SYNC] Sincronizzazione sinistra fermata')
    }
    if ((window as any).rightSyncInterval) {
      clearInterval((window as any).rightSyncInterval)
      ;(window as any).rightSyncInterval = null
      console.log('🔄 [SYNC] Sincronizzazione destra fermata')
    }
  }
  
  // ✅ RIMOSSO: I metodi pauseStreaming/resumeStreaming sono ora gestiti dal ContinuousStreamingManager
  // Non sovrascrivere più i metodi globali definiti in RebuiltDJConsole
  
  // ✅ HELPER: Funzione per attendere che streamingManager sia disponibile
  const waitForStreamingManager = async (timeoutMs: number = 5000): Promise<any> => {
    const startTime = Date.now()
    console.log('🔍 [WAIT] Inizio ricerca StreamingManager...')
    
    while (Date.now() - startTime < timeoutMs) {
      if ((window as any).streamingManager) {
        console.log('📡 [WAIT] StreamingManager trovato dopo', Date.now() - startTime, 'ms')
        console.log('📡 [WAIT] StreamingManager type:', typeof (window as any).streamingManager)
        console.log('📡 [WAIT] StreamingManager updateStream method:', typeof (window as any).streamingManager.updateStream)
        return (window as any).streamingManager
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    console.warn('⚠️ [WAIT] StreamingManager non trovato entro', timeoutMs, 'ms')
    console.warn('⚠️ [WAIT] window.streamingManager:', (window as any).streamingManager)
    return null
  }
  
  // ✅ TRACKING: Sistema per tracciare tutti gli stream audio attivi
  ;(window as any).activeAudioStreams = []
  
  // ✅ FUNZIONE: Aggiungi stream al tracking
  const addAudioStreamToTracking = (stream: MediaStream) => {
    if (!(window as any).activeAudioStreams) {
      ;(window as any).activeAudioStreams = []
    }
    ;(window as any).activeAudioStreams.push(stream)
    console.log('🎵 [TRACKING] Stream audio aggiunto al tracking:', stream.id)
  }
  
  // ✅ FUNZIONE: Rimuovi stream dal tracking
  const removeAudioStreamFromTracking = (stream: MediaStream) => {
    if ((window as any).activeAudioStreams) {
      const index = (window as any).activeAudioStreams.indexOf(stream)
      if (index > -1) {
        ;(window as any).activeAudioStreams.splice(index, 1)
        console.log('🎵 [TRACKING] Stream audio rimosso dal tracking:', stream.id)
      }
    }
  }
  
  // ✅ ESPONI: Funzioni di tracking globalmente
  ;(window as any).addAudioStreamToTracking = addAudioStreamToTracking
  ;(window as any).removeAudioStreamFromTracking = removeAudioStreamFromTracking
  
  // ✅ FUNZIONE: Enumera dispositivi audio output disponibili
  const getAvailableAudioOutputDevices = async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
      console.log('🔊 [AUDIO] Dispositivi audio output disponibili:', audioOutputs)
      return audioOutputs
    } catch (error) {
      console.error('❌ [AUDIO] Errore enumerazione dispositivi output:', error)
      return []
    }
  }
  
  // ✅ ESPONI: Funzione per ottenere dispositivi audio output
  ;(window as any).getAvailableAudioOutputDevices = getAvailableAudioOutputDevices
  
  // ✅ FUNZIONE: Inizializza AudioContext principale se non esiste
  const ensureMainAudioContext = useCallback(() => {
    if (!(window as any).__audioContexts || !(window as any).__audioContexts[0]) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        const mainContext = new AudioContextClass()
        if (!(window as any).__audioContexts) {
          ;(window as any).__audioContexts = []
        }
        ;(window as any).__audioContexts[0] = mainContext
        
        // ✅ CRITICAL FIX: Esponi globalmente l'AudioContext principale immediatamente
        ;(window as any).globalAudioContext = mainContext
        
        // ✅ CRITICAL FIX: Aggiorna anche lo stato Redux
        dispatch({ type: 'SET_AUDIO_CONTEXT', payload: mainContext })
        
        console.log('🎵 [INIT] AudioContext principale inizializzato e esposto globalmente')
        return mainContext
      }
    }
    const mainContext = (window as any).__audioContexts && (window as any).__audioContexts[0]
    if (mainContext && !(window as any).globalAudioContext) {
      // ✅ CRITICAL FIX: Esponi globalmente anche se già esiste
      ;(window as any).globalAudioContext = mainContext
      
      // ✅ CRITICAL FIX: Aggiorna anche lo stato Redux
      dispatch({ type: 'SET_AUDIO_CONTEXT', payload: mainContext })
      
      console.log('🎵 [INIT] AudioContext principale esistente esposto globalmente')
    }
    return mainContext
  }, [dispatch])
  
  // ✅ ESPONI: Funzione per inizializzare AudioContext principale
  ;(window as any).ensureMainAudioContext = ensureMainAudioContext
  
  // ✅ PERFORMANCE: Cleanup automatico ogni 30 secondi per prevenire memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if ((window as any).activeAudioStreams && Array.isArray((window as any).activeAudioStreams)) {
        // Se ci sono più di 5 stream, pulisci quelli vecchi
        if ((window as any).activeAudioStreams.length > 5) {
          console.log(`🧹 [CLEANUP] Troppi stream audio (${(window as any).activeAudioStreams.length}), pulizia automatica...`)
          // Chiama la funzione di cleanup direttamente qui per evitare dependency issues
          try {
            console.log('🧹 [CLEANUP] Inizio cleanup automatico stream audio...')
            if ((window as any).activeAudioStreams && Array.isArray((window as any).activeAudioStreams)) {
              ;(window as any).activeAudioStreams.forEach((stream: MediaStream, index: number) => {
                try {
                  if (stream && stream.getTracks) {
                    stream.getTracks().forEach(track => {
                      track.stop()
                    })
                  }
                } catch (error) {
                  console.warn(`⚠️ [CLEANUP] Errore fermando stream ${index}:`, error)
                }
              })
              ;(window as any).activeAudioStreams = []
            }
          } catch (error) {
            console.warn('⚠️ [CLEANUP] Errore cleanup automatico:', error)
          }
        }
      }
    }, 30000) // Ogni 30 secondi
    
    return () => clearInterval(cleanupInterval)
  }, []) // Rimossa dependency per evitare loop
  
  // ✅ CLEANUP: Funzione per pulire tutti gli stream audio
  const cleanupAllAudioStreams = useCallback(() => {
    try {
      console.log('🧹 [CLEANUP] Inizio cleanup completo stream audio...')
      
      // ✅ CLEANUP: Ferma tutti gli stream audio tracciati
      if ((window as any).activeAudioStreams && Array.isArray((window as any).activeAudioStreams)) {
        console.log(`🧹 [CLEANUP] Trovati ${(window as any).activeAudioStreams.length} stream audio da fermare`)
        
        ;(window as any).activeAudioStreams.forEach((stream: MediaStream, index: number) => {
          try {
            if (stream && stream.getTracks) {
              stream.getTracks().forEach(track => {
                track.stop()
                console.log(`🧹 [CLEANUP] Track fermato: ${track.kind} - ${track.label}`)
              })
            }
          } catch (error) {
            console.warn(`⚠️ [CLEANUP] Errore fermando stream ${index}:`, error)
          }
        })
        
        // ✅ PERFORMANCE: Pulisci l'array di tracking e limita a 5 stream massimi
        ;(window as any).activeAudioStreams = []
        console.log('🧹 [CLEANUP] Array di tracking stream pulito')
      }
      
      // ✅ CLEANUP: Ferma il microfono se attivo
      if (micStreamRef.current) {
        try {
          micStreamRef.current.getTracks().forEach(track => {
            track.stop()
            console.log(`🧹 [CLEANUP] Microfono fermato: ${track.label}`)
          })
          micStreamRef.current = null
        } catch (error) {
          console.warn('⚠️ [CLEANUP] Errore fermando microfono:', error)
        }
      }
      
      // ✅ CLEANUP: Ferma tutti gli elementi audio HTML
      // ✅ CLEANUP: Ferma audio locale solo se non è in streaming
      const isCurrentlyStreaming = (window as any).isCurrentlyStreaming
      if (!isCurrentlyStreaming) {
        if (leftAudioRef.current) {
          try {
            leftAudioRef.current.pause()
            leftAudioRef.current.currentTime = 0
            leftAudioRef.current.src = ''
            console.log('🧹 [CLEANUP] Left deck audio fermato')
          } catch (error) {
            console.warn('⚠️ [CLEANUP] Errore fermando left deck:', error)
          }
        }
        
        if (rightAudioRef.current) {
          try {
            rightAudioRef.current.pause()
            rightAudioRef.current.currentTime = 0
            rightAudioRef.current.src = ''
            console.log('🧹 [CLEANUP] Right deck audio fermato')
          } catch (error) {
            console.warn('⚠️ [CLEANUP] Errore fermando right deck:', error)
          }
        }
      } else {
        console.log('🧹 [CLEANUP] Audio locale mantenuto attivo durante streaming')
      }
      
      // ✅ CLEANUP: Chiudi solo AudioContext temporanei, NON quello principale
      if (typeof window !== 'undefined' && window.AudioContext) {
        try {
          // Cerca AudioContext attivi globalmente
          const audioContexts = (window as any).__audioContexts || []
          audioContexts.forEach((ctx: AudioContext, index: number) => {
            // ✅ CORREZIONE: Non chiudere l'AudioContext principale (indice 0)
            if (ctx && ctx.state !== 'closed' && index > 0) {
              ctx.close()
              console.log(`🧹 [CLEANUP] AudioContext temporaneo ${index} chiuso`)
            } else if (index === 0) {
              console.log('🧹 [CLEANUP] AudioContext principale mantenuto attivo')
            }
          })
        } catch (error) {
          console.warn('⚠️ [CLEANUP] Errore chiudendo AudioContext temporanei:', error)
        }
      }
      
      // ✅ CLEANUP: Pulisci riferimenti globali
      ;(window as any).__currentStreamVolume__ = undefined
      ;(window as any).__pttOriginalStreamVolume__ = undefined
      
      // ✅ CORREZIONE: Mantieni solo l'AudioContext principale
      if ((window as any).__audioContexts && (window as any).__audioContexts.length > 0) {
        ;(window as any).__audioContexts = [(window as any).__audioContexts[0]]
        console.log('🧹 [CLEANUP] Mantenuto solo AudioContext principale')
      }
      
      console.log('✅ [CLEANUP] Cleanup completo stream audio completato')
      
    } catch (error) {
      console.error('❌ [CLEANUP] Errore durante cleanup stream audio:', error)
    }
  }, [])
  
  // ✅ ESPONI: Funzione di cleanup globalmente
  ;(window as any).cleanupAllAudioStreams = cleanupAllAudioStreams
  
  // ✅ AUTO-RECONNECT: Funzione per ricollegare automaticamente i deck quando vengono creati dopo lo streaming
  ;(window as any).reconnectDeckToStreaming = async (deckId: 'A' | 'B') => {
    try {
      console.log(`🎵 [AUTO-RECONNECT] Tentativo ricollegamento deck ${deckId} allo streaming...`)
      
      // Verifica che lo streaming sia attivo
      if (!(window as any).isCurrentlyStreaming) {
        console.log(`🎵 [AUTO-RECONNECT] Streaming non attivo, salto ricollegamento deck ${deckId}`)
        return false
      }
      
      // Cerca l'elemento audio del deck nel DOM
      const deckAudioElement = document.querySelector(`audio.deck-audio[data-deck="${deckId}"]`) as HTMLAudioElement
      if (!deckAudioElement || !deckAudioElement.src || deckAudioElement.src.trim() === '') {
        console.log(`🎵 [AUTO-RECONNECT] Deck ${deckId} non ha audio valido, salto ricollegamento`)
        return false
      }
      
      console.log(`🎵 [AUTO-RECONNECT] Deck ${deckId} trovato con audio valido, procedo con ricollegamento...`)
      
      // ✅ CRITICAL FIX: Invece di cercare di ricollegare al mixer esistente,
      // ricreiamo completamente il mixed stream per includere i nuovi deck
      try {
        // Notifica di inizio ricollegamento
        if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
          ;(window as any).addStreamingNotification('info', 'Ricollegamento Deck', `Ricollegamento deck ${deckId} allo streaming...`, 'audio')
        }
        
        // ✅ RICREA COMPLETAMENTE IL MIXED STREAM
        console.log(`🎵 [AUTO-RECONNECT] Ricreazione mixed stream per includere deck ${deckId}...`)
        
        // Chiama getMixedStream per ricreare il stream con tutti i deck disponibili
        const newMixedStream = await getMixedStream()
        
        if (newMixedStream) {
          // ✅ AGGIORNA LO STREAMING MANAGER CON IL NUOVO STREAM
          if ((window as any).streamingManager && typeof (window as any).streamingManager.updateStream === 'function') {
            await (window as any).streamingManager.updateStream(newMixedStream)
            console.log(`✅ [AUTO-RECONNECT] Streaming aggiornato con nuovo mixed stream`)
          } else {
            console.log(`⚠️ [AUTO-RECONNECT] StreamingManager non disponibile per aggiornamento`)
          }
          
          // Notifica di successo
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('success', 'Deck Ricollegato', `Deck ${deckId} ricollegato con successo allo streaming`, 'audio')
          }
          
          console.log(`✅ [AUTO-RECONNECT] Deck ${deckId} ricollegato con successo allo streaming`)
          return true
        } else {
          throw new Error('getMixedStream ha restituito null')
        }
        
      } catch (streamError: any) {
        console.error(`❌ [AUTO-RECONNECT] Errore ricreazione mixed stream:`, streamError.message)
        
        // Notifica di errore
        if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
          ;(window as any).addStreamingNotification('error', 'Errore Ricollegamento', `Errore ricollegamento deck ${deckId}: ${streamError.message}`, 'audio')
        }
        
        return false
      }
      
    } catch (error: any) {
      console.error(`❌ [AUTO-RECONNECT] Errore generale ricollegamento deck ${deckId}:`, error.message)
      
      if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
        ;(window as any).addStreamingNotification('error', 'Errore Ricollegamento', `Errore ricollegamento deck ${deckId}: ${error.message}`, 'audio')
      }
      
      return false
    }
  }
  
  // ✅ MONITORING: Funzione per monitoraggio continuo del server durante streaming
  ;(window as any).startServerMonitoring = () => {
    if ((window as any).__serverMonitoringInterval__) {
      clearInterval((window as any).__serverMonitoringInterval__)
    }
    
    console.log('🔍 [MONITORING] Avvio monitoraggio continuo del server...')
    
    ;(window as any).__serverMonitoringInterval__ = setInterval(async () => {
      try {
        // ✅ FIX: Controlla se l'utente ha richiesto la disconnessione
        if ((window as any).globalStreamingManager?.isUserRequestedDisconnect) {
          console.log('🛑 [MONITORING] Disconnessione richiesta dall\'utente - fermo monitoraggio')
          return
        }
        
        if ((window as any).isCurrentlyStreaming) {
          console.log('🔍 [MONITORING] Verifica server durante streaming...')
          
          // ✅ CRITICAL FIX: Verifica diretta HTTP usando server di default
          const defaultServer = await localDatabase.getDefaultIcecastServer()
          if (defaultServer?.host && defaultServer?.port) {
            const host = defaultServer.host
            const port = defaultServer.port
            1
            const response = await fetch(`http://${host}:${port}/status-json.xsl`, {
              method: 'GET',
              cache: 'no-cache',
              signal: AbortSignal.timeout(3000) // Timeout più breve per monitoraggio
            })
            
            if (!response.ok) {
              if (response.status === 404) {
                throw new Error(`Server non raggiungibile - Endpoint non trovato (404)`)
              } else if (response.status === 403) {
                throw new Error(`Server non raggiungibile - Accesso negato (403)`)
              } else if (response.status >= 500) {
                throw new Error(`Server non raggiungibile - Errore server (${response.status})`)
            } else {
                throw new Error(`Server non raggiungibile - HTTP ${response.status}`)
              }
            }
            
            console.log('✅ [MONITORING] Server OK durante streaming')
      } else {
            throw new Error('Impostazioni streaming incomplete')
          }
        }
      } catch (error: any) {
        // ✅ FIX: Controlla se l'utente ha richiesto la disconnessione prima di gestire errori
        if ((window as any).globalStreamingManager?.isUserRequestedDisconnect) {
          console.log('🛑 [MONITORING] Disconnessione richiesta dall\'utente - ignoro errore server')
          return
        }
        
        console.error('🚨 [MONITORING] SERVER CADUTO durante streaming!', error.message)
        
        // ✅ CRITICAL FIX: Usa notifiche invece di alert che bloccano l'interfaccia
        if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
          ;(window as any).addStreamingNotification('error', 'Server Caduto', `🚨 SERVER CADUTO!\n\n${error.message}\n\nLo streaming è stato fermato automaticamente.`, 'streaming')
        } else {
          // Fallback a console se le notifiche non sono disponibili
          console.error('🚨 [MONITORING] Server caduto:', error.message)
        }
        
        // Ferma lo streaming
        if ((window as any).stopStreaming) {
          ;(window as any).stopStreaming()
        }
      }
    }, 5000) // Controlla ogni 5 secondi (più frequente)
  }
  
  // ✅ STOP: Funzione per fermare il monitoraggio
  ;(window as any).stopServerMonitoring = () => {
    if ((window as any).__serverMonitoringInterval__) {
      clearInterval((window as any).__serverMonitoringInterval__)
      ;(window as any).__serverMonitoringInterval__ = null
      console.log('🔍 [MONITORING] Monitoraggio server fermato')
    }
  }
  
  
  // ✅ DEBUG: Funzione per verificare lo stato del database
  ;(window as any).debugDatabaseStatus = async () => {
    try {
      console.log('🔍 [DB DEBUG] Verifica stato database...')
      console.log('🔍 [DB DEBUG] Database importato:', !!localDatabase)
      console.log('🔍 [DB DEBUG] Tipo database:', typeof localDatabase)
      console.log('🔍 [DB DEBUG] Metodi disponibili:', Object.getOwnPropertyNames(Object.getPrototypeOf(localDatabase)))
      
      if (localDatabase) {
        console.log('🔍 [DB DEBUG] Database disponibile, aspetto inizializzazione...')
          await localDatabase.waitForInitialization()
        console.log('🔍 [DB DEBUG] Database inizializzato!')
        
          const settings = await localDatabase.getSettings()
        console.log('🔍 [DB DEBUG] Settings letti:', !!settings)
        console.log('🔍 [DB DEBUG] Settings completi:', settings)
        
        if (settings?.streaming?.icecastServers && settings.streaming.icecastServers.length > 0) {
          console.log('🔍 [DB DEBUG] ✅ Icecast servers configurati:', settings.streaming.icecastServers.length)
          const defaultServer = settings.streaming.icecastServers.find(s => s.isDefault) || settings.streaming.icecastServers[0]
          if (defaultServer) {
            console.log('🔍 [DB DEBUG] Server di default:', {
              host: defaultServer.host,
              port: defaultServer.port,
              mount: defaultServer.mount
            })
          }
        } else {
          console.log('🔍 [DB DEBUG] ❌ Nessun server Icecast configurato')
        }
      }
    } catch (error: any) {
      console.error('❌ [DB DEBUG] Errore verifica database:', error.message)
    }
  }
  
  // ✅ SERVER CHECK: Funzione per verificare la connessione al server streaming
  ;(window as any).checkStreamingServerConnection = async (settings?: any) => {
    try {
      console.log('🔍 [SERVER CHECK] Verifica connessione al server streaming...')
      
      // ✅ CRITICAL FIX: Usa le impostazioni passate come parametro o leggi dal database
      
      try {
        let s = settings // Usa le impostazioni passate come parametro
        console.log('🔍 [SERVER CHECK] Parametro settings ricevuto:', !!s)
        console.log('🔍 [SERVER CHECK] Tipo di settings:', typeof s)
        
                // ✅ CRITICAL FIX: FORZA sempre la lettura dal database per evitare problemi di timing
        console.log('🔍 [SERVER CHECK] FORZO lettura dal database per evitare problemi...')
        
        // Aspetta che il database sia inizializzato e forza lettura settings
        await localDatabase.waitForInitialization()
        s = await localDatabase.getSettings()
        console.log('🔍 [SERVER CHECK] Settings forzati dal database:', !!s)
        
        // ✅ USA SERVER DI DEFAULT SELEZIONATO
        const defaultServer = await localDatabase.getDefaultIcecastServer()
        console.log('🔍 [SERVER CHECK] DEBUG - Server di default:', defaultServer)
        
        if (!defaultServer) {
          throw new Error('IMPOSTAZIONI STREAMING INCOMPLETE: Nessun server Icecast configurato')
        }
        
        // ✅ CRITICAL FIX: Verifica che il server di default sia valido
        if (!defaultServer.host || !defaultServer.port) {
          throw new Error('IMPOSTAZIONI STREAMING INCOMPLETE: Server di default non valido')
        }
        
        if (defaultServer.host.trim() === '' || defaultServer.port === 0) {
          throw new Error('IMPOSTAZIONI STREAMING INCOMPLETE: Host vuoto o porta 0 nel server di default')
        }
        
        console.log('🔍 [SERVER CHECK] ✅ Server di default valido, procedo con test connessione...')
        
        if (defaultServer?.host && defaultServer?.port) {
          const host = defaultServer.host
          const port = defaultServer.port
          console.log(`🔍 [SERVER CHECK] Connessione Icecast configurata: http://${host}:${port}`)
          console.log(`🔍 [SERVER CHECK] Server: ${defaultServer.name}, Host: ${host}, Porta: ${port}`)
          
          // ✅ CRITICAL FIX: Prova connessione HTTP per server Icecast
          console.log(`🔍 [SERVER CHECK] Test connessione HTTP su: http://${host}:${port}`)
          
          try {
            // ✅ CRITICAL FIX: Rimuovo no-cors per rilevare errori reali
            const response = await fetch(`http://${host}:${port}/status-json.xsl`, {
              method: 'GET',
              cache: 'no-cache',
              signal: AbortSignal.timeout(5000) // Timeout 5 secondi
            })
            
            if (!response.ok) {
              if (response.status === 404) {
                throw new Error(`Server Icecast non raggiungibile su http://${host}:${port} - Endpoint non trovato (404)`)
              } else if (response.status === 403) {
                throw new Error(`Server Icecast non raggiungibile su http://${host}:${port} - Accesso negato (403)`)
              } else if (response.status >= 500) {
                throw new Error(`Server Icecast non raggiungibile su http://${host}:${port} - Errore server (${response.status})`)
              } else {
                throw new Error(`Server Icecast non raggiungibile su http://${host}:${port} - HTTP ${response.status}`)
              }
            }
            
            console.log(`✅ [SERVER CHECK] Server Icecast raggiungibile su http://${host}:${port}`)
            
            // ✅ CRITICAL FIX: Notifica di successo
            if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
              ;(window as any).addStreamingNotification('success', 'Server Raggiungibile', `Server Icecast raggiungibile su http://${host}:${port}`, 'streaming')
            }
            
            return true
          } catch (httpError: any) {
            console.error(`❌ [SERVER CHECK] Errore connessione HTTP:`, httpError.message)
            throw new Error(`Server Icecast non raggiungibile su http://${host}:${port}`)
          }
        } else {
          // ✅ CRITICAL FIX: NESSUN FALLBACK - Solo errore chiaro
          const errorMsg = `🚨 IMPOSTAZIONI STREAMING INCOMPLETE!\n\nHost o porta non configurati correttamente.\n\nConfigurazione attuale:\n• Host: "${s?.streaming?.icecast?.host || 'NON IMPOSTATO'}"\n• Porta: ${s?.streaming?.icecast?.port || 'NON IMPOSTATA'}\n\nVai in Settings e configura:\n• Host: 82.145.63.6\n• Porta: 5040`
          
          console.error('❌ [SERVER CHECK]', errorMsg)
          
          // ✅ CRITICAL FIX: Notifica di errore
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('error', 'Impostazioni Incomplete', errorMsg, 'app')
          }
          
          throw new Error(errorMsg)
        }
      } catch (settingsError: any) {
        // ✅ CRITICAL FIX: Distinguo tra errore database e errore connessione
        if (settingsError.message.includes('IMPOSTAZIONI STREAMING INCOMPLETE')) {
          // Errore impostazioni
          const errorMsg = `🚨 IMPOSTAZIONI STREAMING INCOMPLETE!\n\n${settingsError.message}\n\nVai in Settings e configura:\n• Host: 82.145.63.6\n• Porta: 5040`
          console.error('❌ [SERVER CHECK] Impostazioni incomplete:', errorMsg)
          throw new Error(errorMsg)
        } else if (settingsError.message.includes('Server Icecast non raggiungibile')) {
          // Errore connessione - lo rilancio così com'è
          console.error('❌ [SERVER CHECK] Server non raggiungibile:', settingsError.message)
          throw settingsError
        } else {
          // Altri errori - potrebbero essere errori database
          const errorMsg = `🚨 ERRORE LETTURA IMPOSTAZIONI!\n\nImpossibile leggere le impostazioni dal database.\n\nErrore: ${settingsError.message}\n\nVerifica che il database sia accessibile e riprova.`
          console.error('❌ [SERVER CHECK] Errore database:', errorMsg)
          
          // ✅ CRITICAL FIX: Notifica di errore
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('error', 'Errore Database', errorMsg, 'app')
          }
          
          throw new Error(errorMsg)
        }
      }
    } catch (error: any) {
      // ✅ CRITICAL FIX: Rilancio l'errore così com'è - la logica di gestione è già nel catch interno
      console.error('❌ [SERVER CHECK] Errore finale:', error.message)
      throw error
    }
  }

  // ✅ FIX: Funzione globale per aggiornare i volumi PTT dinamicamente
  ;(window as any).updatePTTVolumesOnly = async (pttActive: boolean) => {
    try {
      // ✅ FIX: Riduci i log per evitare spam - solo quando cambia stato
      const lastPTTState = (window as any).__lastPTTState__
      if (lastPTTState !== pttActive) {
        console.log(`🎤 [PTT UPDATE] Stato cambiato: ${pttActive ? 'ON' : 'OFF'}`)
        ;(window as any).__lastPTTState__ = pttActive
      }
      
      // ✅ CRITICAL FIX: Controlla se il microfono è effettivamente mutato
      const isMicMuted = (window as any).__isMicMuted__ || false
      const isHostMicMuted = (window as any).__isHostMicMuted__ || false
      
      // ✅ FIX: Log stato microfoni solo quando cambia
      const lastMicState = (window as any).__lastMicState__
      const currentMicState = `${isMicMuted}-${isHostMicMuted}`
      if (lastMicState !== currentMicState) {
        console.log(`🎤 [PTT UPDATE] Stato microfoni - Mic: ${isMicMuted ? 'MUTATO' : 'ATTIVO'}, Host: ${isHostMicMuted ? 'MUTATO' : 'ATTIVO'}`)
        ;(window as any).__lastMicState__ = currentMicState
      }
      
      // Se entrambi i microfoni sono mutati, non inviare audio in streaming
      if (isMicMuted && isHostMicMuted) {
        if (pttActive) { // Solo log se stava per attivarsi
          console.log(`🎤 [PTT UPDATE] 🚫 Streaming bloccato: entrambi i microfoni sono mutati.`)
        }
        pttActive = false // Forza PTT a OFF
      }
      
      // ✅ CRITICAL FIX: Usa i riferimenti globali del mixer per il PTT
      const micGain = (window as any).currentPTTMicGain
      const mixerGain = (window as any).currentPTTMixerGain
      const context = (window as any).currentPTTContext
      
      // ✅ FIX: Verifica che i riferimenti siano disponibili
      if (!micGain || !mixerGain || !context) {
        // ✅ FIX: Log warning solo una volta per evitare spam
        const lastMissingRefsWarning = (window as any).__lastMissingRefsWarning__
        if (!lastMissingRefsWarning) {
          console.warn('⚠️ [PTT] Riferimenti WebAudio non disponibili per ducking - sistema PTT non inizializzato')
          ;(window as any).__lastMissingRefsWarning__ = true
        }
        return // Esci se i riferimenti non sono disponibili
      }
      
      // ✅ CRITICAL FIX: PTT Ducking dalle impostazioni (default 75% = musica abbassata del 75% del volume corrente)
      const settings = await localDatabase.getSettings()
      const duckingPercent = settings?.microphone?.duckingPercent ?? 75
      const pttDuckingLevel = duckingPercent / 100 // Converte da percentuale a decimale
      ;(window as any).__pttDuckingLevel__ = pttDuckingLevel
      
      if (pttActive) {
        // ✅ STORE: Salva il volume corrente del LiveStream prima del ducking
        if (!(window as any).__pttOriginalStreamVolume__) {
          // ✅ CRITICAL FIX: Ottieni il volume corrente del LiveStream dall'interfaccia
          const currentStreamVolume = (window as any).__currentStreamVolume__ || 1.0 // Default 100%
          ;(window as any).__pttOriginalStreamVolume__ = currentStreamVolume
          
          console.log(`🎤 [PTT] Volume originale del LiveStream salvato: ${Math.round(currentStreamVolume * 100)}%`)
        }
        
        // ✅ CALCULATE: Calcola il volume ducked del LiveStream
        const originalStreamVolume = (window as any).__pttOriginalStreamVolume__ || 1.0
        const duckedStreamVolume = Math.max(0, originalStreamVolume * (1.0 - pttDuckingLevel))
        
        // ✅ FIX: Log dettagliato solo quando cambia stato
        const lastDuckingState = (window as any).__lastDuckingState__
        if (lastDuckingState !== 'active') {
          console.log(`🎤 [PTT DEBUG] Volume originale LiveStream: ${Math.round(originalStreamVolume * 100)}%, Ducking: ${Math.round(pttDuckingLevel * 100)}%, Volume finale: ${Math.round(duckedStreamVolume * 100)}%`)
          ;(window as any).__lastDuckingState__ = 'active'
        }
        
        // ✅ PTT: Aggiorna il microfono per lo streaming
        if (micGain && context) {
          micGain.gain.setValueAtTime(1.0, context.currentTime) // Microfono al 100%
          // ✅ FIX: Log microfono solo quando cambia stato
          if (lastDuckingState !== 'active') {
            console.log(`🎤 [PTT UPDATE] Microfono attivato al 100% per streaming`)
          }
          
          // ✅ CRITICAL FIX: Notifica di successo
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('info', 'PTT Attivato', 'Microfono attivato al 100% per streaming', 'audio')
          }
        }
        
        // ✅ CRITICAL FIX: Abbassa SOLO il volume del LiveStream usando setLiveStreamVolume (controlla SOLO l'interfaccia Live Stream)
        if (typeof (window as any).setLiveStreamVolume === 'function') {
          ;(window as any).setLiveStreamVolume(duckedStreamVolume)
          // ✅ FIX: Log LiveStream solo quando cambia stato
          if (lastDuckingState !== 'active') {
            console.log(`🎤 [PTT UPDATE] LiveStream abbassato del ${Math.round(pttDuckingLevel * 100)}% (da ${Math.round(originalStreamVolume * 100)}% a ${Math.round(duckedStreamVolume * 100)}%)`)
          }
        } else {
          // ✅ FIX: Log warning solo una volta
          if (lastDuckingState !== 'active') {
            console.warn('⚠️ [PTT] Funzione setLiveStreamVolume non disponibile')
          }
        }
        
        // ✅ CRITICAL FIX: Aggiorna ANCHE il mixer WebAudio per abbassare realmente la musica
        if (mixerGain && mixerGain.gain) {
          mixerGain.gain.setValueAtTime(duckedStreamVolume, context.currentTime)
          // ✅ FIX: Log mixer solo quando cambia stato
          if (lastDuckingState !== 'active') {
            console.log(`🎤 [PTT UPDATE] Mixer WebAudio abbassato a ${Math.round(duckedStreamVolume * 100)}% per ducking reale`)
          }
        }
        // ✅ FIX: Rimosso warning ridondante - già gestito sopra
        
      } else {
        // ✅ RESTORE: Ripristina il volume originale del LiveStream (NON al 100%!)
        const originalStreamVolume = (window as any).__pttOriginalStreamVolume__ || 1.0
        
        // ✅ FIX: Log deactivation solo quando cambia stato
        const lastDuckingState = (window as any).__lastDuckingState__
        if (lastDuckingState !== 'inactive') {
          ;(window as any).__lastDuckingState__ = 'inactive'
        }
        
        // ✅ PTT: Disattiva il microfono per lo streaming
        if (micGain && context) {
          micGain.gain.setValueAtTime(0.0, context.currentTime) // Microfono al 0%
          // ✅ FIX: Log microfono solo quando cambia stato
          if (lastDuckingState !== 'inactive') {
            console.log(`🎤 [PTT UPDATE] Microfono disattivato per streaming`)
          }
          
          // ✅ CRITICAL FIX: Notifica di successo
          if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
            ;(window as any).addStreamingNotification('info', 'PTT Disattivato', 'Microfono disattivato per streaming', 'audio')
          }
        }
        
        // ✅ CRITICAL FIX: Ripristina il volume originale del LiveStream usando setLiveStreamVolume
        if (typeof (window as any).setLiveStreamVolume === 'function') {
          ;(window as any).setLiveStreamVolume(originalStreamVolume)
          console.log(`🎤 [PTT UPDATE] LiveStream ripristinato al volume originale: ${Math.round(originalStreamVolume * 100)}%`)
          } else {
          console.warn('⚠️ [PTT] Funzione setLiveStreamVolume non disponibile')
        }
        
        // ✅ CRITICAL FIX: Ripristina ANCHE il mixer WebAudio al volume originale
        if (mixerGain && mixerGain.gain) {
          mixerGain.gain.setValueAtTime(originalStreamVolume, context.currentTime)
          console.log(`🎤 [PTT UPDATE] Mixer WebAudio ripristinato a ${Math.round(originalStreamVolume * 100)}%`)
          } else {
          console.warn('⚠️ [PTT] Mixer WebAudio non disponibile per ripristino')
        }
        
        // ✅ CLEANUP: Pulisci il volume originale salvato
        ;(window as any).__pttOriginalStreamVolume__ = undefined
      }
      
      // ✅ DEBUG: Log dei riferimenti disponibili
      console.log(`🎤 [PTT DEBUG] Riferimenti disponibili:`, {
        micGain: !!micGain,
        context: !!context,
        setLiveStreamVolume: typeof (window as any).setLiveStreamVolume === 'function',
        originalStreamVolume: (window as any).__pttOriginalStreamVolume__
      })

          } catch (error) {
      console.error('❌ [PTT ERROR] Errore durante aggiornamento volumi PTT:', error)
    }
  }

  // ===== FUNZIONI ESSENZIALI =====

  // Riproduce una track nel deck sinistro
  const playLeftTrack = useCallback((track: AudioTrack) => {
    console.log(`🎵 [LEFT DECK] Riproduzione track: ${track.title}`)
    
    try {
      // ✅ CLEANUP: Pulisci audio precedente
      if (leftAudioRef.current) {
        leftAudioRef.current.pause()
        leftAudioRef.current.currentTime = 0
        leftAudioRef.current.src = ''
        console.log('🧹 [LEFT DECK] Audio precedente pulito')
      }
      
      // Aggiorna lo stato del deck
      dispatch({ type: 'SET_LEFT_DECK_TRACK', payload: track })
      dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: true })
      
      // Carica l'audio se c'è un URL
      if (track.url && leftAudioRef.current) {
        console.log(`🎵 [LEFT DECK] Caricamento URL:`, track.url)
        console.log(`🎵 [LEFT DECK] Track title:`, track.title)
        leftAudioRef.current.src = track.url
        leftAudioRef.current.load()
        
        // ✅ FIX: Applica il volume locale corretto
        leftAudioRef.current.volume = state.leftDeck.localVolume
        
        // Avvia la riproduzione
        leftAudioRef.current.play().catch((error: any) => {
          console.error('❌ Errore avvio riproduzione left deck:', error)
          dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })
        })
      }
      
      console.log(`✅ [LEFT DECK] Track "${track.title}" caricata e avviata`)
      
      // ✅ CRITICAL FIX: NON aggiornare nulla al cambio traccia - il sistema gestirà automaticamente
      // Il mixed stream si aggiorna automaticamente e il MediaRecorder continua a funzionare
      console.log('🎵 [TRACK CHANGE LEFT] Traccia cambiata - sistema gestirà automaticamente lo streaming')
      
      // ✅ CRITICAL FIX: Avvia sincronizzazione continua se non è già attiva
      if (typeof window !== 'undefined' && (window as any).startContinuousSync) {
        console.log('🔄 [TRACK CHANGE] Avvio sincronizzazione continua per cambio traccia...')
        ;(window as any).startContinuousSync()
      }
    } catch (error: any) {
      console.error('❌ Errore caricamento left deck:', error)
      dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })
    }
  }, [dispatch, state.leftDeck.localVolume, getMixedStream])

  // Riproduce una track nel deck destro
  const playRightTrack = useCallback((track: AudioTrack) => {
    console.log(`🎵 [RIGHT DECK] Riproduzione track: ${track.title}`)
    
    try {
      // ✅ CLEANUP: Pulisci audio precedente
      if (rightAudioRef.current) {
        rightAudioRef.current.pause()
        rightAudioRef.current.currentTime = 0
        rightAudioRef.current.src = ''
        console.log('🧹 [RIGHT DECK] Audio precedente pulito')
      }
      
      // Aggiorna lo stato del deck
      dispatch({ type: 'SET_RIGHT_DECK_TRACK', payload: track })
      dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: true })
      
      // Carica l'audio se c'è un URL
      if (track.url && rightAudioRef.current) {
        console.log(`🎵 [RIGHT DECK] Caricamento URL:`, track.url)
        console.log(`🎵 [RIGHT DECK] Track title:`, track.title)
        rightAudioRef.current.src = track.url
        rightAudioRef.current.load()
        
        // ✅ FIX: Applica il volume locale corretto
        rightAudioRef.current.volume = state.rightDeck.localVolume
        
        // Avvia la riproduzione
        rightAudioRef.current.play().catch((error: any) => {
          console.error('❌ Errore avvio riproduzione right deck:', error)
          dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })
        })
      }
      
      console.log(`✅ [RIGHT DECK] Track "${track.title}" caricata e avviata`)
      
      // ✅ CRITICAL FIX: NON aggiornare nulla al cambio traccia - il sistema gestirà automaticamente
      // Il mixed stream si aggiorna automaticamente e il MediaRecorder continua a funzionare
      console.log('🎵 [TRACK CHANGE RIGHT] Traccia cambiata - sistema gestirà automaticamente lo streaming')
      
      // ✅ CRITICAL FIX: Avvia sincronizzazione continua se non è già attiva
      if (typeof window !== 'undefined' && (window as any).startContinuousSync) {
        console.log('🔄 [TRACK CHANGE] Avvio sincronizzazione continua per cambio traccia...')
        ;(window as any).startContinuousSync()
      }
    } catch (error: any) {
      console.error('❌ Errore caricamento right deck:', error)
      dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })
    }
  }, [dispatch, state.rightDeck.localVolume, getMixedStream])

  // ✅ FIX AUTOPLAY: Listener globale per caricamento tracce
  useEffect(() => {
    const handleGlobalTrackLoad = (event: CustomEvent) => {
      const { deck, track } = event.detail
      console.log(`🔄 [AUDIO CONTEXT] Global track load received: ${track.title} → ${deck} deck`)
      console.log(`🔄 [AUDIO CONTEXT] Event detail:`, event.detail)
      
      try {
        // ✅ FIX: Aggiorna prima lo stato del deck
        if (deck === 'left') {
          console.log(`🔄 [AUDIO CONTEXT] Loading track in LEFT deck:`, track.title)
          dispatch({ type: 'SET_LEFT_DECK_TRACK', payload: track })
          playLeftTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            url: track.url
          })
        } else if (deck === 'right') {
          console.log(`🔄 [AUDIO CONTEXT] Loading track in RIGHT deck:`, track.title)
          dispatch({ type: 'SET_RIGHT_DECK_TRACK', payload: track })
          playRightTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            url: track.url
          })
        }
        console.log(`✅ [AUDIO CONTEXT] Track loaded globally: ${track.title} → ${deck} deck`)
      } catch (error) {
        console.error('❌ [AUDIO CONTEXT] Error loading track globally:', error)
      }
    }

    // ✅ FIX CROSSFADER: Listener per pulizia deck da eventi esterni
    const handleClearDeck = (event: CustomEvent) => {
      const { deck } = event.detail
      console.log(`🗑️ [AUDIO CONTEXT] Clear deck event:`, deck)
      
      try {
        if (deck === 'left') {
          console.log(`🗑️ [AUDIO CONTEXT] Clearing LEFT deck completely`)
          dispatch({ type: 'SET_LEFT_DECK_TRACK', payload: null })
          dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })
          dispatch({ type: 'SET_LEFT_DECK_TIME', payload: 0 })
          dispatch({ type: 'SET_LEFT_DECK_DURATION', payload: 0 })
          dispatch({ type: 'SET_LEFT_DECK_VOLUME', payload: 1.0 })
          dispatch({ type: 'SET_LEFT_DECK_LOCAL_VOLUME', payload: 0.0 })
        } else if (deck === 'right') {
          console.log(`🗑️ [AUDIO CONTEXT] Clearing RIGHT deck completely`)
          dispatch({ type: 'SET_RIGHT_DECK_TRACK', payload: null })
          dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })
          dispatch({ type: 'SET_RIGHT_DECK_TIME', payload: 0 })
          dispatch({ type: 'SET_RIGHT_DECK_DURATION', payload: 0 })
          dispatch({ type: 'SET_RIGHT_DECK_VOLUME', payload: 1.0 })
          dispatch({ type: 'SET_RIGHT_DECK_LOCAL_VOLUME', payload: 0.0 })
        }
        console.log(`✅ [AUDIO CONTEXT] Deck ${deck} completamente svuotato`)
      } catch (error) {
        console.error('❌ [AUDIO CONTEXT] Errore nella pulizia deck:', error)
      }
    }

    window.addEventListener('djconsole:load-track', handleGlobalTrackLoad as EventListener)
    window.addEventListener('djconsole:clear-deck', handleClearDeck as EventListener)
    return () => {
      window.removeEventListener('djconsole:load-track', handleGlobalTrackLoad as EventListener)
      window.removeEventListener('djconsole:clear-deck', handleClearDeck as EventListener)
    }
  }, [playLeftTrack, playRightTrack, dispatch])

  // ✅ FIX: Aggiorna i volumi locali degli elementi audio HTML
  const updateLocalVolumes = useCallback(() => {
    if (leftAudioRef.current) {
      // ✅ FIX: Applica il volume locale corretto
      const targetVolume = Math.max(0, Math.min(1, state.leftDeck.localVolume))
      leftAudioRef.current.volume = targetVolume
      console.log(`🔊 [LEFT DECK] Volume locale aggiornato: ${Math.round(targetVolume * 100)}%`)
    }
    
    if (rightAudioRef.current) {
      // ✅ FIX: Applica il volume locale corretto
      const targetVolume = Math.max(0, Math.min(1, state.rightDeck.localVolume))
      rightAudioRef.current.volume = targetVolume
      console.log(`🔊 [RIGHT DECK] Volume locale aggiornato: ${Math.round(targetVolume * 100)}%`)
    }
  }, [state.leftDeck.localVolume, state.rightDeck.localVolume])

  // ✅ FIX: Effetto per aggiornare i volumi locali quando cambiano
  useEffect(() => {
    console.log('🔊 [VOLUMES] Aggiornamento volumi locali richiesto')
    updateLocalVolumes()
  }, [updateLocalVolumes])

  // ✅ FIX: Effetto per aggiornare i volumi quando cambia lo stato
  useEffect(() => {
    console.log('🔊 [VOLUMES] Stato volumi cambiato - aggiornamento automatico')
    updateLocalVolumes()
  }, [state.leftDeck.localVolume, state.rightDeck.localVolume])

  // ✅ CORREZIONE: Funzione per configurare il dispositivo output audio
  const configureAudioOutputDevice = useCallback(async () => {
    try {
      const outputDevice = settings?.audio?.outputDevice
      if (!outputDevice || outputDevice === 'default') {
        console.log('🔊 [AUDIO] Usando dispositivo output predefinito')
        return
      }

      console.log(`🔊 [AUDIO] Configurazione dispositivo output: ${outputDevice}`)
      
      // ✅ CORREZIONE: Configura gli elementi audio per usare il dispositivo specifico
      const audioElements = [leftAudioRef.current, rightAudioRef.current].filter(Boolean)
      
      for (const audioElement of audioElements) {
        if (audioElement) {
          try {
            // ✅ CORREZIONE: Usa setSinkId se supportato (Chrome/Edge)
            if ('setSinkId' in audioElement) {
              await (audioElement as any).setSinkId(outputDevice)
              console.log(`🔊 [AUDIO] Dispositivo output configurato per elemento audio: ${outputDevice}`)
            } else {
              console.warn('⚠️ [AUDIO] setSinkId non supportato, usa dispositivo predefinito')
            }
          } catch (error) {
            console.warn(`⚠️ [AUDIO] Errore configurazione dispositivo output:`, error)
          }
        }
      }
      
    } catch (error) {
      console.error('❌ [AUDIO] Errore configurazione dispositivo output:', error)
    }
  }, [settings?.audio?.outputDevice])

  // ✅ CORREZIONE: Effetto per applicare la scheda audio configurata
  useEffect(() => {
    configureAudioOutputDevice()
  }, [configureAudioOutputDevice])

  // ✅ CORREZIONE: Effetto per riconfigurare quando gli elementi audio sono pronti
  useEffect(() => {
    if (leftAudioRef.current || rightAudioRef.current) {
      console.log('🔊 [AUDIO] Elementi audio pronti, riconfigurazione dispositivo output...')
      configureAudioOutputDevice()
    }
  }, [leftAudioRef.current, rightAudioRef.current, configureAudioOutputDevice])

  // ✅ CLEANUP: Effetto per pulire gli stream audio quando il componente viene smontato
  useEffect(() => {
    return () => {
      console.log('🧹 [CLEANUP] AudioProvider smontato, cleanup automatico...')
      // ✅ CLEANUP: Pulisci il debounce timeout
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current)
        seekDebounceRef.current = null
      }
      cleanupAllAudioStreams()
    }
  }, [cleanupAllAudioStreams])

  // ✅ CLEANUP: Listener per chiusura finestra/app
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('🧹 [CLEANUP] App in chiusura, cleanup stream audio...')
      cleanupAllAudioStreams()
    }

    const handleUnload = () => {
      console.log('🧹 [CLEANUP] App chiusa, cleanup finale...')
      cleanupAllAudioStreams()
    }

    // ✅ CLEANUP: Aggiungi listener per chiusura
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleUnload)

    // ✅ CLEANUP: Rimuovi listener quando il componente viene smontato
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleUnload)
    }
  }, [cleanupAllAudioStreams])

  // ✅ CLEANUP: Cleanup iniziale per rimuovere stream residui
  useEffect(() => {
    console.log('🧹 [CLEANUP] Cleanup iniziale per rimuovere stream residui...')
    cleanupAllAudioStreams()
    
    // ✅ INIZIALIZZA: AudioContext principale
    ensureMainAudioContext()
  }, [cleanupAllAudioStreams, ensureMainAudioContext]) // Solo all'inizializzazione

  // ✅ FIX: Funzioni per impostare i volumi locali dei deck
  const setLeftLocalVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    dispatch({ type: 'SET_LEFT_DECK_LOCAL_VOLUME', payload: clampedVolume })
    
    // ✅ CRITICAL FIX: Aggiorna SOLO il volume HTML locale, NON quello streaming
    if (leftAudioRef.current) {
      leftAudioRef.current.volume = clampedVolume
      console.log(`🔊 [LEFT DECK] Volume locale impostato: ${Math.round(clampedVolume * 100)}% (HTML solo)`)
    }
  }, [dispatch])

  const setRightLocalVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    dispatch({ type: 'SET_RIGHT_DECK_LOCAL_VOLUME', payload: clampedVolume })
    
    // ✅ CRITICAL FIX: Aggiorna SOLO il volume HTML locale, NON quello streaming
    if (rightAudioRef.current) {
      rightAudioRef.current.volume = clampedVolume
      console.log(`🔊 [RIGHT DECK] Volume locale impostato: ${Math.round(clampedVolume * 100)}% (HTML solo)`)
    }
  }, [dispatch])

  // ✅ DEBOUNCE: Debounce per evitare troppi aggiornamenti rapidi
  const seekDebounceRef = useRef<NodeJS.Timeout | null>(null)
  
  // ✅ NUOVO: Funzioni seek per spostare la canzone
  const seekLeftTo = useCallback(async (time: number) => {
    console.log('🎯 [SEEK LEFT] Funzione seekLeftTo chiamata con time:', time)
    console.log('🎯 [SEEK LEFT] leftAudioRef.current:', !!leftAudioRef.current)
    console.log('🎯 [SEEK LEFT] leftAudioRef.current.src:', leftAudioRef.current?.src)
    
    if (leftAudioRef.current && leftAudioRef.current.src) {
      const duration = leftAudioRef.current.duration || 0
      const clampedTime = Math.max(0, Math.min(duration, time))
      leftAudioRef.current.currentTime = clampedTime
      // ✅ OPTIMIZATION: Arrotonda il tempo per ridurre re-render
      const roundedTime = Math.floor(clampedTime * 10) / 10
      dispatch({ type: 'SET_LEFT_DECK_TIME', payload: roundedTime })
      console.log(`⏩ [LEFT DECK] Seek to ${roundedTime.toFixed(2)}s`)
      
      // ✅ CRITICAL FIX: Debounce per evitare troppi aggiornamenti rapidi
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current)
      }
      
      // ✅ CRITICAL FIX: NON fermare lo streaming per seek - solo sincronizzazione continua
      console.log('🎯 [SEEK LEFT] Seek completato - sincronizzazione continua gestirà l\'aggiornamento')
      
      // ✅ CRITICAL FIX: Forza sincronizzazione immediata della posizione dopo il seek
      setTimeout(() => {
        const leftAudio = leftAudioRef.current
        if (leftAudio) {
          console.log(`🔄 [SEEK SYNC] Forzando sincronizzazione posizione: ${leftAudio.currentTime.toFixed(2)}s`)
          // La sincronizzazione continua gestirà il resto
        }
      }, 100)
    }
  }, [dispatch, getMixedStream])

  const seekRightTo = useCallback(async (time: number) => {
    console.log('🎯 [SEEK RIGHT] Funzione seekRightTo chiamata con time:', time)
    console.log('🎯 [SEEK RIGHT] rightAudioRef.current:', !!rightAudioRef.current)
    console.log('🎯 [SEEK RIGHT] rightAudioRef.current.src:', rightAudioRef.current?.src)
    
    if (rightAudioRef.current && rightAudioRef.current.src) {
      const duration = rightAudioRef.current.duration || 0
      const clampedTime = Math.max(0, Math.min(duration, time))
      rightAudioRef.current.currentTime = clampedTime
      // ✅ OPTIMIZATION: Arrotonda il tempo per ridurre re-render
      const roundedTime = Math.floor(clampedTime * 10) / 10
      dispatch({ type: 'SET_RIGHT_DECK_TIME', payload: roundedTime })
      console.log(`⏩ [RIGHT DECK] Seek to ${roundedTime.toFixed(2)}s`)
      
      // ✅ CRITICAL FIX: Debounce per evitare troppi aggiornamenti rapidi
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current)
      }
      
      // ✅ CRITICAL FIX: NON fermare lo streaming per seek - solo sincronizzazione continua
      console.log('🎯 [SEEK RIGHT] Seek completato - sincronizzazione continua gestirà l\'aggiornamento')
      
      // ✅ CRITICAL FIX: Forza sincronizzazione immediata della posizione dopo il seek
      setTimeout(() => {
        const rightAudio = rightAudioRef.current
        if (rightAudio) {
          console.log(`🔄 [SEEK SYNC] Forzando sincronizzazione posizione: ${rightAudio.currentTime.toFixed(2)}s`)
          // La sincronizzazione continua gestirà il resto
        }
      }, 100)
    }
  }, [dispatch, getMixedStream])

  // ✅ NUOVO: Funzioni di controllo playback
  const pauseLeftTrack = useCallback(() => {
    if (leftAudioRef.current && leftAudioRef.current.src) {
      leftAudioRef.current.pause()
      dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })
      console.log('⏸️ [LEFT DECK] Paused')
      
      // ✅ CRITICAL FIX: Pausa anche lo streaming quando l'audio locale viene messo in pausa
      if (typeof window !== 'undefined' && (window as any).streamingManager && (window as any).streamingManager.isCurrentlyStreaming()) {
        console.log('⏸️ [STREAMING SYNC] Pausa streaming per sincronizzazione con deck A')
        
        // Pausa lo streaming temporaneamente
        if (typeof window !== 'undefined' && (window as any).pauseStreaming) {
          ;(window as any).pauseStreaming()
          console.log('⏸️ [STREAMING SYNC] Streaming pausato per sincronizzazione')
        } else {
          console.log('⚠️ [STREAMING SYNC] Funzione pauseStreaming non disponibile')
        }
      }
    }
  }, [dispatch])

  const resumeLeftTrack = useCallback(() => {
    if (leftAudioRef.current && leftAudioRef.current.src) {
      leftAudioRef.current.play().catch((error: any) => {
        console.error('❌ Errore resume left deck:', error)
      })
      dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: true })
      console.log('▶️ [LEFT DECK] Resumed')
      
      // ✅ CRITICAL FIX: Riprendi anche lo streaming quando l'audio locale viene ripreso
      if (typeof window !== 'undefined' && (window as any).streamingManager && (window as any).streamingManager.isCurrentlyStreaming()) {
        console.log('▶️ [STREAMING SYNC] Riprendi streaming per sincronizzazione con deck A')
        
        // Riprendi lo streaming
        if (typeof window !== 'undefined' && (window as any).resumeStreaming) {
          ;(window as any).resumeStreaming()
          console.log('▶️ [STREAMING SYNC] Streaming ripreso per sincronizzazione')
        } else {
          console.log('⚠️ [STREAMING SYNC] Funzione resumeStreaming non disponibile')
        }
      }
    }
  }, [dispatch])

  const stopLeftTrack = useCallback(() => {
    if (leftAudioRef.current) {
      leftAudioRef.current.pause()
      leftAudioRef.current.currentTime = 0
      dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })
      dispatch({ type: 'SET_LEFT_DECK_TIME', payload: 0 })
      console.log('⏹️ [LEFT DECK] Stopped')
    }
  }, [dispatch])

  const pauseRightTrack = useCallback(() => {
    if (rightAudioRef.current && rightAudioRef.current.src) {
      rightAudioRef.current.pause()
      dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })
      console.log('⏸️ [RIGHT DECK] Paused')
      
      // ✅ CRITICAL FIX: Pausa anche lo streaming quando l'audio locale viene messo in pausa
      if (typeof window !== 'undefined' && (window as any).streamingManager && (window as any).streamingManager.isCurrentlyStreaming()) {
        console.log('⏸️ [STREAMING SYNC] Pausa streaming per sincronizzazione con deck B')
        
        // Pausa lo streaming temporaneamente
        if (typeof window !== 'undefined' && (window as any).pauseStreaming) {
          ;(window as any).pauseStreaming()
          console.log('⏸️ [STREAMING SYNC] Streaming pausato per sincronizzazione')
        } else {
          console.log('⚠️ [STREAMING SYNC] Funzione pauseStreaming non disponibile')
        }
      }
    }
  }, [dispatch])

  const resumeRightTrack = useCallback(() => {
    if (rightAudioRef.current && rightAudioRef.current.src) {
      rightAudioRef.current.play().catch((error: any) => {
        console.error('❌ Errore resume right deck:', error)
      })
      dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: true })
      console.log('▶️ [RIGHT DECK] Resumed')
      
      // ✅ CRITICAL FIX: Riprendi anche lo streaming quando l'audio locale viene ripreso
      if (typeof window !== 'undefined' && (window as any).streamingManager && (window as any).streamingManager.isCurrentlyStreaming()) {
        console.log('▶️ [STREAMING SYNC] Riprendi streaming per sincronizzazione con deck B')
        
        // Riprendi lo streaming
        if (typeof window !== 'undefined' && (window as any).resumeStreaming) {
          ;(window as any).resumeStreaming()
          console.log('▶️ [STREAMING SYNC] Streaming ripreso per sincronizzazione')
        } else {
          console.log('⚠️ [STREAMING SYNC] Funzione resumeStreaming non disponibile')
        }
      }
    }
  }, [dispatch])

  const stopRightTrack = useCallback(() => {
    if (rightAudioRef.current) {
      rightAudioRef.current.pause()
      rightAudioRef.current.currentTime = 0
      dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })
      dispatch({ type: 'SET_RIGHT_DECK_TIME', payload: 0 })
      console.log('⏹️ [RIGHT DECK] Stopped')
    }
  }, [dispatch])

  // ✅ NUOVO: Funzione universale per play/pause
  const handlePlayPauseDefinitive = useCallback(async (side: 'left' | 'right') => {
    const audioRef = side === 'left' ? leftAudioRef : rightAudioRef
    const isPlaying = side === 'left' ? state.leftDeck.isPlaying : state.rightDeck.isPlaying
    
    if (audioRef.current && audioRef.current.src) {
      if (isPlaying) {
        // ✅ PAUSA: Ferma audio locale E streaming
        audioRef.current.pause()
        dispatch({ type: side === 'left' ? 'SET_LEFT_DECK_PLAYING' : 'SET_RIGHT_DECK_PLAYING', payload: false })
        console.log(`⏸️ [${side.toUpperCase()} DECK] Paused`)
        
        // ✅ CRITICAL: Ferma anche lo streaming quando pausa
        if ((window as any).pauseStreaming) {
          console.log(`⏸️ [STREAMING] Pausa streaming richiesta da ${side} deck`)
          ;(window as any).pauseStreaming()
        }
      } else {
        try {
          // ✅ PLAY: Avvia audio locale E streaming
          await audioRef.current.play()
          dispatch({ type: side === 'left' ? 'SET_LEFT_DECK_PLAYING' : 'SET_RIGHT_DECK_PLAYING', payload: true })
          console.log(`▶️ [${side.toUpperCase()} DECK] Playing`)
          
          // ✅ CRITICAL: Avvia anche lo streaming quando riprende
          if ((window as any).resumeStreaming) {
            console.log(`▶️ [STREAMING] Riprendi streaming richiesto da ${side} deck`)
            ;(window as any).resumeStreaming()
          }
        } catch (error: any) {
          console.error(`❌ Errore play ${side} deck:`, error)
        }
      }
    }
  }, [leftAudioRef, rightAudioRef, state.leftDeck.isPlaying, state.rightDeck.isPlaying, dispatch])

  // ✅ FIX: Funzione per il ducking dello streaming
  const setStreamDucking = useCallback((active: boolean) => {
    // ✅ FIX: Log solo quando cambia stato per evitare spam
    const lastStreamDuckingState = (window as any).__lastStreamDuckingState__
    if (lastStreamDuckingState !== active) {
      if (active) {
        console.log(`🎤 [STREAMING] Ducking attivato - ${settings?.microphone?.duckingPercent ?? 75}%`)
      } else {
        console.log(`🎤 [STREAMING] Ducking disattivato`)
      }
      ;(window as any).__lastStreamDuckingState__ = active
    }
    
    // ✅ CRITICAL FIX: Ducking automatico per i deck
    const duckingPercent = settings?.microphone?.duckingPercent ?? 75
    const duckingFactor = active ? (100 - duckingPercent) / 100 : 1.0 // Se attivo, riduce al (100-duckingPercent)%, altrimenti 100%
    
    if (active) {
      // Salva i volumi originali se non sono già salvati
      if (!(window as any).__originalDeckVolumes__) {
        // ✅ CRITICAL FIX: Usa i volumi effettivi degli elementi audio invece dei volumi dello stato
        const leftAudio = leftAudioRef.current
        const rightAudio = rightAudioRef.current
        
        const leftVolume = leftAudio ? leftAudio.volume : state.leftDeck.localVolume
        const rightVolume = rightAudio ? rightAudio.volume : state.rightDeck.localVolume
        
        ;(window as any).__originalDeckVolumes__ = {
          left: leftVolume,
          right: rightVolume
        }
        console.log(`🎤 [AUTO-DUCKING] Volumi originali salvati - Left: ${leftVolume}, Right: ${rightVolume}`)
      }
      
      // Applica ducking ai deck
      const newLeftVolume = (window as any).__originalDeckVolumes__.left * duckingFactor
      const newRightVolume = (window as any).__originalDeckVolumes__.right * duckingFactor
      
      dispatch({ type: 'SET_LEFT_DECK_LOCAL_VOLUME', payload: newLeftVolume })
      dispatch({ type: 'SET_RIGHT_DECK_LOCAL_VOLUME', payload: newRightVolume })
      
      console.log(`🎤 [AUTO-DUCKING] Ducking applicato - Left: ${(newLeftVolume * 100).toFixed(1)}%, Right: ${(newRightVolume * 100).toFixed(1)}%`)
    } else {
      // Ripristina i volumi originali
      if ((window as any).__originalDeckVolumes__) {
        const originalLeft = (window as any).__originalDeckVolumes__.left
        const originalRight = (window as any).__originalDeckVolumes__.right
        
        // ✅ CRITICAL FIX: Ripristina sia lo stato che gli elementi audio
        dispatch({ type: 'SET_LEFT_DECK_LOCAL_VOLUME', payload: originalLeft })
        dispatch({ type: 'SET_RIGHT_DECK_LOCAL_VOLUME', payload: originalRight })
        
        // ✅ CRITICAL FIX: Ripristina anche i volumi degli elementi audio direttamente
        const leftAudio = leftAudioRef.current
        const rightAudio = rightAudioRef.current
        
        if (leftAudio) {
          leftAudio.volume = originalLeft
        }
        if (rightAudio) {
          rightAudio.volume = originalRight
        }
        
        console.log(`🎤 [AUTO-DUCKING] Volumi ripristinati - Left: ${(originalLeft * 100).toFixed(1)}%, Right: ${(originalRight * 100).toFixed(1)}%`)
        
        // Pulisci i volumi salvati
        delete (window as any).__originalDeckVolumes__
      }
    }
    
    // ✅ CRITICAL FIX: Aggiorna anche i volumi PTT dinamicamente
    if (typeof (window as any).updatePTTVolumesOnly === 'function') {
      // ✅ CRITICAL FIX: Imposta il livello di ducking dalle impostazioni
      const pttDuckingLevel = duckingPercent / 100 // Converte da percentuale a decimale
      ;(window as any).__pttDuckingLevel__ = pttDuckingLevel
      
      // ✅ CRITICAL FIX: Aggiorna i volumi PTT
      try {
        ;(window as any).updatePTTVolumesOnly(active)
      } catch (error) {
        console.error('❌ [PTT] Errore aggiornamento volumi PTT:', error)
      }
    } else {
      console.warn('⚠️ [PTT] Funzione updatePTTVolumesOnly non disponibile')
    }
  }, [settings?.microphone?.duckingPercent, state.leftDeck.localVolume, state.rightDeck.localVolume])

  // ✅ FIX: Funzione per impostare il volume master dello streaming
  const setStreamMasterVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    console.log(`🔊 [STREAMING] Volume master streaming impostato: ${Math.round(clampedVolume * 100)}%`)
    
    // ✅ CRITICAL FIX: Salva il volume corrente globalmente per il PTT
    ;(window as any).__currentStreamVolume__ = clampedVolume
    
    // I deck mantengono sempre il 100% per lo streaming, indipendentemente dal volume locale
    if (leftAudioRef.current) leftAudioRef.current.volume = clampedVolume
    if (rightAudioRef.current) rightAudioRef.current.volume = clampedVolume
  }, [leftAudioRef.current, rightAudioRef.current])

  // ✅ FIX: Funzione per impostare il volume master generale (controlla il mixer gain)
  const setMasterVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    console.log(`🔊 [MASTER] Volume master generale impostato: ${Math.round(clampedVolume * 100)}%`)
    
    // ✅ CRITICAL FIX: Usa la funzione globale per il volume del mixer
    if (typeof (window as any).audioContextSetMasterVolume === 'function') {
      ;(window as any).audioContextSetMasterVolume(clampedVolume)
    }
  }, [])

  // ✅ NUOVO: Funzioni per liberare i deck
  const clearLeftDeck = useCallback(() => {
    console.log('🗑️ [DECK CLEAR] Liberando deck sinistro completamente')
    dispatch({ type: 'SET_LEFT_DECK_TRACK', payload: null })
    dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })
    dispatch({ type: 'SET_LEFT_DECK_TIME', payload: 0 })
    dispatch({ type: 'SET_LEFT_DECK_DURATION', payload: 0 })
    dispatch({ type: 'SET_LEFT_DECK_VOLUME', payload: 1.0 })
    dispatch({ type: 'SET_LEFT_DECK_LOCAL_VOLUME', payload: 0.0 })
    
    // Ferma l'audio se è in riproduzione
    const leftAudio = document.querySelector('audio[data-deck="A"]') as HTMLAudioElement
    if (leftAudio) {
      leftAudio.pause()
      leftAudio.currentTime = 0
      leftAudio.src = ''
    }
    console.log('✅ [DECK CLEAR] Deck sinistro completamente svuotato')
  }, [])

  const clearRightDeck = useCallback(() => {
    console.log('🗑️ [DECK CLEAR] Liberando deck destro completamente')
    dispatch({ type: 'SET_RIGHT_DECK_TRACK', payload: null })
    dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })
    dispatch({ type: 'SET_RIGHT_DECK_TIME', payload: 0 })
    dispatch({ type: 'SET_RIGHT_DECK_DURATION', payload: 0 })
    dispatch({ type: 'SET_RIGHT_DECK_VOLUME', payload: 1.0 })
    dispatch({ type: 'SET_RIGHT_DECK_LOCAL_VOLUME', payload: 0.0 })
    
    // Ferma l'audio se è in riproduzione
    const rightAudio = document.querySelector('audio[data-deck="B"]') as HTMLAudioElement
    if (rightAudio) {
      rightAudio.pause()
      rightAudio.currentTime = 0
      rightAudio.src = ''
    }
    console.log('✅ [DECK CLEAR] Deck destro completamente svuotato')
  }, [])

  // ✅ CROSSFADER: Funzione per impostare il crossfader (solo per streaming)
  const setCrossfader = useCallback((value: number) => {
    const clampedValue = Math.max(0, Math.min(1, value))
    
    // ✅ NUOVA LOGICA: Applica la logica intelligente per il cursore
    const leftDeckEmpty = !state.leftDeck.track
    const rightDeckEmpty = !state.rightDeck.track
    
    let displayValue: number
    let leftVolume: number
    let rightVolume: number
    
    if (leftDeckEmpty && rightDeckEmpty) {
      // Entrambi i deck vuoti: cursore al centro ma volumi 0
      displayValue = 0.5
      leftVolume = 0
      rightVolume = 0
    } else if (leftDeckEmpty) {
      // Solo deck A vuoto: cursore tutto a destra, deck B al 100%
      displayValue = 1.0
      leftVolume = 0
      rightVolume = 1.0
    } else if (rightDeckEmpty) {
      // Solo deck B vuoto: cursore tutto a sinistra, deck A al 100%
      displayValue = 0.0
      leftVolume = 1.0
      rightVolume = 0
    } else {
      // Entrambi i deck occupati: cursore normale
      displayValue = clampedValue
      leftVolume = 1.0 - clampedValue
      rightVolume = clampedValue
    }
    
    console.log(`🎚️ [CROSSFADER] Crossfader impostato: ${Math.round(displayValue * 100)}% (A=${Math.round(leftVolume * 100)}%, B=${Math.round(rightVolume * 100)}%)`)
    
    // Aggiorna lo stato con il valore di display
    dispatch({ type: 'SET_CROSSFADER', payload: displayValue })
    
    // ✅ CROSSFADER: Aggiorna il crossfader per lo streaming se disponibile
    if (typeof window !== 'undefined' && (window as any).updateStreamingCrossfader) {
      ;(window as any).updateStreamingCrossfader(displayValue)
    }
  }, [state.leftDeck.track, state.rightDeck.track])

  // ✅ CROSSFADER: Aggiorna automaticamente il crossfader quando cambia lo stato dei deck
  // ⚠️ FIX: Solo quando i deck cambiano da occupato a vuoto o viceversa, NON ad ogni movimento manuale
  const prevDeckStateRef = useRef({ leftEmpty: false, rightEmpty: false })
  
  useEffect(() => {
    // Calcola il nuovo valore del crossfader basato sui deck
    const leftDeckEmpty = !state.leftDeck.track
    const rightDeckEmpty = !state.rightDeck.track
    
    // ✅ FIX: Solo aggiorna se lo stato dei deck è effettivamente cambiato
    const leftChanged = leftDeckEmpty !== prevDeckStateRef.current.leftEmpty
    const rightChanged = rightDeckEmpty !== prevDeckStateRef.current.rightEmpty
    
    if (!leftChanged && !rightChanged) {
      // Nessun cambio di stato dei deck, non fare nulla
      return
    }
    
    // Aggiorna il riferimento per il prossimo controllo
    prevDeckStateRef.current = { leftEmpty: leftDeckEmpty, rightEmpty: rightDeckEmpty }
    
    let newCrossfaderValue: number
    
    if (leftDeckEmpty && rightDeckEmpty) {
      // Entrambi i deck vuoti: cursore al centro
      newCrossfaderValue = 0.5
    } else if (leftDeckEmpty) {
      // Solo deck A vuoto: cursore tutto a destra (100% B)
      newCrossfaderValue = 1.0
    } else if (rightDeckEmpty) {
      // Solo deck B vuoto: cursore tutto a sinistra (100% A)
      newCrossfaderValue = 0.0
    } else {
      // Entrambi i deck occupati: 50% (centro)
      newCrossfaderValue = 0.5
    }
    
    console.log(`🎚️ [CROSSFADER] Auto-aggiornamento per cambio deck: ${Math.round(newCrossfaderValue * 100)}% (A=${leftDeckEmpty ? 'vuoto' : 'occupato'}, B=${rightDeckEmpty ? 'vuoto' : 'occupato'})`)
    dispatch({ type: 'SET_CROSSFADER', payload: newCrossfaderValue })
    
    // Aggiorna anche lo streaming
    if (typeof window !== 'undefined' && (window as any).updateStreamingCrossfader) {
      ;(window as any).updateStreamingCrossfader(newCrossfaderValue)
    }
  }, [state.leftDeck.track, state.rightDeck.track])

  // ✅ CRITICAL FIX: Funzione che controlla SOLO il volume del Live Stream nell'interfaccia
  const setLiveStreamVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    console.log(`🔊 [LIVE STREAM] Volume Live Stream impostato: ${Math.round(clampedVolume * 100)}%`)
    
    // ✅ CRITICAL FIX: Aggiorna SOLO il volume del Live Stream nell'interfaccia
    // Questo NON tocca il Master locale, solo il Live Stream!
    
    // 1. Emetti evento custom per aggiornare l'interfaccia
    window.dispatchEvent(new CustomEvent('djconsole:stream-volume-change', {
      detail: { volume: clampedVolume }
    }))
    
    // 2. Aggiorna lo stato locale per mantenere la sincronizzazione
    ;(window as any).__currentStreamVolume__ = clampedVolume
    
    console.log(`🔊 [INTERFACE] Volume Live Stream aggiornato nell'interfaccia: ${Math.round(clampedVolume * 100)}%`)
  }, [])

  // ✅ CRITICAL FIX: Rendi disponibile setStreamMasterVolume globalmente per il PTT
  ;(window as any).setStreamMasterVolume = setStreamMasterVolume

  // ✅ CRITICAL FIX: Rendi disponibile setMasterVolume globalmente per il PTT
  ;(window as any).setMasterVolume = setMasterVolume

  // ✅ CRITICAL FIX: Rendi disponibile setLiveStreamVolume globalmente per il PTT
  ;(window as any).setLiveStreamVolume = setLiveStreamVolume

  // ✅ CROSSFADER: Funzione per aggiornare il crossfader dinamicamente durante lo streaming
  ;(window as any).updateStreamingCrossfader = (crossfaderValue: number) => {
    try {
      console.log(`🎚️ [CROSSFADER] Aggiornamento crossfader streaming a ${Math.round(crossfaderValue * 100)}%`)
      
      // ✅ FIX: Prova a ottenere i gain nodes da diverse fonti
      let leftGain = (window as any).leftDeckStreamGain
      let rightGain = (window as any).rightDeckStreamGain
      let context = (window as any).currentMixContext
      
      // Se non sono disponibili, prova a ottenerli dal mixer globale
      if (!leftGain || !rightGain) {
        console.log(`🔍 [CROSSFADER] Gain nodes non trovati, cerco nel mixer globale...`)
        const mixerGain = (window as any).mixerGain
        const audioContext = (window as any).audioContext
        
        console.log(`🔍 [CROSSFADER] DEBUG - mixerGain:`, !!mixerGain, `audioContext:`, !!audioContext)
        
        if (mixerGain && audioContext) {
          // ✅ FIX: Crea gain nodes temporanei e salvali globalmente
          if (!leftGain) {
            leftGain = audioContext.createGain()
            leftGain.gain.value = 1.0
            ;(window as any).leftDeckStreamGain = leftGain
            console.log(`🔧 [CROSSFADER] Creato e salvato leftGain temporaneo`)
          }
          if (!rightGain) {
            rightGain = audioContext.createGain()
            rightGain.gain.value = 1.0
            ;(window as any).rightDeckStreamGain = rightGain
            console.log(`🔧 [CROSSFADER] Creato e salvato rightGain temporaneo`)
          }
          context = audioContext
          ;(window as any).currentMixContext = audioContext
          console.log(`🔧 [CROSSFADER] Salvato currentMixContext`)
        } else {
          console.log(`⚠️ [CROSSFADER] Mixer globale non disponibile - mixerGain:`, !!mixerGain, `audioContext:`, !!audioContext)
        }
      }
      
      if (leftGain && rightGain && context) {
        // ✅ NUOVA LOGICA: Controlla se i deck sono vuoti
        const leftDeckEmpty = !state.leftDeck.track
        const rightDeckEmpty = !state.rightDeck.track
        
        let leftVolume: number
        let rightVolume: number
        
        if (leftDeckEmpty && rightDeckEmpty) {
          // Entrambi i deck vuoti: volume 0 per entrambi
          leftVolume = 0
          rightVolume = 0
          console.log(`🎚️ [CROSSFADER] Entrambi i deck vuoti: A=0%, B=0%`)
        } else if (leftDeckEmpty) {
          // Solo deck A vuoto: deck B al 100%
          leftVolume = 0
          rightVolume = 1.0
          console.log(`🎚️ [CROSSFADER] Solo deck A vuoto: A=0%, B=100%`)
        } else if (rightDeckEmpty) {
          // Solo deck B vuoto: deck A al 100%
          leftVolume = 1.0
          rightVolume = 0
          console.log(`🎚️ [CROSSFADER] Solo deck B vuoto: A=100%, B=0%`)
        } else {
          // Entrambi i deck occupati: crossfader normale
          leftVolume = 1.0 - crossfaderValue
          rightVolume = crossfaderValue
          console.log(`🎚️ [CROSSFADER] Entrambi i deck occupati: A=${Math.round(leftVolume * 100)}%, B=${Math.round(rightVolume * 100)}%`)
        }
        
        leftGain.gain.setValueAtTime(leftVolume, context.currentTime)
        rightGain.gain.setValueAtTime(rightVolume, context.currentTime)
        
        // ✅ DEBUG: Verifica i volumi effettivi dopo l'impostazione
        const actualLeftGain = leftGain.gain.value
        const actualRightGain = rightGain.gain.value
        
        console.log(`🎚️ [CROSSFADER] Streaming aggiornato: A=${Math.round(leftVolume * 100)}%, B=${Math.round(rightVolume * 100)}%`)
        console.log(`🔍 [CROSSFADER] DEBUG - Volumi effettivi: A=${Math.round(actualLeftGain * 100)}%, B=${Math.round(actualRightGain * 100)}%`)
      } else {
        console.warn('⚠️ [CROSSFADER] Gain nodes non disponibili per aggiornamento crossfader')
      }
    } catch (error: any) {
      console.error('❌ [CROSSFADER] Errore aggiornamento crossfader streaming:', error.message)
    }
  }

  // ✅ CRITICAL FIX: Inizializza il volume corrente del LiveStream per il PTT
  ;(window as any).__currentStreamVolume__ = 1.0 // Default al 100% (come richiesto dall'utente)

  // Aggiunge track al deck specificato
  const addToDeck = async (track: any, deck: 'left' | 'right') => {
    console.log(`🎵 [DECK] Aggiunta track "${track.title}" al deck ${deck}`)
    
    try {
      // Converti DatabaseTrack in AudioTrack
      const audioTrack: AudioTrack = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        url: '' // Sarà impostato dopo aver ottenuto il blob
      }
      
      if (deck === 'left') {
        dispatch({ type: 'SET_LEFT_DECK_TRACK', payload: audioTrack })
        // Carica l'audio nel deck sinistro
        if (leftAudioRef.current) {
          // Crea URL dal blob
          const blob = await getBlob(track.blobId)
          if (blob) {
            const url = URL.createObjectURL(blob)
            leftAudioRef.current.src = url
            leftAudioRef.current.load()
            console.log(`✅ [DECK] Track caricata nel deck sinistro: ${track.title}`)
            
            // ✅ AUTO-RECONNECT: Ricollega automaticamente il deck allo streaming se attivo
            if (typeof window !== 'undefined' && (window as any).reconnectDeckToStreaming) {
              try {
                // ✅ CRITICAL: Aspetta che il deck sia completamente caricato prima del ricollegamento
                console.log('🎵 [DECK] Aspetto caricamento completo deck A prima del ricollegamento...')
                await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay
                
                await (window as any).reconnectDeckToStreaming('A')
                console.log('✅ [DECK] Deck A ricollegato automaticamente allo streaming')
              } catch (reconnectError: any) {
                console.warn('⚠️ [DECK] Ricollegamento automatico deck A fallito:', reconnectError.message)
              }
            }
            
            // ✅ CRITICAL FIX: Forza la ricreazione del mixed stream se lo streaming è attivo
            if (typeof window !== 'undefined' && (window as any).isCurrentlyStreaming) {
              try {
                console.log('🎵 [DECK LEFT] Streaming attivo rilevato - forzo ricreazione mixed stream...')
                console.log('🎵 [DECK LEFT] isCurrentlyStreaming:', (window as any).isCurrentlyStreaming)
                
                // ✅ RICREA COMPLETAMENTE IL MIXED STREAM
                const newMixedStream = await getMixedStream()
                console.log('🎵 [DECK LEFT] newMixedStream creato:', !!newMixedStream, newMixedStream?.active, newMixedStream?.getTracks().length)
                
                if (newMixedStream) {
                  // ✅ ATTENDI CHE STREAMINGMANAGER SIA DISPONIBILE
                  console.log('🎵 [DECK LEFT] Chiamata waitForStreamingManager...')
                  const streamingManager = await waitForStreamingManager()
                  console.log('🎵 [DECK LEFT] streamingManager ricevuto:', !!streamingManager)
                  
                  if (streamingManager) {
                    // ✅ AGGIORNA LO STREAMING MANAGER CON IL NUOVO STREAM
                    console.log('📡 [DECK LEFT] StreamingManager disponibile, aggiorno stream...')
                    console.log('📡 [DECK LEFT] Chiamata updateStream con stream:', !!newMixedStream)
                    const updated = await streamingManager.updateStream(newMixedStream)
                    console.log('📡 [DECK LEFT] updateStream risultato:', updated)
                    
                    if (updated) {
                      console.log('✅ [DECK] Mixed stream ricreato e aggiornato con successo per deck A')
                      
                      // Notifica di successo
                      if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
                        ;(window as any).addStreamingNotification('success', 'Deck A Connesso', 'Deck A connesso automaticamente allo streaming', 'audio')
                      }
                    } else {
                      console.warn('⚠️ [DECK] Aggiornamento streaming fallito per deck A')
                    }
                  } else {
                    console.warn('⚠️ [DECK] StreamingManager non disponibile per aggiornamento')
                  }
                } else {
                  console.warn('⚠️ [DECK] Nuovo mixed stream non valido')
                }
              } catch (streamError: any) {
                console.error('❌ [DECK] Errore ricreazione mixed stream per deck A:', streamError.message)
              }
            }
          } else {
            console.error(`❌ [DECK] Blob non trovato per track: ${track.title}`)
          }
        }
      } else {
        dispatch({ type: 'SET_RIGHT_DECK_TRACK', payload: audioTrack })
        // Carica l'audio nel deck destro
        if (rightAudioRef.current) {
          // Crea URL dal blob
          const blob = await getBlob(track.blobId)
          if (blob) {
            const url = URL.createObjectURL(blob)
            rightAudioRef.current.src = url
            rightAudioRef.current.load()
            console.log(`✅ [DECK] Track caricata nel deck destro: ${track.title}`)
            
            // ✅ AUTO-RECONNECT: Ricollega automaticamente il deck allo streaming se attivo
            if (typeof window !== 'undefined' && (window as any).reconnectDeckToStreaming) {
              try {
                // ✅ CRITICAL: Aspetta che il deck sia completamente caricato prima del ricollegamento
                console.log('🎵 [DECK] Aspetto caricamento completo deck B prima del ricollegamento...')
                await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay
                
                await (window as any).reconnectDeckToStreaming('B')
                console.log('✅ [DECK] Deck B ricollegato automaticamente allo streaming')
              } catch (reconnectError: any) {
                console.warn('⚠️ [DECK] Ricollegamento automatico deck B fallito:', reconnectError.message)
              }
            }
            
            // ✅ CRITICAL FIX: Forza la ricreazione del mixed stream se lo streaming è attivo
            if (typeof window !== 'undefined' && (window as any).isCurrentlyStreaming) {
              try {
                console.log('🎵 [DECK] Streaming attivo rilevato - forzo ricreazione mixed stream...')
                
                // ✅ RICREA COMPLETAMENTE IL MIXED STREAM
                const newMixedStream = await getMixedStream()
                
                if (newMixedStream) {
                  // ✅ ATTENDI CHE STREAMINGMANAGER SIA DISPONIBILE
                  const streamingManager = await waitForStreamingManager()
                  
                  if (streamingManager) {
                    // ✅ AGGIORNA LO STREAMING MANAGER CON IL NUOVO STREAM
                    console.log('📡 [DECK RIGHT] StreamingManager disponibile, aggiorno stream...')
                    console.log('📡 [DECK RIGHT] Chiamata updateStream con stream:', !!newMixedStream)
                    const updated = await streamingManager.updateStream(newMixedStream)
                    console.log('📡 [DECK RIGHT] updateStream risultato:', updated)
                    
                    if (updated) {
                      console.log('✅ [DECK] Mixed stream ricreato e aggiornato con successo per deck B')
                      
                      // Notifica di successo
                      if (typeof window !== 'undefined' && (window as any).addStreamingNotification) {
                        ;(window as any).addStreamingNotification('success', 'Deck B Connesso', 'Deck B connesso automaticamente allo streaming', 'audio')
                      }
                    } else {
                      console.warn('⚠️ [DECK] Aggiornamento streaming fallito per deck B')
                    }
                  } else {
                    console.warn('⚠️ [DECK] StreamingManager non disponibile per aggiornamento')
                  }
                } else {
                  console.warn('⚠️ [DECK] Nuovo mixed stream non valido')
                }
              } catch (streamError: any) {
                console.error('❌ [DECK] Errore ricreazione mixed stream per deck B:', streamError.message)
              }
            }
        } else {
            console.error(`❌ [DECK] Blob non trovato per track: ${track.title}`)
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ [DECK] Errore caricamento track nel deck ${deck}:`, error)
    }
  }

  // Incrementa il play count di una track
  const incrementPlayCount = async (trackId: string) => {
    try {
      await localDatabase.waitForInitialization()
      // Incrementa il play count direttamente nella traccia
      const track = await localDatabase.getTrack(trackId)
      if (track) {
        const newPlayCount = (track.playCount || 0) + 1
        await localDatabase.updateTrack(trackId, { playCount: newPlayCount })
        console.log(`✅ Play count incrementato per track ${trackId}: ${newPlayCount}`)
      }
    } catch (error: any) {
      console.error(`❌ Errore incremento play count per track ${trackId}:`, error)
    }
  }

  // ===== INIZIALIZZAZIONE DATABASE =====
  useEffect(() => {
    if (window.indexedDB) {
      const request = window.indexedDB.open('djconsole', 1)
      
      request.onerror = () => {
        console.error('❌ Error opening IndexedDB for audio persistence')
      }
      
      request.onsuccess = () => {
        console.log('✅ IndexedDB opened successfully for audio persistence')
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Crea la tabella per lo stato audio
        if (!db.objectStoreNames.contains('audioState')) {
          const audioStore = db.createObjectStore('audioState', { keyPath: 'id' })
          audioStore.createIndex('timestamp', 'timestamp', { unique: false })
          console.log('✅ Audio state store created in IndexedDB')
        }
      }
    }
  }, [])

         // ✅ FIX MICROFONO: Gestione intelligente del cambio impostazioni microfono
         useEffect(() => {
           const handleMicrophoneSettingsChange = async (event: Event) => {
             const customEvent = event as CustomEvent
             const newDeviceId = customEvent?.detail?.inputDevice
             const forceReinit = customEvent?.detail?.forceReinit
             const forceCleanup = customEvent?.detail?.forceCleanup
             
             // ✅ FIX: Debouncing per evitare reinizializzazioni multiple rapide
             const now = Date.now()
             const timeSinceLastReinit = now - lastMicrophoneReinitRef.current
             const DEBOUNCE_TIME = 500 // 500ms di debouncing
             
             if (timeSinceLastReinit < DEBOUNCE_TIME && !forceReinit && !forceCleanup) {
               console.log('🎤 [MIC] Reinizializzazione ignorata per debouncing (ultima:', timeSinceLastReinit, 'ms fa)')
               return
             }
             
             lastMicrophoneReinitRef.current = now
             console.log('🎤 [MIC] Impostazioni microfono cambiate:', { newDeviceId, forceReinit, forceCleanup })
             
             // ✅ FIX: Verifica se il dispositivo è effettivamente cambiato
             let deviceChanged = false
             if (newDeviceId && micStreamRef.current) {
               const currentStream = micStreamRef.current
               const audioTrack = currentStream.getAudioTracks()[0]
               if (audioTrack) {
                 const currentDeviceId = audioTrack.getSettings().deviceId
                 deviceChanged = currentDeviceId !== newDeviceId
                 console.log('🎤 [MIC] Verifica cambio dispositivo:', { current: currentDeviceId, new: newDeviceId, changed: deviceChanged })
               }
             }
             
             // ✅ FIX: Solo se il dispositivo è cambiato o è richiesta una reinizializzazione forzata
             if (deviceChanged || forceReinit || forceCleanup) {
               console.log('🎤 [MIC] Reinizializzazione necessaria, procedendo...')
               
               // ✅ FIX: Ferma gli stream microfono attivi in modo più smooth
               if (micStreamRef.current) {
                 console.log('🎤 [MIC] Fermando stream microfono corrente...')
                 micStreamRef.current.getTracks().forEach(track => {
                   track.stop()
                 })
                 micStreamRef.current = null
               }
               
               // ✅ FIX: Pulisci gli stream globali solo se necessario
               if (forceCleanup && (window as any).__activeMicrophoneStreams) {
                 console.log('🎤 [MIC] Pulizia forzata stream globali...')
                 ;(window as any).__activeMicrophoneStreams.forEach((stream: MediaStream) => {
                   stream.getTracks().forEach(track => track.stop())
                 })
                 ;(window as any).__activeMicrophoneStreams.clear()
               }
               
               // ✅ FIX: Reinizializza l'AudioManager solo se necessario
               if ((window as any).audioManager && typeof (window as any).audioManager.reinitializeMicrophone === 'function') {
                 console.log('🎤 [MIC] Reinizializzando AudioManager...')
                 try {
                   await (window as any).audioManager.reinitializeMicrophone()
                 } catch (error) {
                   console.warn('⚠️ [MIC] Errore reinizializzazione AudioManager:', error)
                 }
               }
               
               // ✅ FIX: Gestione più intelligente dell'abilitazione/disabilitazione
               const wasEnabled = state.microphone.isEnabled
               if (wasEnabled) {
                 // Se il microfono era abilitato, riabilitalo dopo un breve delay
                 console.log('🎤 [MIC] Microfono era abilitato, riabilitando con nuove impostazioni...')
                 
                 // Aspetta un momento per la pulizia
                 await new Promise(resolve => setTimeout(resolve, 100))
                 
                 // Riabilita il microfono
                 dispatch({ type: 'SET_MICROPHONE_ENABLED', payload: true })
               } else {
                 // Se il microfono non era abilitato, non fare nulla
                 console.log('🎤 [MIC] Microfono non era abilitato, nessuna azione necessaria')
               }
             } else {
               console.log('🎤 [MIC] Nessun cambio dispositivo rilevato, reinizializzazione non necessaria')
             }
             
             // ✅ FIX: Ricreazione ottimizzata del stream microfono
             console.log('🎤 [MIC] 🔄 Ricreazione stream microfono con nuove impostazioni...')
             try {
               // Aspetta un momento per assicurarsi che il dispatch sia processato
               await new Promise(resolve => setTimeout(resolve, 100))
               
               const newStream = await createMicrophoneStream()
               if (newStream) {
                 micStreamRef.current = newStream
                 console.log('🎤 [MIC] ✅ Stream microfono ricreato con successo!')
                 
                 // ✅ FIX: Verifica rapida del dispositivo
                 const audioTrack = newStream.getAudioTracks()[0]
                 if (audioTrack && newDeviceId) {
                   const trackSettings = audioTrack.getSettings()
                   if (trackSettings.deviceId === newDeviceId) {
                     console.log('🎤 [MIC] ✅ Dispositivo corretto!')
                   } else {
                     console.warn('⚠️ [MIC] Dispositivo diverso da quello richiesto')
                   }
                 }
                 
                 // ✅ CRITICAL FIX: Riconnetti il microfono al sistema di streaming esistente
                 console.log('🎤 [MIC] 🔄 Riconnessione microfono al sistema di streaming esistente...')
                 try {
                   // Riconnetti il microfono al sistema esistente senza ricreare tutto
                   await reconnectMicrophoneToExistingStream()
                   console.log('🎤 [MIC] ✅ Microfono riconnesso al sistema di streaming esistente!')
                 } catch (reconnectError) {
                   console.error('❌ [MIC] Errore riconnessione al sistema di streaming:', reconnectError)
                 }
               } else {
                 console.error('❌ [MIC] Errore creazione stream')
               }
             } catch (fallbackError) {
               console.error('❌ [MIC] Errore creazione stream:', fallbackError)
             }
           }
    
    // Listener per cambiamenti nelle impostazioni microfono
    window.addEventListener('djconsole:microphone-settings-changed', handleMicrophoneSettingsChange as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:microphone-settings-changed', handleMicrophoneSettingsChange as EventListener)
    }
         }, [state.microphone.isEnabled])

         // ✅ FIX OUTPUT: Gestione intelligente del cambio output device
         useEffect(() => {
           const handleOutputSettingsChange = async (event: Event) => {
             const customEvent = event as CustomEvent
             const newOutputDevice = customEvent?.detail?.outputDevice
             
             console.log('🔊 [OUTPUT] Impostazioni output cambiate:', { newOutputDevice })
             
             // ✅ FIX: Riconnetti immediatamente l'output device
             try {
               await reconnectOutputDevice()
               console.log('🔊 [OUTPUT] ✅ Output device riconnesso con successo!')
             } catch (reconnectError) {
               console.error('❌ [OUTPUT] Errore riconnessione output device:', reconnectError)
             }
           }
           
           window.addEventListener('djconsole:output-settings-changed', handleOutputSettingsChange as EventListener)
           return () => {
             window.removeEventListener('djconsole:output-settings-changed', handleOutputSettingsChange as EventListener)
           }
         }, [settings.audio?.outputDevice, reconnectOutputDevice])

         // ✅ FIX MICROFONO: Monitora cambiamenti del deviceId e forza reinizializzazione
         useEffect(() => {
           const currentDeviceId = (state.microphone as any).inputDevice || 'default'
           console.log('🎤 [MIC] DeviceId microfono cambiato:', currentDeviceId)
           
           // Se il microfono è attivo e il deviceId è cambiato, forza reinizializzazione
           if (state.microphone.isEnabled && currentDeviceId) {
             console.log('🎤 [MIC] DeviceId cambiato con microfono attivo, forzando reinizializzazione...')
             
             // Emetti evento per forzare reinizializzazione
             const event = new CustomEvent('djconsole:microphone-settings-changed', {
               detail: { inputDevice: currentDeviceId, forceReinit: true }
             })
             window.dispatchEvent(event)
           }
         }, [(state.microphone as any).inputDevice, state.microphone.isEnabled])

         // ✅ FIX MICROFONO: Reinizializzazione ottimizzata senza retry aggressivi
         useEffect(() => {
           if (state.microphone.isEnabled) {
             console.log('🎤 [MIC] Microfono riabilitato, verificando stream...')
             
             // ✅ FIX: Singolo tentativo ottimizzato senza retry multipli
             const createStreamOnce = async () => {
               if (!micStreamRef.current) {
                 try {
                   console.log('🎤 [MIC] Creazione stream microfono...')
                   const stream = await createMicrophoneStream()
                   if (stream) {
                     micStreamRef.current = stream
                     console.log('🎤 [MIC] ✅ Stream microfono creato con successo!')
                   } else {
                     console.warn('⚠️ [MIC] Stream creato ma null')
                   }
                 } catch (error) {
                   console.error('❌ [MIC] Errore creazione stream:', error)
                 }
               } else {
                 console.log('🎤 [MIC] Stream microfono già attivo')
               }
             }
             
             // ✅ FIX: Singolo tentativo con delay minimo per evitare interruzioni audio
             setTimeout(createStreamOnce, 50)
           } else {
             console.log('🎤 [MIC] Microfono disabilitato, pulendo stream...')
             // Pulisci lo stream quando il microfono viene disabilitato
             if (micStreamRef.current) {
               micStreamRef.current.getTracks().forEach(track => track.stop())
               micStreamRef.current = null
               console.log('🎤 [MIC] Stream microfono pulito')
             }
           }
         }, [state.microphone.isEnabled])


  // ✅ CONFIGURAZIONE MICROFONO CON ISOLAMENTO AUDIO SISTEMA
  const createMicrophoneStream = async (): Promise<MediaStream | null> => {
    try {
      // ✅ CLEANUP: Pulisci stream microfono precedente se esiste
      if (micStreamRef.current) {
        console.log('🧹 [MICROPHONE] Pulizia stream microfono precedente...')
        try {
          micStreamRef.current.getTracks().forEach(track => {
            track.stop()
            console.log(`🧹 [MICROPHONE] Track microfono fermato: ${track.label}`)
          })
        } catch (error) {
          console.warn('⚠️ [MICROPHONE] Errore fermando track precedenti:', error)
        }
        micStreamRef.current = null
      }
      
      // ✅ CORREZIONE: Usa le impostazioni del microfono dalle settings
      const settings = await localDatabase.getSettings();
      const micSettings = settings?.microphone || {
        inputDevice: 'default',
        sampleRate: 48000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false
      };
      
      console.log('🎤 [MIC] Usando impostazioni microfono dalle settings:', micSettings);
      console.log('🎤 [MIC] 🔍 DEBUG: Device ID richiesto:', micSettings.inputDevice);
      
      // ✅ FIX MICROFONO: Seleziona dispositivo microfono specifico se configurato
      let deviceId = undefined;
      console.log('🎤 [MIC] 🔍 DEBUG: Impostazione microfono da cercare:', micSettings.inputDevice);
      
      if (micSettings.inputDevice && micSettings.inputDevice !== 'default') {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          console.log('🎤 [MIC] 🔍 DEBUG: Dispositivi audio input disponibili:', audioInputs.map(d => ({
            deviceId: d.deviceId,
            label: d.label,
            groupId: d.groupId
          })));
          
          // ✅ FIX: Cerca prima per deviceId, poi per label
          let selectedDevice = audioInputs.find(device => 
            device.deviceId === micSettings.inputDevice
          );
          
          if (!selectedDevice) {
            selectedDevice = audioInputs.find(device => 
              device.label === micSettings.inputDevice
            );
          }
          
          if (selectedDevice) {
            deviceId = selectedDevice.deviceId;
            console.log('🎤 [MIC] ✅ Dispositivo microfono selezionato:', {
              label: selectedDevice.label,
              deviceId: selectedDevice.deviceId,
              groupId: selectedDevice.groupId
            });
            
            // ✅ FIX: Verifica che non sia un dispositivo che cattura audio sistema
            const label = selectedDevice.label.toLowerCase();
            const problematicPatterns = [
              'stereo mix', 'what u hear', 'wave out mix', 'speakers', 
              'headphones', 'output', 'playback', 'monitor', 'loopback',
              'virtual', 'system', 'desktop', 'screen'
            ];
            
            const isProblematic = problematicPatterns.some(pattern => label.includes(pattern));
            if (isProblematic) {
              console.warn('⚠️ [MIC] ATTENZIONE: Il dispositivo selezionato potrebbe catturare audio sistema!', selectedDevice.label);
              console.warn('⚠️ [MIC] CONSIGLIO: Cambia dispositivo nelle impostazioni per evitare feedback');
            }
            
          } else {
            console.error('❌ [MIC] ERRORE: Dispositivo microfono non trovato!', {
              cercato: micSettings.inputDevice,
              disponibili: audioInputs.map(d => ({ deviceId: d.deviceId, label: d.label }))
            });
            console.log('🎤 [MIC] Dispositivi disponibili:', audioInputs.map(d => d.label));
            console.warn('⚠️ [MIC] Il dispositivo potrebbe essere stato disconnesso. Userò il microfono di default.');
            
            // ✅ FIX: Aggiorna le impostazioni per usare il microfono di default
            try {
              const { localDatabase } = await import('../database/LocalDatabase');
              const currentSettings = await localDatabase.getSettings();
              if (currentSettings?.microphone?.inputDevice === micSettings.inputDevice) {
                console.log('🎤 [MIC] 🔄 Aggiornando impostazioni per usare microfono di default...');
                await localDatabase.updateSettings({
                  ...currentSettings,
                  microphone: {
                    ...currentSettings.microphone,
                    inputDevice: 'default'
                  }
                });
                console.log('🎤 [MIC] ✅ Impostazioni aggiornate per usare microfono di default');
              }
            } catch (updateError) {
              console.warn('⚠️ [MIC] Errore aggiornamento impostazioni:', updateError);
            }
          }
        } catch (error) {
          console.warn('⚠️ [MIC] Errore enumerazione dispositivi:', error);
        }
      } else {
        console.log('🎤 [MIC] Usando microfono di default (nessun dispositivo specifico configurato)');
      }
      
      // ✅ FIX MICROFONO: Configurazione aggressiva per prevenire cattura audio sistema
      const constraints = {
        audio: {
          // ✅ PARAMETRI BASE per isolamento massimo
          echoCancellation: true,             // ✅ FORZATO: Sempre attivo per prevenire feedback
          noiseSuppression: true,             // ✅ FORZATO: Sempre attivo per pulire il segnale
          autoGainControl: false,             // ✅ DISABILITATO: Controllo manuale del volume
          latency: 0,                         // Latenza minima
          sampleRate: micSettings.sampleRate, // Usa impostazione settings
          channelCount: 1,                    // Mono per ridurre latenza
          sampleSize: 16,                     // 16-bit per compatibilità
          ...(deviceId && { deviceId: { exact: deviceId } }),  // ✅ FIX: Forza dispositivo specifico con "exact"
          
          // ✅ PARAMETRI GOOGLE AGGIUNTIVI per isolamento massimo
          googEchoCancellation: true,         // Cancellazione eco Google
          googNoiseSuppression: true,         // Soppressione rumore Google
          googAutoGainControl: false,         // ✅ DISABILITATO: Controllo guadagno manuale
          googHighpassFilter: true,           // Filtro passa-alto
          googTypingNoiseDetection: true,     // Rilevamento rumore tastiera
          googAudioMirroring: false,          // ✅ CRITICO: Disabilita mirroring audio
          
          // ✅ PARAMETRI AGGIUNTIVI per isolamento massimo
          googDAEchoCancellation: true,       // Cancellazione eco digitale avanzata
          googNoiseReduction: true,           // Riduzione rumore avanzata
          googBeamforming: true,              // Beamforming per direzionalità
          
          // ✅ PARAMETRI SPECIFICI per prevenire cattura audio sistema
          suppressLocalAudioPlayback: true,   // Esclude audio locale (se supportato)
          googEchoCancellation2: true,        // Cancellazione eco v2
          googNoiseSuppression2: true,        // Soppressione rumore v2
          googHighpassFilter2: true,          // Filtro passa-alto v2
          googTypingNoiseDetection2: true,    // Rilevamento rumore tastiera v2
          googAudioMirroring2: false,         // ✅ CRITICO: Disabilita mirroring v2
          
          // ✅ NUOVI PARAMETRI per isolamento audio sistema
          googAudioMirroring3: false,         // Disabilita mirroring v3
          googEchoCancellation3: true,        // Cancellazione eco v3
          googNoiseSuppression3: true,        // Soppressione rumore v3
          googHighpassFilter3: true,          // Filtro passa-alto v3
          googTypingNoiseDetection3: true,    // Rilevamento rumore tastiera v3
          
          // ✅ PARAMETRI EXPERIMENTAL per isolamento massimo
          experimentalEchoCancellation: true, // Cancellazione eco sperimentale
          experimentalNoiseSuppression: true, // Soppressione rumore sperimentale
          experimentalAutoGainControl: false, // ✅ DISABILITATO: Controllo guadagno sperimentale
          experimentalHighpassFilter: true,   // Filtro passa-alto sperimentale
          experimentalTypingNoiseDetection: true, // Rilevamento rumore tastiera sperimentale
          experimentalAudioMirroring: false   // ✅ CRITICO: Disabilita mirroring sperimentale
        }
      };

      console.log('🎤 [MIC] Configurazione anti-eco + esclusione audio live applicata:', constraints);
      console.log('🎤 [MIC] 🔍 DEBUG: Richiesta getUserMedia con deviceId:', deviceId);
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // ✅ FIX: Verifica se il dispositivo selezionato è effettivamente quello richiesto
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack && deviceId) {
          const trackSettings = audioTrack.getSettings();
          if (trackSettings.deviceId !== deviceId) {
            console.warn('⚠️ [MIC] ATTENZIONE: Il browser ha ignorato il deviceId specifico!');
            console.warn('⚠️ [MIC] Richiesto:', deviceId);
            console.warn('⚠️ [MIC] Ottenuto:', trackSettings.deviceId);
            console.warn('⚠️ [MIC] Questo può causare feedback audio se il dispositivo sbagliato cattura audio sistema');
            
            // ✅ FIX: Prova a forzare il dispositivo corretto
            console.log('🎤 [MIC] 🔍 DEBUG: Tentativo di forzare il dispositivo corretto...');
            
            // Ferma lo stream corrente
            stream.getTracks().forEach(track => track.stop());
            
            // Prova con constraints più specifici
            const forcedConstraints = {
              audio: {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false,
                latency: 0,
                sampleRate: micSettings.sampleRate,
                channelCount: 1,
                sampleSize: 16
              }
            };
            
            try {
              stream = await navigator.mediaDevices.getUserMedia(forcedConstraints);
              console.log('🎤 [MIC] ✅ Dispositivo forzato con successo!');
              
              // ✅ FIX: Verifica che il nuovo stream usi il dispositivo corretto
              const newAudioTrack = stream.getAudioTracks()[0];
              if (newAudioTrack) {
                const newTrackSettings = newAudioTrack.getSettings();
                if (newTrackSettings.deviceId === deviceId) {
                  console.log('🎤 [MIC] ✅ PERFETTO: Nuovo stream usa il dispositivo corretto!');
                } else {
                  console.warn('⚠️ [MIC] ATTENZIONE: Anche il tentativo forzato non ha funzionato!');
                  console.warn('  🔑 Richiesto:', deviceId);
                  console.warn('  🔑 Ottenuto:', newTrackSettings.deviceId);
                }
              }
            } catch (forcedError) {
              console.warn('⚠️ [MIC] Impossibile forzare il dispositivo specifico:', forcedError);
              // Usa il fallback
              throw new Error('DeviceId specifico non disponibile');
            }
          }
        }
        
      } catch (error) {
        console.warn('⚠️ [MIC] Errore con dispositivo specifico, provo fallback:', error);
        
        // ✅ FALLBACK: Prova senza deviceId specifico ma con le stesse impostazioni anti-eco
        const fallbackConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            latency: 0,
            sampleRate: micSettings.sampleRate,
            channelCount: 1,
            sampleSize: 16,
            // ✅ PARAMETRI GOOGLE AGGIUNTIVI per isolamento massimo
            googEchoCancellation: true,
            googNoiseSuppression: true,
            googAutoGainControl: false,
            googHighpassFilter: true,
            googTypingNoiseDetection: true,
            googAudioMirroring: false,
            googDAEchoCancellation: true,
            googNoiseReduction: true,
            googBeamforming: true,
            suppressLocalAudioPlayback: true,
            googEchoCancellation2: true,
            googNoiseSuppression2: true,
            googHighpassFilter2: true,
            googTypingNoiseDetection2: true,
            googAudioMirroring2: false,
            googAudioMirroring3: false,
            googEchoCancellation3: true,
            googNoiseSuppression3: true,
            googHighpassFilter3: true,
            googTypingNoiseDetection3: true,
            experimentalEchoCancellation: true,
            experimentalNoiseSuppression: true,
            experimentalAutoGainControl: false,
            experimentalHighpassFilter: true,
            experimentalTypingNoiseDetection: true,
            experimentalAudioMirroring: false
          }
        };
        
        console.log('🎤 [MIC] 🔍 DEBUG: Tentativo fallback senza deviceId specifico');
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        console.log('🎤 [MIC] ✅ Fallback riuscito - usando microfono di default con impostazioni anti-eco');
      }
      
      console.log('🎤 [MIC] 🔍 DEBUG: Stream ottenuto:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map(track => ({
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          settings: track.getSettings()
        }))
      });
      
      // ✅ FIX MICROFONO: Verifica che l'audio live non venga catturato
      console.log('🎤 [MIC] Stream microfono creato con esclusione audio live');
      console.log('🎤 [MIC] Audio tracks:', stream.getAudioTracks().map(track => ({
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        settings: track.getSettings()
      })));
      
      // ✅ FIX MICROFONO: Verifica che le impostazioni anti-eco siano attive
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log('🎤 [MIC] Impostazioni track microfono:', settings);
        
        // Verifica che l'echo cancellation sia attivo
        if (settings.echoCancellation !== true) {
          console.warn('⚠️ [MIC] ATTENZIONE: Echo cancellation non attivo!');
        }
        
        // Verifica che il noise suppression sia attivo
        if (settings.noiseSuppression !== true) {
          console.warn('⚠️ [MIC] ATTENZIONE: Noise suppression non attivo!');
        }
        
        // Verifica che l'auto gain control sia disattivo
        if (settings.autoGainControl !== false) {
          console.warn('⚠️ [MIC] ATTENZIONE: Auto gain control attivo (dovrebbe essere disattivo)!');
        }
        
        // ✅ FIX: Verifica che il dispositivo selezionato sia corretto
        if (settings.deviceId && deviceId && settings.deviceId !== deviceId) {
          console.warn('⚠️ [MIC] ATTENZIONE: DeviceId non corrisponde! Richiesto:', deviceId, 'Ottenuto:', settings.deviceId);
        }
        
        // ✅ FIX: Verifica che il label del dispositivo sia corretto
        const deviceLabel = (settings as any).label;
        if (deviceLabel) {
          const label = deviceLabel.toLowerCase();
          const problematicPatterns = [
            'stereo mix', 'what u hear', 'wave out mix', 'speakers', 
            'headphones', 'output', 'playback', 'monitor', 'loopback',
            'virtual', 'system', 'desktop', 'screen'
          ];
          
          const isProblematic = problematicPatterns.some(pattern => label.includes(pattern));
          if (isProblematic) {
            console.error('❌ [MIC] ERRORE CRITICO: Il microfono selezionato potrebbe catturare audio sistema!', deviceLabel);
            console.error('❌ [MIC] Questo causerà feedback audio. Cambia dispositivo nelle impostazioni.');
          } else {
            console.log('✅ [MIC] Dispositivo microfono verificato come sicuro:', deviceLabel);
          }
        }
      }
      
      // ✅ TRACKING: Aggiungi stream al tracking
      if ((window as any).addAudioStreamToTracking) {
        ;(window as any).addAudioStreamToTracking(stream);
      }
      
      // ✅ DEBUG: Traccia tutti gli stream microfono attivi
      if (!(window as any).__activeMicrophoneStreams) {
        (window as any).__activeMicrophoneStreams = new Set();
      }
      (window as any).__activeMicrophoneStreams.add(stream);
      
      console.log('🎤 [MIC] 🔍 DEBUG: Stream microfono aggiunto al tracking. Totale attivi:', (window as any).__activeMicrophoneStreams.size);
      
      // ✅ DEBUG: Lista tutti gli stream microfono attivi
      (window as any).__activeMicrophoneStreams.forEach((activeStream: MediaStream, index: number) => {
        console.log(`🎤 [MIC] 🔍 DEBUG: Stream attivo #${index}:`, {
          id: activeStream.id,
          active: activeStream.active,
          tracks: activeStream.getTracks().map(track => ({
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted
          }))
        });
      });
      
      // ✅ CLEANUP: Chiudi solo AudioContext temporanei del microfono, NON quello principale
      if (typeof window !== 'undefined' && window.AudioContext) {
        try {
          // Cerca AudioContext attivi globalmente
          const audioContexts = (window as any).__audioContexts || []
          audioContexts.forEach((ctx: AudioContext, index: number) => {
            // ✅ CORREZIONE: Non chiudere l'AudioContext principale (indice 0)
            if (ctx && ctx.state !== 'closed' && index > 0) {
              ctx.close()
              console.log(`🧹 [MICROPHONE] AudioContext temporaneo ${index} chiuso`)
            } else if (index === 0) {
              console.log('🧹 [MICROPHONE] AudioContext principale mantenuto attivo')
            }
          })
        } catch (error) {
          console.warn('⚠️ [MICROPHONE] Errore chiudendo AudioContext temporanei:', error)
        }
      }
      
      // ✅ CORREZIONE: Assicurati che l'AudioContext principale sia disponibile
      let audioCtx = ensureMainAudioContext()
      
      if (!audioCtx) {
        throw new Error('Impossibile creare AudioContext per microfono')
      }
      
      console.log('🎤 [MIC] AudioContext principale disponibile per microfono')
      const source = audioCtx.createMediaStreamSource(stream);
      const destination = audioCtx.createMediaStreamDestination();
      
      // ✅ FILTRO PER RIDURRE LATENZA
      const lowpassFilter = audioCtx.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 8000; // Taglia frequenze alte per ridurre latenza
      lowpassFilter.Q.value = 0.5;          // Q basso per transizione graduale
      
      // ✅ FILTRO PER RIDURRE RUMORE
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 80;     // Taglia frequenze basse (rumore)
      noiseFilter.Q.value = 1.0;
      
      // ✅ GAIN PRINCIPALE MICROFONO
      const microphoneGain = audioCtx.createGain();
      microphoneGain.gain.setValueAtTime(1, audioCtx.currentTime);
      
      // ✅ REVERBERO: Crea nodo reverbero
      const reverbNode = audioCtx.createConvolver();
      const reverbGain = audioCtx.createGain();
      const dryGain = audioCtx.createGain();
      
      // Genera impulso di reverbero
      const reverbLength = audioCtx.sampleRate * 2; // 2 secondi
      const reverbBuffer = audioCtx.createBuffer(2, reverbLength, audioCtx.sampleRate);
      const leftChannel = reverbBuffer.getChannelData(0);
      const rightChannel = reverbBuffer.getChannelData(1);
      
      for (let i = 0; i < reverbLength; i++) {
        const time = i / audioCtx.sampleRate;
        const decay = Math.exp(-time * 2) * (Math.random() * 2 - 1) * 0.3;
        leftChannel[i] = decay;
        rightChannel[i] = decay * 0.8;
      }
      
      reverbNode.buffer = reverbBuffer;
      reverbGain.gain.setValueAtTime(0, audioCtx.currentTime); // Inizia disattivato
      dryGain.gain.setValueAtTime(1, audioCtx.currentTime);
      
      // ✅ CONNESSIONE CON REVERBERO
      source.connect(lowpassFilter);
      lowpassFilter.connect(noiseFilter);
      noiseFilter.connect(microphoneGain);
      
      // Split del segnale: dry e wet
      microphoneGain.connect(dryGain);
      microphoneGain.connect(reverbNode);
      reverbNode.connect(reverbGain);
      
      // Mix dry e wet
      dryGain.connect(destination);
      reverbGain.connect(destination);
      
      // ✅ ESPONI controlli microfono globalmente
      ;(window as any).microphoneGain = microphoneGain;
      ;(window as any).microphoneReverbGain = reverbGain;
      ;(window as any).microphoneDryGain = dryGain;
      
      // ✅ ESPONI anche i nodi principali per gli effetti audio
      ;(window as any).destinationStream = destination;
      
      console.log('🎤 [MIC] Filtri anti-eco e reverbero applicati con successo');
      
      return destination.stream;
      
    } catch (error) {
      console.error('❌ [MIC] Errore creazione stream microfono anti-eco:', error);
      return null;
    }
  };


  // ✅ NUOVO: Sistema di controllo microfono intelligente
  const createSmartMicrophoneControl = () => {
    let isMicrophoneActive = false;
    let microphoneStream: MediaStream | null = null;
    
    const enableMicrophone = async (): Promise<boolean> => {
      try {
        if (isMicrophoneActive && microphoneStream) {
          console.log('🎤 [SMART-MIC] Microfono già attivo');
          return true;
        }
        
        console.log('🎤 [SMART-MIC] Attivazione microfono...');
        
        // Crea stream microfono con configurazione isolata e impostazioni corrette
        console.log('🎤 [SMART-MIC] Creazione stream microfono con impostazioni settings...');
        microphoneStream = await createMicrophoneStream();
        if (!microphoneStream) {
          throw new Error('Impossibile creare stream microfono');
        }
        
        console.log('🎤 [SMART-MIC] Stream microfono creato con successo:', {
          id: microphoneStream.id,
          active: microphoneStream.active,
          tracks: microphoneStream.getTracks().length
        });
        
        // ✅ TRACKING: Aggiungi al tracking globale
        if ((window as any).addAudioStreamToTracking) {
          ;(window as any).addAudioStreamToTracking(microphoneStream);
        }
        
        isMicrophoneActive = true;
        console.log('✅ [SMART-MIC] Microfono attivato con successo');
        return true;
        
      } catch (error) {
        console.error('❌ [SMART-MIC] Errore attivazione microfono:', error);
        return false;
      }
    };
    
    const disableMicrophone = (): void => {
      try {
        console.log('🎤 [SMART-MIC] Disattivazione microfono...');
        
        if (microphoneStream) {
          // ✅ TRACKING: Rimuovi dal tracking globale
          if ((window as any).removeAudioStreamFromTracking) {
            ;(window as any).removeAudioStreamFromTracking(microphoneStream);
          }
          
          microphoneStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
          microphoneStream = null;
        }
        
        isMicrophoneActive = false;
        console.log('✅ [SMART-MIC] Microfono disattivato');
        
      } catch (error) {
        console.error('❌ [SMART-MIC] Errore disattivazione microfono:', error);
      }
    };
    
    const getMicrophoneStream = (): MediaStream | null => {
      return microphoneStream;
    };
    
    const isActive = (): boolean => {
      return isMicrophoneActive;
    };
    
    // Esponi funzioni globalmente
    (window as any).smartMicrophone = {
      enable: enableMicrophone,
      disable: disableMicrophone,
      getStream: getMicrophoneStream,
      isActive: isActive
    };
    
    return {
      enable: enableMicrophone,
      disable: disableMicrophone,
      getStream: getMicrophoneStream,
      isActive: isActive
    };
  };

  // ✅ INIZIALIZZA: Controllo intelligente microfono (dopo la definizione)
  const smartMicrophoneControl = createSmartMicrophoneControl();
  ;(window as any).smartMicrophoneControl = smartMicrophoneControl;

  return (
    <AudioContext.Provider value={{
      // Stato
      state,
      
      // Refs
      leftAudioRef,
      rightAudioRef,
      micStreamRef,
      soundEffectsManagerRef,
      microphoneEffectsManagerRef,
      
      // Funzioni
      getMixedStream,
      createMicrophoneStream,
      createSmartMicrophoneControl,
      getAvailableAudioOutputDevices,
      ensureMainAudioContext,
      playLeftTrack,
      playRightTrack,
      pauseLeftTrack,
      resumeLeftTrack,
      stopLeftTrack,
      pauseRightTrack,
      resumeRightTrack,
      stopRightTrack,
      handlePlayPauseDefinitive,
      setLeftLocalVolume,
      setRightLocalVolume,
      seekLeftTo,
      seekRightTo,
      
      // Funzioni per DJ remoti
      addRemoteDJStream: (id: string, stream: MediaStream) => {
        console.log(`🎵 [AudioContext] Aggiungendo stream DJ remoto: ${id}`)
        dispatch({ type: 'ADD_REMOTE_DJ_STREAM', payload: { id, stream } })
        
        // ✅ CRITICAL FIX: Imposta immediatamente il volume al 100% per qualità massima
        setTimeout(() => {
          dispatch({ type: 'SET_REMOTE_DJ_VOLUME', payload: { id, volume: 1.0 } })
          console.log(`🎵 [AudioContext] Volume DJ remoto ${id} impostato al 100% per qualità massima`)
        }, 100) // Piccolo delay per assicurarsi che lo stream sia stato aggiunto
        
        // L'audio viene gestito direttamente dall'elemento audio nel RemoteDJHost
        // Questo è solo per il tracking dello stato
        console.log(`✅ [AudioContext] Stream DJ remoto ${id} aggiunto al tracking con volume 100%`)
      },
      removeRemoteDJStream: (id: string) => {
        console.log(`🎵 [AudioContext] Rimuovendo stream DJ remoto: ${id}`)
        dispatch({ type: 'REMOVE_REMOTE_DJ_STREAM', payload: id })
      },
      setRemoteDJVolume: (id: string, volume: number) => {
        console.log(`🎵 [AudioContext] Impostando volume DJ remoto ${id}: ${volume}`)
        dispatch({ type: 'SET_REMOTE_DJ_VOLUME', payload: { id, volume } })
      },
      setStreamDucking,
      setStreamMasterVolume,
      setMasterVolume,
      setCrossfader,
      addToDeck,
      incrementPlayCount,
      clearLeftDeck,
      clearRightDeck,
      
      // Dispatch per modifiche di stato
      dispatch
    }}>
      {/* Elementi audio globali */}
      <audio
        ref={leftAudioRef}
        preload="metadata"
        data-deck="A"
        className="deck-audio"
        // ✅ FIX: Usa la scheda audio configurata nelle impostazioni
        onLoadedMetadata={() => {
          if (leftAudioRef.current) {
            dispatch({ type: 'SET_LEFT_DECK_DURATION', payload: leftAudioRef.current.duration })
          }
        }}
        onTimeUpdate={() => {
          if (leftAudioRef.current) {
            const currentTime = leftAudioRef.current.currentTime
            const duration = leftAudioRef.current.duration
            
            // ✅ FIX: Evita di mostrare tempo maggiore della durata
            if (currentTime <= duration && currentTime >= 0) {
              // ✅ OPTIMIZATION: Aggiorna ogni 0.1 secondi per bilanciare fluidità e stabilità
              const roundedTime = Math.floor(currentTime * 10) / 10
              dispatch({ type: 'SET_LEFT_DECK_TIME', payload: roundedTime })
            }
          }
        }}
        onPlay={() => dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: true })}
        onPause={() => dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })}
        onEnded={() => {
          console.log('🔚 [LEFT DECK] onEnded event triggered!')
          dispatch({ type: 'SET_LEFT_DECK_PLAYING', payload: false })
          // ✅ FIX: Resetta il tempo a 0 quando finisce
          dispatch({ type: 'SET_LEFT_DECK_TIME', payload: 0 })
          
          // ✅ AUTO-ADVANCE: Emetti evento per auto-avanzamento
          const trackEndedEvent = new CustomEvent('djconsole:track-ended', {
            detail: { deckId: 'A' }
          })
          window.dispatchEvent(trackEndedEvent)
          console.log('🔚 [LEFT DECK] Track ended - auto-advance event emitted')
        }}
        onVolumeChange={() => {
          if (leftAudioRef.current) {
            dispatch({ type: 'SET_LEFT_DECK_LOCAL_VOLUME', payload: leftAudioRef.current.volume })
          }
        }}
      />
      
      <audio
        ref={rightAudioRef}
        preload="metadata"
        data-deck="B"
        className="deck-audio"
        onLoadedMetadata={() => {
          if (rightAudioRef.current) {
            dispatch({ type: 'SET_RIGHT_DECK_DURATION', payload: rightAudioRef.current.duration })
          }
        }}
        onTimeUpdate={() => {
          if (rightAudioRef.current) {
            const currentTime = rightAudioRef.current.currentTime
            const duration = rightAudioRef.current.duration
            
            // ✅ FIX: Evita di mostrare tempo maggiore della durata
            if (currentTime <= duration && currentTime >= 0) {
              // ✅ OPTIMIZATION: Aggiorna ogni 0.1 secondi per bilanciare fluidità e stabilità
              const roundedTime = Math.floor(currentTime * 10) / 10
              dispatch({ type: 'SET_RIGHT_DECK_TIME', payload: roundedTime })
            }
          }
        }}
        onPlay={() => dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: true })}
        onPause={() => dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })}
        onEnded={() => {
          console.log('🔚 [RIGHT DECK] onEnded event triggered!')
          dispatch({ type: 'SET_RIGHT_DECK_PLAYING', payload: false })
          // ✅ FIX: Resetta il tempo a 0 quando finisce
          dispatch({ type: 'SET_RIGHT_DECK_TIME', payload: 0 })
          
          // ✅ AUTO-ADVANCE: Emetti evento per auto-avanzamento
          const trackEndedEvent = new CustomEvent('djconsole:track-ended', {
            detail: { deckId: 'B' }
          })
          window.dispatchEvent(trackEndedEvent)
          console.log('🔚 [RIGHT DECK] Track ended - auto-advance event emitted')
        }}
        onVolumeChange={() => {
          if (rightAudioRef.current) {
            dispatch({ type: 'SET_RIGHT_DECK_LOCAL_VOLUME', payload: rightAudioRef.current.volume })
          }
        }}
      />
      
      {children}
    </AudioContext.Provider>
  )
}

// ===== HOOKS =====
export function useAudio() {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}



