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

    // ✅ NUOVO: Effetto console DJ professionale
    const now = Date.now()
    const timeOffset = now * 0.002 // Velocità più lenta e professionale

    // Disegna le barre del waveform con stile console DJ
    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth
      let barHeight = amplitude * maxBarHeight
      const y = (height - barHeight) / 2

      // ✅ NUOVO: Effetto console DJ - pulsazione sottile e professionale
      if (isPlaying) {
        // Pulsazione molto sottile, come nelle console reali
        const barPulse = 0.95 + Math.sin(timeOffset + index * 0.1) * 0.05
        barHeight *= barPulse
      }

      // Colori professionali console DJ
      let color = '#4a5568' // Grigio scuro per barre non riprodotte
      let highlightColor = '#2d3748' // Grigio più scuro per ombra

      // Evidenzia la posizione corrente con stile professionale
      if (index <= currentPosition) {
        // ✅ NUOVO: Colore verde professionale per barre riprodotte
        color = '#38a169' // Verde console DJ
        highlightColor = '#2f855a' // Verde più scuro per ombra
        
        // ✅ NUOVO: Effetto di "illuminazione" sottile quando in play
        if (isPlaying) {
          const glowIntensity = 0.8 + Math.sin(timeOffset * 0.5 + index * 0.05) * 0.2
          const r = Math.floor(56 + glowIntensity * 20)   // 56-76
          const g = Math.floor(161 + glowIntensity * 30)  // 161-191
          const b = Math.floor(105 + glowIntensity * 15)  // 105-120
          color = `rgb(${r}, ${g}, ${b})`
        }
      }

      // Evidenzia la barra hoverata
      if (index === hoveredIndex) {
        color = '#e53e3e' // Rosso per hover
        highlightColor = '#c53030'
      }

      // ✅ NUOVO: Disegna la barra con ombra professionale (come console DJ)
      // Ombra
      ctx.fillStyle = highlightColor
      ctx.fillRect(x + 1, y + 1, barWidth - 2, barHeight)
      
      // Barra principale
      ctx.fillStyle = color
      ctx.fillRect(x, y, barWidth - 2, barHeight)

      // ✅ NUOVO: Bordo superiore luminoso (effetto console DJ)
      if (index <= currentPosition) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.fillRect(x, y, barWidth - 2, 1)
      }

      // ✅ NUOVO: Effetto di "scan" quando in play (come oscilloscopio)
      if (isPlaying && index <= currentPosition) {
        const scanEffect = Math.sin(timeOffset * 2 + index * 0.1) * 0.1 + 0.1
        ctx.fillStyle = `rgba(255, 255, 255, ${scanEffect})`
        ctx.fillRect(x, y, barWidth - 2, barHeight * 0.1)
      }
    })

    // ✅ NUOVO: Linea di posizione stile console DJ professionale
    if (duration > 0 && currentTime >= 0) {
      const lineX = (currentTime / duration) * width
      
      // Linea principale professionale
      ctx.strokeStyle = '#e53e3e' // Rosso console DJ
      ctx.lineWidth = 2
      ctx.shadowColor = '#e53e3e'
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.moveTo(lineX, 0)
      ctx.lineTo(lineX, height)
      ctx.stroke()
      
      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      
      // Cerchio di posizione professionale
      ctx.fillStyle = '#e53e3e'
      ctx.beginPath()
      ctx.arc(lineX, height / 2, 6, 0, 2 * Math.PI)
      ctx.fill()
      
      // Cerchio interno bianco
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(lineX, height / 2, 3, 0, 2 * Math.PI)
      ctx.fill()
      
      // ✅ NUOVO: Effetto pulsante sottile quando in play
      if (isPlaying) {
        const pulse = 0.8 + Math.sin(Date.now() * 0.003) * 0.2
        ctx.fillStyle = `rgba(229, 62, 62, ${pulse})`
        ctx.beginPath()
        ctx.arc(lineX, height / 2, 8, 0, 2 * Math.PI)
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

  // ✅ NUOVO: Animazione fluida per le barre del waveform
  useEffect(() => {
    if (isPlaying && settings.interface.animations) {
      // ✅ NUOVO: Usa requestAnimationFrame per animazioni fluide
      const animate = () => {
        // Forza il re-render del canvas per animare le barre
        if (canvasRef.current) {
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Ridisegna il canvas per aggiornare le animazioni
            const { width, height } = canvas
            ctx.clearRect(0, 0, width, height)

            // Calcola dimensioni delle barre
            const barWidth = width / waveformData.length
            const maxBarHeight = height * 0.8

            // Calcola il tempo per animazioni fluide
            const now = Date.now()
            const timeOffset = now * 0.003

            // Ridisegna le barre con stile console DJ professionale
            waveformData.forEach((amplitude, index) => {
              const x = index * barWidth
              let barHeight = amplitude * maxBarHeight
              const y = (height - barHeight) / 2

              // ✅ NUOVO: Pulsazione sottile e professionale
              if (isPlaying) {
                const barPulse = 0.95 + Math.sin(timeOffset + index * 0.1) * 0.05
                barHeight *= barPulse
              }

              // Colori professionali console DJ
              let color = '#4a5568' // Grigio scuro per barre non riprodotte
              let highlightColor = '#2d3748' // Grigio più scuro per ombra

              // Evidenzia la posizione corrente con stile professionale
              if (index <= currentPosition) {
                color = '#38a169' // Verde console DJ
                highlightColor = '#2f855a' // Verde più scuro per ombra
                
                // Effetto di "illuminazione" sottile quando in play
                if (isPlaying) {
                  const glowIntensity = 0.8 + Math.sin(timeOffset * 0.5 + index * 0.05) * 0.2
                  const r = Math.floor(56 + glowIntensity * 20)
                  const g = Math.floor(161 + glowIntensity * 30)
                  const b = Math.floor(105 + glowIntensity * 15)
                  color = `rgb(${r}, ${g}, ${b})`
                }
              }

              if (index === hoveredIndex) {
                color = '#e53e3e' // Rosso per hover
                highlightColor = '#c53030'
              }

              // Disegna la barra con ombra professionale
              // Ombra
              ctx.fillStyle = highlightColor
              ctx.fillRect(x + 1, y + 1, barWidth - 2, barHeight)
              
              // Barra principale
              ctx.fillStyle = color
              ctx.fillRect(x, y, barWidth - 2, barHeight)

              // Bordo superiore luminoso
              if (index <= currentPosition) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
                ctx.fillRect(x, y, barWidth - 2, 1)
              }

              // Effetto di "scan" quando in play
              if (isPlaying && index <= currentPosition) {
                const scanEffect = Math.sin(timeOffset * 2 + index * 0.1) * 0.1 + 0.1
                ctx.fillStyle = `rgba(255, 255, 255, ${scanEffect})`
                ctx.fillRect(x, y, barWidth - 2, barHeight * 0.1)
              }
            })

            // Ridisegna la linea di posizione professionale
            if (duration > 0 && currentTime >= 0) {
              const lineX = (currentTime / duration) * width
              
              ctx.strokeStyle = '#e53e3e'
              ctx.lineWidth = 2
              ctx.shadowColor = '#e53e3e'
              ctx.shadowBlur = 4
              ctx.beginPath()
              ctx.moveTo(lineX, 0)
              ctx.lineTo(lineX, height)
              ctx.stroke()
              
              ctx.shadowColor = 'transparent'
              ctx.shadowBlur = 0
              
              ctx.fillStyle = '#e53e3e'
              ctx.beginPath()
              ctx.arc(lineX, height / 2, 6, 0, 2 * Math.PI)
              ctx.fill()
              
              ctx.fillStyle = '#ffffff'
              ctx.beginPath()
              ctx.arc(lineX, height / 2, 3, 0, 2 * Math.PI)
              ctx.fill()
              
              const pulse = 0.8 + Math.sin(now * 0.003) * 0.2
              ctx.fillStyle = `rgba(229, 62, 62, ${pulse})`
              ctx.beginPath()
              ctx.arc(lineX, height / 2, 8, 0, 2 * Math.PI)
              ctx.fill()
            }
          }
        }
        
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animationRef.current = requestAnimationFrame(animate)
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, settings.interface.animations, waveformData, currentPosition, currentTime, duration, hoveredIndex])

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

