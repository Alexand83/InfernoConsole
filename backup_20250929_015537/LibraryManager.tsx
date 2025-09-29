import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, Music, Plus, Upload, Trash2, Edit3, X } from 'lucide-react'
import { useAudio } from '../contexts/AudioContext'
import { localDatabase, DatabaseTrack } from '../database/LocalDatabase'
import { getBlob } from '../database/BlobStore'
import { generateWaveformPeaksFromBlob } from '../utils/AudioAnalysis'
import FileUploadManager, { UploadProgress } from '../utils/FileUploadManager'
import FolderImporter from './FolderImporter'
import AdvancedSearch, { SearchFilters } from './AdvancedSearch'
import LazyWaveform from './LazyWaveform'
import VirtualizedTrackList from './VirtualizedTrackList'

interface Playlist {
  id: string
  name: string
  tracks: DatabaseTrack[]
  createdAt: Date
}

// ✅ MEMOIZZAZIONE: Componente ottimizzato per track items
const TrackItem = React.memo(({ 
  track, 
  isSelected, 
  onSelect, 
  onDelete, 
  onDoubleClick,
  onDragStart
}: {
  track: DatabaseTrack
  isSelected: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onDoubleClick: (track: DatabaseTrack) => void
  onDragStart: (track: DatabaseTrack) => void
}) => {
  const handleClick = useCallback(() => {
    onSelect(track.id)
  }, [track.id, onSelect])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(track.id)
  }, [track.id, onDelete])

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(track)
  }, [track, onDoubleClick])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    onDragStart(track)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(track))
  }, [track, onDragStart])

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={handleDoubleClick}
      className={`p-4 hover:bg-dj-primary/20 transition-all cursor-move ${
        isSelected ? 'bg-dj-accent/10 border-l-4 border-dj-accent' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{track.title}</h4>
          <p className="text-sm text-dj-light/60 truncate">{track.artist}</p>
          {track.album && (
            <p className="text-xs text-dj-light/40 truncate">{track.album}</p>
          )}
          
          {/* ✅ LAZY LOADING WAVEFORM: Carica solo quando visibile */}
          <div className="mt-2">
            <LazyWaveform
              track={track}
              height={16}
              color="#3b82f6"
              className="opacity-60"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-3 ml-4">
          <div className="text-right">
            <div className="text-sm text-dj-light/60">
              {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
            </div>
            {track.playCount > 0 && (
              <div className="text-xs text-dj-accent">▶ {track.playCount}</div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDelete}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded transition-all"
              title="Elimina traccia"
            >
              <Trash2 size={16} className="text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Solo re-render se cambiano props specifiche
  return (
    prevProps.track.id === nextProps.track.id &&
    prevProps.track.title === nextProps.track.title &&
    prevProps.track.artist === nextProps.track.artist &&
    prevProps.track.album === nextProps.track.album &&
    prevProps.track.duration === nextProps.track.duration &&
    prevProps.track.playCount === nextProps.track.playCount &&
    prevProps.isSelected === nextProps.isSelected
  )
})

const LibraryManager = () => {
  // const { addToDeck } = useAudio() // Rimosso perché non usato
  const [tracks, setTracks] = useState<DatabaseTrack[]>([])
  const [filteredTracks, setFilteredTracks] = useState<DatabaseTrack[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
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
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'duration' | 'addedAt' | 'playCount' | 'rating'>('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ✅ PAGINAZIONE: Gestione pagine per performance
  const [currentPage, setCurrentPage] = useState(0)
  const ITEMS_PER_PAGE = 50 // 50 file per pagina per fluidità massima

  // ✅ VIRTUALIZZAZIONE: Abilita/disabilita virtualizzazione
  const [useVirtualization, setUseVirtualization] = useState(false)
  const VIRTUALIZATION_THRESHOLD = 100 // Usa virtualizzazione se > 100 file

  // Nuove variabili per playlist
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activePlaylist, setActivePlaylist] = useState<string>('')
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // NUOVO: Gestione drag & drop per playlist
  const [draggedTrack, setDraggedTrack] = useState<DatabaseTrack | null>(null)
  const [dragOverPlaylist, setDragOverPlaylist] = useState<string | null>(null)

  const handleDragStart = (track: DatabaseTrack) => {
    setDraggedTrack(track)
    console.log('🎵 Started dragging track:', track.title)
  }

  const handleDragOver = (e: React.DragEvent, playlistId: string) => {
    e.preventDefault()
    setDragOverPlaylist(playlistId)
  }

  const handleDragLeave = () => {
    setDragOverPlaylist(null)
  }

  const handleDrop = async (e: React.DragEvent, playlistId: string) => {
    e.preventDefault()
    
    if (!draggedTrack) return
    
    try {
      console.log('🎵 Dropping track into playlist:', { track: draggedTrack.title, playlistId })
      
      // Trova la playlist
      const playlist = playlists.find(p => p.id === playlistId)
      if (!playlist) return
      
      // Controlla se la traccia è già nella playlist
      if (playlist.tracks.some(t => t.id === draggedTrack.id)) {
        console.log('⚠️ Track already in playlist')
        return
      }
      
      // Aggiungi la traccia alla playlist
      const updatedTracks = [...playlist.tracks, draggedTrack]
      await localDatabase.updatePlaylist(playlistId, { tracks: updatedTracks.map(t => t.id) })
      
      // Aggiorna lo stato locale
      const updatedPlaylists = playlists.map(p => 
        p.id === playlistId ? { ...p, tracks: updatedTracks } : p
      )
      setPlaylists(updatedPlaylists)
      
      console.log('✅ Track added to playlist successfully')
      
      // Notifica la Console DJ dell'aggiornamento (senza loop)
      window.dispatchEvent(new CustomEvent('djconsole:library-playlist-updated', { 
        detail: { playlistId, updatedTracks, updatedPlaylists } 
      }))
      
    } catch (error) {
      console.error('❌ Error adding track to playlist:', error)
    } finally {
      setDraggedTrack(null)
      setDragOverPlaylist(null)
    }
  }

  // NUOVO: Funzione per rimuovere traccia da playlist
  const removeTrackFromPlaylist = async (trackId: string, playlistId: string) => {
    try {
      console.log('🗑️ Removing track from playlist:', { trackId, playlistId })
      
      // Trova la playlist
      const playlist = playlists.find(p => p.id === playlistId)
      if (!playlist) return
      
      // Rimuovi la traccia dalla playlist
      const updatedTracks = playlist.tracks.filter(t => t.id !== trackId)
      await localDatabase.updatePlaylist(playlistId, { tracks: updatedTracks.map(t => t.id) })
      
      // Aggiorna lo stato locale
      const updatedPlaylists = playlists.map(p => 
        p.id === playlistId ? { ...p, tracks: updatedTracks } : p
      )
      setPlaylists(updatedPlaylists)
      
      console.log('✅ Track removed from playlist successfully')
      
      // Notifica la Console DJ dell'aggiornamento (senza loop)
      window.dispatchEvent(new CustomEvent('djconsole:library-playlist-updated', { 
        detail: { playlistId, updatedTracks, updatedPlaylists } 
      }))
      
    } catch (error) {
      console.error('❌ Error removing track from playlist:', error)
    }
  }

  // ✅ MEMOIZZAZIONE: Callback ottimizzati per track items
  const handleTrackSelect = useCallback((trackId: string) => {
    setSelectedTrack(trackId)
  }, [])

  const handleTrackDelete = useCallback(async (trackId: string) => {
    await deleteTrack(trackId)
  }, [])

  const handleTrackDoubleClick = useCallback((track: DatabaseTrack) => {
    console.log('🎵 [DOUBLE CLICK] Track double clicked:', track.title)
    console.log('🎵 [DOUBLE CLICK] Active playlist:', activePlaylist)
    addTrackToSelectedPlaylist(track)
  }, [activePlaylist, playlists])

  const handleTrackDragStart = useCallback((track: DatabaseTrack) => {
    setDraggedTrack(track)
  }, [])

  // NUOVO: Funzione per aggiungere traccia alla playlist selezionata
  const addTrackToSelectedPlaylist = async (track: DatabaseTrack) => {
    if (!activePlaylist) {
      // Usa il sistema di notifiche invece di alert
      window.dispatchEvent(new CustomEvent('djconsole:notification', {
        detail: { 
          type: 'warning', 
          message: 'Seleziona prima una playlist per aggiungere la canzone!' 
        }
      }))
      return
    }
    
    try {
      console.log('🎵 Adding track to selected playlist:', { track: track.title, playlistId: activePlaylist })
      
      // Trova la playlist
      const playlist = playlists.find(p => p.id === activePlaylist)
      if (!playlist) return
      
      // Controlla se la traccia è già nella playlist
      if (playlist.tracks.some(t => t.id === track.id)) {
        window.dispatchEvent(new CustomEvent('djconsole:notification', {
          detail: { 
            type: 'info', 
            message: 'Questa canzone è già nella playlist!' 
          }
        }))
        return
      }
      
      // Aggiungi la traccia alla playlist
      const updatedTracks = [...playlist.tracks, track]
      await localDatabase.updatePlaylist(activePlaylist, { tracks: updatedTracks.map(t => t.id) })
      
      // Aggiorna lo stato locale
      const updatedPlaylists = playlists.map(p => 
        p.id === activePlaylist ? { ...p, tracks: updatedTracks } : p
      )
      setPlaylists(updatedPlaylists)
      
      console.log('✅ Track added to selected playlist successfully')
      
      // Notifica successo
      window.dispatchEvent(new CustomEvent('djconsole:notification', {
        detail: { 
          type: 'success', 
          message: `"${track.title}" aggiunta alla playlist "${playlist.name}"` 
        }
      }))
      
      // Notifica la Console DJ dell'aggiornamento (senza loop)
      window.dispatchEvent(new CustomEvent('djconsole:library-playlist-updated', { 
        detail: { playlistId: activePlaylist, updatedTracks, updatedPlaylists } 
      }))
      
    } catch (error) {
      console.error('❌ Error adding track to selected playlist:', error)
      window.dispatchEvent(new CustomEvent('djconsole:notification', {
        detail: { 
          type: 'error', 
          message: 'Errore durante l\'aggiunta della canzone alla playlist' 
        }
      }))
    }
  }


  // ✅ DEBOUNCED SEARCH: Aspetta 300ms prima di cercare
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300) // 300ms di delay per evitare ricerche continue
    
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter and sort tracks
  useEffect(() => {
    let filtered = [...tracks]

    // Apply search filter (usa debouncedQuery invece di searchQuery)
    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase()
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        (track.album && track.album.toLowerCase().includes(query)) ||
        (track.genre && track.genre.toLowerCase().includes(query))
      )
    }

    // Apply advanced filters
    if (searchFilters.genre) {
      filtered = filtered.filter(track => track.genre === searchFilters.genre)
    }
    if (searchFilters.artist) {
      filtered = filtered.filter(track => track.artist === searchFilters.artist)
    }
    if (searchFilters.album) {
      filtered = filtered.filter(track => track.album === searchFilters.album)
    }
    if (searchFilters.minDuration > 0) {
      filtered = filtered.filter(track => track.duration >= searchFilters.minDuration)
    }
    if (searchFilters.maxDuration < 9999) {
      filtered = filtered.filter(track => track.duration <= searchFilters.maxDuration)
    }
    if (searchFilters.minRating > 0) {
      filtered = filtered.filter(track => (track.rating || 0) >= searchFilters.minRating)
    }
    if (searchFilters.maxRating < 5) {
      filtered = filtered.filter(track => (track.rating || 0) <= searchFilters.maxRating)
    }
    if (searchFilters.minPlayCount > 0) {
      filtered = filtered.filter(track => (track.playCount || 0) >= searchFilters.minPlayCount)
    }
    if (searchFilters.maxPlayCount < 9999) {
      filtered = filtered.filter(track => (track.playCount || 0) <= searchFilters.maxPlayCount)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'artist':
          aValue = a.artist.toLowerCase()
          bValue = b.artist.toLowerCase()
          break
        case 'duration':
          aValue = a.duration
          bValue = b.duration
          break
        case 'addedAt':
          aValue = new Date(a.addedAt || 0)
          bValue = new Date(b.addedAt || 0)
          break
        case 'playCount':
          aValue = a.playCount || 0
          bValue = b.playCount || 0
          break
        case 'rating':
          aValue = a.rating || 0
          bValue = b.rating || 0
          break
        default:
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    setFilteredTracks(filtered)
    // Reset alla prima pagina quando cambiano i filtri
    setCurrentPage(0)
  }, [tracks, debouncedQuery, searchFilters, sortBy, sortOrder])

  // ✅ PAGINAZIONE: Calcola i track da mostrare per la pagina corrente
  const paginatedTracks = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return filteredTracks.slice(start, end)
  }, [filteredTracks, currentPage, ITEMS_PER_PAGE])

  // ✅ PAGINAZIONE: Calcola il numero totale di pagine
  const totalPages = Math.ceil(filteredTracks.length / ITEMS_PER_PAGE)

  // ✅ VIRTUALIZZAZIONE: Decidi se usare virtualizzazione o paginazione
  const shouldUseVirtualization = filteredTracks.length > VIRTUALIZATION_THRESHOLD
  const effectiveUseVirtualization = useVirtualization && shouldUseVirtualization

  // ✅ OPTIMIZATION: Load tracks from database - Caricamento differito per avvio veloce
  useEffect(() => {
    const loadTracks = async () => {
      try {
        // ✅ FIX: Non aspettare l'inizializzazione - carica in background
        const initPromise = localDatabase.waitForInitialization()
        const allTracks = await localDatabase.getAllTracks().catch(() => [])
        
        // Completa l'inizializzazione in background
        initPromise.catch(() => {})
        // ✅ OPTIMIZATION: Waveform generation completamente differita per avvio veloce
        // Non rigenerare waveform all'avvio - solo quando necessario
        try { 
          (window as any).log?.info?.('Waveform generation deferred for faster startup') 
        } catch {}
        
        // Genera waveform solo per i primi 5 track per avvio veloce
        const tracksToProcess = allTracks.slice(0, 5)
        setTimeout(async () => {
          for (const t of tracksToProcess) {
            if ((!t.waveform || t.waveform.length === 0) && t.blobId) {
              try {
                const blob = await getBlob(t.blobId)
                if (blob) {
                  const peaks = await generateWaveformPeaksFromBlob(blob, 200)
                  if (peaks.length > 0) {
                    await localDatabase.updateTrack(t.id, { waveform: peaks })
                    t.waveform = peaks
                  }
                }
              } catch {}
            }
          }
        }, 1000) // Differito di 1 secondo
        setTracks(allTracks)
        setFilteredTracks(allTracks)
      } catch (error) {
        console.error('Failed to load tracks:', error)
      }
    }
    
    loadTracks()
    // Reload when DB updates (e.g., after upload, playlist changes)
    const onDbUpdated = (e: Event) => {
      loadTracks()
    }
    window.addEventListener('djconsole:db-updated', onDbUpdated as EventListener)

    // Reload when tab becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadTracks()
    }
    document.addEventListener('visibilitychange', onVisibility)
    
    return () => {
      window.removeEventListener('djconsole:db-updated', onDbUpdated as EventListener)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // NUOVO: Funzione per forzare il ripristino del database
  const forceDatabaseRestore = async () => {
    try {
      console.log('🔄 Forcing database restoration...')
      
      // Forza la reinizializzazione del database
      await localDatabase.waitForInitialization()
      
      // Ricarica tutte le tracce
      const allTracks = await localDatabase.getAllTracks()
      setTracks(allTracks)
      setFilteredTracks(allTracks)
      
      // Ricarica le playlist con tracce complete
      const allPlaylists = await localDatabase.getAllPlaylists()
      
      // RICOSTRUISCI COMPLETAMENTE le playlist con tracce complete
      const reconstructedPlaylists = await Promise.all(
        allPlaylists.map(async (playlist) => {
          try {
            // Per ogni playlist, ricostruisci le tracce complete
            const fullTracks = await Promise.all(
              playlist.tracks.map(async (trackId) => {
                try {
                  // Carica la traccia completa dal database
                  const fullTrack = await localDatabase.getTrack(trackId)
                  if (fullTrack) {
                    return fullTrack
                  } else {
                    console.warn(`⚠️ Track ${trackId} not found during restore, skipping`)
                    return null
                  }
                } catch (error) {
                  console.error(`❌ Error loading track ${trackId} during restore:`, error)
                  return null
                }
              })
            )
            
            // Filtra le tracce valide e ricostruisci la playlist
            const validTracks = fullTracks.filter(track => track !== null) as DatabaseTrack[]
            
            return {
              ...playlist,
              tracks: validTracks
            }
          } catch (error) {
            console.error(`❌ Error reconstructing playlist ${playlist.id} during restore:`, error)
            return { ...playlist, tracks: [] }
          }
        })
      )
      
      setPlaylists(reconstructedPlaylists)
      
      console.log('✅ Database restored successfully')
      
      // Sincronizzazione diretta senza eventi che causano loop
      
    } catch (error) {
      console.error('❌ Failed to restore database:', error)
    }
  }

  // SOLUZIONE ROCK-SOLID: Carica playlist dal database SENZA default
  useEffect(() => {
    const loadPlaylistsFromDatabase = async () => {
      try {
        console.log('🔄 Loading playlists from database...')
        
        // Carica playlist dal database locale
        const savedPlaylists = await localDatabase.getAllPlaylists()
        
        if (savedPlaylists && savedPlaylists.length > 0) {
          console.log('✅ Found saved playlists:', savedPlaylists.length)
          
          // RICOSTRUISCI COMPLETAMENTE le playlist con tracce complete
          const reconstructedPlaylists = await Promise.all(
            savedPlaylists.map(async (playlist) => {
              try {
                // Per ogni playlist, ricostruisci le tracce complete
                const fullTracks = await Promise.all(
                  playlist.tracks.map(async (trackId) => {
                    try {
                      // Carica la traccia completa dal database
                      const fullTrack = await localDatabase.getTrack(trackId)
                      if (fullTrack) {
                        return fullTrack
                      } else {
                        console.warn(`⚠️ Track ${trackId} not found, skipping`)
                        return null
                      }
                    } catch (error) {
                      console.error(`❌ Error loading track ${trackId}:`, error)
                      return null
                    }
                  })
                )
                
                // Filtra le tracce valide e ricostruisci la playlist
                const validTracks = fullTracks.filter(track => track !== null) as DatabaseTrack[]
                
                return {
                  ...playlist,
                  tracks: validTracks
                }
              } catch (error) {
                console.error(`❌ Error reconstructing playlist ${playlist.id}:`, error)
                return { ...playlist, tracks: [] }
              }
            })
          )
          
          console.log('✅ Playlists reconstructed with full tracks:', reconstructedPlaylists.length)
          setPlaylists(reconstructedPlaylists)
          
          if (reconstructedPlaylists.length > 0) {
            setActivePlaylist(reconstructedPlaylists[0].id)
          }
        } else {
          console.log('📝 No saved playlists found - starting with empty state')
          setPlaylists([])
          setActivePlaylist('')
        }
        
      } catch (error) {
        console.error('❌ Error loading playlists:', error)
        // In caso di errore, inizia con stato vuoto
        setPlaylists([])
        setActivePlaylist('')
      }
    }
    
    loadPlaylistsFromDatabase()
  }, [])

  // SOLUZIONE ROCK-SOLID: Salvataggio IMMEDIATO e affidabile
  const savePlaylistsToDatabase = useCallback(async (playlistsToSave: Playlist[] = playlists) => {
    try {
      console.log('💾 Saving playlists to database IMMEDIATELY:', playlistsToSave.length)
      
      // Salva ogni playlist nel database
      for (const playlist of playlistsToSave) {
        await localDatabase.updatePlaylist(playlist.id, { 
          tracks: playlist.tracks.map(t => t.id),
          name: playlist.name,
          createdAt: playlist.createdAt
        })
      }
      
      console.log('✅ Playlists saved successfully to database')
      
      // Salva anche nel localStorage come backup
      localStorage.setItem('djconsole_playlists_backup', JSON.stringify(playlistsToSave))
      console.log('💾 Backup saved to localStorage')
      
    } catch (error) {
      console.error('❌ Error saving playlists:', error)
      
      // Fallback: salva nel localStorage
      try {
        localStorage.setItem('djconsole_playlists_backup', JSON.stringify(playlistsToSave))
        console.log('💾 Fallback: saved to localStorage')
      } catch (localError) {
        console.error('❌ Even localStorage failed:', localError)
      }
    }
  }, [localDatabase])

  // RIMOSSO: Salvataggio automatico che causava loop infinito
  // Il salvataggio avviene solo quando necessario tramite le funzioni specifiche

  // SOLUZIONE ROCK-SOLID: Crea playlist e salva IMMEDIATAMENTE
  const createPlaylistRockSolid = async () => {
    try {
      // Salva il nome PRIMA di resettare lo stato
      const playlistName = newPlaylistName.trim() || 'Nuova Playlist'
      const wasNameEmpty = !newPlaylistName.trim()
      
      console.log('🎵 Creating playlist with name:', playlistName, 'wasEmpty:', wasNameEmpty)
      
      // Crea la playlist nel database PRIMA di aggiornare lo stato
      const playlistId = await localDatabase.createPlaylist({
        name: playlistName,
        tracks: []
      })
      
      console.log('✅ Playlist created in database with ID:', playlistId)
      
      // Crea l'oggetto playlist per lo stato locale
      const newPlaylist: Playlist = {
        id: playlistId,
        name: playlistName,
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        totalDuration: 0
      }
      
      // Aggiorna lo stato locale
      const updatedPlaylists = [...playlists, newPlaylist]
      setPlaylists(updatedPlaylists)
      setActivePlaylist(newPlaylist.id)
      setNewPlaylistName('')
      setIsCreatingPlaylist(false)
      
      // Se il nome era vuoto, avvia immediatamente la modifica
      if (wasNameEmpty) {
        setEditingPlaylist(newPlaylist.id)
        setEditName('')
      }
      
      // Notifica successo
      window.dispatchEvent(new CustomEvent('djconsole:notification', {
        detail: { 
          type: 'success', 
          message: `Playlist "${newPlaylist.name}" creata` 
        }
      }))
      
      // Notifica la Console DJ dell'aggiornamento (senza loop)
      window.dispatchEvent(new CustomEvent('djconsole:library-playlist-updated', { 
        detail: { playlistId: newPlaylist.id, updatedTracks: newPlaylist.tracks || [], updatedPlaylists } 
      }))
      
    } catch (error) {
      console.error('❌ Errore durante la creazione della playlist:', error)
      window.dispatchEvent(new CustomEvent('djconsole:notification', {
        detail: { 
          type: 'error', 
          message: 'Errore durante la creazione della playlist' 
        }
      }))
    }
  }


  // Rinomina playlist
  const renamePlaylist = async (playlistId: string) => {
    if (editName.trim()) {
      try {
        // Aggiorna nel database
        await localDatabase.updatePlaylist(playlistId, { name: editName.trim() })
        
        // Aggiorna lo stato locale
        const updatedPlaylists = playlists.map(p => 
          p.id === playlistId ? { ...p, name: editName.trim() } : p
        )
        setPlaylists(updatedPlaylists)
        setEditingPlaylist(null)
        setEditName('')
        
        console.log('✅ Playlist rinominata con successo')
        
        // Notifica successo
        window.dispatchEvent(new CustomEvent('djconsole:notification', {
          detail: { 
            type: 'success', 
            message: `Playlist rinominata in "${editName.trim()}"` 
          }
        }))
        
        // Notifica la Console DJ dell'aggiornamento (senza loop)
        const playlist = updatedPlaylists.find(p => p.id === playlistId)
        window.dispatchEvent(new CustomEvent('djconsole:library-playlist-updated', { 
          detail: { playlistId, updatedTracks: playlist?.tracks || [], updatedPlaylists } 
        }))
        
      } catch (error) {
        console.error('❌ Errore durante la rinominazione della playlist:', error)
        window.dispatchEvent(new CustomEvent('djconsole:notification', {
          detail: { 
            type: 'error', 
            message: 'Errore durante la rinominazione della playlist' 
          }
        }))
      }
    }
  }

  // Elimina playlist
  const deletePlaylist = async (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId)
    const playlistName = playlist?.name || 'Playlist'
    
    if (window.confirm(`Sei sicuro di voler eliminare la playlist "${playlistName}"?`)) {
      try {
        // Elimina dal database
        await localDatabase.deletePlaylist(playlistId)
        
        // Aggiorna lo stato locale
        const updatedPlaylists = playlists.filter(p => p.id !== playlistId)
        setPlaylists(updatedPlaylists)
        
        // Se era attiva, passa alla prima disponibile
        if (activePlaylist === playlistId) {
          if (updatedPlaylists.length > 0) {
            setActivePlaylist(updatedPlaylists[0].id)
          } else {
            setActivePlaylist('')
          }
        }
        
        console.log('✅ Playlist eliminata con successo')
        
        // Notifica successo
        window.dispatchEvent(new CustomEvent('djconsole:notification', {
          detail: { 
            type: 'success', 
            message: `Playlist "${playlistName}" eliminata` 
          }
        }))
        
        // Notifica la Console DJ dell'aggiornamento (senza loop)
        const playlist = updatedPlaylists.find(p => p.id === playlistId)
        window.dispatchEvent(new CustomEvent('djconsole:library-playlist-updated', { 
          detail: { playlistId, updatedTracks: playlist?.tracks || [], updatedPlaylists } 
        }))
        
      } catch (error) {
        console.error('❌ Errore durante l\'eliminazione della playlist:', error)
        window.dispatchEvent(new CustomEvent('djconsole:notification', {
          detail: { 
            type: 'error', 
            message: 'Errore durante l\'eliminazione della playlist' 
          }
        }))
      }
    }
  }


  const deleteTrack = async (trackId: string) => {
    // Conferma prima di eliminare
    if (!window.confirm('Sei sicuro di voler eliminare questa traccia? Verrà rimossa anche da tutte le playlist.')) {
      return
    }
    
    try {
      // Rimuovi la traccia dal database
      await localDatabase.deleteTrack(trackId)
      
      // Aggiorna lo stato locale
      setTracks(prev => prev.filter(t => t.id !== trackId))
      setFilteredTracks(prev => prev.filter(t => t.id !== trackId))
      if (selectedTrack === trackId) {
        setSelectedTrack(null)
      }
      
      // NUOVO: Sincronizza le playlist - rimuovi la traccia da tutte le playlist
      const updatedPlaylists = playlists.map(playlist => ({
        ...playlist,
        tracks: playlist.tracks.filter(track => track.id !== trackId)
      }))
      setPlaylists(updatedPlaylists)
      
      // Aggiorna anche il database delle playlist
      for (const playlist of playlists) {
        if (playlist.tracks.some(track => track.id === trackId)) {
          const updatedTracks = playlist.tracks.filter(track => track.id !== trackId)
          await localDatabase.updatePlaylist(playlist.id, { tracks: updatedTracks.map(t => t.id) })
        }
      }
      
      console.log('✅ Traccia eliminata e sincronizzata con tutte le playlist')
      
      // ✅ FIX: Ricarica le playlist per aggiornare l'interfaccia
      const reloadedPlaylists = await localDatabase.getAllPlaylists()
      if (reloadedPlaylists && reloadedPlaylists.length > 0) {
        const reconstructedPlaylists = await Promise.all(
          reloadedPlaylists.map(async (playlist) => {
            try {
              const fullTracks = await Promise.all(
                playlist.tracks.map(async (trackId) => {
                  try {
                    const fullTrack = await localDatabase.getTrack(trackId)
                    return fullTrack
                  } catch (error) {
                    console.error(`❌ Error loading track ${trackId}:`, error)
                    return null
                  }
                })
              )
              const validTracks = fullTracks.filter(track => track !== null) as DatabaseTrack[]
              return { ...playlist, tracks: validTracks }
            } catch (error) {
              console.error(`❌ Error reconstructing playlist ${playlist.id}:`, error)
              return { ...playlist, tracks: [] }
            }
          })
        )
        setPlaylists(reconstructedPlaylists)
        console.log('🔄 Playlists ricaricate dopo cancellazione:', reconstructedPlaylists.length)
      }
      
      // Sincronizzazione diretta senza eventi che causano loop
      
    } catch (error) {
      console.error('Errore durante l\'eliminazione della traccia:', error)
    }
  }

  const handleUpload = async (files: FileList) => {
    setIsUploading(true)
    setUploadProgress([])

    try {
      const uploadManager = new FileUploadManager()
      const results = await uploadManager.uploadFiles(files, (progress: any) => {
        setUploadProgress(prev => {
          const existing = prev.find(p => p.fileName === progress.fileName)
          if (existing) {
            return prev.map(p => p.fileName === progress.fileName ? progress : p)
          } else {
            return [...prev, progress]
          }
        })
      })

      console.log('Upload completato:', results)
      setShowUploadForm(false)
      
      // Reload tracks
      const allTracks = await localDatabase.getAllTracks()
      setTracks(allTracks)
      setFilteredTracks(allTracks)
      
      // Sincronizzazione diretta senza eventi che causano loop
    } catch (error) {
      console.error('Errore durante l\'upload:', error)
    } finally {
      setIsUploading(false)
      setUploadProgress([])
    }
  }

  const handleClearLibrary = async () => {
    if (window.confirm('⚠️ ATTENZIONE: Questa operazione eliminerà TUTTE le canzoni dalla libreria. Sei sicuro di voler continuare?')) {
      try {
        console.log('🗑️ [LIBRARY] Inizio pulizia libreria...')
        
        // Elimina tutte le tracce dal database
        const allTracks = await localDatabase.getAllTracks()
        for (const track of allTracks) {
          await localDatabase.deleteTrack(track.id)
        }
        
        // Pulisci lo stato locale
        setTracks([])
        setFilteredTracks([])
        setSelectedTrack(null)
        
        console.log('✅ [LIBRARY] Libreria pulita con successo')
        
        // Sincronizzazione diretta senza eventi che causano loop
      } catch (error) {
        console.error('❌ [LIBRARY] Errore durante la pulizia della libreria:', error)
        alert('Errore durante la pulizia della libreria. Controlla la console per i dettagli.')
      }
    }
  }

  // Rimosso perché non usato
  // const genres = tracks.map(track => track.genre).filter(Boolean)
  // const artists = tracks.map(track => track.artist).filter(Boolean)
  // const albums = tracks.map(track => track.album).filter(Boolean) as string[]

  const currentPlaylist = playlists.find(p => p.id === activePlaylist)

  // NUOVO: Sincronizzazione completa con la console DJ
  useEffect(() => {
    // Listener per aggiornamenti playlist dalla console DJ
    const handlePlaylistUpdatedFromConsole = (event: CustomEvent) => {
      const { playlistId, updatedTracks, updatedPlaylists } = event.detail
      console.log('🔄 Playlist updated from console - syncing library:', { playlistId, trackCount: updatedTracks?.length || 0 })
      
      // Aggiorna lo stato locale delle playlist
      if (updatedPlaylists && Array.isArray(updatedPlaylists)) {
        setPlaylists(updatedPlaylists)
      } else if (playlistId && updatedTracks && Array.isArray(updatedTracks)) {
        // Aggiorna solo la playlist specifica
        setPlaylists(prev => prev.map(p => 
          p.id === playlistId ? { ...p, tracks: updatedTracks } : p
        ))
      }
    }

    // RIMOSSO: Listener che causava loop infinito
    // La sincronizzazione avviene direttamente nelle funzioni specifiche

    // Listener per richieste di sincronizzazione dalla console
    const handleSyncRequestFromConsole = () => {
      console.log('🔄 Sync request from console - sending current playlist state')
      
      // Sincronizzazione diretta senza eventi che causano loop
    }

    window.addEventListener('djconsole:playlist-updated', handlePlaylistUpdatedFromConsole as EventListener)
    window.addEventListener('djconsole:request-playlists-sync', handleSyncRequestFromConsole as EventListener)
    
    return () => {
      window.removeEventListener('djconsole:playlist-updated', handlePlaylistUpdatedFromConsole as EventListener)
      window.removeEventListener('djconsole:request-playlists-sync', handleSyncRequestFromConsole as EventListener)
    }
  }, [])

  // RIMOSSO: Sincronizzazione automatica che causava loop infinito
  // La sincronizzazione avviene solo quando necessario tramite le funzioni specifiche




  // RIMOSSO: Sincronizzazione che causava loop infinito

  return (
    <div className="min-h-screen bg-dj-dark text-white p-4 md:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-dj font-bold text-white mb-2">🎵 Libreria & Playlist</h1>
          <p className="text-dj-light/60">Gestisci la tua libreria musicale e organizza le playlist - Vista Unificata</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="dj-button flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Carica File</span>
          </button>
          
          {/* NUOVO: Pulsante per ripristinare il database */}
          <button
            onClick={forceDatabaseRestore}
            className="dj-button-warning flex items-center space-x-2"
            title="Ripristina Database e Playlist"
          >
            <span>🔄</span>
            <span>Ripristina DB</span>
          </button>
          
          <button
            onClick={handleClearLibrary}
            className="dj-button-danger flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Pulisci Libreria</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation - RIMOSSO: Ripristino vista originale */}
      {/* <div className="flex items-center space-x-1 mb-6 bg-dj-primary rounded-lg p-1">
        <button
          onClick={() => setActiveTab('library')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'library'
              ? 'bg-dj-accent text-white shadow-lg'
              : 'bg-transparent text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
          }`}
        >
          <Library size={16} />
          <span>Libreria ({tracks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('playlists')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'playlists'
              ? 'bg-dj-accent text-white shadow-lg'
              : 'bg-transparent text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
          }`}
        >
          <Music size={16} />
          <span>Playlist ({playlists.length})</span>
        </button>
      </div> */}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-dj-secondary rounded-xl p-6 mb-6 border border-dj-accent/20">
          <h2 className="text-xl font-dj font-bold text-white mb-4">Carica File Musicali</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Carica File Singoli</h3>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*"
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
                className="dj-input w-full"
                aria-label="Seleziona file audio da caricare"
                title="Seleziona file audio da caricare"
              />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-3">Importa Cartella</h3>
              <FolderImporter onImportComplete={() => {}} />
            </div>
          </div>
          
          {isUploading && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-white mb-2">Progresso Upload:</h4>
              {uploadProgress.map((progress: any, index) => (
                <div key={index} className="text-sm text-dj-light/60">
                  {progress.fileName || 'File'}: {Math.round(progress.progress || 0)}%
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VISTA ORIGINALE: Libreria e Playlist insieme */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Libreria - Colonna sinistra */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dj-light/60" />
              <input
                type="text"
                placeholder="Cerca canzoni, artisti, album..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="dj-input w-full pl-10"
                aria-label="Cerca canzoni, artisti, album"
                title="Cerca canzoni, artisti, album"
              />
            </div>

            {/* Advanced Search */}
            <AdvancedSearch
              filters={searchFilters}
              onFiltersChange={setSearchFilters}
              availableGenres={[]}
              availableArtists={[]}
              availableAlbums={[]}
            />

            {/* Sort Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-dj-light/60">Ordina per:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="dj-select bg-dj-secondary border-dj-accent/30 text-white"
                  title="Seleziona criterio di ordinamento"
                >
                  <option value="title">Titolo</option>
                  <option value="artist">Artista</option>
                  <option value="duration">Durata</option>
                  <option value="addedAt">Data Aggiunta</option>
                  <option value="playCount">Conteggio Riproduzioni</option>
                  <option value="rating">Valutazione</option>
                </select>
              </div>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="dj-button-secondary"
              >
                {sortOrder === 'asc' ? '↑ Crescente' : '↓ Decrescente'}
              </button>
            </div>
          </div>

          {/* Tracks List */}
          <div className="bg-dj-secondary rounded-xl border border-dj-accent/20 overflow-hidden">
            <div className="p-4 border-b border-dj-accent/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-dj font-bold text-white">
                  Libreria ({filteredTracks.length} tracce)
                  {!effectiveUseVirtualization && totalPages > 1 && (
                    <span className="text-sm text-dj-light/60 ml-2">
                      - Pagina {currentPage + 1} di {totalPages}
                    </span>
                  )}
                  {effectiveUseVirtualization && (
                    <span className="text-sm text-dj-accent ml-2">
                      - Virtualizzato
                    </span>
                  )}
                </h3>
                
                {/* ✅ VIRTUALIZZAZIONE: Toggle per abilitare/disabilitare */}
                {shouldUseVirtualization && (
                  <button
                    onClick={() => setUseVirtualization(!useVirtualization)}
                    className={`px-3 py-1 rounded text-sm transition-all ${
                      useVirtualization
                        ? 'bg-dj-accent text-white'
                        : 'bg-dj-accent/20 text-dj-light/80 hover:bg-dj-accent/30'
                    }`}
                    title={useVirtualization ? 'Disabilita virtualizzazione' : 'Abilita virtualizzazione'}
                  >
                    {useVirtualization ? '📊 Virtualizzato' : '📄 Paginato'}
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto">
              {filteredTracks.length === 0 ? (
                <div className="text-center py-12 text-dj-light/60">
                  <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Nessuna traccia trovata</p>
                  <p className="text-sm">Prova a modificare i filtri di ricerca o carica nuovi file</p>
                </div>
              ) : effectiveUseVirtualization ? (
                // ✅ VIRTUALIZZAZIONE: Lista virtualizzata per performance massime
                <VirtualizedTrackList
                  tracks={filteredTracks}
                  selectedTrack={selectedTrack}
                  onTrackSelect={handleTrackSelect}
                  onTrackDelete={handleTrackDelete}
                  onTrackDoubleClick={handleTrackDoubleClick}
                  onTrackDragStart={handleTrackDragStart}
                  height={600}
                  itemHeight={80}
                  TrackItemComponent={TrackItem}
                />
              ) : (
                // ✅ PAGINAZIONE: Lista paginata per file < 100
                <>
                  <div className="divide-y divide-dj-accent/10">
                    {paginatedTracks.map((track) => (
                      <TrackItem
                        key={track.id}
                        track={track}
                        isSelected={selectedTrack === track.id}
                        onSelect={handleTrackSelect}
                        onDelete={handleTrackDelete}
                        onDoubleClick={handleTrackDoubleClick}
                        onDragStart={handleTrackDragStart}
                      />
                    ))}
                  </div>
                  
                  {/* ✅ PAGINAZIONE: Controlli di navigazione */}
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-dj-accent/20 bg-dj-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-dj-light/60">
                          Mostrando {currentPage * ITEMS_PER_PAGE + 1}-{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredTracks.length)} di {filteredTracks.length} tracce
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                            className="px-3 py-1 bg-dj-accent/20 hover:bg-dj-accent/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
                          >
                            ← Precedente
                          </button>
                          
                          <span className="px-3 py-1 text-sm text-dj-light/80">
                            {currentPage + 1} / {totalPages}
                          </span>
                          
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage >= totalPages - 1}
                            className="px-3 py-1 bg-dj-accent/20 hover:bg-dj-accent/30 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
                          >
                            Successiva →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

          {/* Playlist - Colonna destra */}
        <div className="lg:col-span-1 space-y-6">
          {/* Istruzioni per aggiungere canzoni */}
          <div className="bg-dj-accent/10 border border-dj-accent/30 rounded-lg p-4">
            <h3 className="text-lg font-dj font-bold text-white mb-2">📝 Come aggiungere canzoni</h3>
            <div className="text-sm text-dj-light/80 space-y-2">
              <p>• <strong>Drag & Drop:</strong> Trascina una canzone dalla libreria alla playlist</p>
              <p>• <strong>Doppio Click:</strong> Fai doppio click su una canzone per aggiungerla alla playlist selezionata</p>
              <p>• <strong>Seleziona playlist:</strong> Clicca su una playlist per selezionarla (evidenziata in verde)</p>
            </div>
          </div>

          {/* Gestione Playlist */}
          <div className="bg-dj-primary border border-dj-accent/30 rounded-lg">
            <div className="p-4 border-b border-dj-accent/20">
              <h3 className="text-lg font-dj font-bold text-white mb-2">Playlist</h3>
              <p className="text-sm text-dj-light/60">
                {playlists.length} playlist create
                {playlists.length === 0 && (
                  <span className="text-dj-warning ml-2">⚠️ Nessuna playlist trovata</span>
                )}
              </p>
            </div>
            
            <div className="p-4 space-y-2">
              {/* Lista Playlist */}
              {playlists.length === 0 ? (
                <div className="text-center py-8 text-dj-light/60">
                  <div className="w-16 h-16 mx-auto mb-4 opacity-50">🎵</div>
                  <p className="text-lg mb-2">Nessuna playlist creata</p>
                  <p className="text-sm">Crea una playlist per iniziare ad aggiungere canzoni</p>
                </div>
              ) : (
                playlists.map(playlist => (
                <div
                  key={playlist.id}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    activePlaylist === playlist.id
                      ? 'bg-dj-accent text-white shadow-lg'
                      : 'bg-dj-primary/50 text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
                  } ${
                    dragOverPlaylist === playlist.id
                      ? 'border-2 border-green-400 bg-green-400/20'
                      : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, playlist.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, playlist.id)}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      onClick={() => setActivePlaylist(playlist.id)}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <Music size={16} />
                        {editingPlaylist === playlist.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && renamePlaylist(playlist.id)}
                            onBlur={() => {
                              setEditingPlaylist(null)
                              setEditName('')
                            }}
                            className="bg-transparent border-none outline-none text-white placeholder-dj-light/40"
                            placeholder="Nuovo nome playlist"
                            title="Inserisci il nuovo nome della playlist"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{playlist.name}</span>
                        )}
                      </div>
                      <span className="text-xs bg-dj-accent/20 px-2 py-1 rounded-full">
                        {playlist.tracks ? playlist.tracks.filter(t => t && t.id).length : 0}
                      </span>
                    </div>
                    
                    {/* Pulsanti di azione */}
                    <div className="flex items-center space-x-1 ml-2">
                      {editingPlaylist === playlist.id ? (
                        <button
                          onClick={() => renamePlaylist(playlist.id)}
                          className="p-1 hover:bg-green-500/30 rounded"
                          title="Conferma"
                        >
                          <span className="text-green-400">✓</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingPlaylist(playlist.id)
                            setEditName(playlist.name)
                          }}
                          className="p-1 hover:bg-dj-accent/30 rounded"
                          title="Rinomina"
                        >
                          <Edit3 size={14} className="text-dj-light/60" />
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deletePlaylist(playlist.id)
                        }}
                        className="p-1 hover:bg-red-500/30 rounded"
                        title="Elimina playlist"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
                ))
              )}
              
              {/* Nuova Playlist */}
              {isCreatingPlaylist ? (
                <div className="flex items-center space-x-2 p-3 bg-dj-accent/20 rounded-lg">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Nome playlist..."
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-dj-light/40"
                    title="Inserisci il nome della nuova playlist"
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && createPlaylistRockSolid()}
                    onBlur={() => {
                      if (newPlaylistName.trim()) {
                        createPlaylistRockSolid()
                      } else {
                        setIsCreatingPlaylist(false)
                        setNewPlaylistName('')
                      }
                    }}
                  />
                                      <button
                      onClick={createPlaylistRockSolid}
                      className="p-1 hover:bg-dj-accent/30 rounded"
                      title="Crea playlist"
                    >
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingPlaylist(true)}
                  className="w-full flex items-center justify-center space-x-2 p-3 bg-dj-accent/20 text-dj-light/80 hover:bg-dj-accent/30 hover:text-white rounded-lg transition-all"
                >
                  <Plus size={16} />
                  <span>Nuova Playlist</span>
                </button>
              )}
            </div>
          </div>

          {/* Contenuto Playlist Attiva */}
          {currentPlaylist && (
            <div className="bg-dj-secondary rounded-xl p-4 border border-dj-accent/20">
              <div className="mb-4">
                <h4 className="text-lg font-dj font-bold text-white">{currentPlaylist.name}</h4>
                <p className="text-sm text-dj-light/60">
                  {currentPlaylist.tracks ? currentPlaylist.tracks.filter(t => t && t.id).length : 0} tracce
                </p>
              </div>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(!currentPlaylist.tracks || currentPlaylist.tracks.filter(t => t && t.id).length === 0) ? (
                  <div className="text-center py-8 text-dj-light/40">
                    <Music size={32} className="mx-auto mb-2" />
                    <p className="text-sm">Playlist vuota</p>
                  </div>
                ) : (
                  (currentPlaylist.tracks || [])
                    .filter(track => {
                      // FILTRO ULTRA-ROBUSTO: Verifica che track esista e abbia le proprietà necessarie
                      if (!track || typeof track !== 'object') {
                        console.warn('⚠️ Track is not a valid object:', track)
                        return false
                      }
                      if (!track.id) {
                        console.warn('⚠️ Track missing id:', track)
                        return false
                      }
                      if (!track.title) {
                        console.warn('⚠️ Track missing title:', track)
                        return false
                      }
                      return true
                    })
                    .map((track, index) => {
                      // PROTEZIONE AGGIUNTIVA: Verifica ancora una volta prima del render
                      if (!track || !track.title) {
                        console.error('❌ CRITICAL: Track passed filter but is invalid:', track)
                        return null
                      }
                      return (
                        <div
                          key={track.id}
                          className="flex items-center space-x-2 p-2 bg-dj-primary/20 rounded hover:bg-dj-primary/30"
                        >
                          <span className="text-xs text-dj-accent font-bold w-6">{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{track.title || 'Titolo sconosciuto'}</p>
                            <p className="text-xs text-dj-light/60 truncate">{track.artist || 'Artista sconosciuto'}</p>
                          </div>
                          <button
                            onClick={() => removeTrackFromPlaylist(track.id, currentPlaylist.id)}
                            className="p-1 hover:bg-red-500/30 rounded"
                            title="Rimuovi"
                          >
                            <X size={14} className="text-red-400" />
                          </button>
                        </div>
                      )
                    })
                    .filter(element => element !== null) // Rimuovi elementi null dal render
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LibraryManager
