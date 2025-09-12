export interface AudioTrack {
  id: string
  title: string
  artist: string
  url: string
  file?: File
  duration: number
  waveform?: number[]
}

export interface DeckState {
  track: AudioTrack | null
  isPlaying: boolean
  isActive: boolean
  isMuted: boolean
  localVolume: number
  currentTime: number
  duration: number
  isLoading: boolean
  isQueued: boolean
}

export interface MicrophoneState {
  isEnabled: boolean
  isMuted: boolean
  volume: number
}

export interface AudioState {
  leftDeck: DeckState
  rightDeck: DeckState
  crossfader: number // 0 = tutto LEFT, 1 = tutto RIGHT, 0.5 = 50/50
  masterVolume: number
  fadeEnabled: boolean
  fadeDuration: number
  microphone: MicrophoneState
}

export type AudioAction =
  | { type: 'SET_LEFT_DECK_TRACK'; payload: AudioTrack | null }
  | { type: 'SET_RIGHT_DECK_TRACK'; payload: AudioTrack | null }
  | { type: 'SET_LEFT_DECK_PLAYING'; payload: boolean }
  | { type: 'SET_RIGHT_DECK_PLAYING'; payload: boolean }
  | { type: 'SET_LEFT_DECK_ACTIVE'; payload: boolean }
  | { type: 'SET_RIGHT_DECK_ACTIVE'; payload: boolean }
  | { type: 'SET_LEFT_DECK_MUTED'; payload: boolean }
  | { type: 'SET_RIGHT_DECK_MUTED'; payload: boolean }
  | { type: 'SET_LEFT_DECK_LOCAL_VOLUME'; payload: number }
  | { type: 'SET_RIGHT_DECK_LOCAL_VOLUME'; payload: number }
  | { type: 'SET_LEFT_DECK_TIME'; payload: number }
  | { type: 'SET_RIGHT_DECK_TIME'; payload: number }
  | { type: 'SET_LEFT_DECK_DURATION'; payload: number }
  | { type: 'SET_RIGHT_DECK_DURATION'; payload: number }
  | { type: 'SET_LEFT_DECK_LOADING'; payload: boolean }
  | { type: 'SET_RIGHT_DECK_LOADING'; payload: boolean }
  | { type: 'SET_LEFT_DECK_QUEUED'; payload: boolean }
  | { type: 'SET_RIGHT_DECK_QUEUED'; payload: boolean }
  | { type: 'ADD_TO_LEFT_DECK_QUEUE'; payload: AudioTrack }
  | { type: 'ADD_TO_RIGHT_DECK_QUEUE'; payload: AudioTrack }
  | { type: 'REMOVE_FROM_LEFT_DECK_QUEUE'; payload: number }
  | { type: 'REMOVE_FROM_RIGHT_DECK_QUEUE'; payload: number }
  | { type: 'SET_CROSSFADER'; payload: number }
  | { type: 'SET_MASTER_VOLUME'; payload: number }
  | { type: 'SET_FADE_ENABLED'; payload: boolean }
  | { type: 'SET_FADE_DURATION'; payload: number }
  | { type: 'SET_MICROPHONE'; payload: Partial<MicrophoneState> }
  | { type: 'RESET_AUDIO' }

export interface AudioContextType {
  state: AudioState
  dispatch: React.Dispatch<AudioAction>
  
  // Audio elements refs
  leftAudioRef: React.RefObject<HTMLAudioElement>
  rightAudioRef: React.RefObject<HTMLAudioElement>
  
  // Funzioni di controllo playback
  playLeftTrack: (track: AudioTrack) => Promise<void>
  pauseLeftTrack: () => void
  resumeLeftTrack: () => void
  stopLeftTrack: () => void
  
  playRightTrack: (track: AudioTrack) => Promise<void>
  pauseRightTrack: () => void
  resumeRightTrack: () => void
  stopRightTrack: () => void
  
  // Gestione universale e stabilità
  handlePlayPauseDefinitive: (side: 'left' | 'right') => Promise<void>
  
  // Funzioni seek
  seekLeftTo: (time: number) => void
  seekRightTo: (time: number) => void
  
  // Funzioni volume
  setLeftLocalVolume: (volume: number) => void
  setRightLocalVolume: (volume: number) => void
  setMasterVolume: (volume: number) => void
  
  // Funzioni crossfader
  setCrossfader: (value: number) => void
  
  // Funzioni fade
  setFadeEnabled: (enabled: boolean) => void
  setFadeDuration: (duration: number) => void
  
  // Funzioni microfono
  toggleMicrophone: () => void
  setMicrophoneVolume: (volume: number) => void
  
  // Funzioni streaming
  getMixedStream: () => Promise<MediaStream | null>
}














