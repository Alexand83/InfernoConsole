import React, { useState, useEffect } from 'react'
import { Search, Filter, X, Music, User, Disc, Clock, Star } from 'lucide-react'

interface AdvancedSearchProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  availableGenres: string[]
  availableArtists: string[]
  availableAlbums: string[]
}

export interface SearchFilters {
  genre: string
  artist: string
  album: string
  minDuration: number
  maxDuration: number
  minRating: number
  maxRating: number
  minPlayCount: number
  maxPlayCount: number
  addedAfter: string
  addedBefore: string
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  filters,
  onFiltersChange,
  availableGenres,
  availableArtists,
  availableAlbums
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>(filters)

  // Aggiorna i filtri quando cambiano dall'esterno
  useEffect(() => {
    setCurrentFilters(filters)
  }, [filters])

  // Debounce per i filtri
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFiltersChange(currentFilters)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [currentFilters, onFiltersChange])

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    setCurrentFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setCurrentFilters({
      genre: '',
      artist: '',
      album: '',
      minDuration: 0,
      maxDuration: 9999,
      minRating: 0,
      maxRating: 5,
      minPlayCount: 0,
      maxPlayCount: 9999,
      addedAfter: '',
      addedBefore: ''
    })
  }

  const hasActiveFilters = Object.values(currentFilters).some(value => 
    value !== '' && value !== 0 && value !== 9999
  )

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="advanced-search">
      {/* Pulsante per mostrare/nascondere filtri avanzati */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2 rounded-md text-sm transition-all duration-200 flex items-center space-x-2 ${
            showAdvanced 
              ? 'bg-dj-accent text-white' 
              : 'bg-dj-secondary text-dj-light hover:bg-dj-accent/20'
          }`}
          title={showAdvanced ? "Nascondi filtri avanzati" : "Mostra filtri avanzati"}
          aria-label={showAdvanced ? "Nascondi filtri avanzati" : "Mostra filtri avanzati"}
        >
          <Filter className="w-4 h-4" />
          <span>{showAdvanced ? 'Nascondi' : 'Filtri'}</span>
        </button>
      </div>

      {/* Filtri avanzati */}
      {showAdvanced && (
        <div className="bg-dj-secondary rounded-lg p-4 mb-4 border border-dj-accent/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Filtri Avanzati</h3>
            <div className="flex items-center space-x-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-2 py-1 bg-dj-error hover:bg-red-600 rounded text-xs transition-all duration-200"
                  title="Cancella filtri"
                  aria-label="Cancella filtri"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Filtri per genere, artista, album */}
            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Genere</label>
              <select
                value={currentFilters.genre}
                onChange={(e) => handleFilterChange('genre', e.target.value)}
                className="dj-input w-full"
                aria-label="Seleziona genere"
              >
                <option value="">Tutti i generi</option>
                {availableGenres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Artista</label>
              <select
                value={currentFilters.artist}
                onChange={(e) => handleFilterChange('artist', e.target.value)}
                className="dj-input w-full"
                aria-label="Seleziona artista"
              >
                <option value="">Tutti gli artisti</option>
                {availableArtists.map(artist => (
                  <option key={artist} value={artist}>{artist}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Album</label>
              <select
                value={currentFilters.album}
                onChange={(e) => handleFilterChange('album', e.target.value)}
                className="dj-input w-full"
                aria-label="Seleziona album"
              >
                <option value="">Tutti gli album</option>
                {availableAlbums.map(album => (
                  <option key={album} value={album}>{album}</option>
                ))}
              </select>
            </div>

            {/* Filtri per durata */}
            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Durata Min (sec)</label>
              <input
                type="number"
                min="0"
                max="9999"
                value={currentFilters.minDuration}
                onChange={(e) => handleFilterChange('minDuration', parseInt(e.target.value) || 0)}
                className="dj-input w-full"
                placeholder="0"
                aria-label="Durata minima in secondi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Durata Max (sec)</label>
              <input
                type="number"
                min="0"
                max="9999"
                value={currentFilters.maxDuration}
                onChange={(e) => handleFilterChange('maxDuration', parseInt(e.target.value) || 9999)}
                className="dj-input w-full"
                placeholder="9999"
                aria-label="Durata massima in secondi"
              />
            </div>

            {/* Filtri per rating */}
            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Rating Min</label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => handleFilterChange('minRating', rating)}
                    className={`p-1 rounded ${
                      currentFilters.minRating >= rating 
                        ? 'text-yellow-400' 
                        : 'text-dj-light/40'
                    }`}
                    title={`Rating minimo: ${rating} stelle`}
                    aria-label={`Rating minimo: ${rating} stelle`}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Rating Max</label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => handleFilterChange('maxRating', rating)}
                    className={`p-1 rounded ${
                      currentFilters.maxRating >= rating 
                        ? 'text-yellow-400' 
                        : 'text-dj-light/40'
                    }`}
                    title={`Rating massimo: ${rating} stelle`}
                    aria-label={`Rating massimo: ${rating} stelle`}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Filtri per play count */}
            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Play Count Min</label>
              <input
                type="number"
                min="0"
                value={currentFilters.minPlayCount}
                onChange={(e) => handleFilterChange('minPlayCount', parseInt(e.target.value) || 0)}
                className="dj-input w-full"
                placeholder="0"
                aria-label="Play count minimo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Play Count Max</label>
              <input
                type="number"
                min="0"
                value={currentFilters.maxPlayCount}
                onChange={(e) => handleFilterChange('maxPlayCount', parseInt(e.target.value) || 9999)}
                className="dj-input w-full"
                placeholder="9999"
                aria-label="Play count massimo"
              />
            </div>

            {/* Filtri per data */}
            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Aggiunto dopo</label>
              <input
                type="date"
                value={currentFilters.addedAfter}
                onChange={(e) => handleFilterChange('addedAfter', e.target.value)}
                className="dj-input w-full"
                aria-label="Data di aggiunta dopo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dj-light/60 mb-2">Aggiunto prima</label>
              <input
                type="date"
                value={currentFilters.addedBefore}
                onChange={(e) => handleFilterChange('addedBefore', e.target.value)}
                className="dj-input w-full"
                aria-label="Data di aggiunta prima"
              />
            </div>
          </div>

          {/* Riepilogo filtri attivi */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-dj-accent/20">
              <h4 className="text-sm font-medium text-white mb-2">Filtri Attivi:</h4>
              <div className="flex flex-wrap gap-2">
                {currentFilters.genre && (
                  <span className="px-2 py-1 bg-dj-accent/20 text-dj-accent rounded text-xs">
                    Genere: {currentFilters.genre}
                  </span>
                )}
                {currentFilters.artist && (
                  <span className="px-2 py-1 bg-dj-accent/20 text-dj-accent rounded text-xs">
                    Artista: {currentFilters.artist}
                  </span>
                )}
                {currentFilters.album && (
                  <span className="px-2 py-1 bg-dj-accent/20 text-dj-accent rounded text-xs">
                    Album: {currentFilters.album}
                  </span>
                )}
                {currentFilters.minDuration > 0 && (
                  <span className="px-2 py-1 bg-dj-accent/20 text-dj-accent rounded text-xs">
                    Durata ≥ {formatDuration(currentFilters.minDuration)}
                  </span>
                )}
                {currentFilters.maxDuration < 9999 && (
                  <span className="px-2 py-1 bg-dj-accent/20 text-dj-accent rounded text-xs">
                    Durata ≤ {formatDuration(currentFilters.maxDuration)}
                  </span>
                )}
                {currentFilters.minRating > 0 && (
                  <span className="px-2 py-1 bg-dj-accent/20 text-dj-accent rounded text-xs">
                    Rating ≥ {currentFilters.minRating}⭐
                  </span>
                )}
                {currentFilters.maxRating < 5 && (
                  <span className="px-2 py-1 bg-dj-accent/20 text-dj-accent rounded text-xs">
                    Rating ≤ {currentFilters.maxRating}⭐
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdvancedSearch
