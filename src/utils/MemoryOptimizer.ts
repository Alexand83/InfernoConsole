/**
 * Utility per ottimizzare la memoria durante il caricamento di grandi librerie musicali
 */

export interface MemoryOptimizationConfig {
  maxConcurrentFiles: number
  batchSize: number
  delayBetweenBatches: number
  skipWaveformGeneration: boolean
  enableGarbageCollection: boolean
  memoryThreshold: number // Percentuale di memoria oltre la quale rallentare
  maxMemoryUsage: number // Percentuale massima di memoria consentita
}

export class MemoryOptimizer {
  private config: MemoryOptimizationConfig
  private memoryHistory: number[] = []
  private isLowMemoryMode: boolean = false

  constructor(config: Partial<MemoryOptimizationConfig> = {}) {
    this.config = {
      maxConcurrentFiles: 5,
      batchSize: 50,
      delayBetweenBatches: 100,
      skipWaveformGeneration: false, // Waveform sempre generati per qualità
      enableGarbageCollection: true,
      memoryThreshold: 70,
      maxMemoryUsage: 85,
      ...config
    }
  }

  /**
   * Calcola impostazioni ottimali basate sul numero di file
   */
  calculateOptimalSettings(fileCount: number): MemoryOptimizationConfig {
    if (fileCount <= 50) {
      return {
        maxConcurrentFiles: 2,
        batchSize: 20,
        delayBetweenBatches: 30,
        skipWaveformGeneration: false,
        enableGarbageCollection: true,
        memoryThreshold: 60,
        maxMemoryUsage: 80
      }
    } else if (fileCount <= 100) {
      return {
        maxConcurrentFiles: 3,
        batchSize: 25,
        delayBetweenBatches: 50,
        skipWaveformGeneration: false,
        enableGarbageCollection: true,
        memoryThreshold: 60,
        maxMemoryUsage: 80
      }
    } else if (fileCount <= 300) {
      return {
        maxConcurrentFiles: 4,
        batchSize: 40,
        delayBetweenBatches: 80,
        skipWaveformGeneration: false,
        enableGarbageCollection: true,
        memoryThreshold: 65,
        maxMemoryUsage: 82
      }
    } else if (fileCount <= 500) {
      return {
        maxConcurrentFiles: 5,
        batchSize: 50,
        delayBetweenBatches: 100,
        skipWaveformGeneration: false,
        enableGarbageCollection: true,
        memoryThreshold: 70,
        maxMemoryUsage: 85
      }
    } else if (fileCount <= 1000) {
      return {
        maxConcurrentFiles: 6,
        batchSize: 75,
        delayBetweenBatches: 150,
        skipWaveformGeneration: false,
        enableGarbageCollection: true,
        memoryThreshold: 75,
        maxMemoryUsage: 90
      }
    } else {
      // Librerie enormi
      return {
        maxConcurrentFiles: 8,
        batchSize: 100,
        delayBetweenBatches: 200,
        skipWaveformGeneration: false,
        enableGarbageCollection: true,
        memoryThreshold: 80,
        maxMemoryUsage: 95
      }
    }
  }

