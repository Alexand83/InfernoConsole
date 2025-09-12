import React from 'react'

interface Props {
  playlists: { id: string; name: string }[]
  selectedId: string
  onSelect: (id: string) => void
  onAdd: () => void
}

const AddToPlaylistInline: React.FC<Props> = ({ playlists, selectedId, onSelect, onAdd }) => {
  return (
    <div className="flex items-center space-x-2 w-full">
      <div className="relative flex-1">
        <select
          className="dj-input w-full pr-8"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Seleziona playlist</option>
          {playlists.map(pl => (
            <option key={pl.id} value={pl.id}>{pl.name}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dj-light/50">▾</span>
      </div>
      <button
        onClick={onAdd}
        disabled={!selectedId}
        className={`px-3 py-2 rounded-lg text-sm transition-colors ${selectedId ? 'bg-dj-accent text-white hover:bg-dj-highlight' : 'bg-dj-secondary text-dj-light cursor-not-allowed'}`}
      >
        Aggiungi
      </button>
    </div>
  )
}

export default AddToPlaylistInline


