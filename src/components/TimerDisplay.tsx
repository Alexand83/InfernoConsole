import React, { memo } from 'react'
import { useAudio } from '../contexts/AudioContext'

interface TimerDisplayProps {
  deck: 'left' | 'right'
  className?: string
}

const TimerDisplay = memo(({ deck, className = '' }: TimerDisplayProps) => {
  const { state } = useAudio()
  
  // Ottieni currentTime e duration direttamente dallo stato
  const currentTime = deck === 'left' 
    ? state.leftDeck.currentTime 
    : state.rightDeck.currentTime
  
  const duration = deck === 'left' 
    ? state.leftDeck.duration 
    : state.rightDeck.duration
  
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  return (
    <div className={`timer-display ${className}`}>
      <span className="text-sm font-mono">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  )
})

TimerDisplay.displayName = 'TimerDisplay'

export default TimerDisplay
