import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { localDatabase, DatabaseTrack } from '../database/LocalDatabase'

interface Track extends DatabaseTrack {}
interface Playlist {
  id: string
  name: string
  description?: string
  tracks: Track[]
  isAutoPlaylist: boolean
  autoRules?: {
    genre?: string[]
    bpmRange?: { min: number; max: number }
    energy?: 'low' | 'medium' | 'high'
    maxDuration?: number
  }
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
  totalDuration: number
}

interface Library {
  tracks: Track[]
  playlists: Playlist[]
  genres: string[]
  artists: string[]
  albums: string[]
}

interface PlaylistState {
  library: Library
  currentPlaylist: Playlist | null
  currentTrack: Track | null
  searchQuery: string
  filterGenre: string
  filterArtist: string
  sortBy: 'title' | 'artist' | 'duration' | 'addedAt' | 'playCount' | 'rating'
  sortOrder: 'asc' | 'desc'
  isLoading: boolean
  error: string | null
}

type PlaylistAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_FILTER_GENRE'; payload: string }
  | { type: 'SET_FILTER_ARTIST'; payload: string }
  | { type: 'SET_SORT_BY'; payload: PlaylistState['sortBy'] }
  | { type: 'SET_SORT_ORDER'; payload: 'asc' | 'desc' }
  | { type: 'SET_CURRENT_PLAYLIST'; payload: Playlist | null }
  | { type: 'SET_CURRENT_TRACK'; payload: Track | null }
  | { type: 'ADD_TRACK'; payload: Track }
  | { type: 'REMOVE_TRACK'; payload: string }
  | { type: 'UPDATE_TRACK'; payload: Track }
  | { type: 'CREATE_PLAYLIST'; payload: Playlist }
  | { type: 'DELETE_PLAYLIST'; payload: string }
  | { type: 'UPDATE_PLAYLIST'; payload: Playlist }
  | { type: 'ADD_TRACK_TO_PLAYLIST'; payload: { playlistId: string; track: Track } }
  | { type: 'REMOVE_TRACK_FROM_PLAYLIST'; payload: { playlistId: string; trackId: string } }
  | { type: 'REORDER_PLAYLIST_TRACKS'; payload: { playlistId: string; trackIds: string[] } }
  | { type: 'LOAD_LIBRARY'; payload: Library }
  | { type: 'INCREMENT_PLAY_COUNT'; payload: string }

const initialState: PlaylistState = {
  library: {
    tracks: [],
    playlists: [],
    genres: [],
    artists: [],
    albums: [],
  },
  currentPlaylist: null,
  currentTrack: null,
  searchQuery: '',
  filterGenre: '',
  filterArtist: '',
  sortBy: 'title',
  sortOrder: 'asc',
  isLoading: false,
  error: null,
}

function playlistReducer(state: PlaylistState, action: PlaylistAction): PlaylistState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }
    case 'SET_FILTER_GENRE':
      return { ...state, filterGenre: action.payload }
    case 'SET_FILTER_ARTIST':
      return { ...state, filterArtist: action.payload }
    case 'SET_SORT_BY':
      return { ...state, sortBy: action.payload }
    case 'SET_SORT_ORDER':
      return { ...state, sortOrder: action.payload }
    case 'SET_CURRENT_PLAYLIST':
      return { ...state, currentPlaylist: action.payload }
    case 'SET_CURRENT_TRACK':
      return { ...state, currentTrack: action.payload }
    case 'ADD_TRACK':
      return {
        ...state,
        library: {
          ...state.library,
          tracks: [...state.library.tracks, action.payload],
          artists: state.library.artists.includes(action.payload.artist)
            ? state.library.artists
            : [...state.library.artists, action.payload.artist],
          genres: action.payload.genre && !state.library.genres.includes(action.payload.genre)
            ? [...state.library.genres, action.payload.genre]
            : state.library.genres,
          albums: action.payload.album && !state.library.albums.includes(action.payload.album)
            ? [...state.library.albums, action.payload.album]
            : state.library.albums,
        },
      }
    case 'REMOVE_TRACK':
      return {
        ...state,
        library: {
          ...state.library,
          tracks: state.library.tracks.filter(track => track.id !== action.payload),
          playlists: state.library.playlists.map(playlist => ({
            ...playlist,
            tracks: playlist.tracks.filter(track => track.id !== action.payload),
          })),
        },
      }
    case 'UPDATE_TRACK':
      return {
        ...state,
        library: {
          ...state.library,
          tracks: state.library.tracks.map(track =>
            track.id === action.payload.id ? action.payload : track
          ),
        },
      }
    case 'CREATE_PLAYLIST':
      return {
        ...state,
        library: {
          ...state.library,
          playlists: [...state.library.playlists, action.payload],
        },
      }
    case 'DELETE_PLAYLIST':
      return {
        ...state,
        library: {
          ...state.library,
          playlists: state.library.playlists.filter(playlist => playlist.id !== action.payload),
        },
        currentPlaylist: state.currentPlaylist?.id === action.payload ? null : state.currentPlaylist,
      }
    case 'UPDATE_PLAYLIST':
      return {
        ...state,
        library: {
          ...state.library,
          playlists: state.library.playlists.map(playlist =>
            playlist.id === action.payload.id ? action.payload : playlist
          ),
        },
        currentPlaylist: state.currentPlaylist?.id === action.payload.id
          ? action.payload
          : state.currentPlaylist,
      }
    case 'ADD_TRACK_TO_PLAYLIST':
      return {
        ...state,
        library: {
          ...state.library,
          playlists: state.library.playlists.map(playlist =>
            playlist.id === action.payload.playlistId
              ? {
                  ...playlist,
                  tracks: [...playlist.tracks, action.payload.track],
                  updatedAt: new Date(),
                }
              : playlist
          ),
        },
      }
    case 'REMOVE_TRACK_FROM_PLAYLIST':
      return {
        ...state,
        library: {
          ...state.library,
          playlists: state.library.playlists.map(playlist =>
            playlist.id === action.payload.playlistId
              ? {
                  ...playlist,
                  tracks: playlist.tracks.filter(track => track.id !== action.payload.trackId),
                  updatedAt: new Date(),
                }
              : playlist
          ),
        },
      }
    case 'REORDER_PLAYLIST_TRACKS':
      return {
        ...state,
        library: {
          ...state.library,
          playlists: state.library.playlists.map(playlist =>
            playlist.id === action.payload.playlistId
              ? {
                  ...playlist,
                  tracks: action.payload.trackIds.map(id =>
                    playlist.tracks.find(track => track.id === id)!
                  ),
                  updatedAt: new Date(),
                }
              : playlist
          ),
        },
      }
    case 'LOAD_LIBRARY':
      return {
        ...state,
        library: action.payload,
      }
    case 'INCREMENT_PLAY_COUNT':
      return {
        ...state,
        library: {
          ...state.library,
          tracks: state.library.tracks.map(track =>
            track.id === action.payload
              ? { ...track, playCount: track.playCount + 1 }
              : track
          ),
        },
      }
    default:
      return state
  }
}

