/**
 * 🎵 COLLABORATIVE AUDIO MIXER
 * Gestisce il mix dell'audio collaborativo con la musica locale
 */

export interface CollaborativeAudioSource {
  id: string
  djName: string
  audioData: Float32Array
  volume: number
  muted: boolean
  lastUpdate: number
}

export interface MixerConfig {
  sampleRate: number
  bufferSize: number
  outputChannels: number
}

export interface MixerState {
  isActive: boolean
  sources: Map<string, CollaborativeAudioSource>
  masterVolume: number
  error: string | null
}

class CollaborativeAudioMixer {
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private state: MixerState
  private config: MixerConfig
  private onMixedAudioCallback: ((audioData: Float32Array) => void) | null = null
  
  // MediaStream per integrazione streaming
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null
  private scriptProcessor: ScriptProcessorNode | null = null

  constructor(config: MixerConfig = {
    sampleRate: 44100,
    bufferSize: 2048,
    outputChannels: 2
  }) {
    this.config = config
    this.state = {
      isActive: false,
      sources: new Map(),
      masterVolume: 1.0,
      error: null
    }
  }

  /**
   * Inizializza l'audio context
   */
  private async initAudioContext(): Promise<void> {
    if (this.audioContext) {
      return
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      })

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Crea gain node per controllo volume master
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = this.state.masterVolume

      // Crea MediaStream destination per integrazione streaming
      this.mediaStreamDestination = this.audioContext.createMediaStreamDestination()
      
      // Crea script processor per mixare l'audio collaborativo
      this.scriptProcessor = this.audioContext.createScriptProcessor(this.config.bufferSize, 0, 2)
      
