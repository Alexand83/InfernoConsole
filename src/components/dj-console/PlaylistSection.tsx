import React from 'react'
import { Music, Play, Plus } from 'lucide-react'

interface Track {
  id: string
  title: string
  artist: string
  duration: number
  url: string
}

interface Playlist {
  id: string
  name: string
  tracks: Track[]
}

interface PlaylistSectionProps {
  // Playlist Data
  playlists: Playlist[]
  activePlaylistId: string | null
  onPlaylistSelect: (playlistId: string) => void
  
  // Track Interaction
  onTrackClick: (track: Track, index: number) => void
  onTrackDoubleClick: (track: Track, index: number) => void
  
  // Drag & Drop
  draggedTrack: number | null
  dragOverTrack: number | null
  onDragStart: (e: React.DragEvent, trackIndex: number) => void
  onDragOver: (e: React.DragEvent, trackIndex: number) => void
  onDrop: (e: React.DragEvent, dropIndex: number) => void
  onDragEnd: () => void
}

const PlaylistSection: React.FC<PlaylistSectionProps> = ({
  playlists,
  activePlaylistId,
  onPlaylistSelect,
  onTrackClick,
  onTrackDoubleClick,
  draggedTrack,
  dragOverTrack,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const activePlaylist = playlists.find(p => p.id === activePlaylistId)
  const tracks = activePlaylist?.tracks || []

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Music className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Playlist Manager</h2>
      </div>
      
      {/* Playlist Tabs */}
      <div className="flex space-x-2 mb-4 overflow-x-auto">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            onClick={() => onPlaylistSelect(playlist.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activePlaylistId === playlist.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {playlist.name} ({playlist.tracks?.length || 0})
          </button>
        ))}
      </div>
      
      {/* Playlist Content */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activePlaylistId && tracks.length > 0 ? (
          tracks.map((track, index) => (
            <div
              key={track.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
              onClick={() => onTrackClick(track, index)}
              onDoubleClick={() => onTrackDoubleClick(track, index)}
              className={`p-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-all duration-200 group ${
                draggedTrack === index ? 'opacity-50' : ''
              } ${
                dragOverTrack === index ? 'bg-blue-600' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm w-8">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{track.title}</h4>
                      <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 text-sm">
                    {formatDuration(track.duration)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTrackDoubleClick(track, index)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 bg-blue-500 hover:bg-blue-400 text-white rounded transition-all duration-200"
                    title="Load Track"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : activePlaylistId ? (
          <div className="text-center py-8 text-gray-400">
            Playlist vuota
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            Seleziona una playlist
          </div>
        )}
      </div>
    </div>
  )
}

export default PlaylistSection














