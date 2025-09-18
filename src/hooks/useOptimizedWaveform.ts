/**
 * 🎯 HOOK PER WAVEFORM OTTIMIZZATI
 * Riduce drasticamente l'uso di memoria per i waveform
 */

import { useState, useEffect, useCallback, useRef } from 'react'

interface OptimizedWaveformConfig {
  samples: number
  quality: 'low' | 'medium' | 'high'
  cacheSize: number
  enableCompression: boolean
}

interface WaveformData {
  peaks: number[]
  duration: number
  compressed?: boolean
}

export const useOptimizedWaveform = (
  audioUrl: string | null,
  config: Partial<OptimizedWaveformConfig> = {}
) => {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const cacheRef = useRef<Map<string, WaveformData>>(new Map())
  const abortControllerRef = useRef<AbortController | null>(null)

  const defaultConfig: OptimizedWaveformConfig = {
    samples: 100,           // Ridotto da 200 a 100
    quality: 'low',         // Qualità bassa per risparmiare memoria
    cacheSize: 10,          // Limita cache a 10 waveform
    enableCompression: true, // Abilita compressione
    ...config
  }

  // Pulisce cache quando supera il limite
  const cleanupCache = useCallback(() => {
    if (cacheRef.current.size > defaultConfig.cacheSize) {
      const entries = Array.from(cacheRef.current.entries())
      const toDelete = entries.slice(0, entries.length - defaultConfig.cacheSize)
      toDelete.forEach(([key]) => cacheRef.current.delete(key))
      console.log(`🧹 [WAVEFORM] Cache pulita, rimossi ${toDelete.length} elementi`)
    }
  }, [defaultConfig.cacheSize])

  // Genera waveform ottimizzato
  const generateOptimizedWaveform = useCallback(async (url: string): Promise<WaveformData> => {
    // Controlla cache
    if (cacheRef.current.has(url)) {
      console.log('🎯 [WAVEFORM] Cache hit per:', url)
      return cacheRef.current.get(url)!
    }

    console.log('🎯 [WAVEFORM] Generazione ottimizzata per:', url)
    
    try {
      // Crea AudioContext temporaneo
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // Ottimizza il numero di campioni
      const samples = Math.min(defaultConfig.samples, audioBuffer.length)
      const peaks: number[] = []
      
      // Calcola peaks ottimizzati
      const channelData = audioBuffer.getChannelData(0)
      const blockSize = Math.floor(channelData.length / samples)
      
      for (let i = 0; i < samples; i++) {
        const start = i * blockSize
        const end = Math.min(start + blockSize, channelData.length)
        
        let sum = 0
        for (let j = start; j < end; j++) {
          sum += Math.abs(channelData[j])
        }
        
        // Normalizza e comprime se necessario
        let peak = sum / (end - start)
        if (defaultConfig.enableCompression) {
          peak = Math.pow(peak, 0.5) // Compressione per ridurre memoria
        }
        
        peaks.push(peak)
      }
      
      // Pulisce AudioContext
      await audioContext.close()
      
      const waveformData: WaveformData = {
        peaks,
        duration: audioBuffer.duration,
        compressed: defaultConfig.enableCompression
      }
      
      // Salva in cache
      cacheRef.current.set(url, waveformData)
      cleanupCache()
      
      console.log(`✅ [WAVEFORM] Generato con ${samples} campioni, durata: ${audioBuffer.duration.toFixed(1)}s`)
      
      return waveformData
      
    } catch (error) {
      console.error('❌ [WAVEFORM] Errore generazione:', error)
      throw error
    }
  }, [defaultConfig, cleanupCache])

  // Carica waveform
  const loadWaveform = useCallback(async (url: string) => {
    if (!url) return
    
    setIsLoading(true)
    setError(null)
    
    // Cancella richiesta precedente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    
    try {
      const data = await generateOptimizedWaveform(url)
      setWaveformData(data)
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setError(error.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [generateOptimizedWaveform])

  // Effetto per caricare waveform quando cambia URL
  useEffect(() => {
    if (audioUrl) {
      loadWaveform(audioUrl)
    } else {
      setWaveformData(null)
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [audioUrl, loadWaveform])

  // Pulisce cache quando il componente si smonta
  useEffect(() => {
    return () => {
      cacheRef.current.clear()
    }
  }, [])

  // Forza pulizia cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear()
    console.log('🧹 [WAVEFORM] Cache completamente pulita')
  }, [])

  // Ottiene statistiche cache
  const getCacheStats = useCallback(() => {
    return {
      size: cacheRef.current.size,
      maxSize: defaultConfig.cacheSize,
      memoryUsage: cacheRef.current.size * defaultConfig.samples * 4 // Stima in bytes
    }
  }, [defaultConfig.cacheSize, defaultConfig.samples])

  return {
    waveformData,
    isLoading,
    error,
    clearCache,
    getCacheStats,
    config: defaultConfig
  }
}

export default useOptimizedWaveform