      // Connessione: gain -> script processor -> media stream destination
      this.gainNode.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.mediaStreamDestination)

      console.log('🎵 [CollaborativeAudioMixer] AudioContext initialized:', this.audioContext.sampleRate)
    } catch (error) {
      console.error('❌ [CollaborativeAudioMixer] Failed to initialize AudioContext:', error)
      throw error
    }
  }

  /**
   * Avvia il mixer
   */
  async start(): Promise<void> {
    try {
      if (this.state.isActive) {
        console.log('⚠️ [CollaborativeAudioMixer] Already active')
        return
      }

      console.log('🎵 [CollaborativeAudioMixer] Starting mixer...')

      await this.initAudioContext()
      this.state.isActive = true
      this.state.error = null

      // Configura il script processor per mixare l'audio
      this.setupScriptProcessor()

      console.log('✅ [CollaborativeAudioMixer] Mixer started successfully')
    } catch (error) {
      console.error('❌ [CollaborativeAudioMixer] Failed to start mixer:', error)
      this.state.error = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }

  /**
   * Ferma il mixer
   */
  stop(): void {
    try {
      console.log('🛑 [CollaborativeAudioMixer] Stopping mixer...')

      this.state.isActive = false

      // Il script processor si ferma automaticamente quando viene disconnesso

      // Disconnetti i nodi
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect()
        this.scriptProcessor = null
      }
      
      if (this.mediaStreamDestination) {
        this.mediaStreamDestination.disconnect()
        this.mediaStreamDestination = null
      }
      
      if (this.gainNode) {
        this.gainNode.disconnect()
        this.gainNode = null
      }

      // Chiudi AudioContext
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close()
        this.audioContext = null
      }

      // Pulisci le sorgenti
      this.state.sources.clear()

      console.log('✅ [CollaborativeAudioMixer] Mixer stopped')
    } catch (error) {
      console.error('❌ [CollaborativeAudioMixer] Error stopping mixer:', error)
    }
  }

  /**
   * Aggiunge una sorgente audio collaborativa
   */
  addSource(sourceId: string, djName: string): void {
    if (this.state.sources.has(sourceId)) {
      console.log('⚠️ [CollaborativeAudioMixer] Source already exists:', sourceId)
      return
    }

    const source: CollaborativeAudioSource = {
      id: sourceId,
      djName: djName,
      audioData: new Float32Array(this.config.bufferSize),
      volume: 1.0,
      muted: false,
      lastUpdate: 0
    }

    this.state.sources.set(sourceId, source)
    console.log('➕ [CollaborativeAudioMixer] Added source:', djName, 'Total sources:', this.state.sources.size)
    console.log('🔍 [CollaborativeAudioMixer] Mixer active:', this.state.isActive)
  }

  /**
   * Rimuove una sorgente audio
   */
  removeSource(sourceId: string): void {
    const source = this.state.sources.get(sourceId)
    if (source) {
      this.state.sources.delete(sourceId)
      console.log('➖ [CollaborativeAudioMixer] Removed source:', source.djName)
    }
  }

  /**
   * Aggiorna i dati audio di una sorgente
   */
        updateAudioData(sourceId: string, audioData: Float32Array): void {
          const source = this.state.sources.get(sourceId)
          if (!source) {
            console.warn('⚠️ [CollaborativeAudioMixer] Source not found:', sourceId)
            return
          }

          // Copia i dati audio
          source.audioData = new Float32Array(audioData)
          source.lastUpdate = Date.now()

          // Debug: verifica se c'è audio significativo con soglia molto più bassa
          const hasAudio = audioData.some(sample => Math.abs(sample) > 0.00001) // Soglia ancora più bassa: 0.00001
          const maxAmplitude = Math.max(...audioData.map(s => Math.abs(s)))
          const avgAmplitude = audioData.reduce((sum, sample) => sum + Math.abs(sample), 0) / audioData.length
          
          if (hasAudio) {
            console.log('🎵 [CollaborativeAudioMixer] ✅ AUDIO RICEVUTO da', source.djName, ':', audioData.slice(0, 5), 'Max:', maxAmplitude.toFixed(6), 'Avg:', avgAmplitude.toFixed(6), 'Mixer active:', this.state.isActive)
          } else {
            console.log('🎵 [CollaborativeAudioMixer] ❌ Nessun audio da', source.djName, 'Max:', maxAmplitude.toFixed(6), 'Avg:', avgAmplitude.toFixed(6), 'Mixer active:', this.state.isActive)
          }
        }

  /**
   * Imposta il volume di una sorgente
   */
  setSourceVolume(sourceId: string, volume: number): void {
    const source = this.state.sources.get(sourceId)
    if (source) {
      source.volume = Math.max(0, Math.min(1, volume))
      console.log('🔊 [CollaborativeAudioMixer] Volume set for', source.djName, ':', source.volume)
    }
  }

  /**
   * Muta/smuta una sorgente
   */
  setSourceMuted(sourceId: string, muted: boolean): void {
    const source = this.state.sources.get(sourceId)
    if (source) {
      source.muted = muted
      console.log('🔇 [CollaborativeAudioMixer]', source.djName, muted ? 'muted' : 'unmuted')
    }
  }

  /**
   * Imposta il volume master
   */
  setMasterVolume(volume: number): void {
    this.state.masterVolume = Math.max(0, Math.min(1, volume))
    
    if (this.gainNode) {
      this.gainNode.gain.value = this.state.masterVolume
    }

    console.log('🔊 [CollaborativeAudioMixer] Master volume set to:', this.state.masterVolume)
  }

  /**
   * Configura il script processor per mixare l'audio collaborativo
   */
  private setupScriptProcessor(): void {
    if (!this.scriptProcessor || !this.audioContext) {
      return
    }

    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.state.isActive) {
        return
      }

      const outputBuffer = event.outputBuffer
      const leftChannel = outputBuffer.getChannelData(0)
      const rightChannel = outputBuffer.getChannelData(1)

      // Pulisci i buffer
      leftChannel.fill(0)
      rightChannel.fill(0)

            // Mixa tutte le sorgenti attive
            let hasAudio = false
            for (const [sourceId, source] of this.state.sources) {
              if (source.muted || source.audioData.length === 0) {
                continue
              }

              // Applica volume della sorgente e mixa con filtri minimi per fluidità
              for (let i = 0; i < Math.min(leftChannel.length, source.audioData.length); i++) {
                let sample = source.audioData[i] * source.volume
                
                // Solo limitazione range per evitare distorsioni (senza filtri complessi)
                sample = Math.max(-0.9, Math.min(0.9, sample))
                
                leftChannel[i] += sample
                rightChannel[i] += sample // Stereo: stesso segnale su entrambi i canali
                if (Math.abs(sample) > 0.00001) { // Soglia più bassa per rilevare audio
                  hasAudio = true
                }
              }
            }

      // Applica volume master
      for (let i = 0; i < leftChannel.length; i++) {
        leftChannel[i] *= this.state.masterVolume
        rightChannel[i] *= this.state.masterVolume
      }
      
            // Debug: log se c'è audio attivo
            if (hasAudio) {
              console.log('🔊 [CollaborativeAudioMixer] ✅ AUDIO MIXATO e inviato al destination')
            } else {
              // Debug: log se non c'è audio per capire il problema
              if (this.state.sources.size > 0) {
                console.log('🔍 [CollaborativeAudioMixer] ❌ Nessun audio attivo, sorgenti:', this.state.sources.size)
                for (const [sourceId, source] of this.state.sources) {
                  const sourceHasAudio = source.audioData.some(sample => Math.abs(sample) > 0.00001)
                  const maxSample = Math.max(...source.audioData.map(s => Math.abs(s)))
                  const avgSample = source.audioData.reduce((sum, s) => sum + Math.abs(s), 0) / source.audioData.length
                  console.log('🔍 [CollaborativeAudioMixer] Sorgente:', source.djName, 'muted:', source.muted, 'hasAudio:', sourceHasAudio, 'max:', maxSample.toFixed(6), 'avg:', avgSample.toFixed(6), 'length:', source.audioData.length)
                }
              }
            }
    }
  }

  /**
   * Ottiene il MediaStream dell'audio collaborativo mixato
   */
  getMediaStream(): MediaStream | null {
    if (!this.mediaStreamDestination || !this.state.isActive) {
      return null
    }

    return this.mediaStreamDestination.stream
  }


  /**
   * Imposta il callback per l'audio mixato
   */
  setMixedAudioCallback(callback: (audioData: Float32Array) => void): void {
    this.onMixedAudioCallback = callback
  }

  /**
   * Ottiene lo stato corrente
   */
  getState(): MixerState {
    return {
      ...this.state,
      sources: new Map(this.state.sources) // Copia per evitare mutazioni esterne
    }
  }

  /**
   * Ottiene le informazioni delle sorgenti
   */
  getSources(): CollaborativeAudioSource[] {
    return Array.from(this.state.sources.values())
  }

  /**
   * Verifica se è attivo
   */
  isActive(): boolean {
    return this.state.isActive
  }

  /**
   * Ottiene l'errore corrente
   */
  getError(): string | null {
    return this.state.error
  }
}

export default CollaborativeAudioMixer