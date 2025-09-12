import React, { useMemo, useRef } from 'react'

interface WaveformPeaksProps {
  peaks: number[]
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  isPlaying: boolean
}

const WaveformPeaks: React.FC<WaveformPeaksProps> = ({ peaks, currentTime, duration, onSeek, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const playheadPercent = useMemo(() => {
    if (!duration || duration <= 0) return 0
    return Math.min(100, Math.max(0, (currentTime / duration) * 100))
  }, [currentTime, duration])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.min(1, Math.max(0, x / rect.width))
    onSeek(ratio * duration)
  }

  // Normalize peaks to a fixed number of bars for stable rendering
  const bars = useMemo(() => {
    const TARGET = 120
    const src = (peaks && peaks.length > 0) ? peaks : Array.from({ length: TARGET }, (_, i) => 0.3 + ((i % 5) * 0.05))
    if (src.length === TARGET) return src
    const out: number[] = []
    for (let i = 0; i < TARGET; i++) {
      const start = Math.floor((i / TARGET) * src.length)
      const end = Math.floor(((i + 1) / TARGET) * src.length)
      let max = 0
      for (let j = start; j < Math.max(end, start + 1); j++) {
        const v = Math.abs(src[j] || 0)
        if (v > max) max = v
      }
      out.push(Math.min(1, max))
    }
    return out
  }, [peaks])

  return (
    <div className="w-full bg-dj-primary rounded-lg p-2 border border-dj-accent/20 cursor-pointer" onClick={handleClick} ref={containerRef}>
      <div className="relative h-16 flex items-end space-x-[2px] select-none">
        {bars.map((v, i) => (
          <div
            key={i}
            className={`rounded-sm ${isPlaying ? 'bg-dj-accent' : 'bg-dj-accent/60'}`}
            style={{ width: 2, height: `${Math.max(10, Math.min(100, v * 100))}%` }}
          />
        ))}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-dj-highlight"
          style={{ left: `calc(${playheadPercent}% - 1px)` }}
        />
      </div>
    </div>
  )
}

export default WaveformPeaks