  /**
   * Monitora l'uso di memoria
   */
  getMemoryUsage(): { used: number; total: number; percentage: number } {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      }
    }
    
    // Fallback per browser che non supportano Performance Memory API
    return {
      used: 0,
      total: 0,
      percentage: 0
    }
  }

  /**
   * Controlla se la memoria è critica
   */
  isMemoryCritical(): boolean {
    const { percentage } = this.getMemoryUsage()
    return percentage > this.config.maxMemoryUsage
  }

  /**
   * Controlla se dovremmo rallentare per preservare memoria
   */
  shouldSlowDown(): boolean {
    const { percentage } = this.getMemoryUsage()
    return percentage > this.config.memoryThreshold
  }

  /**
   * Forza garbage collection se supportato
   */
  forceGarbageCollection(): void {
    if (!this.config.enableGarbageCollection) return

    try {
      // Prova diversi metodi per forzare GC
      if ('gc' in window) {
        (window as any).gc()
      } else if ('collectGarbage' in window) {
        (window as any).collectGarbage()
      }
      
      // Fallback: forza un ciclo di eventi
      setTimeout(() => {
        // Questo può aiutare il browser a liberare memoria
      }, 0)
    } catch (error) {
      console.warn('Garbage collection non supportato:', error)
    }
  }

  /**
   * Ottimizza le impostazioni in tempo reale basate sulla memoria
   */
  getAdaptiveSettings(): Partial<MemoryOptimizationConfig> {
    const { percentage } = this.getMemoryUsage()
    
    if (percentage > this.config.maxMemoryUsage) {
      // Memoria critica: rallenta drasticamente
      return {
        maxConcurrentFiles: Math.max(1, this.config.maxConcurrentFiles - 3),
        delayBetweenBatches: this.config.delayBetweenBatches * 2
        // Waveform sempre generati per qualità audio
      }
    } else if (percentage > this.config.memoryThreshold) {
      // Memoria elevata: rallenta moderatamente
      return {
        maxConcurrentFiles: Math.max(2, this.config.maxConcurrentFiles - 1),
        delayBetweenBatches: this.config.delayBetweenBatches * 1.5
      }
    }
    
    return {}
  }

  /**
   * Crea un delay intelligente basato sulla memoria
   */
  async intelligentDelay(baseDelay: number): Promise<void> {
    const { percentage } = this.getMemoryUsage()
    
    // Aumenta il delay se la memoria è elevata
    let actualDelay = baseDelay
    if (percentage > this.config.memoryThreshold) {
      actualDelay *= 1.5
    }
    if (percentage > this.config.maxMemoryUsage) {
      actualDelay *= 2
    }
    
    await new Promise(resolve => setTimeout(resolve, actualDelay))
    
    // Forza GC se necessario
    if (this.config.enableGarbageCollection && percentage > this.config.memoryThreshold) {
      this.forceGarbageCollection()
    }
  }

  /**
   * Ottimizza la configurazione per il numero di file
   */
  optimizeForFileCount(fileCount: number): void {
    const optimalConfig = this.calculateOptimalSettings(fileCount)
    this.config = { ...this.config, ...optimalConfig }
  }

  /**
   * Ottimizza la configurazione per la memoria disponibile
   */
  optimizeForMemory(): void {
    const { percentage } = this.getMemoryUsage()
    
    if (percentage > 90) {
      // Memoria molto critica
      this.config.maxConcurrentFiles = 1
      this.config.batchSize = 25
      this.config.delayBetweenBatches = 500
      // Waveform sempre generati per qualità audio
    } else if (percentage > 80) {
      // Memoria critica
      this.config.maxConcurrentFiles = Math.max(2, this.config.maxConcurrentFiles - 2)
      this.config.batchSize = Math.max(25, this.config.batchSize - 25)
      this.config.delayBetweenBatches = Math.min(1000, this.config.delayBetweenBatches * 2)
    } else if (percentage > 70) {
      // Memoria elevata
      this.config.maxConcurrentFiles = Math.max(3, this.config.maxConcurrentFiles - 1)
      this.config.delayBetweenBatches = Math.min(500, this.config.delayBetweenBatches * 1.5)
    }
  }

  /**
   * Ottiene la configurazione corrente
   */
  getConfig(): MemoryOptimizationConfig {
    return { ...this.config }
  }

  /**
   * Aggiorna la configurazione
   */
  updateConfig(newConfig: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Resetta la configurazione ai valori predefiniti
   */
  resetConfig(): void {
    this.config = {
      maxConcurrentFiles: 5,
      batchSize: 50,
      delayBetweenBatches: 100,
      skipWaveformGeneration: false, // Waveform sempre generati
      enableGarbageCollection: true,
      memoryThreshold: 70,
      maxMemoryUsage: 85
    }
  }

  /**
   * Genera un report delle ottimizzazioni
   */
  generateReport(): string {
    const { percentage } = this.getMemoryUsage()
    const adaptiveSettings = this.getAdaptiveSettings()
    
    return `
Memoria: ${percentage.toFixed(1)}%
Stato: ${this.isMemoryCritical() ? 'CRITICA' : this.shouldSlowDown() ? 'ELEVATA' : 'OK'}
Configurazione adattiva: ${Object.keys(adaptiveSettings).length > 0 ? 'ATTIVA' : 'NORMALE'}
Impostazioni correnti:
- File concorrenti: ${this.config.maxConcurrentFiles}
- Dimensione batch: ${this.config.batchSize}
- Delay tra batch: ${this.config.delayBetweenBatches}ms
- Waveform: Sempre generati per qualità audio
- GC forzato: ${this.config.enableGarbageCollection ? 'Sì' : 'No'}
    `.trim()
  }
}

export default MemoryOptimizer
