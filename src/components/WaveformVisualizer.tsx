import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'

const WaveformVisualizer = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(100)
  const [volume, setVolume] = useState(0.8)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const animationRef = useRef<number>()

  // Generate sample waveform data
  useEffect(() => {
    const generateWaveform = () => {
      const data = []
      for (let i = 0; i < 200; i++) {
        data.push(Math.random() * 0.8 + 0.2)
      }
      setWaveformData(data)
    }
    
    generateWaveform()
    const interval = setInterval(generateWaveform, 1000)
    return () => clearInterval(interval)
  }, [])

  // Simulate audio playback
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false)
            return 0
          }
          return prev + 0.1
        })
        
        setAudioLevel(Math.random() * 0.8 + 0.2)
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animationRef.current = requestAnimationFrame(animate)
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
  }, [isPlaying, duration])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="waveform-container">
      {/* Waveform Display */}
      <div className="bg-dj-secondary rounded-lg p-4 mb-4 border border-dj-accent/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-white">Waveform</h4>
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-dj-light/60" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 dj-slider"
            />
          </div>
        </div>
        
        {/* Waveform Bars */}
        <div className="h-24 flex items-end justify-center space-x-1">
          {waveformData.map((height, index) => (
            <div
              key={index}
              className="bg-dj-accent rounded-sm transition-all duration-100"
              style={{
                width: '2px',
                height: `${height * 100}%`,
                opacity: isPlaying ? 0.8 : 0.4
              }}
            />
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-dj-light/60 mb-2">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full dj-slider"
          />
          <div 
            className="absolute top-0 left-0 h-2 bg-dj-highlight rounded-full transition-all duration-200"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        <button className="w-10 h-10 bg-dj-secondary hover:bg-dj-accent rounded-lg flex items-center justify-center transition-all duration-200">
          <SkipBack className="w-4 h-4" />
        </button>
        
        <button
          onClick={handlePlayPause}
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 ${
            isPlaying 
              ? 'bg-dj-accent hover:bg-dj-highlight' 
              : 'bg-dj-highlight hover:bg-dj-accent'
          }`}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        
        <button className="w-10 h-10 bg-dj-secondary hover:bg-dj-accent rounded-lg flex items-center justify-center transition-all duration-200">
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Audio Level Meter */}
      <div className="bg-dj-secondary rounded-lg p-3 border border-dj-accent/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white">Audio Level</span>
          <span className="text-xs text-dj-light/60">{Math.round(audioLevel * 100)}%</span>
        </div>
        <div className="w-full bg-dj-primary rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-dj-success via-dj-accent to-dj-highlight transition-all duration-100"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-dj-light/60 mt-1">
          <span>-60dB</span>
          <span>-20dB</span>
          <span>0dB</span>
        </div>
      </div>
    </div>
  )
}

export default WaveformVisualizer
