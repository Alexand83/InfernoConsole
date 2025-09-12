import React from 'react'
import DeckPlayer from '../DeckPlayer'

interface Track {
  id: string
  title: string
  artist: string
  duration: number
  url: string
}

interface DeckSectionProps {
  // Deck A Props
  deckATrack: Track | null
  deckAActive: boolean
  deckAVolume: number
  deckAMuted: boolean
  onDeckAVolumeChange: (volume: number) => void
  onDeckAActivate: () => void
  
  // Deck B Props
  deckBTrack: Track | null
  deckBActive: boolean
  deckBVolume: number
  deckBMuted: boolean
  onDeckBVolumeChange: (volume: number) => void
  onDeckBActivate: () => void
  
  // Common Props
  onTrackEnd: (deckId: 'A' | 'B') => void
}

const DeckSection: React.FC<DeckSectionProps> = ({
  deckATrack,
  deckAActive,
  deckAVolume,
  deckAMuted,
  onDeckAVolumeChange,
  onDeckAActivate,
  deckBTrack,
  deckBActive,
  deckBVolume,
  deckBMuted,
  onDeckBVolumeChange,
  onDeckBActivate,
  onTrackEnd
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <DeckPlayer
        deckId="A"
        track={deckATrack}
        isActive={deckAActive}
        volume={deckAVolume}
        isMuted={deckAMuted}
        onVolumeChange={onDeckAVolumeChange}
        onActivate={onDeckAActivate}
        onTrackEnd={() => onTrackEnd('A')}
      />
      
      <DeckPlayer
        deckId="B"
        track={deckBTrack}
        isActive={deckBActive}
        volume={deckBVolume}
        isMuted={deckBMuted}
        onVolumeChange={onDeckBVolumeChange}
        onActivate={onDeckBActivate}
        onTrackEnd={() => onTrackEnd('B')}
      />
    </div>
  )
}

export default DeckSection














