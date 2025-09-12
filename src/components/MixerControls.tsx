import React, { useState, useCallback } from 'react'
import { Volume2, VolumeX, Headphones, Mic, MicOff } from 'lucide-react'

interface MixerControlsProps {
  // Volumi individuali deck
  deckAVolume: number
  deckBVolume: number
  onDeckAVolumeChange: (volume: number) => void
  onDeckBVolumeChange: (volume: number) => void
  
  // Mute deck
  deckAMuted: boolean
  deckBMuted: boolean
  onDeckAMuteToggle: () => void
  onDeckBMuteToggle: () => void
  
  // Crossfader
  crossfaderValue: number
  onCrossfaderChange: (value: number) => void
  
  // Volume master
  masterVolume: number
  onMasterVolumeChange: (volume: number) => void
  
  // Microfono
  micEnabled: boolean
  micVolume: number
  onMicToggle: () => void
  onMicVolumeChange: (volume: number) => void
  
  // Cue/Monitor
  cueEnabled: boolean
  onCueToggle: () => void
}

const MixerControls: React.FC<MixerControlsProps> = ({
  deckAVolume,
  deckBVolume,
  onDeckAVolumeChange,
  onDeckBVolumeChange,
  deckAMuted,
  deckBMuted,
  onDeckAMuteToggle,
  onDeckBMuteToggle,
  crossfaderValue,
  onCrossfaderChange,
  masterVolume,
  onMasterVolumeChange,
  micEnabled,
  micVolume,
  onMicToggle,
  onMicVolumeChange,
  cueEnabled,
  onCueToggle
}) => {
  // Stati locali per master mute
  const [masterMuted, setMasterMuted] = useState(false)
  
  // Gestione mute master
  const handleMasterMute = useCallback(() => {
    setMasterMuted(!masterMuted)
    onMasterVolumeChange(masterMuted ? masterVolume : 0)
  }, [masterMuted, masterVolume, onMasterVolumeChange])
  
  // Calcolo del crossfader per visualizzazione
  const crossfaderPosition = crossfaderValue * 100
  
  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <h2 className="text-lg font-bold text-white mb-4 text-center">MIXER</h2>
      
      <div className="grid grid-cols-5 gap-4">
        {/* Deck A Channel */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white mb-2">DECK A</h3>
          </div>
          
          {/* Volume Deck A */}
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={onDeckAMuteToggle}
              className={`w-8 h-8 rounded flex items-center justify-center transition-all duration-200 ${
                deckAMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Mute Deck A"
            >
              {deckAMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            <div className="flex flex-col items-center h-32">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={deckAVolume}
                onChange={(e) => onDeckAVolumeChange(parseFloat(e.target.value))}
                className="h-full w-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider vertical-slider"
                aria-label="Deck A Volume"
                title="Deck A Volume"
                orient="vertical"
                style={{
                  writingMode: 'bt-lr',
                  WebkitAppearance: 'slider-vertical',
                  background: deckAMuted 
                    ? `linear-gradient(to top, #ef4444 0%, #ef4444 ${deckAVolume * 100}%, #374151 ${deckAVolume * 100}%, #374151 100%)`
                    : `linear-gradient(to top, #10b981 0%, #10b981 ${deckAVolume * 100}%, #374151 ${deckAVolume * 100}%, #374151 100%)`
                }}
              />
            </div>
            
            <div className="text-xs text-center">
              <div className={deckAMuted ? 'text-red-400' : 'text-gray-400'}>
                {Math.round(deckAVolume * 100)}%
              </div>
              {deckAMuted && (
                <div className="text-xs text-red-500 font-bold">
                  MUTED
                </div>
              )}
            </div>
          </div>
          
          {/* Cue Deck A */}
          <button
            className={`w-full py-2 rounded text-xs font-medium transition-all duration-200 ${
              cueEnabled ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Cue Deck A"
          >
            CUE
          </button>
        </div>
        
        {/* Crossfader */}
        <div className="col-span-3 space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white mb-2">CROSSFADER</h3>
          </div>
          
          <div className="space-y-2">
            {/* Indicatori A/B */}
            <div className="flex justify-between text-xs text-gray-400">
              <span className={crossfaderValue < 0.3 ? 'text-green-400' : ''}>A</span>
              <span className={crossfaderValue > 0.7 ? 'text-blue-400' : ''}>B</span>
            </div>
            
            {/* Crossfader slider */}
            <div className="relative">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={crossfaderValue}
                onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider crossfader"
                aria-label="Crossfader"
                title="Crossfader"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${crossfaderPosition}%, #3b82f6 ${crossfaderPosition}%, #3b82f6 100%)`
                }}
              />
              
              {/* Indicatore posizione crossfader */}
              <div 
                className="absolute top-0 w-1 h-3 bg-white rounded shadow-lg pointer-events-none"
                style={{ left: `calc(${crossfaderPosition}% - 2px)` }}
              />
            </div>
            
            <div className="text-center text-xs text-gray-400">
              {crossfaderValue < 0.3 ? 'DECK A' : crossfaderValue > 0.7 ? 'DECK B' : 'CENTER'}
            </div>
          </div>
          
          {/* Curve selector */}
          <div className="flex justify-center space-x-2 mt-4">
            <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs rounded">
              SMOOTH
            </button>
            <button className="px-2 py-1 bg-blue-600 text-xs rounded">
              SHARP
            </button>
          </div>
        </div>
        
        {/* Deck B Channel */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white mb-2">DECK B</h3>
          </div>
          
          {/* Volume Deck B */}
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={onDeckBMuteToggle}
              className={`w-8 h-8 rounded flex items-center justify-center transition-all duration-200 ${
                deckBMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Mute Deck B"
            >
              {deckBMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            
            <div className="flex flex-col items-center h-32">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={deckBVolume}
                onChange={(e) => onDeckBVolumeChange(parseFloat(e.target.value))}
                className="h-full w-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider vertical-slider"
                aria-label="Deck B Volume"
                title="Deck B Volume"
                orient="vertical"
                style={{
                  writingMode: 'bt-lr',
                  WebkitAppearance: 'slider-vertical',
                  background: deckBMuted 
                    ? `linear-gradient(to top, #ef4444 0%, #ef4444 ${deckBVolume * 100}%, #374151 ${deckBVolume * 100}%, #374151 100%)`
                    : `linear-gradient(to top, #3b82f6 0%, #3b82f6 ${deckBVolume * 100}%, #374151 ${deckBVolume * 100}%, #374151 100%)`
                }}
              />
            </div>
            
            <div className="text-xs text-center">
              <div className={deckBMuted ? 'text-red-400' : 'text-gray-400'}>
                {Math.round(deckBVolume * 100)}%
              </div>
              {deckBMuted && (
                <div className="text-xs text-red-500 font-bold">
                  MUTED
                </div>
              )}
            </div>
          </div>
          
          {/* Cue Deck B */}
          <button
            className={`w-full py-2 rounded text-xs font-medium transition-all duration-200 ${
              cueEnabled ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Cue Deck B"
          >
            CUE
          </button>
        </div>
      </div>
      
      {/* Sezione Master e Microfono */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-700">
        {/* Microfono */}
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white mb-2">MIC</h3>
          </div>
          
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={onMicToggle}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                micEnabled ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={micEnabled ? 'Disable Microphone' : 'Enable Microphone'}
            >
              {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            
            <div className="w-full">
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={micVolume}
                onChange={(e) => onMicVolumeChange(parseFloat(e.target.value))}
                disabled={!micEnabled}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
                aria-label="Microphone Volume"
                title="Microphone Volume"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${(micVolume / 2) * 100}%, #374151 ${(micVolume / 2) * 100}%, #374151 100%)`
                }}
              />
            </div>
            
            <div className="text-xs text-gray-400 text-center">
              {micVolume === 0 ? '-∞ dB' : `${(20 * Math.log10(micVolume)).toFixed(1)} dB`}
            </div>
          </div>
        </div>
        
        {/* Monitor/Cue */}
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white mb-2">MONITOR</h3>
          </div>
          
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={onCueToggle}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                cueEnabled ? 'bg-yellow-500 text-black shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={cueEnabled ? 'Disable Monitor' : 'Enable Monitor'}
            >
              <Headphones className="w-5 h-5" />
            </button>
            
            <div className="text-xs text-gray-400 text-center">
              {cueEnabled ? 'ON' : 'OFF'}
            </div>
          </div>
        </div>
        
        {/* Master Volume */}
        <div className="space-y-3">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white mb-2">MASTER</h3>
          </div>
          
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={handleMasterMute}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                masterMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Mute Master"
            >
              {masterMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            
            <div className="w-full">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                aria-label="Master Volume"
                title="Master Volume"
                style={{
                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${masterVolume * 100}%, #374151 ${masterVolume * 100}%, #374151 100%)`
                }}
              />
            </div>
            
            <div className="text-xs text-gray-400 text-center font-bold">
              {Math.round(masterVolume * 100)}%
            </div>
          </div>
        </div>
      </div>
      
      {/* VU Meter simulato */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="text-center text-xs text-gray-400 mb-2">OUTPUT LEVEL</div>
        <div className="flex justify-center space-x-1">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-6 rounded ${
                i < Math.floor(masterVolume * 10)
                  ? i < 6 ? 'bg-green-500' : i < 8 ? 'bg-yellow-500' : 'bg-red-500'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default MixerControls
