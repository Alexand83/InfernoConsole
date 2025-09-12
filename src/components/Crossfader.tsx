import React, { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useTranslation } from '../i18n'

interface CrossfaderProps {
  leftVolume: number
  rightVolume: number
  onLeftVolumeChange: (volume: number) => void
  onRightVolumeChange: (volume: number) => void
  crossfadeValue: number
  onCrossfadeChange: (value: number) => void
}

const Crossfader: React.FC<CrossfaderProps> = ({
  leftVolume,
  rightVolume,
  onLeftVolumeChange,
  onRightVolumeChange,
  crossfadeValue,
  onCrossfadeChange
}) => {
  const [crossfadeCurve, setCrossfadeCurve] = useState<'linear' | 'smooth' | 'sharp'>('smooth')
  const { t } = useTranslation()

  const handleCrossfadeChange = (value: number) => {
    onCrossfadeChange(value)
  }

  const getCrossfadeCurve = (value: number) => {
    switch (crossfadeCurve) {
      case 'linear':
        return value
      case 'smooth':
        return Math.pow(value, 2)
      case 'sharp':
        return Math.pow(value, 3)
      default:
        return value
    }
  }

  return (
    <div className="text-center">
      <h3 className="text-sm font-medium text-dj-light/60 mb-4 uppercase tracking-wider">
        Crossfader
      </h3>
      
      {/* Crossfader Slider - Design Migliorato */}
      <div className="mb-6">
        <div className="bg-dj-secondary rounded-xl p-4">
          {/* Titolo chiaro */}
          <div className="text-center mb-3">
            <h4 className="text-sm font-medium text-dj-light/80 mb-1">{t('console.mixer').toUpperCase()}</h4>
            <p className="text-xs text-dj-light/60">{t('console.mixerDesc')}</p>
          </div>
          
          {/* Slider orizzontale chiaro */}
          <div className="relative">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={crossfadeValue}
              onChange={(e) => handleCrossfadeChange(parseFloat(e.target.value))}
              className="dj-slider w-full h-3"
            />
            
            {/* Indicatori posizione */}
            <div className="flex justify-between mt-2">
              <span className="text-xs font-medium text-dj-accent">{t('console.deckA').toUpperCase()}</span>
              <span className="text-xs font-medium text-dj-highlight">{t('console.deckB').toUpperCase()}</span>
            </div>
            
            {/* Indicatore posizione corrente */}
            <div className="text-center mt-2">
              <div className="inline-block bg-dj-primary px-3 py-1 rounded-full">
                <span className="text-sm font-mono text-white">
                  {crossfadeValue <= 0.5 ? 'A' : 'B'} {Math.round(crossfadeValue * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Volume Controls */}
      <div className="space-y-3 mb-4">
        {/* Left Deck Volume Control */}
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-dj-light/60" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={leftVolume}
            onChange={(e) => onLeftVolumeChange(parseFloat(e.target.value))}
            className="flex-1 dj-slider h-2"
          />
          <span className="text-xs text-dj-light/60 w-8 text-right">
            {Math.round(leftVolume * 100)}%
          </span>
        </div>

        {/* Right Deck Volume Control */}
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-dj-light/60" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={rightVolume}
            onChange={(e) => onRightVolumeChange(parseFloat(e.target.value))}
            className="flex-1 dj-slider h-2"
          />
          <span className="text-xs text-dj-light/60 w-8 text-right">
            {Math.round(rightVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Crossfade Curve Selection - Design Migliorato */}
      <div className="mb-4">
        <div className="bg-dj-secondary rounded-lg p-3">
          <h4 className="text-xs text-dj-light/80 mb-3 text-center uppercase tracking-wider">
            {t('console.transitionType').toUpperCase()}
          </h4>
          <div className="flex space-x-2 justify-center">
            {(['linear', 'smooth', 'sharp'] as const).map((curve) => (
              <button
                key={curve}
                onClick={() => setCrossfadeCurve(curve)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  crossfadeCurve === curve 
                    ? 'bg-dj-highlight text-white shadow-lg' 
                    : 'bg-dj-primary text-dj-light hover:bg-dj-accent hover:scale-105'
                }`}
              >
                {curve === 'linear' ? t('console.linear').toUpperCase() : 
                 curve === 'smooth' ? t('console.smooth').toUpperCase() : t('console.sharp').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Volume Controls - Design Migliorato */}
      <div className="space-y-4">
        <h4 className="text-xs text-dj-light/80 text-center uppercase tracking-wider">
          {t('console.volumeControl').toUpperCase()}
        </h4>
        
        {/* Left Deck Volume Control */}
        <div className="bg-dj-secondary rounded-lg p-3">
          <div className="flex items-center space-x-3">
            <Volume2 className="w-5 h-5 text-dj-accent" />
            <div className="flex-1">
              <div className="text-xs text-dj-light/80 mb-1">{t('console.deckA').toUpperCase()}</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={leftVolume}
                onChange={(e) => onLeftVolumeChange(parseFloat(e.target.value))}
                className="dj-slider w-full h-2"
              />
            </div>
            <span className="text-sm font-mono text-white bg-dj-primary px-2 py-1 rounded">
              {Math.round(leftVolume * 100)}%
            </span>
          </div>
        </div>

        {/* Right Deck Volume Control */}
        <div className="bg-dj-secondary rounded-lg p-3">
          <div className="flex items-center space-x-3">
            <Volume2 className="w-5 h-5 text-dj-highlight" />
            <div className="flex-1">
              <div className="text-xs text-dj-light/80 mb-1">{t('console.deckB').toUpperCase()}</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={rightVolume}
                onChange={(e) => onRightVolumeChange(parseFloat(e.target.value))}
                className="dj-slider w-full h-2"
              />
            </div>
            <span className="text-sm font-mono text-white bg-dj-primary px-2 py-1 rounded">
              {Math.round(rightVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Crossfader
