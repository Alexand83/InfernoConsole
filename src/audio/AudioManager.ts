// AudioManager semplificato - senza AudioRouter complesso

interface Track {
  id: string
  title: string
  artist: string
  duration: number
  url: string
}

interface DeckState {
  id: 'A' | 'B'
  track: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isActive: boolean
  isMuted: boolean
  volumeBeforeMute: number
}

interface AudioManagerState {
  deckA: DeckState
  deckB: DeckState
  crossfader: number
  masterVolume: number
  micEnabled: boolean
  micVolume: number
  cueEnabled: boolean
}

type AudioEventType = 
  | 'stateChanged'
  | 'trackLoaded'
  | 'trackEnded'
  | 'playbackStarted'
  | 'playbackPaused'
  | 'volumeChanged'
  | 'crossfaderChanged'
  | 'muteChanged'
  | 'micVolumeChanged'

interface AudioEvent {
  type: AudioEventType
  deckId?: 'A' | 'B'
  data?: any
}

type AudioEventListener = (event: AudioEvent) => void

export class AudioManager {
  private static instance: AudioManager | null = null
  private state: AudioManagerState
  private listeners: Map<AudioEventType, AudioEventListener[]> = new Map()
  private persistenceKey = 'djconsole_audio_state'
  private persistenceTimeout: NodeJS.Timeout | null = null
  
  // Audio elements globali
  private deckAAudio: HTMLAudioElement | null = null
  private deckBAudio: HTMLAudioElement | null = null
  private timeUpdateInterval: NodeJS.Timeout | null = null
  
  // Stream del microfono
  private microphoneStream: MediaStream | null = null
  
  // Web Audio per streaming
  private audioContext: AudioContext | null = null
  private streamDestination: MediaStreamAudioDestinationNode | null = null
  private isStreaming = false
  
