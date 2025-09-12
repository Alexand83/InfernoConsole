import React, { useState, useEffect } from 'react'
import { Mic, MicOff, Volume2, Settings, Zap, BarChart3, Filter } from 'lucide-react'
import { useAudio } from '../contexts/AudioContext'

const MicrophonePanel = () => {
  const { state: audioState, toggleMicrophone, setMicrophoneVolume } = useAudio()
  const [micEffects, setMicEffects] = useState({
    lowPass: 20000,
    highPass: 20,
    reverb: 0,
    delay: 0,
    echo: 0,
    distortion: 0
  })

  const handleMicVolumeChange = (volume: number) => {
    setMicrophoneVolume(volume)
  }

  const handleMicEffectChange = (effectId: string, value: number) => {
    setMicEffects(prev => ({ ...prev, [effectId]: value }))
  }

  const micEffectControls = [
    {
      id: 'lowPass',
      name: 'Low Pass',
      icon: Filter,
      min: 20,
      max: 20000,
      value: micEffects.lowPass,
      unit: 'Hz',
      description: 'Cut high frequencies'
    },
    {
      id: 'highPass',
      name: 'High Pass',
      icon: Filter,
      min: 20,
      max: 20000,
      value: micEffects.highPass,
      unit: 'Hz',
      description: 'Cut low frequencies'
    },
    {
      id: 'reverb',
      name: 'Reverb',
      icon: BarChart3,
      min: 0,
      max: 1,
      value: micEffects.reverb,
      unit: '',
      description: 'Add room ambience'
    },
    {
      id: 'delay',
      name: 'Delay',
      icon: BarChart3,
      min: 0,
      max: 1,
      value: micEffects.delay,
      unit: '',
      description: 'Echo effect'
    }
  ]

  return (
    <div className="h-full bg-dj-primary p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <Mic className="w-5 h-5 text-dj-highlight" />
        <h3 className="text-lg font-dj font-bold text-white">Microphone</h3>
      </div>

      {/* Microphone Status */}
      <div className="bg-dj-secondary rounded-lg p-4 mb-6 border border-dj-accent/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${audioState.microphone.isEnabled ? 'bg-dj-success' : 'bg-dj-error'}`}></div>
            <span className="text-sm text-white">
              {audioState.microphone.isEnabled ? 'Microphone Active' : 'Microphone Inactive'}
            </span>
          </div>
          <button
            onClick={toggleMicrophone}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              audioState.microphone.isEnabled
                ? 'bg-dj-error hover:bg-red-600 text-white'
                : 'bg-dj-success hover:bg-green-600 text-white'
            }`}
          >
            {audioState.microphone.isEnabled ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {/* Microphone Level Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dj-light/60">Input Level</span>
            <span className="text-xs text-dj-light/60">
              {audioState.microphone.isEnabled ? 'Live' : 'No Signal'}
            </span>
          </div>
          <div className="w-full bg-dj-primary rounded-full h-3 border border-dj-accent/20">
            <div 
              className="bg-gradient-to-r from-dj-success via-dj-warning to-dj-error h-3 rounded-full transition-all duration-200"
              style={{ 
                width: audioState.microphone.isEnabled ? `${Math.random() * 80 + 20}%` : '0%' 
              }}
            />
          </div>
        </div>
      </div>

      {/* Microphone Volume */}
      <div className="bg-dj-secondary rounded-lg p-4 mb-6 border border-dj-accent/20">
        <div className="flex items-center space-x-2 mb-3">
          <Volume2 className="w-4 h-4 text-dj-light/60" />
          <span className="text-sm font-medium text-white">Microphone Volume</span>
        </div>
        
        <input
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={audioState.microphone.volume}
          onChange={(e) => handleMicVolumeChange(parseFloat(e.target.value))}
          className="dj-slider w-full"
          disabled={!audioState.microphone.isEnabled}
        />
        
        <div className="flex justify-between text-xs text-dj-light/60 mt-1">
          <span>-∞ dB</span>
          <span className="text-white font-mono">
            {audioState.microphone.volume === 0 ? '-∞ dB' : `${(20 * Math.log10(audioState.microphone.volume)).toFixed(1)} dB`}
          </span>
          <span>+6 dB</span>
        </div>
      </div>

      {/* Microphone Effects */}
      <div className="bg-dj-secondary rounded-lg p-4 mb-6 border border-dj-accent/20">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-4 h-4 text-dj-light/60" />
          <span className="text-sm font-medium text-white">Microphone Effects</span>
        </div>
        
        <div className="space-y-4">
          {micEffectControls.map((effect) => {
            const Icon = effect.icon
            return (
              <div key={effect.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-dj-light/60" />
                    <span className="text-sm text-dj-light/60">{effect.name}</span>
                  </div>
                  <span className="text-xs text-white font-mono">
                    {effect.value.toFixed(effect.max > 100 ? 0 : 2)}{effect.unit}
                  </span>
                </div>
                
                <input
                  type="range"
                  min={effect.min}
                  max={effect.max}
                  step={effect.max > 100 ? 1 : 0.01}
                  value={effect.value}
                  onChange={(e) => handleMicEffectChange(effect.id, parseFloat(e.target.value))}
                  className="dj-slider w-full"
                  disabled={!audioState.microphone.isEnabled}
                />
                
                <div className="flex justify-between text-xs text-dj-light/60 mt-1">
                  <span>{effect.min}{effect.unit}</span>
                  <span>{effect.max}{effect.unit}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Settings */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white">Quick Settings</h4>
        
        <div className="grid grid-cols-2 gap-2">
          {['Radio', 'Live', 'Studio', 'Custom'].map((preset) => (
            <button
              key={preset}
              className="px-3 py-2 bg-dj-accent hover:bg-dj-highlight rounded text-sm transition-all duration-200 text-center"
            >
              {preset}
            </button>
          ))}
        </div>
        
        <div className="flex space-x-2">
          <button className="flex-1 px-3 py-2 bg-dj-secondary hover:bg-dj-accent rounded text-sm transition-all duration-200">
            Reset Effects
          </button>
          <button className="flex-1 px-3 py-2 bg-dj-secondary hover:bg-dj-accent rounded text-sm transition-all duration-200">
            Save Preset
          </button>
        </div>
      </div>

      {/* Microphone Tips */}
      <div className="mt-6 p-3 bg-dj-accent/10 rounded-lg border border-dj-accent/20">
        <h5 className="text-sm font-medium text-dj-highlight mb-2">Microphone Tips</h5>
        <ul className="text-xs text-dj-light/60 space-y-1">
          <li>• Keep microphone 6-8 inches from your mouth</li>
          <li>• Use pop filter to reduce plosives</li>
          <li>• Monitor levels to prevent feedback</li>
          <li>• Test effects before going live</li>
        </ul>
      </div>
    </div>
  )
}

export default MicrophonePanel
