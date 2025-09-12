import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from '../i18n'
import { useAudio } from '../contexts/AudioContext'
import { localDatabase, DatabaseTrack } from '../database/LocalDatabase'
import { Play, Plus, X, Music, Trash2, Edit3 } from 'lucide-react'

interface Playlist {
  id: string
  name: string
  tracks: DatabaseTrack[]
  createdAt: Date
}

const PlaylistManager: React.FC = () => {
  const { t } = useTranslation()
  const { addToDeck } = useAudio()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activePlaylist, setActivePlaylist] = useState<string>('')
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Carica playlist dal database
  useEffect(() => {
    loadPlaylists()
  }, [])

  const loadPlaylists = async () => {
    try {
      // Per ora creo playlist di esempio, poi le carico dal database
      const defaultPlaylists: Playlist[] = [
        {
          id: '1',
          name: 'Mix 2024',
          tracks: [],
          createdAt: new Date()
        },
        {
          id: '2',
          name: 'Preferiti',
          tracks: [],
          createdAt: new Date()
        },
        {
          id: '3',
          name: 'Serata Sabato',
          tracks: [],
          createdAt: new Date()
        }
      ]
      
      setPlaylists(defaultPlaylists)
      if (defaultPlaylists.length > 0) {
        setActivePlaylist(defaultPlaylists[0].id)
      }
    } catch (error) {
      console.error('❌ [PLAYLIST] Errore caricamento playlist:', error)
    }
  }

  // Crea nuova playlist
  const createPlaylist = () => {
    if (newPlaylistName.trim()) {
      const newPlaylist: Playlist = {
        id: Date.now().toString(),
        name: newPlaylistName.trim(),
        tracks: [],
        createdAt: new Date()
      }
      
      setPlaylists(prev => [...prev, newPlaylist])
      setActivePlaylist(newPlaylist.id)
      setNewPlaylistName('')
      setIsCreatingPlaylist(false)
    }
  }

  // Rinomina playlist
  const renamePlaylist = (playlistId: string) => {
    if (editName.trim()) {
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId ? { ...p, name: editName.trim() } : p
      ))
      setEditingPlaylist(null)
      setEditName('')
    }
  }

  // Elimina playlist
  const deletePlaylist = (playlistId: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa playlist?')) {
      setPlaylists(prev => prev.filter(p => p.id !== playlistId))
      
      // Se era attiva, passa alla prima disponibile
      if (activePlaylist === playlistId) {
        const remaining = playlists.filter(p => p.id !== playlistId)
        if (remaining.length > 0) {
          setActivePlaylist(remaining[0].id)
        } else {
          setActivePlaylist('')
        }
      }
    }
  }

  // Gestisce il drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    
    try {
      const trackData = e.dataTransfer.getData('application/json')
      if (trackData) {
        const track: DatabaseTrack = JSON.parse(trackData)
        addTrackToPlaylist(track, activePlaylist)
      }
    } catch (error) {
      console.error('❌ [PLAYLIST] Errore parsing track data:', error)
    }
  }

  // Aggiunge track alla playlist
  const addTrackToPlaylist = (track: DatabaseTrack, playlistId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        // Controlla se la track è già presente
        const exists = p.tracks.some(t => t.id === track.id)
        if (!exists) {
          return { ...p, tracks: [...p.tracks, track] }
        }
      }
      return p
    }))
    
    console.log(`✅ [PLAYLIST] Track "${track.title}" aggiunta a playlist`)
  }

  // Rimuove track dalla playlist
  const removeTrackFromPlaylist = (trackId: string, playlistId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) }
      }
      return p
    }))
  }

  // Aggiunge track al deck
  const addToDeckHandler = async (track: DatabaseTrack, deck: 'left' | 'right') => {
    try {
      await addToDeck(track, deck)
      console.log(`✅ [PLAYLIST] Track "${track.title}" aggiunta al deck ${deck}`)
    } catch (error) {
      console.error(`❌ [PLAYLIST] Errore aggiunta track al deck ${deck}:`, error)
    }
  }

  const currentPlaylist = playlists.find(p => p.id === activePlaylist)

  return (
    <div className="flex flex-col h-full bg-dj-dark text-dj-light">
      {/* Header */}
      <div className="bg-dj-primary p-4 border-b border-dj-accent/30">
        <h1 className="text-2xl font-dj font-bold text-white">🎵 Gestione Playlist</h1>
        <p className="text-dj-light/60 mt-1">Organizza le tue playlist e gestisci le tracce</p>
      </div>

      {/* Tab delle Playlist */}
      <div className="bg-dj-primary border-b border-dj-accent/30">
        <div className="flex items-center space-x-1 p-4 overflow-x-auto">
          {playlists.map(playlist => (
            <button
              key={playlist.id}
              onClick={() => setActivePlaylist(playlist.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activePlaylist === playlist.id
                  ? 'bg-dj-accent text-white shadow-lg'
                  : 'bg-dj-primary/50 text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
              }`}
            >
              <Music size={16} />
              <span>{playlist.name}</span>
              <span className="text-xs bg-dj-accent/20 px-2 py-1 rounded-full">
                {playlist.tracks.length}
              </span>
              
              {/* Menu contestuale per playlist */}
              <div className="relative group">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingPlaylist(playlist.id)
                    setEditName(playlist.name)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 hover:bg-dj-accent/30 rounded"
                  title="Rinomina playlist"
                  aria-label="Rinomina playlist"
                >
                  <Edit3 size={14} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePlaylist(playlist.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1 hover:bg-red-500/30 rounded text-red-400"
                  title="Elimina playlist"
                  aria-label="Elimina playlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </button>
          ))}
          
          {/* Nuova Playlist */}
          {isCreatingPlaylist ? (
            <div className="flex items-center space-x-2 px-4 py-2 bg-dj-accent/20 rounded-lg">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nome playlist..."
                className="bg-transparent border-none outline-none text-white placeholder-dj-light/40"
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && createPlaylist()}
                onBlur={() => {
                  setIsCreatingPlaylist(false)
                  setNewPlaylistName('')
                }}
              />
                             <button
                 onClick={createPlaylist}
                 className="p-1 hover:bg-dj-accent/30 rounded"
                 title="Crea playlist"
                 aria-label="Crea playlist"
               >
                 <Plus size={16} />
               </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingPlaylist(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-dj-accent/20 text-dj-light/80 hover:bg-dj-accent/30 hover:text-white rounded-lg transition-all"
            >
              <Plus size={16} />
              <span>Nuova Playlist</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Rinomina Playlist */}
      {editingPlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dj-primary p-6 rounded-lg border border-dj-accent/30">
            <h3 className="text-lg font-bold mb-4">Rinomina Playlist</h3>
                          <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-dj-dark border border-dj-accent/30 rounded px-3 py-2 text-white mb-4"
                autoFocus
                placeholder="Nome playlist"
                aria-label="Nome playlist"
              />
            <div className="flex space-x-2">
              <button
                onClick={() => renamePlaylist(editingPlaylist)}
                className="px-4 py-2 bg-dj-accent text-white rounded hover:bg-dj-accent/80"
              >
                Salva
              </button>
              <button
                onClick={() => {
                  setEditingPlaylist(null)
                  setEditName('')
                }}
                className="px-4 py-2 bg-dj-dark border border-dj-accent/30 text-white rounded hover:bg-dj-accent/20"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenuto Playlist Attiva */}
      <div className="flex-1 overflow-hidden">
        {currentPlaylist ? (
          <div className="h-full flex flex-col">
            {/* Header Playlist */}
            <div className="bg-dj-primary/20 p-4 border-b border-dj-accent/20">
              <h2 className="text-xl font-dj font-bold text-white">{currentPlaylist.name}</h2>
              <p className="text-dj-light/60 mt-1">
                {currentPlaylist.tracks.length} tracce • Creata il {currentPlaylist.createdAt.toLocaleDateString()}
              </p>
            </div>

            {/* Area Drop Zone */}
            <div
              className="flex-1 p-4 overflow-y-auto"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {currentPlaylist.tracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-dj-light/40">
                  <Music size={64} className="mb-4" />
                  <p className="text-lg font-medium">Playlist vuota</p>
                  <p className="text-sm">Trascina qui le canzoni dalla libreria per iniziare</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentPlaylist.tracks.map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-center space-x-3 p-3 bg-dj-primary/20 rounded-lg hover:bg-dj-primary/30 transition-all"
                    >
                      {/* Numero traccia */}
                      <div className="w-8 h-8 bg-dj-accent/20 rounded-full flex items-center justify-center text-sm font-bold text-dj-accent">
                        {index + 1}
                      </div>

                      {/* Info traccia */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{track.title}</h4>
                        <p className="text-sm text-dj-light/60 truncate">{track.artist}</p>
                        <p className="text-xs text-dj-light/40">
                          {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </p>
                      </div>

                      {/* Azioni */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => addToDeckHandler(track, 'left')}
                          className="p-2 bg-dj-accent/20 hover:bg-dj-accent/30 rounded transition-all"
                          title="Aggiungi al Deck Sinistro"
                        >
                          <Play size={16} className="text-dj-accent" />
                        </button>
                        
                        <button
                          onClick={() => addToDeckHandler(track, 'right')}
                          className="p-2 bg-dj-accent/20 hover:bg-dj-accent/30 rounded transition-all"
                          title="Aggiungi al Deck Destro"
                        >
                          <Play size={16} className="text-dj-accent" />
                        </button>
                        
                                                 <button
                           onClick={() => removeTrackFromPlaylist(track.id, currentPlaylist.id)}
                           className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded transition-all"
                           title="Rimuovi dalla playlist"
                           aria-label="Rimuovi dalla playlist"
                         >
                           <X size={16} className="text-red-400" />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-dj-light/40">
            <div className="text-center">
              <Music size={64} className="mb-4 mx-auto" />
              <p className="text-lg font-medium">Nessuna playlist selezionata</p>
              <p className="text-sm">Seleziona una playlist dai tab sopra o creane una nuova</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlaylistManager
