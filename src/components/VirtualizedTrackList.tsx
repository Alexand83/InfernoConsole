import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  // ✅ SICUREZZA: Controlli robusti per evitare crash
  const safeTracks = Array.isArray(tracks) ? tracks : []
  
  if (!tracks || !Array.isArray(tracks) || safeTracks.length === 0) {
    console.log('📋 [VIRTUAL] Tracks non valido, rendering fallback')
    return (
      <div className="text-center py-12 text-dj-light/60">
        <div className="w-16 h-16 mx-auto mb-4 opacity-50">🎵</div>
        <p className="text-lg mb-2">Caricamento in corso...</p>
        <p className="text-sm">Attendere il caricamento della libreria</p>
      </div>
    )
  }

  // ✅ VIRTUALIZZAZIONE CUSTOM: Stato per la virtualizzazione
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(height)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  // ✅ CALCOLI VIRTUALIZZAZIONE: Calcola quali elementi renderizzare
  const visibleStart = Math.floor(scrollTop / itemHeight)
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    safeTracks.length
  )
  
  const visibleTracks = safeTracks.slice(visibleStart, visibleEnd)
  const totalHeight = safeTracks.length * itemHeight
  const offsetY = visibleStart * itemHeight

  // ✅ SCROLL HANDLER: Gestisce lo scroll per la virtualizzazione
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)
  }, [])

  // ✅ RESIZE HANDLER: Gestisce il ridimensionamento del container
  const handleResize = useCallback(() => {
    if (scrollElementRef.current) {
      setContainerHeight(scrollElementRef.current.clientHeight)
    }
  }, [])

  // ✅ EFFECT: Setup resize listener
  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  // ✅ RENDER ITEM: Componente per ogni track visibile
  const renderTrack = (track: DatabaseTrack, index: number) => {
    const actualIndex = visibleStart + index
    return (
      <div
        key={track.id}
        style={{
          height: itemHeight,
          minHeight: itemHeight,
          maxHeight: itemHeight
        }}
        className="w-full"
      >
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

  console.log(`📋 [VIRTUAL] Rendering ${visibleTracks.length} track visibili su ${safeTracks.length} totali`)

  return (
    <div className="w-full">
      {/* ✅ CONTAINER VIRTUALIZZATO: Container con scroll personalizzato */}
      <div
        ref={scrollElementRef}
        className="w-full overflow-y-auto"
        style={{
          height: containerHeight,
          scrollbarWidth: 'thin',
          scrollbarColor: '#3b82f6 #1f2937'
        }}
        onScroll={handleScroll}
      >
        {/* ✅ SPACER SUPERIORE: Spazio per gli elementi non visibili sopra */}
        <div style={{ height: offsetY }} />
        
        {/* ✅ TRACK VISIBILI: Solo i track visibili vengono renderizzati */}
        <div className="divide-y divide-dj-accent/10">
          {visibleTracks.map((track, index) => renderTrack(track, index))}
        </div>
        
        {/* ✅ SPACER INFERIORE: Spazio per gli elementi non visibili sotto */}
        <div style={{ height: totalHeight - offsetY - (visibleTracks.length * itemHeight) }} />
      </div>
      
      {/* ✅ DEBUG INFO: Informazioni di debug (solo in sviluppo) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-dj-light/40 mt-2 p-2 bg-dj-primary/10 rounded">
          📊 Virtualizzazione: {visibleTracks.length}/{safeTracks.length} track visibili
          <br />
          📏 Scroll: {Math.round(scrollTop)}px | Range: {visibleStart}-{visibleEnd}
        </div>
      )}
    </div>
  )
}

export default VirtualizedTrackList