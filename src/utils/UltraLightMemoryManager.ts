/**
 * 🚀 ULTRA-LIGHT MEMORY MANAGER
 * Gestione memoria ultra-aggressiva per PC antichi con 4GB RAM
 */

export interface UltraLightConfig {
  maxMemoryMB: number
  cleanupIntervalMs: number
  aggressiveCleanup: boolean
  waveformCacheSize: number
  trackCacheSize: number
}

export class UltraLightMemoryManager {
  private config: UltraLightConfig
  private cleanupInterval: NodeJS.Timeout | null = null
  private isCleaning = false

  constructor(config: Partial<UltraLightConfig> = {}) {
    this.config = {
      maxMemoryMB: 50,        // Massimo 50MB per PC antichi
      cleanupIntervalMs: 5000, // Cleanup ogni 5 secondi
      aggressiveCleanup: true,
      waveformCacheSize: 3,    // Solo 3 waveform in cache
      trackCacheSize: 20,      // Solo 20 track in cache
      ...config
    }
  }

  /**
   * 🚀 Avvia il monitoraggio memoria ultra-aggressivo
   */
  startUltraLightMode() {
    console.log('🚀 [ULTRA-LIGHT] Modalità ultra-leggera attivata per PC antichi')
    
    // Cleanup automatico ogni 5 secondi
    this.cleanupInterval = setInterval(() => {
      this.performAggressiveCleanup()
    }, this.config.cleanupIntervalMs)

    // Cleanup immediato
    this.performAggressiveCleanup()
  }

  /**
   * 🛑 Ferma il monitoraggio memoria
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * 🧹 Cleanup ultra-aggressivo per PC antichi
   */
  private performAggressiveCleanup() {
    if (this.isCleaning) return
    this.isCleaning = true

    try {
      console.log('🧹 [ULTRA-LIGHT] Cleanup ultra-aggressivo in corso...')
      
      // 1. Forza garbage collection
      this.forceGarbageCollection()
      
      // 2. Pulisci cache waveform
      this.cleanupWaveformCache()
      
      // 3. Pulisci cache track
      this.cleanupTrackCache()
      
      // 4. Pulisci DOM non utilizzato
      this.cleanupUnusedDOM()
      
      // 5. Pulisci event listeners
      this.cleanupEventListeners()
      
      console.log('✅ [ULTRA-LIGHT] Cleanup completato')
      
    } catch (error) {
      console.error('❌ [ULTRA-LIGHT] Errore cleanup:', error)
    } finally {
      this.isCleaning = false
    }
  }

  /**
   * 🗑️ Forza garbage collection
   */
  private forceGarbageCollection() {
    try {
      // Forza garbage collection se disponibile
      if (typeof (window as any).gc === 'function') {
        (window as any).gc()
        console.log('🗑️ [ULTRA-LIGHT] Garbage collection forzato')
      }
      
      // Pulisci riferimenti circolari
      this.cleanupCircularReferences()
      
    } catch (error) {
      console.warn('⚠️ [ULTRA-LIGHT] Errore garbage collection:', error)
    }
  }

  /**
   * 🎵 Pulisci cache waveform
   */
  private cleanupWaveformCache() {
    try {
      // Pulisci cache waveform globale se esiste
      if ((window as any).waveformCache) {
        const cache = (window as any).waveformCache
        if (cache.size > this.config.waveformCacheSize) {
          const entries = Array.from(cache.entries())
          const toDelete = entries.slice(0, entries.length - this.config.waveformCacheSize)
          toDelete.forEach(([key]) => cache.delete(key))
          console.log(`🎵 [ULTRA-LIGHT] Waveform cache pulita: ${toDelete.length} elementi rimossi`)
        }
      }
    } catch (error) {
      console.warn('⚠️ [ULTRA-LIGHT] Errore cleanup waveform cache:', error)
    }
  }

