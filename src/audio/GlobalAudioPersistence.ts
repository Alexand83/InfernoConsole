import AudioManager from './AudioManager'

class GlobalAudioPersistence {
  private static instance: GlobalAudioPersistence | null = null
  private audioManager: AudioManager
  private isInitialized = false
  
  private constructor() {
    this.audioManager = AudioManager.getInstance()
    this.initialize()
  }
  
  public static getInstance(): GlobalAudioPersistence {
    if (!GlobalAudioPersistence.instance) {
      GlobalAudioPersistence.instance = new GlobalAudioPersistence()
    }
    return GlobalAudioPersistence.instance
  }
  
  private initialize(): void {
    if (this.isInitialized) return
    
    console.log('🔄 Initializing Global Audio Persistence')
    
    // Listener per quando si cambia pagina
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this))
    window.addEventListener('unload', this.handleUnload.bind(this))
    
    // Listener per quando si torna alla pagina
    window.addEventListener('focus', this.handleWindowFocus.bind(this))
    window.addEventListener('pageshow', this.handlePageShow.bind(this))
    
    // Listener per eventi di navigazione
    window.addEventListener('popstate', this.handlePopState.bind(this))
    
    // Mantieni l'audio attivo durante la navigazione
    this.setupNavigationPersistence()
    
    this.isInitialized = true
    console.log('✅ Global Audio Persistence initialized')
  }
  
  private handleBeforeUnload(): void {
    console.log('🔄 Page unloading - preserving audio state')
    this.saveCurrentState()
  }
  
  private handleUnload(): void {
    console.log('🔄 Page unloaded - audio state preserved')
  }
  
  private handleWindowFocus(): void {
    console.log('🔄 Window focused - checking audio state')
    this.restoreAudioIfNeeded()
  }
  
  private handlePageShow(event: PageTransitionEvent): void {
    console.log('🔄 Page shown - restoring audio state')
    if (event.persisted) {
      // Pagina ripristinata dalla cache del browser
      this.restoreAudioIfNeeded()
    }
  }
  
  private handlePopState(): void {
    console.log('🔄 Navigation detected - maintaining audio state')
    // Non fare nulla - l'audio deve continuare
  }
  
  private setupNavigationPersistence(): void {
    // Override del comportamento di navigazione per mantenere l'audio
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState
    
    history.pushState = function(...args) {
      console.log('🔄 Navigation (pushState) - preserving audio')
      return originalPushState.apply(history, args)
    }
    
    history.replaceState = function(...args) {
      console.log('🔄 Navigation (replaceState) - preserving audio')
      return originalReplaceState.apply(history, args)
    }
  }
  
  private saveCurrentState(): void {
    try {
      const state = this.audioManager.getState()
      const persistentState = {
        deckA: {
          track: state.deckA.track,
          isPlaying: state.deckA.isPlaying,
          currentTime: state.deckA.currentTime,
          volume: state.deckA.volume
        },
        deckB: {
          track: state.deckB.track,
          isPlaying: state.deckB.isPlaying,
          currentTime: state.deckB.currentTime,
          volume: state.deckB.volume
        },
        crossfader: state.crossfader,
        masterVolume: state.masterVolume,
        timestamp: Date.now()
      }
      
      sessionStorage.setItem('dj_audio_persistent_state', JSON.stringify(persistentState))
      console.log('💾 Audio state saved for persistence')
      
    } catch (error) {
      console.error('❌ Error saving persistent audio state:', error)
    }
  }
  
  private restoreAudioIfNeeded(): void {
    try {
      const savedState = sessionStorage.getItem('dj_audio_persistent_state')
      if (!savedState) return
      
      const persistentState = JSON.parse(savedState)
      
      // Controlla se lo stato è recente (meno di 5 minuti)
      const maxAge = 5 * 60 * 1000 // 5 minuti
      if (Date.now() - persistentState.timestamp > maxAge) {
        console.log('⏰ Persistent state is too old, skipping restore')
        return
      }
      
      console.log('🔄 Restoring audio state from persistence')
      
      // Ripristina lo stato (ma non forzare la riproduzione)
      if (persistentState.deckA.track) {
        this.audioManager.loadTrack('A', persistentState.deckA.track)
        this.audioManager.setDeckVolume('A', persistentState.deckA.volume)
        
        // Ripristina la riproduzione SOLO se era in corso
        if (persistentState.deckA.isPlaying) {
          setTimeout(() => {
            this.audioManager.play('A')
          }, 100)
        }
      }
      
      if (persistentState.deckB.track) {
        this.audioManager.loadTrack('B', persistentState.deckB.track)
        this.audioManager.setDeckVolume('B', persistentState.deckB.volume)
        
        // Ripristina la riproduzione SOLO se era in corso
        if (persistentState.deckB.isPlaying) {
          setTimeout(() => {
            this.audioManager.play('B')
          }, 100)
        }
      }
      
      // Ripristina controlli globali
      this.audioManager.setCrossfader(persistentState.crossfader)
      this.audioManager.setMasterVolume(persistentState.masterVolume)
      
      console.log('✅ Audio state restored from persistence')
      
    } catch (error) {
      console.error('❌ Error restoring persistent audio state:', error)
    }
  }
  
  // Metodo pubblico per forzare il salvataggio
  public forceSave(): void {
    this.saveCurrentState()
  }
  
  // Metodo pubblico per forzare il ripristino
  public forceRestore(): void {
    this.restoreAudioIfNeeded()
  }
  
  // Cleanup
  public destroy(): void {
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this))
    window.removeEventListener('unload', this.handleUnload.bind(this))
    window.removeEventListener('focus', this.handleWindowFocus.bind(this))
    window.removeEventListener('pageshow', this.handlePageShow.bind(this))
    window.removeEventListener('popstate', this.handlePopState.bind(this))
    
    this.isInitialized = false
    GlobalAudioPersistence.instance = null
    console.log('💀 Global Audio Persistence destroyed')
  }
}

// Auto-inizializzazione
const globalAudioPersistence = GlobalAudioPersistence.getInstance()

export default globalAudioPersistence
