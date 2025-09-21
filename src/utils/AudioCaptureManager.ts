/**
 * 🎤 AUDIO CAPTURE MANAGER
 * Gestisce la cattura e trasmissione audio dal microfono
 */

export interface AudioCaptureConfig {
  sampleRate: number
  bufferSize: number
  channels: number
}

export interface AudioCaptureState {
  isCapturing: boolean
  isMuted: boolean
  volume: number
  error: string | null
}

class AudioCaptureManager {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private gainNode: GainNode | null = null
  private state: AudioCaptureState
  private config: AudioCaptureConfig
  private onAudioDataCallback: ((audioData: Float32Array) => void) | null = null

  constructor(config: AudioCaptureConfig = {
    sampleRate: 44100,
    bufferSize: 4096,
    channels: 1
  }) {
    this.config = config
    this.state = {
      isCapturing: false,
      isMuted: false,
      volume: 1.0,
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

      console.log('🎤 [AudioCapture] AudioContext initialized:', this.audioContext.sampleRate)
    } catch (error) {
      console.error('❌ [AudioCapture] Failed to initialize AudioContext:', error)
      throw error
    }
  }

  /**
   * Avvia la cattura audio
   */
  async startCapture(): Promise<void> {
    try {
      if (this.state.isCapturing) {
        console.log('⚠️ [AudioCapture] Already capturing')
        return
      }

      console.log('🎤 [AudioCapture] Starting audio capture...')

      // Inizializza AudioContext
      await this.initAudioContext()

      // Richiedi accesso al microfono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      if (!this.audioContext) {
        throw new Error('AudioContext not initialized')
      }

      // Crea source node
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Crea gain node per controllo volume
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = this.state.volume

      // Crea processor node per catturare i dati audio
      this.processorNode = this.audioContext.createScriptProcessor(this.config.bufferSize, this.config.channels, this.config.channels)
      
      this.processorNode.onaudioprocess = (event) => {
        if (this.state.isMuted || !this.state.isCapturing) {
          return
        }

        const inputBuffer = event.inputBuffer
        const inputData = inputBuffer.getChannelData(0) // Mono channel
        
        // Applica il volume
        const audioData = new Float32Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = inputData[i] * this.state.volume
        }

        // Callback per inviare i dati
        if (this.onAudioDataCallback) {
          this.onAudioDataCallback(audioData)
        }
      }

      // Connessione: source -> gain -> processor -> destination
      this.sourceNode.connect(this.gainNode)
      this.gainNode.connect(this.processorNode)
      this.processorNode.connect(this.audioContext.destination)

      this.state.isCapturing = true
      this.state.error = null

      console.log('✅ [AudioCapture] Audio capture started successfully')
    } catch (error) {
      console.error('❌ [AudioCapture] Failed to start capture:', error)
      this.state.error = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }

  /**
   * Ferma la cattura audio
   */
  stopCapture(): void {
    try {
      console.log('🛑 [AudioCapture] Stopping audio capture...')

      // Disconnetti i nodi
      if (this.sourceNode) {
        this.sourceNode.disconnect()
        this.sourceNode = null
      }

      if (this.gainNode) {
        this.gainNode.disconnect()
        this.gainNode = null
      }

      if (this.processorNode) {
        this.processorNode.disconnect()
        this.processorNode = null
      }

      // Ferma il media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop())
        this.mediaStream = null
      }

      // Chiudi AudioContext
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close()
        this.audioContext = null
      }

      this.state.isCapturing = false
      this.state.error = null

      console.log('✅ [AudioCapture] Audio capture stopped')
    } catch (error) {
      console.error('❌ [AudioCapture] Error stopping capture:', error)
    }
  }

  /**
   * Imposta il callback per i dati audio
   */
  setAudioDataCallback(callback: (audioData: Float32Array) => void): void {
    this.onAudioDataCallback = callback
  }

  /**
   * Imposta il volume
   */
  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume))
    
    if (this.gainNode) {
      this.gainNode.gain.value = this.state.volume
    }

    console.log('🔊 [AudioCapture] Volume set to:', this.state.volume)
  }

  /**
   * Muta/smuta il microfono
   */
  setMuted(muted: boolean): void {
    this.state.isMuted = muted
    console.log('🔇 [AudioCapture] Microphone', muted ? 'muted' : 'unmuted')
  }

  /**
   * Ottiene lo stato corrente
   */
  getState(): AudioCaptureState {
    return { ...this.state }
  }

  /**
   * Verifica se sta catturando
   */
  isCapturing(): boolean {
    return this.state.isCapturing
  }

  /**
   * Verifica se è mutato
   */
  isMuted(): boolean {
    return this.state.isMuted
  }

  /**
   * Ottiene il volume corrente
   */
  getVolume(): number {
    return this.state.volume
  }

  /**
   * Ottiene l'errore corrente
   */
  getError(): string | null {
    return this.state.error
  }
}

export default AudioCaptureManager

