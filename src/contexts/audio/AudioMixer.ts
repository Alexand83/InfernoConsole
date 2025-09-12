import { AudioState } from './AudioTypes'
import { audioLogger, logMixer } from './AudioLogger'

interface MixerGainRefs {
  mixerGain?: GainNode
  leftGain?: GainNode
  rightGain?: GainNode
  micGain?: GainNode
  leftMonitorGain?: GainNode
  rightMonitorGain?: GainNode
  monitorMasterGain?: GainNode
}

export class AudioMixer {
  private mixContext: AudioContext | null = null
  private destination: MediaStreamAudioDestinationNode | null = null
  private gainRefs: MixerGainRefs = {}
  
  public async createMixer(
    leftElement?: HTMLAudioElement | null,
    rightElement?: HTMLAudioElement | null
  ): Promise<MediaStream | null> {
    try {
      logMixer.info('Creating audio mixer')
      
      // Crea o riutilizza AudioContext
      this.mixContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      if (this.mixContext.state !== 'running') {
        await this.mixContext.resume()
      }
      
      // Crea destination per lo stream
      this.destination = this.mixContext.createMediaStreamDestination()
      
      // Crea gain nodes principali
      this.gainRefs.mixerGain = this.mixContext.createGain()
      this.gainRefs.monitorMasterGain = this.mixContext.createGain()
      
      // Collega mixer al destination
      this.gainRefs.mixerGain.connect(this.destination)
      this.gainRefs.monitorMasterGain.connect(this.mixContext.destination)
      
      // Aggiungi sorgenti audio se disponibili
      await this.addAudioSources(leftElement, rightElement)
      
      // Esponi riferimenti globalmente per controlli esterni
      this.exposeGlobalReferences()
      
      logMixer.info('Audio mixer created successfully')
      return this.destination.stream
      
    } catch (error) {
      logMixer.error('Failed to create audio mixer', error)
      return null
    }
  }
  
  private async addAudioSources(
    leftElement?: HTMLAudioElement | null,
    rightElement?: HTMLAudioElement | null
  ): Promise<void> {
    // Aggiungi deck sinistro
    if (leftElement && this.isAudioReady(leftElement)) {
      await this.addDeckSource(leftElement, 'left')
    }
    
    // Aggiungi deck destro  
    if (rightElement && this.isAudioReady(rightElement)) {
      await this.addDeckSource(rightElement, 'right')
    }
    
    // Aggiungi microfono
    await this.addMicrophoneSource()
  }
  
  private async addDeckSource(element: HTMLAudioElement, side: 'left' | 'right'): Promise<void> {
    try {
      if (!this.mixContext || !this.gainRefs.mixerGain) return
      
      // Forza volume HTML al 100% per MediaElementSource
      element.volume = 1.0
      
      // Crea MediaElementSource
      const source = this.mixContext.createMediaElementSource(element)
      
      // Crea gain nodes per questo deck
      const deckGain = this.mixContext.createGain()
      const monitorGain = this.mixContext.createGain()
      
      // Configura volumi iniziali
      deckGain.gain.value = 1.0 // Live stream sempre al 100%
      monitorGain.gain.value = 0.8 // Monitor al 80%
      
      // Connessioni
      source.connect(deckGain)
      deckGain.connect(this.gainRefs.mixerGain)
      source.connect(monitorGain)
      monitorGain.connect(this.gainRefs.monitorMasterGain!)
      
      // Salva riferimenti
      if (side === 'left') {
        this.gainRefs.leftGain = deckGain
        this.gainRefs.leftMonitorGain = monitorGain
      } else {
        this.gainRefs.rightGain = deckGain
        this.gainRefs.rightMonitorGain = monitorGain
      }
      
      logMixer.info(`${side} deck added to mixer`)
      
    } catch (error) {
      logMixer.error(`Failed to add ${side} deck to mixer`, error)
    }
  }
  