  /**
   * 🎶 Pulisci cache track
   */
  private cleanupTrackCache() {
    try {
      // Pulisci cache track globale se esiste
      if ((window as any).trackCache) {
        const cache = (window as any).trackCache
        if (cache.size > this.config.trackCacheSize) {
          const entries = Array.from(cache.entries())
          const toDelete = entries.slice(0, entries.length - this.config.trackCacheSize)
          toDelete.forEach(([key]) => cache.delete(key))
          console.log(`🎶 [ULTRA-LIGHT] Track cache pulita: ${toDelete.length} elementi rimossi`)
        }
      }
    } catch (error) {
      console.warn('⚠️ [ULTRA-LIGHT] Errore cleanup track cache:', error)
    }
  }

  /**
   * 🧹 Pulisci DOM non utilizzato
   */
  private cleanupUnusedDOM() {
    try {
      // Rimuovi elementi audio non utilizzati
      const audioElements = document.querySelectorAll('audio')
      audioElements.forEach(audio => {
        if (audio.paused && audio.readyState === 0) {
          audio.remove()
        }
      })

      // Rimuovi canvas non utilizzati
      const canvasElements = document.querySelectorAll('canvas')
      canvasElements.forEach(canvas => {
        if (!canvas.isConnected || canvas.width === 0) {
          canvas.remove()
        }
      })

      console.log('🧹 [ULTRA-LIGHT] DOM pulito')
    } catch (error) {
      console.warn('⚠️ [ULTRA-LIGHT] Errore cleanup DOM:', error)
    }
  }

  /**
   * 🎧 Pulisci event listeners
   */
  private cleanupEventListeners() {
    try {
      // Rimuovi event listeners duplicati
      const events = ['resize', 'scroll', 'mousemove', 'keydown']
      events.forEach(eventType => {
        const listeners = (window as any).__eventListeners?.[eventType]
        if (listeners && listeners.length > 5) {
          // Rimuovi listener duplicati
          const uniqueListeners = [...new Set(listeners)]
          ;(window as any).__eventListeners[eventType] = uniqueListeners
          console.log(`🎧 [ULTRA-LIGHT] Event listeners puliti per ${eventType}`)
        }
      })
    } catch (error) {
      console.warn('⚠️ [ULTRA-LIGHT] Errore cleanup event listeners:', error)
    }
  }

  /**
   * 🔄 Pulisci riferimenti circolari
   */
  private cleanupCircularReferences() {
    try {
      // Pulisci riferimenti circolari comuni
      const cleanupRefs = [
        'audioContext',
        'mediaRecorder',
        'fileReader',
        'blobUrl'
      ]

      cleanupRefs.forEach(ref => {
        if ((window as any)[ref]) {
          try {
            if (typeof (window as any)[ref].close === 'function') {
              (window as any)[ref].close()
            }
            delete (window as any)[ref]
          } catch (e) {
            // Ignora errori di cleanup
          }
        }
      })
    } catch (error) {
      console.warn('⚠️ [ULTRA-LIGHT] Errore cleanup riferimenti:', error)
    }
  }

  /**
   * 📊 Ottieni statistiche memoria
   */
  getMemoryStats() {
    try {
      const memory = (performance as any).memory
      if (memory) {
        return {
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
        }
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * ⚠️ Controlla se la memoria è critica
   */
  isMemoryCritical(): boolean {
    const stats = this.getMemoryStats()
    if (!stats) return false
    
    return stats.used > this.config.maxMemoryMB
  }
}

// Istanza globale per PC antichi
export const ultraLightMemoryManager = new UltraLightMemoryManager({
  maxMemoryMB: 30,        // Solo 30MB per PC con 4GB RAM
  cleanupIntervalMs: 3000, // Cleanup ogni 3 secondi
  aggressiveCleanup: true,
  waveformCacheSize: 2,    // Solo 2 waveform in cache
  trackCacheSize: 15       // Solo 15 track in cache
})

