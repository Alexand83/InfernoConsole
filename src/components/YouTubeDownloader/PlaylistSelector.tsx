import React from 'react'
import { Music, Plus, Check } from 'lucide-react'

interface PlaylistSelectorProps {
  selectedPlaylistId: string
  onPlaylistChange: (playlistId: string) => void
  autoAddToPlaylist: boolean
  onAutoAddChange: (enabled: boolean) => void
  playlists: Array<{
    id: string
    name: string
    tracks?: any[]
  }>
  className?: string
}

const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({
  selectedPlaylistId,
  onPlaylistChange,
  autoAddToPlaylist,
  onAutoAddChange,
  playlists,
  className = ''
}) => {
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId)

  return (
    <div className={`bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-4 border border-purple-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center text-white">
          <Music className="mr-2" />
          Integrazione Playlist
        </h3>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="autoAddToPlaylist"
            checked={autoAddToPlaylist}
            onChange={(e) => onAutoAddChange(e.target.checked)}
            className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
          />
          <label htmlFor="autoAddToPlaylist" className="text-sm font-medium text-purple-200">
            Aggiungi automaticamente
          </label>
        </div>
      </div>

      {autoAddToPlaylist && (
        <div className="space-y-3">
          {/* Playlist Selection */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Playlist di destinazione:
            </label>
            <select
              value={selectedPlaylistId}
              onChange={(e) => onPlaylistChange(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-purple-600 rounded-lg focus:outline-none focus:border-purple-400 text-white"
              title="Seleziona playlist di destinazione"
            >
              <option value="">Seleziona una playlist...</option>
              {playlists.map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} ({playlist.tracks?.length || 0} tracce)
                </option>
              ))}
            </select>
          </div>

          {/* Status Display */}
          {selectedPlaylistId && selectedPlaylist && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-3">
              <div className="flex items-center">
                <Check className="text-green-400 mr-2" size={20} />
                <div>
                  <div className="text-green-200 font-medium">
                    ✅ Playlist selezionata: "{selectedPlaylist.name}"
                  </div>
                  <div className="text-green-300 text-sm">
                    I video scaricati verranno aggiunti automaticamente a questa playlist
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex space-x-2">
            <button
              onClick={() => {
                // Apri il pannello playlist per creare una nuova
                window.dispatchEvent(new CustomEvent('djconsole:open-playlist-manager'))
              }}
              className="flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} className="mr-1" />
              Nuova Playlist
            </button>
            
            {selectedPlaylistId && (
              <button
                onClick={() => {
                  // Apri la playlist selezionata
                  window.dispatchEvent(new CustomEvent('djconsole:open-playlist', { 
                    detail: { playlistId: selectedPlaylistId } 
                  }))
                }}
                className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Music size={16} className="mr-1" />
                Apri Playlist
              </button>
            )}
          </div>
        </div>
      )}

      {!autoAddToPlaylist && (
        <div className="text-center py-4">
          <div className="text-purple-300 text-sm">
            Abilita l'opzione per aggiungere automaticamente i video scaricati alla playlist
          </div>
        </div>
      )}
    </div>
  )
}

export default PlaylistSelector