  private async addMicrophoneSource(): Promise<void> {
    try {
      if (!this.mixContext || !this.gainRefs.mixerGain) return
      
      // Prova a ottenere il microfono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      const micSource = this.mixContext.createMediaStreamSource(stream)
      this.gainRefs.micGain = this.mixContext.createGain()
      
      // Microfono inizialmente al 100% (come richiesto)
      this.gainRefs.micGain.gain.value = 1.0
      
      micSource.connect(this.gainRefs.micGain)
      this.gainRefs.micGain.connect(this.gainRefs.mixerGain)
      
      logMixer.info('Microphone added to mixer at 100%')
      
    } catch (error) {
      logMixer.warn('Could not add microphone to mixer', error)
    }
  }
  
  private isAudioReady(element: HTMLAudioElement): boolean {
    return element &&
           element.src &&
           element.src !== '' &&
           element.src !== 'about:blank' &&
           element.readyState >= 2 &&
           !element.error
  }
  
  private exposeGlobalReferences(): void {
    // Esponi riferimenti per controlli esterni
    ;(window as any).currentMixContext = this.mixContext
    ;(window as any).currentMixerGain = this.gainRefs.mixerGain
    ;(window as any).currentLeftGain = this.gainRefs.leftGain
    ;(window as any).currentRightGain = this.gainRefs.rightGain
    ;(window as any).currentMicGain = this.gainRefs.micGain
    ;(window as any).currentLeftMonitorGain = this.gainRefs.leftMonitorGain
    ;(window as any).currentRightMonitorGain = this.gainRefs.rightMonitorGain
    ;(window as any).currentMonitorMasterGain = this.gainRefs.monitorMasterGain
    
    // Funzione per controllo master volume
    ;(window as any).audioContextSetMasterVolume = (volume: number) => {
      if (this.gainRefs.mixerGain && this.mixContext) {
        this.gainRefs.mixerGain.gain.setValueAtTime(volume, this.mixContext.currentTime)
        logMixer.info(`Master volume set to ${Math.round(volume * 100)}%`)
      }
    }
  }
  
  public applyState(state: AudioState): void {
    if (!this.mixContext) return
    
    const currentTime = this.mixContext.currentTime
    
    // Applica master volume
    if (this.gainRefs.mixerGain) {
      this.gainRefs.mixerGain.gain.setValueAtTime(state.masterVolume, currentTime)
    }
    
    // Applica volume microfono
    if (this.gainRefs.micGain) {
      this.gainRefs.micGain.gain.setValueAtTime(state.microphone.volume, currentTime)
    }
    
    // Applica crossfader ai monitor gains
    this.applyCrossfader(state.crossfader)
  }
  
  private applyCrossfader(value: number): void {
    if (!this.mixContext) return
    
    const currentTime = this.mixContext.currentTime
    const leftVolume = 1 - value
    const rightVolume = value
    
    if (this.gainRefs.leftMonitorGain) {
      this.gainRefs.leftMonitorGain.gain.setValueAtTime(leftVolume, currentTime)
    }
    
    if (this.gainRefs.rightMonitorGain) {
      this.gainRefs.rightMonitorGain.gain.setValueAtTime(rightVolume, currentTime)
    }
  }
  
  public destroy(): void {
    logMixer.info('Destroying audio mixer')
    
    if (this.destination) {
      this.destination.disconnect()
      this.destination = null
    }
    
    if (this.mixContext && this.mixContext.state !== 'closed') {
      this.mixContext.close()
      this.mixContext = null
    }
    
    this.gainRefs = {}
    
    // Pulisci riferimenti globali
    ;(window as any).currentMixContext = null
    ;(window as any).currentMixerGain = null
    ;(window as any).currentLeftGain = null
    ;(window as any).currentRightGain = null
    ;(window as any).currentMicGain = null
  }
}

// Istanza singleton per il mixer
export const audioMixer = new AudioMixer()





