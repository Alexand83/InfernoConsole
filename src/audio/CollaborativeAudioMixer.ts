/**
 * 🎤 COLLABORATIVE AUDIO MIXER
 * Mixa microfoni locali e remoti per streaming collaborativo
 */

import { AudioContext, MediaStreamAudioSourceNode, ScriptProcessorNode, GainNode } from 'web-audio-api'

export interface CollaborativeAudioMixerConfig {
  sampleRate: number
  bufferSize: number
  localMicGain: number
  remoteMicGain: number
  masterGain: number
}

export interface CollaborativeAudioMixerState {
  isActive: boolean
  localMicrophone: MediaStream | null
  remoteMicrophones: Map<string, MediaStream>
  outputStream: MediaStream | null
  audioContext: AudioContext | null
  localMicSource: MediaStreamAudioSourceNode | null
  remoteMicSources: Map<string, MediaStreamAudioSourceNode>
  localMicGain: GainNode | null
  remoteMicGains: Map<string, GainNode>
  masterGain: GainNode | null
  processor: ScriptProcessorNode | null
}

export class CollaborativeAudioMixer {
  private config: CollaborativeAudioMixerConfig
  private state: CollaborativeAudioMixerState
  private onAudioData: ((audioData: Float32Array) => void) | null = null

  constructor(config: Partial<CollaborativeAudioMixerConfig> = {}) {
    this.config = {
      sampleRate: 48000,
      bufferSize: 4096,
      localMicGain: 0.8,
      remoteMicGain: 0.8,
      masterGain: 1.0,
      ...config
    }

    this.state = {
      isActive: false,
      localMicrophone: null,
      remoteMicrophones: new Map(),
      outputStream: null,
      audioContext: null,
      localMicSource: null,
      remoteMicSources: new Map(),
      localMicGain: null,
      remoteMicGains: new Map(),
      masterGain: null,
      processor: null
    }
  }

  /**
   * Inizializza il mixer audio
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎤 [COLLABORATIVE MIXER] Inizializzazione...')
      
      // Crea AudioContext
      this.state.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      })

      // Crea nodi di guadagno
      this.state.localMicGain = this.state.audioContext.createGain()
      this.state.masterGain = this.state.audioContext.createGain()
      
      // Configura guadagni
      this.state.localMicGain.gain.value = this.config.localMicGain
      this.state.masterGain.gain.value = this.config.masterGain

      // Crea processor per output
      this.state.processor = this.state.audioContext.createScriptProcessor(
        this.config.bufferSize,
        2, // Input channels (local + remote)
        1  // Output channel (mono mix)
      )

      // Configura processor
      this.state.processor.onaudioprocess = (event) => {
        this.processAudio(event)
      }

      // Connessioni
      this.state.localMicGain.connect(this.state.processor)
      this.state.masterGain.connect(this.state.processor)

      console.log('✅ [COLLABORATIVE MIXER] Inizializzato')
    } catch (error) {
      console.error('❌ [COLLABORATIVE MIXER] Errore inizializzazione:', error)
      throw error
    }
  }

  /**
   * Aggiunge microfono locale
   */
  async addLocalMicrophone(stream: MediaStream): Promise<void> {
    try {
      console.log('🎤 [COLLABORATIVE MIXER] Aggiunta microfono locale...')
      
      if (!this.state.audioContext) {
        throw new Error('AudioContext non inizializzato')
      }

      // Rimuovi microfono precedente se presente
      if (this.state.localMicSource) {
        this.state.localMicSource.disconnect()
      }

      // Crea source per microfono locale
      this.state.localMicSource = this.state.audioContext.createMediaStreamSource(stream)
      this.state.localMicrophone = stream

      // Connessioni
      this.state.localMicSource.connect(this.state.localMicGain!)

      console.log('✅ [COLLABORATIVE MIXER] Microfono locale aggiunto')
    } catch (error) {
      console.error('❌ [COLLABORATIVE MIXER] Errore aggiunta microfono locale:', error)
      throw error
    }
  }

  /**
   * Aggiunge microfono remoto
   */
  async addRemoteMicrophone(djId: string, stream: MediaStream): Promise<void> {
    try {
      console.log(`🎤 [COLLABORATIVE MIXER] Aggiunta microfono remoto: ${djId}`)
      
      if (!this.state.audioContext) {
        throw new Error('AudioContext non inizializzato')
      }

      // Rimuovi microfono precedente se presente
      if (this.state.remoteMicSources.has(djId)) {
        this.state.remoteMicSources.get(djId)?.disconnect()
        this.state.remoteMicGains.delete(djId)
      }

      // Crea source e gain per microfono remoto
      const remoteSource = this.state.audioContext.createMediaStreamSource(stream)
      const remoteGain = this.state.audioContext.createGain()
      
      remoteGain.gain.value = this.config.remoteMicGain

      // Salva riferimenti
      this.state.remoteMicrophones.set(djId, stream)
      this.state.remoteMicSources.set(djId, remoteSource)
      this.state.remoteMicGains.set(djId, remoteGain)

      // Connessioni
      remoteSource.connect(remoteGain)
      remoteGain.connect(this.state.processor!)

      console.log(`✅ [COLLABORATIVE MIXER] Microfono remoto aggiunto: ${djId}`)
    } catch (error) {
      console.error(`❌ [COLLABORATIVE MIXER] Errore aggiunta microfono remoto ${djId}:`, error)
      throw error
    }
  }

  /**
   * Rimuove microfono remoto
   */
  removeRemoteMicrophone(djId: string): void {
    try {
      console.log(`🎤 [COLLABORATIVE MIXER] Rimozione microfono remoto: ${djId}`)
      
      if (this.state.remoteMicSources.has(djId)) {
        this.state.remoteMicSources.get(djId)?.disconnect()
        this.state.remoteMicSources.delete(djId)
      }

      if (this.state.remoteMicGains.has(djId)) {
        this.state.remoteMicGains.delete(djId)
      }

      this.state.remoteMicrophones.delete(djId)

      console.log(`✅ [COLLABORATIVE MIXER] Microfono remoto rimosso: ${djId}`)
    } catch (error) {
      console.error(`❌ [COLLABORATIVE MIXER] Errore rimozione microfono remoto ${djId}:`, error)
    }
  }

  /**
   * Avvia il mixer
   */
  async start(): Promise<MediaStream> {
    try {
      console.log('🎤 [COLLABORATIVE MIXER] Avvio mixer...')
      
      if (!this.state.audioContext || !this.state.processor) {
        throw new Error('Mixer non inizializzato')
      }

      // Crea output stream
      const destination = this.state.audioContext.createMediaStreamDestination()
      this.state.processor.connect(destination)
      this.state.outputStream = destination.stream

      this.state.isActive = true

      console.log('✅ [COLLABORATIVE MIXER] Mixer avviato')
      return this.state.outputStream
    } catch (error) {
      console.error('❌ [COLLABORATIVE MIXER] Errore avvio mixer:', error)
      throw error
    }
  }

  /**
   * Ferma il mixer
   */
  stop(): void {
    try {
      console.log('🎤 [COLLABORATIVE MIXER] Fermata mixer...')
      
      if (this.state.processor) {
        this.state.processor.disconnect()
      }

      if (this.state.localMicSource) {
        this.state.localMicSource.disconnect()
      }

      this.state.remoteMicSources.forEach(source => source.disconnect())
      this.state.remoteMicSources.clear()
      this.state.remoteMicGains.clear()

      this.state.isActive = false
      this.state.outputStream = null

      console.log('✅ [COLLABORATIVE MIXER] Mixer fermato')
    } catch (error) {
      console.error('❌ [COLLABORATIVE MIXER] Errore fermata mixer:', error)
    }
  }

  /**
   * Processa audio e mixa i canali
   */
  private processAudio(event: AudioProcessingEvent): void {
    try {
      const inputBuffer = event.inputBuffer
      const outputBuffer = event.outputBuffer
      
      // Ottieni canali di input
      const localChannel = inputBuffer.getChannelData(0) // Microfono locale
      const remoteChannel = inputBuffer.getChannelData(1) // Microfono remoto
      
      // Crea canale di output
      const outputChannel = outputBuffer.getChannelData(0)
      
      // Mixa i canali
      for (let i = 0; i < outputChannel.length; i++) {
        const localSample = localChannel[i] || 0
        const remoteSample = remoteChannel[i] || 0
        
        // Mix semplice (puoi aggiungere logica più complessa)
        outputChannel[i] = (localSample + remoteSample) * 0.5
      }

      // Callback per dati audio (opzionale)
      if (this.onAudioData) {
        this.onAudioData(outputChannel)
      }
    } catch (error) {
      console.error('❌ [COLLABORATIVE MIXER] Errore processamento audio:', error)
    }
  }

  /**
   * Imposta guadagno microfono locale
   */
  setLocalMicGain(gain: number): void {
    if (this.state.localMicGain) {
      this.state.localMicGain.gain.value = Math.max(0, Math.min(1, gain))
      this.config.localMicGain = gain
    }
  }

  /**
   * Imposta guadagno microfono remoto
   */
  setRemoteMicGain(djId: string, gain: number): void {
    const remoteGain = this.state.remoteMicGains.get(djId)
    if (remoteGain) {
      remoteGain.gain.value = Math.max(0, Math.min(1, gain))
    }
  }

  /**
   * Imposta guadagno master
   */
  setMasterGain(gain: number): void {
    if (this.state.masterGain) {
      this.state.masterGain.gain.value = Math.max(0, Math.min(1, gain))
      this.config.masterGain = gain
    }
  }

  /**
   * Ottieni stato del mixer
   */
  getState(): CollaborativeAudioMixerState {
    return { ...this.state }
  }

  /**
   * Imposta callback per dati audio
   */
  setOnAudioData(callback: (audioData: Float32Array) => void): void {
    this.onAudioData = callback
  }

  /**
   * Pulisce risorse
   */
  dispose(): void {
    try {
      this.stop()
      
      if (this.state.audioContext) {
        this.state.audioContext.close()
        this.state.audioContext = null
      }

      this.state.localMicrophone = null
      this.state.remoteMicrophones.clear()
      this.state.outputStream = null
      this.onAudioData = null

      console.log('✅ [COLLABORATIVE MIXER] Risorse pulite')
    } catch (error) {
      console.error('❌ [COLLABORATIVE MIXER] Errore pulizia risorse:', error)
    }
  }
}

export default CollaborativeAudioMixer
