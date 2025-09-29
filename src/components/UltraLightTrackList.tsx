/**
 * 🚀 ULTRA-LIGHT TRACK LIST
 * Componente ultra-leggero per PC antichi con 4GB RAM
 * Fallback per quando la virtualizzazione non è disponibile
 */

import React from 'react'
import { DatabaseTrack } from '../database/LocalDatabase'

interface UltraLightTrackListProps {
  tracks: DatabaseTrack[]
  selectedTrack: string | null
  onTrackSelect: (id: string) => void
  onTrackDelete: (id: string) => void
  onTrackDoubleClick: (track: DatabaseTrack) => void
  onTrackDragStart: (track: DatabaseTrack) => void
  TrackItemComponent: React.ComponentType<{
    track: DatabaseTrack
    isSelected: boolean
    onSelect: (id: string) => void
    onDelete: (id: string) => void
    onDoubleClick: (track: DatabaseTrack) => void
    onDragStart: (track: DatabaseTrack) => void
  }>
}

const UltraLightTrackList: React.FC<UltraLightTrackListProps> = ({
  tracks,
  selectedTrack,
  onTrackSelect,
  onTrackDelete,
  onTrackDoubleClick,
  onTrackDragStart,
  TrackItemComponent
}) => {
  // ✅ ULTRA-LIGHT: Controlla che tracks sia valido
  if (!tracks || !Array.isArray(tracks)) {
    console.warn('⚠️ [ULTRA-LIGHT] Tracks non valido, rendering fallback')
    return (
      <div className="text-center py-12 text-dj-light/60">
        <div className="w-16 h-16 mx-auto mb-4 opacity-50">🎵</div>
        <p className="text-lg mb-2">Caricamento in corso...</p>
        <p className="text-sm">Attendere il caricamento della libreria</p>
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

  // ✅ ULTRA-LIGHT: Renderizza solo i primi 20 track per PC antichi
  const displayTracks = tracks.slice(0, 20)
  const hasMoreTracks = tracks.length > 20

  return (
    <div className="w-full">
      <div className="divide-y divide-dj-accent/10">
        {displayTracks.map((track) => (
          <TrackItemComponent
            key={track.id}
            track={track}
            isSelected={selectedTrack === track.id}
            onSelect={onTrackSelect}
            onDelete={onTrackDelete}
            onDoubleClick={onTrackDoubleClick}
            onDragStart={onTrackDragStart}
          />
        ))}
      </div>
      
      {hasMoreTracks && (
        <div className="text-center py-8 text-dj-light/60 border-t border-dj-accent/10 mt-4">
          <div className="w-12 h-12 mx-auto mb-2 opacity-50">📄</div>
          <p className="text-sm">
            Mostrando 20 di {tracks.length} tracce
          </p>
          <p className="text-xs text-dj-light/40 mt-1">
            Modalità ultra-leggera per PC antichi
          </p>
        </div>
      )}
    </div>
  )
}

export default UltraLightTrackList

