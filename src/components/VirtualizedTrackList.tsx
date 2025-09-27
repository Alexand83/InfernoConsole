import React from 'react'
import { List } from 'react-window'
import { DatabaseTrack } from '../database/LocalDatabase'

interface VirtualizedTrackListProps {
  tracks: DatabaseTrack[]
  selectedTrack: string | null
  onTrackSelect: (id: string) => void
  onTrackDelete: (id: string) => void
  onTrackDoubleClick: (track: DatabaseTrack) => void
  onTrackDragStart: (track: DatabaseTrack) => void
  height?: number
  itemHeight?: number
  TrackItemComponent: React.ComponentType<{
    track: DatabaseTrack
    isSelected: boolean
    onSelect: (id: string) => void
    onDelete: (id: string) => void
    onDoubleClick: (track: DatabaseTrack) => void
    onDragStart: (track: DatabaseTrack) => void
  }>
}

const VirtualizedTrackList: React.FC<VirtualizedTrackListProps> = ({
  tracks,
  selectedTrack,
  onTrackSelect,
  onTrackDelete,
  onTrackDoubleClick,
  onTrackDragStart,
  height = 600,
  itemHeight = 80,
  TrackItemComponent
}) => {
  // Componente per ogni item virtualizzato
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const track = tracks[index]
    
    if (!track) {
      return (
        <div style={style} className="p-4">
          <div className="animate-pulse bg-dj-light/20 rounded h-16"></div>
        </div>
      )
    }

    return (
      <div style={style} className="px-4">
        <TrackItemComponent
          track={track}
          isSelected={selectedTrack === track.id}
          onSelect={onTrackSelect}
          onDelete={onTrackDelete}
          onDoubleClick={onTrackDoubleClick}
          onDragStart={onTrackDragStart}
        />
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-12 text-dj-light/60">
        <div className="w-16 h-16 mx-auto mb-4 opacity-50">🎵</div>
        <p className="text-lg mb-2">Nessuna traccia trovata</p>
        <p className="text-sm">Prova a modificare i filtri di ricerca o carica nuovi file</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <List
        height={height}
        itemCount={tracks.length}
        itemSize={itemHeight}
        width="100%"
        className="virtualized-list"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#3b82f6 #1f2937'
        }}
      >
        {Row}
      </List>
    </div>
  )
}

export default VirtualizedTrackList
