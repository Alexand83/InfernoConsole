import React, { useState, useEffect, useCallback } from 'react'
import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import { generateWaveformPeaksFromBlob } from '../utils/AudioAnalysis'
import { getBlob } from '../database/BlobStore'

interface LazyWaveformProps {
  track: {
    id: string
    blobId?: string
    waveform?: number[]
  }
  className?: string
  height?: number
  color?: string
}

// Skeleton component per il caricamento
const WaveformSkeleton: React.FC<{ height?: number }> = ({ height = 20 }) => (
  <div 
    className="bg-dj-light/20 rounded animate-pulse"
    style={{ height: `${height}px` }}
  >
    <div className="h-full bg-gradient-to-r from-dj-accent/30 to-dj-accent/10 rounded"></div>
  </div>
)

// Componente waveform effettivo
const WaveformDisplay: React.FC<{
  waveform: number[]
  height?: number
  color?: string
  className?: string
}> = ({ waveform, height = 20, color = '#3b82f6', className = '' }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !waveform.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    
    canvas.width = rect.width * dpr
    canvas.height = height * dpr
    
    ctx.scale(dpr, dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${height}px`

    // Disegna il waveform
    ctx.fillStyle = color
    const barWidth = rect.width / waveform.length
    const maxHeight = height

    waveform.forEach((value, index) => {
      const barHeight = (value * maxHeight) / 100
      const x = index * barWidth
      const y = (maxHeight - barHeight) / 2
      
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight)
    })
  }, [waveform, height, color])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: `${height}px` }}
    />
  )
}

const LazyWaveform: React.FC<LazyWaveformProps> = ({
  track,
  className = '',
  height = 20,
  color = '#3b82f6'
}) => {
  const [waveform, setWaveform] = useState<number[] | null>(track.waveform || null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hook per rilevare quando l'elemento è visibile
  const [ref, isVisible] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px', // Carica 50px prima che diventi visibile
    freezeOnceVisible: true
  })

  // Carica il waveform quando diventa visibile
  const loadWaveform = useCallback(async () => {
    if (waveform || isLoading || !track.blobId || !isVisible) return

    setIsLoading(true)
    setError(null)

    try {
      console.log(`🎵 [LAZY WAVEFORM] Caricamento waveform per: ${track.title}`)
      
      const blob = await getBlob(track.blobId)
      if (!blob) {
        throw new Error('Blob non trovato')
      }

      const peaks = await generateWaveformPeaksFromBlob(blob, 100) // 100 campioni per performance
      setWaveform(peaks)
      
      console.log(`✅ [LAZY WAVEFORM] Waveform caricato: ${track.title}`)
    } catch (err) {
      console.error(`❌ [LAZY WAVEFORM] Errore caricamento: ${track.title}`, err)
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setIsLoading(false)
    }
  }, [track.blobId, track.title, waveform, isLoading, isVisible])

  useEffect(() => {
    if (isVisible && !waveform && !isLoading) {
      loadWaveform()
    }
  }, [isVisible, waveform, isLoading, loadWaveform])

  // Se abbiamo già il waveform, mostralo
  if (waveform) {
    return (
      <WaveformDisplay
        waveform={waveform}
        height={height}
        color={color}
        className={className}
      />
    )
  }

  // Se c'è un errore, mostra un placeholder
  if (error) {
    return (
      <div 
        className={`bg-dj-light/10 rounded flex items-center justify-center text-xs text-dj-light/40 ${className}`}
        style={{ height: `${height}px` }}
      >
        ⚠️ Errore
      </div>
    )
  }

  // Mostra skeleton durante il caricamento
  return (
    <div ref={ref}>
      <WaveformSkeleton height={height} />
    </div>
  )
}

export default LazyWaveform
