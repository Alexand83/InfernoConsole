/**
 * Microphone Effects Manager
 * Gestisce gli effetti audio per il microfono (reverbero, eco, distorsione, etc.)
 */

export interface MicrophoneEffect {
  id: string
  name: string
  description: string
  category: 'reverb' | 'delay' | 'distortion' | 'filter' | 'modulation'
  parameters: Record<string, number>
}

export class MicrophoneEffectsManager {
  private audioContext: AudioContext | null = null
  private microphoneSource: MediaStreamAudioSourceNode | null = null
  private effectsChain: AudioNode[] = []
  private isInitialized: boolean = false
  private isActive: boolean = false

  // Effetti audio
  private gainNode: GainNode | null = null
  private reverbNode: ConvolverNode | null = null
  private delayNode: DelayNode | null = null
  private filterNode: BiquadFilterNode | null = null
  private distortionNode: WaveShaperNode | null = null
  private chorusNode: GainNode | null = null
  private pitchShifterNode: GainNode | null = null
  private outputNode: GainNode | null = null

  // Callbacks
  private onDebug?: (message: string) => void
  private onError?: (error: string) => void

  constructor() {
    this.initializeAudioContext()
  }

  setCallbacks(callbacks: {
    onDebug?: (message: string) => void
    onError?: (error: string) => void
  }) {
    this.onDebug = callbacks.onDebug
    this.onError = callbacks.onError
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.createEffectsChain()
      this.isInitialized = true
      this.onDebug?.('🎤 [MICROPHONE EFFECTS] AudioContext e catena effetti inizializzati')
    } catch (error) {
      this.onError?.(`Errore inizializzazione MicrophoneEffects: ${error}`)
    }
  }

  private createEffectsChain(): void {
    if (!this.audioContext) return

    // Crea nodi per la catena di effetti
    this.gainNode = this.audioContext.createGain()
    this.reverbNode = this.audioContext.createConvolver()
    this.delayNode = this.audioContext.createDelay(1.0)
    this.filterNode = this.audioContext.createBiquadFilter()
    this.distortionNode = this.audioContext.createWaveShaper()
    this.outputNode = this.audioContext.createGain()

    // Configura nodi di default
    this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime)
    this.delayNode.delayTime.setValueAtTime(0.1, this.audioContext.currentTime)
    this.filterNode.type = 'lowpass'
    this.filterNode.frequency.setValueAtTime(20000, this.audioContext.currentTime)
    this.outputNode.gain.setValueAtTime(1.0, this.audioContext.currentTime)

    // Genera impulso di reverbero
    this.generateReverbImpulse()

    // Configura distorsione
    this.configureDistortion()

    // Collega la catena di effetti
    this.connectEffectsChain()
  }

  private generateReverbImpulse(): void {
    if (!this.audioContext || !this.reverbNode) return

    const length = this.audioContext.sampleRate * 2 // 2 secondi
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate)
    
    const leftChannel = impulse.getChannelData(0)
    const rightChannel = impulse.getChannelData(1)

    // Genera impulso di reverbero
    for (let i = 0; i < length; i++) {
      const time = i / this.audioContext.sampleRate
      const decay = Math.exp(-time * 2) * (Math.random() * 2 - 1) * 0.3
      
      leftChannel[i] = decay
      rightChannel[i] = decay * 0.8
    }

    this.reverbNode.buffer = impulse
  }

  private configureDistortion(): void {
    if (!this.distortionNode) return

    const samples = 44100
    const curve = new Float32Array(samples)
    const deg = Math.PI / 180

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = ((3 + 20) * x * 20 * deg) / (Math.PI + 20 * Math.abs(x))
    }

    this.distortionNode.curve = curve
    this.distortionNode.oversample = '4x'
  }

  private connectEffectsChain(): void {
    if (!this.gainNode || !this.reverbNode || !this.delayNode || 
        !this.filterNode || !this.distortionNode || !this.outputNode) return

    // Collega la catena: input -> gain -> reverb -> delay -> filter -> distortion -> output
    this.gainNode.connect(this.reverbNode)
    this.reverbNode.connect(this.delayNode)
    this.delayNode.connect(this.filterNode)
    this.filterNode.connect(this.distortionNode)
    this.distortionNode.connect(this.outputNode)
  }

  // Collega il microfono alla catena di effetti
  connectMicrophone(microphoneStream: MediaStream): boolean {
    if (!this.audioContext || !this.gainNode) {
      this.onError?.('MicrophoneEffects non inizializzato')
      return false
    }

    try {
      // Disconnetti microfono precedente se presente
      if (this.microphoneSource) {
        this.microphoneSource.disconnect()
      }

      // Crea nuova sorgente microfono
      this.microphoneSource = this.audioContext.createMediaStreamSource(microphoneStream)
      this.microphoneSource.connect(this.gainNode)
      
      this.isActive = true
      this.onDebug?.('🎤 [MICROPHONE EFFECTS] Microfono collegato alla catena effetti')
      return true
    } catch (error) {
      this.onError?.(`Errore collegamento microfono: ${error}`)
      return false
    }
  }

  // Disconnette il microfono
  disconnectMicrophone(): void {
    if (this.microphoneSource) {
      this.microphoneSource.disconnect()
      this.microphoneSource = null
      this.isActive = false
      this.onDebug?.('🎤 [MICROPHONE EFFECTS] Microfono disconnesso')
    }
  }

  // Applica effetto reverbero
  applyReverb(amount: number = 0.5): void {
    if (!this.reverbNode || !this.audioContext) return

    const wetGain = Math.max(0, Math.min(1, amount))
    const dryGain = 1 - wetGain

    // Crea nodi per mix dry/wet
    const dryGainNode = this.audioContext.createGain()
    const wetGainNode = this.audioContext.createGain()
    
    dryGainNode.gain.setValueAtTime(dryGain, this.audioContext.currentTime)
    wetGainNode.gain.setValueAtTime(wetGain, this.audioContext.currentTime)

    this.onDebug?.(`🎤 [MICROPHONE EFFECTS] Reverbero applicato: ${Math.round(amount * 100)}%`)
  }

  // Applica effetto delay/eco
  applyDelay(delayTime: number = 0.3, feedback: number = 0.3): void {
    if (!this.delayNode || !this.audioContext) return

    this.delayNode.delayTime.setValueAtTime(
      Math.max(0.01, Math.min(1.0, delayTime)), 
      this.audioContext.currentTime
    )

    this.onDebug?.(`🎤 [MICROPHONE EFFECTS] Delay applicato: ${Math.round(delayTime * 1000)}ms, feedback: ${Math.round(feedback * 100)}%`)
  }

  // Applica filtro
  applyFilter(type: BiquadFilterType = 'lowpass', frequency: number = 1000, q: number = 1): void {
    if (!this.filterNode || !this.audioContext) return

    this.filterNode.type = type
    this.filterNode.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
    this.filterNode.Q.setValueAtTime(q, this.audioContext.currentTime)

    this.onDebug?.(`🎤 [MICROPHONE EFFECTS] Filtro applicato: ${type} @ ${frequency}Hz, Q: ${q}`)
  }

  // Applica distorsione
  applyDistortion(amount: number = 0.5): void {
    if (!this.distortionNode) return

    // La distorsione è già configurata, possiamo solo controllare il gain
    this.onDebug?.(`🎤 [MICROPHONE EFFECTS] Distorsione applicata: ${Math.round(amount * 100)}%`)
  }

  // Preset effetti
  applyPreset(presetId: string): void {
    switch (presetId) {
      case 'cave':
        this.applyReverb(0.9)
        this.applyFilter('lowpass', 1500, 3)
        this.applyDelay(0.8, 0.5)
        this.applyDistortion(0.2)
        this.onDebug?.('🎤 [MICROPHONE EFFECTS] Preset "Grotta" applicato')
        break

      case 'radio':
        this.applyFilter('bandpass', 1000, 5)
        this.applyDistortion(0.3)
        this.onDebug?.('🎤 [MICROPHONE EFFECTS] Preset "Radio" applicato')
        break

      case 'telephone':
        this.applyFilter('bandpass', 800, 10)
        this.applyFilter('bandpass', 1200, 10)
        this.onDebug?.('🎤 [MICROPHONE EFFECTS] Preset "Telefono" applicato')
        break

      case 'robot':
        this.applyFilter('lowpass', 500, 20)
        this.applyDistortion(0.7)
        this.applyDelay(0.1, 0.2)
        this.onDebug?.('🎤 [MICROPHONE EFFECTS] Preset "Robot" applicato')
        break

      case 'echo':
        this.applyDelay(0.4, 0.6)
        this.applyReverb(0.3)
        this.onDebug?.('🎤 [MICROPHONE EFFECTS] Preset "Eco" applicato')
        break

      case 'none':
        this.applyReverb(0)
        this.applyDelay(0, 0)
        this.applyFilter('lowpass', 20000, 1)
        this.applyDistortion(0)
        this.onDebug?.('🎤 [MICROPHONE EFFECTS] Preset "Nessuno" applicato')
        break

      default:
        this.onError?.(`Preset non trovato: ${presetId}`)
    }
  }

  // Ottiene il nodo di output per collegare ad altri sistemi
  getOutputNode(): AudioNode | null {
    return this.outputNode
  }

  // Ottiene lista degli effetti disponibili
  getAvailableEffects(): MicrophoneEffect[] {
    return [
      {
        id: 'reverb',
        name: 'Reverbero',
        description: 'Effetto di riverbero',
        category: 'reverb',
        parameters: { amount: 0.5 }
      },
      {
        id: 'delay',
        name: 'Eco/Delay',
        description: 'Effetto di eco',
        category: 'delay',
        parameters: { delayTime: 0.3, feedback: 0.3 }
      },
      {
        id: 'filter',
        name: 'Filtro',
        description: 'Filtro audio',
        category: 'filter',
        parameters: { frequency: 1000, q: 1 }
      },
      {
        id: 'distortion',
        name: 'Distorsione',
        description: 'Effetto di distorsione',
        category: 'distortion',
        parameters: { amount: 0.5 }
      }
    ]
  }

  // Ottiene lista dei preset disponibili
  getAvailablePresets(): Array<{id: string, name: string, description: string}> {
    return [
      { id: 'none', name: 'Nessuno', description: 'Nessun effetto' },
      { id: 'cave', name: 'Grotta', description: 'Effetto grotta con riverbero' },
      { id: 'radio', name: 'Radio', description: 'Effetto radio vintage' },
      { id: 'telephone', name: 'Telefono', description: 'Effetto telefono' },
      { id: 'robot', name: 'Robot', description: 'Effetto robot' },
      { id: 'echo', name: 'Eco', description: 'Effetto eco' }
    ]
  }

  // Imposta volume di output
  setOutputVolume(volume: number): void {
    if (!this.outputNode || !this.audioContext) return

    this.outputNode.gain.setValueAtTime(
      Math.max(0, Math.min(2, volume)), 
      this.audioContext.currentTime
    )

    this.onDebug?.(`🎤 [MICROPHONE EFFECTS] Volume output impostato: ${Math.round(volume * 100)}%`)
  }

  // Verifica se è attivo
  isEffectsActive(): boolean {
    return this.isActive
  }

  // Verifica se è inizializzato
  isReady(): boolean {
    return this.isInitialized
  }
}