  private constructor() {
    this.state = this.getInitialState()
    this.initializeGlobalAudio()
    this.setupAudioEventListeners()
    this.loadPersistedState()
    
    // Salva lo stato ogni volta che cambia
    this.addEventListener('stateChanged', () => {
      this.persistState()
    })
    
    // Gestisce la persistenza quando la pagina viene chiusa
    window.addEventListener('beforeunload', () => {
      this.persistState()
    })
    
    // Ripristina lo stato quando si torna alla pagina
    window.addEventListener('focus', () => {
      this.loadPersistedState()
    })
    
    console.log('🎵 AudioManager initialized with simple audio system')
  }
  
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager()
    }
    return AudioManager.instance
  }
  
  private getInitialState(): AudioManagerState {
    return {
      deckA: {
        id: 'A',
        track: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        isActive: false,
        isMuted: false,
        volumeBeforeMute: 0.8
      },
      deckB: {
        id: 'B',
        track: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        isActive: false,
        isMuted: false,
        volumeBeforeMute: 0.8
      },
      crossfader: 0.5,
      masterVolume: 0.8,
      micEnabled: false,
      micVolume: 0.7,
      cueEnabled: false
    }
  }
  
  private initializeGlobalAudio(): void {
    // Crea elementi audio globali
    this.deckAAudio = document.createElement('audio')
    this.deckAAudio.setAttribute('data-deck', 'A')
    this.deckAAudio.volume = this.state.deckA.volume
    this.deckAAudio.preload = 'metadata'
    
    this.deckBAudio = document.createElement('audio')
    this.deckBAudio.setAttribute('data-deck', 'B')
    this.deckBAudio.volume = this.state.deckB.volume
    this.deckBAudio.preload = 'metadata'
    
    // Aggiungi al DOM
    document.body.appendChild(this.deckAAudio)
    document.body.appendChild(this.deckBAudio)
    
    // Avvia timer per aggiornamenti
    this.startTimeUpdateTimer()
    
    console.log('🎵 Global audio elements created and attached to DOM')
  }
  
  private setupAudioEventListeners(): void {
    if (this.deckAAudio) {
      this.deckAAudio.addEventListener('play', () => {
        this.state.deckA.isPlaying = true
        this.emitEvent('playbackStarted', { deckId: 'A' })
        this.emitEvent('stateChanged')
      })
      
      this.deckAAudio.addEventListener('pause', () => {
        this.state.deckA.isPlaying = false
        this.emitEvent('playbackPaused', { deckId: 'A' })
        this.emitEvent('stateChanged')
      })
      
      this.deckAAudio.addEventListener('ended', () => {
        this.state.deckA.isPlaying = false
        this.state.deckA.currentTime = 0
        this.emitEvent('trackEnded', { deckId: 'A' })
        this.emitEvent('stateChanged')
      })
    }
    
    if (this.deckBAudio) {
      this.deckBAudio.addEventListener('play', () => {
        this.state.deckB.isPlaying = true
        this.emitEvent('playbackStarted', { deckId: 'B' })
        this.emitEvent('stateChanged')
      })
      
      this.deckBAudio.addEventListener('pause', () => {
        this.state.deckB.isPlaying = false
        this.emitEvent('playbackPaused', { deckId: 'B' })
        this.emitEvent('stateChanged')
      })
      
      this.deckBAudio.addEventListener('ended', () => {
        this.state.deckB.isPlaying = false
        this.state.deckB.currentTime = 0
        this.emitEvent('trackEnded', { deckId: 'B' })
        this.emitEvent('stateChanged')
      })
    }
  }
  
  private startTimeUpdateTimer(): void {
    this.timeUpdateInterval = setInterval(() => {
      if (this.deckAAudio && this.state.deckA.isPlaying) {
        this.state.deckA.currentTime = this.deckAAudio.currentTime
      }
      if (this.deckBAudio && this.state.deckB.isPlaying) {
        this.state.deckB.currentTime = this.deckBAudio.currentTime
      }
      
      // Emetti evento di aggiornamento
      this.emitEvent('stateChanged')
    }, 100)
  }
  
  // === METODI PUBBLICI ===
  
  public loadTrack(deckId: 'A' | 'B', track: Track): void {
    const deck = deckId === 'A' ? this.state.deckA : this.state.deckB
    const audioElement = deckId === 'A' ? this.deckAAudio : this.deckBAudio
    
    if (!audioElement) {
      console.error(`❌ Audio element not found for deck ${deckId}`)
      return
    }
    
    // Carica la traccia
    audioElement.src = track.url
      audioElement.load()
    
    // Aggiorna stato
    deck.track = track
    deck.duration = track.duration
    deck.currentTime = 0
    deck.isPlaying = false
    
    // Notifica
    this.emitEvent('trackLoaded', { deckId, data: track })
    this.emitEvent('stateChanged')
    
    console.log(`🎵 Track loaded on deck ${deckId}: ${track.title}`)
  }
  
  public play(deckId: 'A' | 'B'): boolean {
    const audioElement = deckId === 'A' ? this.deckAAudio : this.deckBAudio
    
    if (!audioElement || !audioElement.src) {
      console.warn(`❌ No track loaded on deck ${deckId}`)
      return false
    }
    
    try {
      audioElement.play()
    return true
    } catch (error) {
      console.error(`❌ Error playing deck ${deckId}:`, error)
      return false
    }
  }
  
  public pause(deckId: 'A' | 'B'): void {
    const audioElement = deckId === 'A' ? this.deckAAudio : this.deckBAudio
    
    if (audioElement) {
      audioElement.pause()
    }
  }
  
  public setDeckVolume(deckId: 'A' | 'B', volume: number): void {
    const deck = deckId === 'A' ? this.state.deckA : this.state.deckB
    const audioElement = deckId === 'A' ? this.deckAAudio : this.deckBAudio
    
    const clampedVolume = Math.max(0, Math.min(1, volume))
    deck.volume = clampedVolume
    
    if (audioElement) {
      audioElement.volume = clampedVolume
    }
    
    this.emitEvent('volumeChanged', { deckId, data: { volume: clampedVolume } })
    this.emitEvent('stateChanged')
  }
  
  public setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    this.state.masterVolume = clampedVolume
    
    // Applica il volume master agli elementi audio
    if (this.deckAAudio) {
      this.deckAAudio.volume = this.state.deckA.volume * clampedVolume
    }
    if (this.deckBAudio) {
      this.deckBAudio.volume = this.state.deckB.volume * clampedVolume
    }
    
    this.emitEvent('volumeChanged', { data: { masterVolume: clampedVolume } })
    this.emitEvent('stateChanged')
  }
  
  public setCrossfader(value: number): void {
    const clampedValue = Math.max(0, Math.min(1, value))
    this.state.crossfader = clampedValue
    
    // Applica crossfader agli elementi audio
    if (this.deckAAudio) {
      this.deckAAudio.volume = this.state.deckA.volume * (1 - clampedValue) * this.state.masterVolume
    }
    if (this.deckBAudio) {
      this.deckBAudio.volume = this.state.deckB.volume * clampedValue * this.state.masterVolume
    }
    
    this.emitEvent('crossfaderChanged', { data: { crossfader: clampedValue } })
    this.emitEvent('stateChanged')
  }
  
  public toggleDeckMute(deckId: 'A' | 'B'): void {
    const deck = deckId === 'A' ? this.state.deckA : this.state.deckB
    const audioElement = deckId === 'A' ? this.deckAAudio : this.deckBAudio
    
    if (deck.isMuted) {
      // Unmute
      deck.isMuted = false
      deck.volume = deck.volumeBeforeMute
      if (audioElement) {
        audioElement.volume = deck.volume * this.state.masterVolume
        audioElement.muted = false
      }
    } else {
      // Mute
      deck.isMuted = true
      deck.volumeBeforeMute = deck.volume
      deck.volume = 0
      if (audioElement) {
        audioElement.volume = 0
        audioElement.muted = true
      }
    }
    
    this.emitEvent('muteChanged', { deckId, data: { muted: deck.isMuted } })
    this.emitEvent('stateChanged')
  }
  
  public setMicrophoneEnabled(enabled: boolean): void {
    this.state.micEnabled = enabled
    
    if (enabled) {
      this.enableMicrophone()
      } else {
      this.disableMicrophone()
    }
    
    this.emitEvent('stateChanged')
  }
  
  public setMicrophoneVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    this.state.micVolume = clampedVolume
    
    this.emitEvent('micVolumeChanged', { data: { micVolume: clampedVolume } })
    this.emitEvent('stateChanged')
  }
  
  private async enableMicrophone(): Promise<void> {
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('🎤 Microphone enabled')
    } catch (error) {
      console.error('❌ Error enabling microphone:', error)
    }
  }
  
  private disableMicrophone(): void {
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop())
      this.microphoneStream = null
      console.log('🎤 Microphone disabled')
    }
  }
  
  // === STREAMING ===
  
  public startStreaming(): MediaStream | null {
    if (this.isStreaming) {
      console.warn('📡 Streaming already active')
      return this.streamDestination?.stream || null
    }
    
    try {
      // Crea AudioContext se non esiste
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      // Crea destination per streaming
      this.streamDestination = this.audioContext.createMediaStreamDestination()
      
      // Connessioni per streaming
      if (this.deckAAudio) {
        const sourceA = this.audioContext.createMediaElementSource(this.deckAAudio)
        sourceA.connect(this.streamDestination)
      }
      
      if (this.deckBAudio) {
        const sourceB = this.audioContext.createMediaElementSource(this.deckBAudio)
        sourceB.connect(this.streamDestination)
      }
      
      // Microfono se abilitato
      if (this.microphoneStream && this.state.micEnabled) {
        const micSource = this.audioContext.createMediaStreamSource(this.microphoneStream)
        micSource.connect(this.streamDestination)
      }
      
      this.isStreaming = true
      console.log('📡 Streaming started')
      
      return this.streamDestination.stream
    } catch (error) {
      console.error('❌ Error starting streaming:', error)
    return null
  }
  }
  
  public stopStreaming(): void {
    if (this.streamDestination) {
      this.streamDestination = null
    }
    this.isStreaming = false
    console.log('📡 Streaming stopped')
  }
  
  public isStreamingActive(): boolean {
    return this.isStreaming
  }
  
  public getStreamDestination(): MediaStream | null {
    return this.streamDestination?.stream || null
  }
  
  // === EVENTI ===
  
  public addEventListener(type: AudioEventType, listener: AudioEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)!.push(listener)
  }
  
  public removeEventListener(type: AudioEventType, listener: AudioEventListener): void {
    const listeners = this.listeners.get(type)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }
  
  private emitEvent(type: AudioEventType, data?: any): void {
    const event: AudioEvent = { type, ...data }
    const listeners = this.listeners.get(type) || []
    listeners.forEach(listener => listener(event))
  }
  
  // === PERSISTENZA ===
  
  private persistState(): void {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout)
    }
    
    this.persistenceTimeout = setTimeout(() => {
      try {
        localStorage.setItem(this.persistenceKey, JSON.stringify(this.state))
        console.log('💾 Audio state persisted')
      } catch (error) {
        console.error('❌ Error persisting audio state:', error)
      }
    }, 1000)
  }
  
  private loadPersistedState(): void {
    try {
      const saved = localStorage.getItem(this.persistenceKey)
      if (saved) {
        const parsedState = JSON.parse(saved)
        this.state = { ...this.state, ...parsedState }
        
        // Applica lo stato agli elementi audio
        if (this.deckAAudio) {
          this.deckAAudio.volume = this.state.deckA.volume * this.state.masterVolume
        }
        if (this.deckBAudio) {
          this.deckBAudio.volume = this.state.deckB.volume * this.state.masterVolume
        }
        
        console.log('🔄 Audio state restored from persistence')
      }
    } catch (error) {
      console.error('❌ Error loading persisted state:', error)
    }
  }
  
  // === UTILITY ===
  
  public getState(): AudioManagerState {
    return { ...this.state }
  }
  
  public getDeckState(deckId: 'A' | 'B'): DeckState {
    return deckId === 'A' ? { ...this.state.deckA } : { ...this.state.deckB }
  }
  
  public destroy(): void {
    console.log('💀 Destroying audio manager')
    
    // Ferma timer
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval)
    }
    
    // Ferma streaming
    this.stopStreaming()
    
    // Disabilita microfono
    this.disableMicrophone()
    
    // Rimuovi elementi audio
    if (this.deckAAudio) {
      this.deckAAudio.remove()
    }
    if (this.deckBAudio) {
      this.deckBAudio.remove()
    }
    
    // Chiudi AudioContext
    if (this.audioContext) {
      this.audioContext.close()
    }
    
    // Pulisci listeners
    this.listeners.clear()
    
    // Pulisci istanza
    AudioManager.instance = null
  }
}

export default AudioManager