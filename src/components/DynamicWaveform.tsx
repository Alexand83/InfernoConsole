import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useSettings } from '../contexts/SettingsContext'

interface DynamicWaveformProps {
  waveformData: number[]
  currentTime: number
  duration: number
  isPlaying: boolean
  deck: 'left' | 'right' | 'A' | 'B' // ← Supporta sia il vecchio che nuovo formato
  className?: string
  onSeek?: (time: number) => void // ← AGGIUNTO: callback per seek
}

const DynamicWaveform: React.FC<DynamicWaveformProps> = ({
  waveformData,
  currentTime,
  duration,
  isPlaying,
  deck,
  className = '',
  onSeek
}) => {
  const { settings } = useSettings()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Nascondi il waveform se disabilitato nelle impostazioni
  if (!settings.interface.showWaveforms) {
    return null
  }

  // Calcola la posizione corrente nel waveform (bilanciato per fluidità)
  const currentPosition = useMemo(() => {
    if (duration <= 0 || !waveformData || waveformData.length === 0) return 0
    // ✅ FIX: Arrotonda a blocchi di 1 barra per massima fluidità
    const rawPosition = (currentTime / duration) * waveformData.length
    return Math.floor(rawPosition)
  }, [currentTime, duration, waveformData?.length || 0])

  // Disegna il waveform sul canvas (ottimizzato per ridurre re-render)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !waveformData || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    // Calcola dimensioni delle barre
    const barWidth = width / waveformData.length
    const maxBarHeight = height * 0.8

    // Disegna le barre del waveform
    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth
      const barHeight = amplitude * maxBarHeight
      const y = (height - barHeight) / 2

      // Colore base
      let color = '#6366f1' // dj-accent

      // Evidenzia la posizione corrente
      if (index <= currentPosition) {
        color = '#f59e0b' // dj-highlight
      }

      // Evidenzia la barra hoverata
      if (index === hoveredIndex) {
        color = '#ef4444' // rosso per hover
      }

      // Disegna la barra
      ctx.fillStyle = color
      ctx.fillRect(x, y, barWidth - 1, barHeight)

           // Aggiungi effetto di brillantezza se la traccia è in riproduzione (bilanciato per fluidità)
           if (isPlaying && index <= currentPosition && index % 2 === 0) {
             ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
             ctx.fillRect(x, y, barWidth - 1, barHeight)
           }
    })

    // Disegna la LINEA ROSSA PRINCIPALE per la posizione corrente
    if (duration > 0 && currentTime >= 0) {
      const lineX = (currentTime / duration) * width
      
      // Linea principale più spessa e visibile
      ctx.strokeStyle = '#ef4444' // Rosso brillante
      ctx.lineWidth = 4
      ctx.shadowColor = '#ef4444'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(lineX, 0)
      ctx.lineTo(lineX, height)
      ctx.stroke()
      
      // Reset shadow per altri elementi
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      
      // Cerchio rosso più grande e visibile sulla linea
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(lineX, height / 2, 8, 0, 2 * Math.PI)
      ctx.fill()
      
      // Cerchio bianco interno per contrasto
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(lineX, height / 2, 4, 0, 2 * Math.PI)
      ctx.fill()
      
      // Effetto pulsante se sta suonando (bilanciato per fluidità)
      if (isPlaying) {
        const pulse = 0.9 + Math.sin(Date.now() * 0.005) * 0.1
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`
        ctx.beginPath()
        ctx.arc(lineX, height / 2, 10, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
  }, [waveformData, currentPosition, currentTime, duration, isPlaying, hoveredIndex])

  // Gestisce il click sul waveform per seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || duration <= 0) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickPosition = x / canvas.width
    const newTime = clickPosition * duration

    console.log(`🎵 Waveform seek: ${newTime.toFixed(2)}s`)

    // Usa il callback se fornito, altrimenti emetti evento
    if (onSeek) {
      onSeek(newTime)
    } else {
      // Emetti evento per il seek con il nome corretto per AudioDeck
      const seekEvent = new CustomEvent('waveform:seek', {
        detail: { time: newTime, deck }
      })
      window.dispatchEvent(seekEvent)
    }
  }

  // Gestisce il movimento del mouse per hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !waveformData || waveformData.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const barWidth = canvas.width / waveformData.length
    const index = Math.floor(x / barWidth)

    if (index >= 0 && index < waveformData.length) {
      setHoveredIndex(index)
    } else {
      setHoveredIndex(null)
    }
  }

  // Gestisce la fuoriuscita del mouse
  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  // Animazione ottimizzata per ridurre il lag
  useEffect(() => {
    if (isPlaying && settings.interface.animations) {
      // Riduci la frequenza di aggiornamento per migliorare le performance
      const interval = setInterval(() => {
        // Solo aggiorna il canvas quando necessario
        if (canvasRef.current) {
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Effetto di pulsazione bilanciato per fluidità
            const pulse = 0.9 + Math.sin(Date.now() * 0.005) * 0.1
            ctx.globalAlpha = pulse
          }
        }
      }, 200) // Aggiorna ogni 200ms per bilanciare fluidità e stabilità
      
      return () => clearInterval(interval)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, settings.interface.animations])

  return (
    <div className={`dynamic-waveform ${className}`}>
      <canvas
        ref={canvasRef}
        width={400}
        height={80}
        className="w-full h-20 cursor-pointer rounded-lg"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)'
        }}
      />
      


      {/* Tooltip per hover */}
      {hoveredIndex !== null && (
        <div className="absolute bg-dj-secondary border border-dj-accent/30 rounded px-2 py-1 text-xs text-white pointer-events-none z-10">
          Barra {hoveredIndex + 1}: {Math.round(waveformData[hoveredIndex] * 100)}%
        </div>
      )}
    </div>
  )
}

export default React.memo(DynamicWaveform)