interface PlaylistContextType {
  state: PlaylistState
  dispatch: React.Dispatch<PlaylistAction>
  getFilteredTracks: () => Track[]
  getFilteredPlaylists: () => Playlist[]
  createPlaylist: (name: string, description?: string) => void
  deletePlaylist: (id: string) => void
  updatePlaylist: (playlist: Playlist) => void
  reorderPlaylist: (playlistId: string, trackIds: string[]) => void
  addTrackToPlaylist: (playlistId: string, track: Track) => void
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void
  searchTracks: (query: string) => Track[]
  getTracksByGenre: (genre: string) => Track[]
  getTracksByArtist: (artist: string) => Track[]
  getPlaylistById: (id: string) => Playlist | undefined
  getTrackById: (id: string) => Track | undefined
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined)

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  // ✅ PERFORMANCE: Rimossi log di re-render per ridurre overhead CPU
  // Debug: Monitor re-render del context (DISABILITATO per performance)
  // const renderCount = useRef(0)
  // const lastRenderTime = useRef(Date.now())

  const [state, dispatch] = useReducer(playlistReducer, initialState)

  // Load data from database on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true })
        
        // Wait for database to initialize
        await localDatabase.waitForInitialization()
        
        // Load tracks and playlists from database
        const tracks = await localDatabase.getAllTracks()
        const playlists = await localDatabase.getAllPlaylists()
        
        // Convert database playlists to interface format
        const interfacePlaylists: Playlist[] = await Promise.all(
          playlists.map(async (dbPlaylist) => {
            const playlistTracks = await Promise.all(
              dbPlaylist.tracks.map(trackId => 
                localDatabase.getTrack(trackId)
              )
            )
            
            const validTracks = playlistTracks.filter(track => track !== null) as Track[]
            const totalDuration = validTracks.reduce((sum, track) => sum + track.duration, 0)
            
            return {
              ...dbPlaylist,
              tracks: validTracks,
              isPublic: true,
              totalDuration
            }
          })
        )
        
        // Extract unique values for filters
        const genres = [...new Set(tracks.map(track => track.genre).filter(Boolean))] as string[]
        const artists = [...new Set(tracks.map(track => track.artist).filter(Boolean))] as string[]
        const albums = [...new Set(tracks.map(track => track.album).filter(Boolean))] as string[]
        
        const library: Library = {
          tracks,
          playlists: interfacePlaylists,
          genres,
          artists,
          albums
        }
        
        dispatch({ type: 'LOAD_LIBRARY', payload: library })
      } catch (error) {
        console.error('Failed to load library:', error)
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load library' })
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }
    
    loadInitialData()

    // Ricarica i dati quando la pagina torna in focus (per sincronizzazione)
    const handleFocus = async () => {
      console.log('🔄 [PLAYLIST_CONTEXT] Page focused - reloading data for sync')
      try {
        // Ricarica solo le playlist per sincronizzazione
        const playlists = await localDatabase.getAllPlaylists()
        
        const interfacePlaylists: Playlist[] = await Promise.all(
          playlists.map(async (dbPlaylist) => {
            const playlistTracks = await Promise.all(
              dbPlaylist.tracks.map(trackId => 
                localDatabase.getTrack(trackId)
              )
            )
            
            const validTracks = playlistTracks.filter(track => track !== null) as Track[]
            const totalDuration = validTracks.reduce((sum, track) => sum + track.duration, 0)
            
            return {
              ...dbPlaylist,
              tracks: validTracks,
              isPublic: true,
              totalDuration
            }
          })
        )
        
        dispatch({
          type: 'LOAD_LIBRARY',
          payload: {
            ...state.library,
            playlists: interfacePlaylists
          }
        })
        
        console.log('✅ [PLAYLIST_CONTEXT] Data reloaded on focus:', { 
          playlists: interfacePlaylists.length 
        })
        
      } catch (error) {
        console.error('❌ [PLAYLIST_CONTEXT] Error reloading data on focus:', error)
      }
    }

    window.addEventListener('focus', handleFocus)

    // Listen for database updates
    const handleDbUpdate = async (event: Event) => {
      // Evita reload completo se è un aggiornamento minore di playlist
      const customEvent = event as CustomEvent
      const detail = customEvent.detail
      
      // Se l'aggiornamento riguarda solo le playlist e non i tracks, evita reload completo
      if (detail?.kind === 'playlists') {
        console.log('🔄 [PLAYLIST] Playlist updated, skipping full reload to avoid re-render loop')
        return
      }
      
      console.log('🔄 [PLAYLIST] Database updated, refreshing library...', detail)
      await loadInitialData()
    }

    // NUOVO: Listener per aggiornamenti playlist dalla Library (senza loop)
    const handleLibraryPlaylistUpdate = async (event: CustomEvent) => {
      const { playlistId, updatedTracks, updatedPlaylists } = event.detail
      console.log('🔄 [PLAYLIST_CONTEXT] Library playlist updated - syncing:', { playlistId, trackCount: updatedTracks?.length || 0 })
      
      try {
        // Se abbiamo le playlist complete, aggiorna direttamente
        if (updatedPlaylists && Array.isArray(updatedPlaylists)) {
          const interfacePlaylists: Playlist[] = await Promise.all(
            updatedPlaylists.map(async (dbPlaylist: any) => {
              // Se abbiamo tracce complete, usale direttamente
              if (dbPlaylist.tracks && Array.isArray(dbPlaylist.tracks) && dbPlaylist.tracks.length > 0 && dbPlaylist.tracks[0].title) {
                // Le tracce sono già complete, usale direttamente
                const validTracks = dbPlaylist.tracks.filter(track => track && track.title) as Track[]
                const totalDuration = validTracks.reduce((sum, track) => sum + track.duration, 0)
                
                return {
                  ...dbPlaylist,
                  tracks: validTracks,
                  isPublic: true,
                  totalDuration
                }
              } else {
                // Le tracce sono solo ID, ricostruiscile dal database
                const playlistTracks = await Promise.all(
                  dbPlaylist.tracks.map((trackId: string) => 
                    localDatabase.getTrack(trackId)
                  )
                )
                
                const validTracks = playlistTracks.filter(track => track !== null) as Track[]
                const totalDuration = validTracks.reduce((sum, track) => sum + track.duration, 0)
                
                return {
                  ...dbPlaylist,
                  tracks: validTracks,
                  isPublic: true,
                  totalDuration
                }
              }
            })
          )
          
          // Aggiorna solo le playlist senza ricaricare tutto
          dispatch({ 
            type: 'LOAD_LIBRARY', 
            payload: { 
              ...state.library, 
              playlists: interfacePlaylists 
            } 
          })
          
          console.log('✅ [PLAYLIST_CONTEXT] Playlists synced from library')
        }
      } catch (error) {
        console.error('❌ [PLAYLIST_CONTEXT] Error syncing playlists from library:', error)
        // Fallback: ricarica tutto
        await loadInitialData()
      }
    }

    // NUOVO: Listener per forzare refresh delle playlist
    const handleForcePlaylistRefresh = async (event: CustomEvent) => {
      const { updatedPlaylists } = event.detail
      console.log('🔄 [PLAYLIST_CONTEXT] Force playlist refresh requested:', { count: updatedPlaylists?.length })
      
      if (updatedPlaylists) {
        const interfacePlaylists: Playlist[] = await Promise.all(
          updatedPlaylists.map(async (dbPlaylist: any) => {
            const playlistTracks = await Promise.all(
              dbPlaylist.tracks.map((trackId: string) => 
                localDatabase.getTrack(trackId)
              )
            )
            
            const validTracks = playlistTracks.filter(track => track !== null) as Track[]
            const totalDuration = validTracks.reduce((sum, track) => sum + track.duration, 0)
            
            return {
              ...dbPlaylist,
              tracks: validTracks,
              isPublic: true,
              totalDuration
            }
          })
        )
        
        // Aggiorna solo le playlist
        dispatch({ 
          type: 'LOAD_LIBRARY', 
          payload: { 
            ...state.library, 
            playlists: interfacePlaylists 
          } 
        })
        
        console.log('✅ [PLAYLIST_CONTEXT] Playlists force refreshed')
      }
    }

    window.addEventListener('djconsole:db-updated', handleDbUpdate)
    window.addEventListener('djconsole:library-playlist-updated', handleLibraryPlaylistUpdate as unknown as EventListener)
    window.addEventListener('djconsole:force-playlist-refresh', handleForcePlaylistRefresh as unknown as EventListener)

    return () => {
      window.removeEventListener('djconsole:db-updated', handleDbUpdate)
      window.removeEventListener('djconsole:library-playlist-updated', handleLibraryPlaylistUpdate as unknown as EventListener)
      window.removeEventListener('djconsole:force-playlist-refresh', handleForcePlaylistRefresh as unknown as EventListener)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const getFilteredTracks = () => {
    let tracks = state.library.tracks

    // Apply search filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase()
      tracks = tracks.filter(
        track =>
          track.title.toLowerCase().includes(query) ||
          track.artist.toLowerCase().includes(query) ||
          track.album?.toLowerCase().includes(query) ||
          track.genre?.toLowerCase().includes(query)
      )
    }

    // Apply genre filter
    if (state.filterGenre) {
      tracks = tracks.filter(track => track.genre === state.filterGenre)
    }

    // Apply artist filter
    if (state.filterArtist) {
      tracks = tracks.filter(track => track.artist === state.filterArtist)
    }

    // Apply sorting
    tracks.sort((a, b) => {
      let aValue: any = a[state.sortBy]
      let bValue: any = b[state.sortBy]

      if (state.sortBy === 'addedAt') {
        aValue = aValue.getTime()
        bValue = bValue.getTime()
      }

      if (aValue < bValue) return state.sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return state.sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return tracks
  }

  const getFilteredPlaylists = () => {
    let playlists = state.library.playlists

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase()
      playlists = playlists.filter(
        playlist =>
          playlist.name.toLowerCase().includes(query) ||
          playlist.description?.toLowerCase().includes(query)
      )
    }

    return playlists
  }

  const createPlaylist = async (name: string, description?: string) => {
    try {
      const playlistId = await localDatabase.createPlaylist({
        name,
        description,
        tracks: [],
        isAutoPlaylist: false
      })
      
      const newPlaylist: Playlist = {
        id: playlistId,
        name,
        description,
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        totalDuration: 0,
        isAutoPlaylist: false
      }
      
      dispatch({ type: 'CREATE_PLAYLIST', payload: newPlaylist })
    } catch (error) {
      console.error('Failed to create playlist:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create playlist' })
    }
  }

  const addTrackToPlaylist = async (playlistId: string, track: Track) => {
    try {
      await localDatabase.addTrackToPlaylist(playlistId, track.id)
      dispatch({ type: 'ADD_TRACK_TO_PLAYLIST', payload: { playlistId, track } })
    } catch (error) {
      console.error('Failed to add track to playlist:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to add track to playlist' })
    }
  }

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    try {
      await localDatabase.removeTrackFromPlaylist(playlistId, trackId)
      dispatch({ type: 'REMOVE_TRACK_FROM_PLAYLIST', payload: { playlistId, trackId } })
    } catch (error) {
      console.error('Failed to remove track from playlist:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove track from playlist' })
    }
  }

  const deletePlaylist = async (id: string) => {
    try {
      await localDatabase.deletePlaylist(id)
      dispatch({ type: 'DELETE_PLAYLIST', payload: id })
    } catch (error) {
      console.error('Failed to delete playlist:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete playlist' })
    }
  }

  const updatePlaylist = async (playlist: Playlist) => {
    try {
      // Persist minimal fields to DB; convert tracks to IDs
      await localDatabase.updatePlaylist(playlist.id, {
        name: playlist.name,
        description: playlist.description,
        tracks: playlist.tracks.map(t => t.id),
      })
      dispatch({ type: 'UPDATE_PLAYLIST', payload: playlist })
    } catch (error) {
      console.error('Failed to update playlist:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update playlist' })
    }
  }

  const reorderPlaylist = async (playlistId: string, trackIds: string[]) => {
    try {
      await localDatabase.reorderPlaylist(playlistId, trackIds)
      dispatch({ type: 'REORDER_PLAYLIST_TRACKS', payload: { playlistId, trackIds } })
    } catch (error) {
      console.error('Failed to reorder playlist:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to reorder playlist' })
    }
  }

  const searchTracks = (query: string) => {
    return state.library.tracks.filter(
      track =>
        track.title.toLowerCase().includes(query.toLowerCase()) ||
        track.artist.toLowerCase().includes(query.toLowerCase())
    )
  }

  const getTracksByGenre = (genre: string) => {
    return state.library.tracks.filter(track => track.genre === genre)
  }

  const getTracksByArtist = (artist: string) => {
    return state.library.tracks.filter(track => track.artist === artist)
  }

  const getPlaylistById = (id: string) => {
    return state.library.playlists.find(playlist => playlist.id === id)
  }

  const getTrackById = (id: string) => {
    return state.library.tracks.find(track => track.id === id)
  }

  const value: PlaylistContextType = {
    state,
    dispatch,
    getFilteredTracks,
    getFilteredPlaylists,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    reorderPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    searchTracks,
    getTracksByGenre,
    getTracksByArtist,
    getPlaylistById,
    getTrackById,
  }

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>
}

export function usePlaylist() {
  const context = useContext(PlaylistContext)
  if (context === undefined) {
    throw new Error('usePlaylist must be used within a PlaylistProvider')
  }
  return context
}
