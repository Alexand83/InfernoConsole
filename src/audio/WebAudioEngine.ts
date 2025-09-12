export class WebAudioEngine {
  private audioContext: AudioContext
  private masterGain: GainNode
  private microphoneGain: GainNode
  private musicGain: GainNode
  private crossfader: GainNode
  private compressor: DynamicsCompressorNode
  private equalizer: BiquadFilterNode[]
  private reverb: ConvolverNode
  private delay: DelayNode
  private distortion: WaveShaperNode
  
  private microphoneStream: MediaStream | null = null
  private microphoneSource: MediaStreamAudioSourceNode | null = null
  
  private musicBuffer: AudioBuffer | null = null
  private musicSource: AudioBufferSourceNode | null = null
  
  private isStreaming = false
  private streamDestination: MediaStreamAudioDestinationNode | null = null
  
  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.setupAudioNodes()
  }

  private setupAudioNodes() {
    // Master gain control
    this.masterGain = this.audioContext.createGain()
    this.masterGain.gain.value = 0.8

    // Individual gain controls
    this.microphoneGain = this.audioContext.createGain()
    this.microphoneGain.gain.value = 0.5

    this.musicGain = this.audioContext.createGain()
    this.musicGain.gain.value = 0.8

    // Crossfader
    this.crossfader = this.audioContext.createGain()
    this.crossfader.gain.value = 0.5

    // Audio effects
    this.setupEffects()

    // Connect the audio chain
    this.connectAudioChain()
  }

  private setupEffects() {
    // Compressor for dynamic range control
    this.compressor = this.audioContext.createDynamicsCompressor()
    this.compressor.threshold.value = -24
    this.compressor.knee.value = 30
    this.compressor.ratio.value = 12
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.25

    // 3-band equalizer
    this.equalizer = [
      this.audioContext.createBiquadFilter(), // Low
      this.audioContext.createBiquadFilter(), // Mid
      this.audioContext.createBiquadFilter()  // High
    ]

    this.equalizer[0].type = 'lowshelf'
    this.equalizer[0].frequency.value = 200
    this.equalizer[0].gain.value = 0

    this.equalizer[1].type = 'peaking'
    this.equalizer[1].frequency.value = 1000
    this.equalizer[1].Q.value = 1
    this.equalizer[1].gain.value = 0

    this.equalizer[2].type = 'highshelf'
    this.equalizer[2].frequency.value = 3000
    this.equalizer[2].gain.value = 0

    // Reverb
    this.reverb = this.audioContext.createConvolver()
    this.createReverbImpulse()

    // Delay
    this.delay = this.audioContext.createDelay(5.0)
    this.delay.delayTime.value = 0.3

    // Distortion
    this.distortion = this.audioContext.createWaveShaper()
    this.distortion.curve = this.makeDistortionCurve(50)
    this.distortion.oversample = '4x'
  }

  private createReverbImpulse() {
    const sampleRate = this.audioContext.sampleRate
    const length = sampleRate * 2 // 2 seconds
    const impulse = this.audioContext.createBuffer(2, length, sampleRate)
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.1))
      }
    }
    
    this.reverb.buffer = impulse
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50
    const n_samples = 48000  // ✅ FIX: Opus supporta 48000Hz
    const curve = new Float32Array(n_samples)
    const deg = Math.PI / 180

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
    }
    return curve
  }

  private connectAudioChain() {
    // Microphone chain
    if (this.microphoneSource) {
      this.microphoneSource
        .connect(this.microphoneGain)
        .connect(this.equalizer[0])
        .connect(this.equalizer[1])
        .connect(this.equalizer[2])
        .connect(this.reverb)
        .connect(this.delay)
        .connect(this.distortion)
        .connect(this.crossfader)
    }

    // Music chain
    if (this.musicSource) {
      this.musicSource
        .connect(this.musicGain)
        .connect(this.equalizer[0])
        .connect(this.equalizer[1])
        .connect(this.equalizer[2])
        .connect(this.reverb)
        .connect(this.delay)
        .connect(this.distortion)
        .connect(this.crossfader)
    }

    // Master chain
    this.crossfader
      .connect(this.compressor)
      .connect(this.masterGain)
      .connect(this.audioContext.destination)
  }

  async startMicrophone() {
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      this.microphoneSource = this.audioContext.createMediaStreamSource(this.microphoneStream)
      this.connectAudioChain()

      return true
    } catch (error) {
      console.error('Error accessing microphone:', error)
      return false
    }
  }

  stopMicrophone() {
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop())
      this.microphoneStream = null
      this.microphoneSource = null
    }
  }

  async loadMusic(audioFile: File): Promise<boolean> {
    try {
      const arrayBuffer = await audioFile.arrayBuffer()
      this.musicBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      return true
    } catch (error) {
      console.error('Error loading music:', error)
      return false
    }
  }

  playMusic(startTime: number = 0) {
    if (!this.musicBuffer) return false

    if (this.musicSource) {
      this.musicSource.stop()
    }

    this.musicSource = this.audioContext.createBufferSource()
    this.musicSource.buffer = this.musicBuffer
    this.musicSource.connect(this.musicGain)
    
    this.connectAudioChain()
    this.musicSource.start(0, startTime)

    return true
  }

  stopMusic() {
    if (this.musicSource) {
      this.musicSource.stop()
      this.musicSource = null
    }
  }

  pauseMusic() {
    if (this.musicSource) {
      this.musicSource.stop()
    }
  }

  setMicrophoneVolume(volume: number) {
    this.microphoneGain.gain.setValueAtTime(volume, this.audioContext.currentTime)
  }

  setMusicVolume(volume: number) {
    this.musicGain.gain.setValueAtTime(volume, this.audioContext.currentTime)
  }

  setMasterVolume(volume: number) {
    this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime)
  }

  setCrossfader(value: number) {
    // value: 0 = left (microphone), 1 = right (music)
    const leftGain = 1 - value
    const rightGain = value
    
    this.microphoneGain.gain.setValueAtTime(leftGain, this.audioContext.currentTime)
    this.musicGain.gain.setValueAtTime(rightGain, this.audioContext.currentTime)
  }

  setLowEQ(gain: number) {
    this.equalizer[0].gain.setValueAtTime(gain, this.audioContext.currentTime)
  }

  setMidEQ(gain: number) {
    this.equalizer[1].gain.setValueAtTime(gain, this.audioContext.currentTime)
  }

  setHighEQ(gain: number) {
    this.equalizer[2].gain.setValueAtTime(gain, this.audioContext.currentTime)
  }

  setReverbWet(dry: number, wet: number) {
    // Implement dry/wet mix for reverb
    // This is a simplified version
  }

  setDelayTime(time: number) {
    this.delay.delayTime.setValueAtTime(time, this.audioContext.currentTime)
  }

  setDistortionAmount(amount: number) {
    this.distortion.curve = this.makeDistortionCurve(amount)
  }

  startStreaming(): MediaStream | null {
    if (this.isStreaming) return null

    this.streamDestination = this.audioContext.createMediaStreamDestination()
    
    // Connect the mixed audio to the stream destination
    this.crossfader.connect(this.streamDestination)
    
    this.isStreaming = true
    return this.streamDestination.stream
  }

  stopStreaming() {
    if (this.streamDestination) {
      this.streamDestination.disconnect()
      this.streamDestination = null
      this.isStreaming = false
    }
  }

  getCurrentTime(): number {
    return this.audioContext.currentTime
  }

  getMusicDuration(): number {
    return this.musicBuffer ? this.musicBuffer.duration : 0
  }

  resumeAudioContext() {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  destroy() {
    this.stopMicrophone()
    this.stopMusic()
    this.stopStreaming()
    
    if (this.audioContext) {
      this.audioContext.close()
    }
  }
}
