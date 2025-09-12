import React, { useState } from 'react'
import { ListMusic, Play, Pause, SkipForward, Clock, Music, Plus, Search, Filter } from 'lucide-react'
import { usePlaylist } from '../contexts/PlaylistContext'

const PlaylistPanel = () => {
  const { state: playlistState, createPlaylist, addTrackToPlaylist } = usePlaylist()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  // Safety check for data
  if (!playlistState || !playlistState.library || !playlistState.library.playlists) {
    return (
      <div className="h-full bg-dj-primary p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dj-highlight mx-auto mb-4"></div>
          <p className="text-dj-light/60">Loading playlists...</p>
        </div>
      </div>
    )
  }

  const filteredPlaylists = playlistState.library.playlists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      await createPlaylist(newPlaylistName.trim())
      setNewPlaylistName('')
      setShowCreateForm(false)
    }
  }

  const handleAddTrack = async (playlistId: string, track: any) => {
    await addTrackToPlaylist(playlistId, track)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-full bg-dj-primary p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <ListMusic className="w-5 h-5 text-dj-highlight" />
          <h3 className="text-lg font-dj font-bold text-white">Playlists</h3>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="p-2 bg-dj-accent hover:bg-dj-highlight rounded-lg transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Create Playlist Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-dj-secondary rounded-lg border border-dj-accent/20">
          <h4 className="text-sm font-medium text-white mb-3">Create New Playlist</h4>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              className="flex-1 dj-input bg-dj-primary border-dj-accent/30"
            />
            <button
              onClick={handleCreatePlaylist}
              className="px-4 py-2 bg-dj-highlight hover:bg-dj-accent text-white rounded-lg transition-all duration-200"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-dj-secondary hover:bg-dj-accent text-dj-light rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dj-light/60" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search playlists..."
            className="w-full dj-input pl-10 bg-dj-secondary border-dj-accent/30"
          />
        </div>
      </div>

      {/* Playlists List */}
      <div className="space-y-4">
        {filteredPlaylists.map((playlist) => (
          <div
            key={playlist.id}
            className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
              selectedPlaylist === playlist.id
                ? 'bg-dj-highlight border-dj-highlight'
                : 'bg-dj-secondary border-dj-accent/20 hover:border-dj-accent/40'
            }`}
            onClick={() => setSelectedPlaylist(playlist.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">{playlist.name}</h4>
              <div className="flex items-center space-x-2 text-sm text-dj-light/60">
                <Music className="w-4 h-4" />
                <span>{playlist.tracks.length} tracks</span>
              </div>
            </div>

            {/* Playlist Tracks Preview */}
            {playlist.tracks.length > 0 && (
              <div className="space-y-2">
                {playlist.tracks.slice(0, 3).map((track) => (
                  <div key={track.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-dj-accent rounded-full"></div>
                      <span className="text-dj-light">{track.title}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-dj-light/60">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(track.duration)}</span>
                    </div>
                  </div>
                ))}
                {playlist.tracks.length > 3 && (
                  <div className="text-xs text-dj-light/60 text-center">
                    +{playlist.tracks.length - 3} more tracks
                  </div>
                )}
              </div>
            )}

            {/* Playlist Actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-dj-accent/20">
              <div className="flex space-x-2">
                <button className="p-2 bg-dj-accent hover:bg-dj-highlight rounded transition-all duration-200">
                  <Play className="w-4 h-4" />
                </button>
                <button className="p-2 bg-dj-secondary hover:bg-dj-accent rounded transition-all duration-200">
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs text-dj-light/60">
                {playlist.tracks.reduce((total, track) => total + track.duration, 0) > 0
                  ? formatDuration(playlist.tracks.reduce((total, track) => total + track.duration, 0))
                  : '0:00'
                }
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPlaylists.length === 0 && (
        <div className="text-center py-8">
          <ListMusic className="w-16 h-16 text-dj-light/40 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-dj-light/60 mb-2">No Playlists Found</h4>
          <p className="text-sm text-dj-light/40">
            {searchTerm ? 'Try adjusting your search terms' : 'Create your first playlist to get started'}
          </p>
        </div>
      )}
    </div>
  )
}

export default PlaylistPanel
