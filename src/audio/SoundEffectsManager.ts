/**
 * Sound Effects Manager
 * Gestisce la riproduzione di effetti sonori (applausi, trombette, etc.)
 */

export interface SoundEffect {
  id: string
  name: string
  description: string
  duration: number // in millisecondi
  volume: number // 0.0 - 1.0
  category: 'applause' | 'horn' | 'transition' | 'ambient' | 'comedy'
}

export class SoundEffectsManager {
  private audioContext: AudioContext | null = null
  private soundEffects: Map<string, AudioBuffer> = new Map()
  private isInitialized: boolean = false
  private masterVolume: number = 0.8

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
      // ✅ CRITICAL FIX: Usa il main AudioContext tramite ensureMainAudioContext
      const ensureMainAudioContext = (window as any).ensureMainAudioContext
      if (ensureMainAudioContext && typeof ensureMainAudioContext === 'function') {
        this.audioContext = ensureMainAudioContext()
        this.onDebug?.('🎵 [SOUND EFFECTS] AudioContext principale ottenuto tramite ensureMainAudioContext')
      } else {
        // Fallback: aspetta per l'AudioContext globale
        this.onDebug?.('🎵 [SOUND EFFECTS] ensureMainAudioContext non disponibile, aspetto AudioContext globale...')
        
        let globalAudioContext = (window as any).globalAudioContext
        if (!globalAudioContext) {
          // Aspetta fino a 20 secondi per l'AudioContext globale
          for (let i = 0; i < 200; i++) {
            await new Promise(resolve => setTimeout(resolve, 100))
            globalAudioContext = (window as any).globalAudioContext
            if (globalAudioContext) {
              this.onDebug?.('🎵 [SOUND EFFECTS] AudioContext globale trovato!')
              break
            }
          }
        }
        
        if (globalAudioContext) {
          this.audioContext = globalAudioContext
          this.onDebug?.('🎵 [SOUND EFFECTS] AudioContext GLOBALE utilizzato')
        } else {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          this.onDebug?.('🎵 [SOUND EFFECTS] AudioContext LOCALE creato (fallback)')
        }
      }
      
      await this.loadSoundEffects()
      this.isInitialized = true
    } catch (error) {
      this.onError?.(`Errore inizializzazione SoundEffects: ${error}`)
    }
  }

  private async loadSoundEffects(): Promise<void> {
    if (!this.audioContext) return

    try {
      // Prova a caricare file audio reali, fallback su sintetici
      await this.loadRealSoundEffects()
      
      this.onDebug?.(`🎵 [SOUND EFFECTS] ${this.soundEffects.size} effetti caricati`)
    } catch (error) {
      this.onError?.(`Errore caricamento effetti: ${error}`)
    }
  }

  // Carica suoni reali da file audio
  private async loadRealSoundEffects(): Promise<void> {
    if (!this.audioContext) return

    const soundFiles = [
      { id: 'applause', url: '/sounds/applause.mp3', fallback: () => this.generateApplause() },
      { id: 'horn', url: '/sounds/horn.mp3', fallback: () => this.generateHorn() },
      { id: 'swoosh', url: '/sounds/swoosh.mp3', fallback: () => this.generateSwoosh() },
      { id: 'whoosh', url: '/sounds/whoosh.mp3', fallback: () => this.generateWhoosh() },
      { id: 'beep', url: '/sounds/beep.mp3', fallback: () => this.generateBeep() },
      { id: 'drop', url: '/sounds/drop.mp3', fallback: () => this.generateDrop() },
      { id: 'rise', url: '/sounds/rise.mp3', fallback: () => this.generateRise() },
      { id: 'squeak', url: '/sounds/squeak.mp3', fallback: () => this.generateSqueak() }
    ]

    for (const sound of soundFiles) {
      try {
        // Prova a caricare il file audio reale
        const response = await fetch(sound.url)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
          this.soundEffects.set(sound.id, audioBuffer)
          this.onDebug?.(`🎵 [SOUND EFFECTS] Caricato file reale: ${sound.id}`)
        } else {
          // Fallback su generazione sintetica
          this.onDebug?.(`🎵 [SOUND EFFECTS] File non trovato, uso sintetico: ${sound.id}`)
          await sound.fallback()
        }
      } catch (error) {
        // Fallback su generazione sintetica
        this.onDebug?.(`🎵 [SOUND EFFECTS] Errore caricamento file, uso sintetico: ${sound.id}`)
        await sound.fallback()
      }
    }
  }

  // Genera applausi realistici migliorati
  private async generateApplause(): Promise<void> {
    if (!this.audioContext) return

    const duration = 3.0 // 3 secondi per applausi più lunghi
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Genera applausi più realistici con pattern complessi
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      
      // Envelope principale con attacco più graduale
      let envelope = 1.0
      if (time < 0.1) {
        envelope = time / 0.1 // Attacco graduale
      } else if (time > 1.5) {
        envelope = Math.exp(-(time - 1.5) * 1.2) // Decadimento più lento
      }
      
      // Pattern di applausi più complessi
      const clapPattern1 = Math.sin(time * 6) * 0.4 + Math.sin(time * 9) * 0.3
      const clapPattern2 = Math.sin(time * 15) * 0.2 + Math.sin(time * 22) * 0.15
      const randomClaps = (Math.random() * 2 - 1) * 0.3 * Math.exp(-time * 1.5)
      
      // Modula l'envelope con i pattern
      envelope *= (1 + clapPattern1 + clapPattern2 + randomClaps)
      envelope = Math.max(0, Math.min(1, envelope))
      
      // Rumore bianco con filtro passa-alto più realistico
      const noise = (Math.random() * 2 - 1) * envelope * 0.5
      
      // Frequenze medie e alte per realismo
      const midFreq = Math.sin(2 * Math.PI * 180 * time) * envelope * 0.15
      const highFreq = Math.sin(2 * Math.PI * 400 * time) * envelope * 0.1
      
      // Aggiungi un po' di riverbero sintetico
      const reverb = Math.sin(2 * Math.PI * 120 * time) * envelope * 0.08
      
      leftChannel[i] = (noise + midFreq + highFreq + reverb) * 0.9
      rightChannel[i] = (noise + midFreq + highFreq + reverb) * 0.8 // Leggero stereo
    }

    this.soundEffects.set('applause', buffer)
  }

  // Genera trombetta realistica migliorata
  private async generateHorn(): Promise<void> {
    if (!this.audioContext) return

    const duration = 2.5 // Più lunga per effetto più drammatico
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Trombetta con armoniche multiple, vibrato e modulazione migliorati
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      
      // Frequenza base con vibrato più realistico
      const vibrato = 1 + 0.2 * Math.sin(2 * Math.PI * 6 * time) // 6Hz vibrato più pronunciato
      const baseFreq = 220 * vibrato // A3 con vibrato (più potente)
      
      // Armoniche della trombetta con rapporti più realistici
      const fundamental = Math.sin(2 * Math.PI * baseFreq * time)
      const harmonic2 = Math.sin(2 * Math.PI * baseFreq * 2 * time) * 0.7
      const harmonic3 = Math.sin(2 * Math.PI * baseFreq * 3 * time) * 0.5
      const harmonic4 = Math.sin(2 * Math.PI * baseFreq * 4 * time) * 0.3
      const harmonic5 = Math.sin(2 * Math.PI * baseFreq * 5 * time) * 0.2
      const harmonic6 = Math.sin(2 * Math.PI * baseFreq * 6 * time) * 0.1
      
      // Envelope con attacco più graduale e sustain più lungo
      let envelope
      if (time < 0.1) {
        envelope = time / 0.1 // Attacco graduale
      } else if (time < 0.8) {
        envelope = 1.0 // Sustain lungo
      } else {
        envelope = Math.exp(-(time - 0.8) * 1.2) // Decadimento più lento
      }
      
      // Modulazione di ampiezza più pronunciata
      const tremolo = 1 + 0.15 * Math.sin(2 * Math.PI * 5 * time)
      
      // Rumore per texture più realistico
      const noise = (Math.random() * 2 - 1) * 0.05 * envelope
      
      // Aggiungi un po' di distorsione per realismo
      const distortion = Math.tanh((fundamental + harmonic2 + harmonic3 + harmonic4 + harmonic5 + harmonic6) * 1.2) * 0.3
      
      // Mix finale con tremolo e distorsione
      const wave = (fundamental + harmonic2 + harmonic3 + harmonic4 + harmonic5 + harmonic6) * envelope * tremolo * 0.8 + noise + distortion
      
      leftChannel[i] = wave
      rightChannel[i] = wave * 0.95 // Leggero stereo
    }

    this.soundEffects.set('horn', buffer)
  }

  // Genera effetto swoosh
  private async generateSwoosh(): Promise<void> {
    if (!this.audioContext) return

    const duration = 1.0
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Genera rumore con filtro passa-alto crescente
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      const envelope = Math.sin(time * Math.PI) * 0.5
      const noise = (Math.random() * 2 - 1) * envelope
      
      leftChannel[i] = noise
      rightChannel[i] = noise * 0.7
    }

    this.soundEffects.set('swoosh', buffer)
  }

  // Genera effetto whoosh
  private async generateWhoosh(): Promise<void> {
    if (!this.audioContext) return

    const duration = 0.8
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Genera rumore con envelope a campana
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      const envelope = Math.exp(-Math.pow((time - 0.4) / 0.2, 2)) * 0.6
      const noise = (Math.random() * 2 - 1) * envelope
      
      leftChannel[i] = noise
      rightChannel[i] = noise * 0.8
    }

    this.soundEffects.set('whoosh', buffer)
  }

  // Genera beep
  private async generateBeep(): Promise<void> {
    if (!this.audioContext) return

    const duration = 0.3
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Genera tono puro
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      const envelope = Math.exp(-time * 8) * 0.5
      const wave = Math.sin(2 * Math.PI * 800 * time) * envelope
      
      leftChannel[i] = wave
      rightChannel[i] = wave
    }

    this.soundEffects.set('beep', buffer)
  }

  // Genera effetto drop
  private async generateDrop(): Promise<void> {
    if (!this.audioContext) return

    const duration = 1.2
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Genera tono con frequenza decrescente
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      const frequency = 400 * Math.exp(-time * 3) // Da 400Hz a 0Hz
      const envelope = Math.exp(-time * 2) * 0.6
      const wave = Math.sin(2 * Math.PI * frequency * time) * envelope
      
      leftChannel[i] = wave
      rightChannel[i] = wave * 0.9
    }

    this.soundEffects.set('drop', buffer)
  }

  // Genera effetto rise
  private async generateRise(): Promise<void> {
    if (!this.audioContext) return

    const duration = 1.0
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Genera tono con frequenza crescente
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      const frequency = 100 + time * 300 // Da 100Hz a 400Hz
      const envelope = Math.exp(-time * 1.5) * 0.5
      const wave = Math.sin(2 * Math.PI * frequency * time) * envelope
      
      leftChannel[i] = wave
      rightChannel[i] = wave * 0.8
    }

    this.soundEffects.set('rise', buffer)
  }

  // Genera effetto squeak (suono che perde)
  private async generateSqueak(): Promise<void> {
    if (!this.audioContext) return

    const duration = 0.5
    const sampleRate = this.audioContext.sampleRate
    const buffer = this.audioContext.createBuffer(2, duration * sampleRate, sampleRate)
    
    const leftChannel = buffer.getChannelData(0)
    const rightChannel = buffer.getChannelData(1)

    // Genera tono con frequenza oscillante
    for (let i = 0; i < buffer.length; i++) {
      const time = i / sampleRate
      const frequency = 1000 + 500 * Math.sin(time * 20) // Oscilla tra 500Hz e 1500Hz
      const envelope = Math.exp(-time * 4) * 0.4
      const wave = Math.sin(2 * Math.PI * frequency * time) * envelope
      
      leftChannel[i] = wave
      rightChannel[i] = wave * 0.7
    }

    this.soundEffects.set('squeak', buffer)
  }

  // Riproduce un effetto sonoro
  async playSoundEffect(effectId: string, volume: number = 1.0): Promise<boolean> {
    if (!this.isInitialized || !this.audioContext) {
      this.onError?.('SoundEffects non inizializzato')
      return false
    }

    const buffer = this.soundEffects.get(effectId)
    if (!buffer) {
      this.onError?.(`Effetto sonoro non trovato: ${effectId}`)
      return false
    }

    try {
      const source = this.audioContext.createBufferSource()
      const gainNode = this.audioContext.createGain()
      
      source.buffer = buffer
      gainNode.gain.setValueAtTime(volume * this.masterVolume, this.audioContext.currentTime)
      
      // FORZA collegamento al mixer principale per streaming
      const mixerGain = (window as any).mixerGain
      const destinationStream = (window as any).destinationStream
      
      // DEBUG: Verifica disponibilità nodi
      this.onDebug?.(`🔍 [SOUND EFFECTS] Debug nodi disponibili:`)
      this.onDebug?.(`🔍 [SOUND EFFECTS] - mixerGain: ${mixerGain ? '✅ DISPONIBILE' : '❌ NON DISPONIBILE'}`)
      this.onDebug?.(`🔍 [SOUND EFFECTS] - destinationStream: ${destinationStream ? '✅ DISPONIBILE' : '❌ NON DISPONIBILE'}`)
      
      // ✅ FIX: Collegamento sia locale che streaming
      source.connect(gainNode)
      
      // 1. SEMPRE collegare al output locale per ascolto in cuffie
      gainNode.connect(this.audioContext.destination)
      this.onDebug?.(`🎵 [SOUND EFFECTS] ✅ Effetto collegato al output locale: ${effectId}`)
      
      // 2. Collegare anche al mixer per streaming se disponibile
      if (mixerGain) {
        gainNode.connect(mixerGain)
        this.onDebug?.(`🎵 [SOUND EFFECTS] ✅ Effetto collegato anche al mixer per streaming: ${effectId}`)
      } else if (destinationStream) {
        gainNode.connect(destinationStream)
        this.onDebug?.(`🎵 [SOUND EFFECTS] ✅ Effetto collegato anche al destination stream per streaming: ${effectId}`)
      } else {
        this.onDebug?.(`🎵 [SOUND EFFECTS] ⚠️ Solo output locale (nessun streaming disponibile): ${effectId}`)
      }
      
      source.start()
      
      this.onDebug?.(`🎵 [SOUND EFFECTS] Riprodotto: ${effectId} (volume: ${Math.round(volume * 100)}%)`)
      return true
    } catch (error) {
      this.onError?.(`Errore riproduzione effetto ${effectId}: ${error}`)
      return false
    }
  }

  // Ottiene lista degli effetti disponibili
  getAvailableEffects(): SoundEffect[] {
    return [
      { id: 'applause', name: 'Applausi', description: 'Applausi realistici del pubblico', duration: 3000, volume: 0.8, category: 'applause' },
      { id: 'horn', name: 'Trombetta', description: 'Trombetta realistica con vibrato', duration: 2500, volume: 0.7, category: 'horn' },
      { id: 'swoosh', name: 'Swoosh', description: 'Effetto di transizione', duration: 1000, volume: 0.6, category: 'transition' },
      { id: 'whoosh', name: 'Whoosh', description: 'Effetto di movimento', duration: 800, volume: 0.6, category: 'transition' },
      { id: 'beep', name: 'Beep', description: 'Suono di notifica', duration: 300, volume: 0.5, category: 'comedy' },
      { id: 'drop', name: 'Drop', description: 'Effetto di caduta', duration: 1200, volume: 0.7, category: 'transition' },
      { id: 'rise', name: 'Rise', description: 'Effetto di ascesa', duration: 1000, volume: 0.6, category: 'transition' },
      { id: 'squeak', name: 'Squeak', description: 'Suono che perde', duration: 500, volume: 0.4, category: 'comedy' }
    ]
  }

  // Imposta volume master
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    this.onDebug?.(`🎵 [SOUND EFFECTS] Volume master impostato: ${Math.round(this.masterVolume * 100)}%`)
  }

  // Ottiene volume master
  getMasterVolume(): number {
    return this.masterVolume
  }

  // Verifica se è inizializzato
  isReady(): boolean {
    return this.isInitialized
  }
}
