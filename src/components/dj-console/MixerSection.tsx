import React from 'react'
import MixerControls from '../MixerControls'

interface MixerSectionProps {
  // Deck Volumes
  deckAVolume: number
  deckBVolume: number
  onDeckAVolumeChange: (volume: number) => void
  onDeckBVolumeChange: (volume: number) => void
  
  // Deck Mutes
  deckAMuted: boolean
  deckBMuted: boolean
  onDeckAMuteToggle: () => void
  onDeckBMuteToggle: () => void
  
  // Crossfader
  crossfader: number
  onCrossfaderChange: (value: number) => void
  
  // Master Volume
  masterVolume: number
  onMasterVolumeChange: (volume: number) => void
  
  // Microphone
  micEnabled: boolean
  micVolume: number
  onMicToggle: () => void
  onMicVolumeChange: (volume: number) => void
  
  // Cue/Monitor
  cueEnabled: boolean
  onCueToggle: () => void
}

const MixerSection: React.FC<MixerSectionProps> = ({
  deckAVolume,
  deckBVolume,
  onDeckAVolumeChange,
  onDeckBVolumeChange,
  deckAMuted,
  deckBMuted,
  onDeckAMuteToggle,
  onDeckBMuteToggle,
  crossfader,
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
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">Mixer Controls</h2>
      <MixerControls
        deckAVolume={deckAVolume}
        deckBVolume={deckBVolume}
        onDeckAVolumeChange={onDeckAVolumeChange}
        onDeckBVolumeChange={onDeckBVolumeChange}
        deckAMuted={deckAMuted}
        deckBMuted={deckBMuted}
        onDeckAMuteToggle={onDeckAMuteToggle}
        onDeckBMuteToggle={onDeckBMuteToggle}
        crossfaderValue={crossfader}
        onCrossfaderChange={onCrossfaderChange}
        masterVolume={masterVolume}
        onMasterVolumeChange={onMasterVolumeChange}
        micEnabled={micEnabled}
        micVolume={micVolume}
        onMicToggle={onMicToggle}
        onMicVolumeChange={onMicVolumeChange}
        cueEnabled={cueEnabled}
        onCueToggle={onCueToggle}
      />
    </div>
  )
}

export default MixerSection














