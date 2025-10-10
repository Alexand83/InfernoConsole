import React, { createContext, useContext, useReducer, useEffect } from 'react'

interface DownloadItem {
  id: string
  url: string
  title: string
  progress: number
  status: 'downloading' | 'completed' | 'error'
  error?: string
  filePath?: string
  quality: string
  startTime: Date
  endTime?: Date
}

interface YouTubeDownloaderState {
  downloads: DownloadItem[]
  isDownloading: boolean
  totalDownloads: number
  completedDownloads: number
  failedDownloads: number
  lastActivity: Date | null
}

type YouTubeDownloaderAction =
  | { type: 'ADD_DOWNLOAD'; payload: Omit<DownloadItem, 'id' | 'startTime'> }
  | { type: 'ADD_DOWNLOAD_WITH_ID'; payload: DownloadItem }
  | { type: 'UPDATE_DOWNLOAD'; payload: { id: string; updates: Partial<DownloadItem> } }
  | { type: 'REMOVE_DOWNLOAD'; payload: string }
  | { type: 'CLEAR_DOWNLOADS' }
  | { type: 'SET_DOWNLOADING'; payload: boolean }
  | { type: 'UPDATE_PROGRESS'; payload: { id: string; progress: number } }
  | { type: 'COMPLETE_DOWNLOAD'; payload: { id: string; filePath: string } }
  | { type: 'FAIL_DOWNLOAD'; payload: { id: string; error: string } }

const initialState: YouTubeDownloaderState = {
  downloads: [],
  isDownloading: false,
  totalDownloads: 0,
  completedDownloads: 0,
  failedDownloads: 0,
  lastActivity: null
}

function youtubeDownloaderReducer(state: YouTubeDownloaderState, action: YouTubeDownloaderAction): YouTubeDownloaderState {
  switch (action.type) {
    case 'ADD_DOWNLOAD':
      const newDownload: DownloadItem = {
        ...action.payload,
        id: Date.now().toString(),
        startTime: new Date()
      }
      return {
        ...state,
        downloads: [...state.downloads, newDownload],
        totalDownloads: state.totalDownloads + 1,
        lastActivity: new Date()
      }

    case 'ADD_DOWNLOAD_WITH_ID':
      return {
        ...state,
        downloads: [...state.downloads, action.payload],
        totalDownloads: state.totalDownloads + 1,
        lastActivity: new Date()
      }

    case 'UPDATE_DOWNLOAD':
      return {
        ...state,
        downloads: state.downloads.map(download =>
          download.id === action.payload.id
            ? { ...download, ...action.payload.updates }
            : download
        ),
        lastActivity: new Date()
      }

    case 'REMOVE_DOWNLOAD':
      return {
        ...state,
        downloads: state.downloads.filter(download => download.id !== action.payload),
        lastActivity: new Date()
      }

    case 'CLEAR_DOWNLOADS':
      return {
        ...state,
        downloads: [],
        totalDownloads: 0,
        completedDownloads: 0,
        failedDownloads: 0,
        lastActivity: new Date()
      }

    case 'SET_DOWNLOADING':
      return {
        ...state,
        isDownloading: action.payload,
        lastActivity: new Date()
      }

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        downloads: state.downloads.map(download =>
          download.id === action.payload.id
            ? { ...download, progress: action.payload.progress }
            : download
        ),
        lastActivity: new Date()
      }

    case 'COMPLETE_DOWNLOAD':
      return {
        ...state,
        downloads: state.downloads.map(download =>
          download.id === action.payload.id
            ? { 
                ...download, 
                status: 'completed', 
                progress: 100, 
                filePath: action.payload.filePath,
                endTime: new Date()
              }
            : download
        ),
        completedDownloads: state.completedDownloads + 1,
        lastActivity: new Date()
      }

    case 'FAIL_DOWNLOAD':
      return {
        ...state,
        downloads: state.downloads.map(download =>
          download.id === action.payload.id
            ? { 
                ...download, 
                status: 'error', 
                error: action.payload.error,
                endTime: new Date()
              }
            : download
        ),
        failedDownloads: state.failedDownloads + 1,
        lastActivity: new Date()
      }

    default:
      return state
  }
}

interface YouTubeDownloaderContextType {
  state: YouTubeDownloaderState
  addDownload: (download: Omit<DownloadItem, 'id' | 'startTime'>) => void
  addDownloadWithId: (download: DownloadItem) => void
  updateDownload: (id: string, updates: Partial<DownloadItem>) => void
  removeDownload: (id: string) => void
  clearDownloads: () => void
  setDownloading: (isDownloading: boolean) => void
  updateProgress: (id: string, progress: number) => void
  completeDownload: (id: string, filePath: string) => void
  failDownload: (id: string, error: string) => void
  getActiveDownloads: () => DownloadItem[]
  getCompletedDownloads: () => DownloadItem[]
  getFailedDownloads: () => DownloadItem[]
}

const YouTubeDownloaderContext = createContext<YouTubeDownloaderContextType | undefined>(undefined)

export function YouTubeDownloaderProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(youtubeDownloaderReducer, initialState)

  // Carica stato salvato all'avvio
  useEffect(() => {
    const savedState = localStorage.getItem('youtube-downloader-state')
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState)
        // Ripristina solo i download non completati
        const activeDownloads = parsedState.downloads?.filter((d: DownloadItem) => 
          d.status === 'downloading' || d.status === 'error'
        ) || []
        
        if (activeDownloads.length > 0) {
          dispatch({ type: 'CLEAR_DOWNLOADS' })
          activeDownloads.forEach((download: DownloadItem) => {
            dispatch({ type: 'ADD_DOWNLOAD', payload: download })
          })
        }
      } catch (error) {
        console.error('Errore caricamento stato YouTube Downloader:', error)
      }
    }
  }, [])

  // Salva stato quando cambia
  useEffect(() => {
    localStorage.setItem('youtube-downloader-state', JSON.stringify(state))
  }, [state])

  // Listener per eventi di download dal main process
  useEffect(() => {
    const handleDownloadProgress = (event: any, data: any) => {
      console.log('🔄 [CONTEXT] Ricevuto progresso download:', data)
      const { downloadId, percentage } = data
      dispatch({ type: 'UPDATE_PROGRESS', payload: { id: downloadId, progress: percentage } })
    }

    const handleDownloadComplete = (event: any, data: any) => {
      console.log('✅ [CONTEXT] Download completato:', data)
      const { downloadId, filePath, title } = data
      dispatch({ type: 'COMPLETE_DOWNLOAD', payload: { id: downloadId, filePath } })
      
      // Notifica completamento
      window.dispatchEvent(new CustomEvent('djconsole:notification', {
        detail: { 
          type: 'success', 
          message: `Download completato: ${title || 'File'}` 
        }
      }))
    }

    const handleDownloadError = (event: any, data: any) => {
      console.log('❌ [CONTEXT] Download fallito:', data)
      const { downloadId, error } = data
      dispatch({ type: 'FAIL_DOWNLOAD', payload: { id: downloadId, error } })
      
      // Notifica errore
      window.dispatchEvent(new CustomEvent('djconsole:notification', {
        detail: { 
          type: 'error', 
          message: `Download fallito: ${error}` 
        }
      }))
    }

    // Listener per eventi esistenti
    const handleExistingProgress = (event: any, data: any) => {
      console.log('🔄 [CONTEXT] Evento progresso esistente:', data)
      const { downloadId, percentage } = data
      dispatch({ type: 'UPDATE_PROGRESS', payload: { id: downloadId, progress: percentage } })
    }

    if (window.electronAPI?.on) {
      window.electronAPI.on('youtube-download-progress', handleDownloadProgress)
      window.electronAPI.on('youtube-download-complete', handleDownloadComplete)
      window.electronAPI.on('youtube-download-error', handleDownloadError)
      window.electronAPI.on('youtube-download-progress', handleExistingProgress)
    }

    return () => {
      if (window.electronAPI?.removeListener) {
        window.electronAPI.removeListener('youtube-download-progress', handleDownloadProgress)
        window.electronAPI.removeListener('youtube-download-complete', handleDownloadComplete)
        window.electronAPI.removeListener('youtube-download-error', handleDownloadError)
        window.electronAPI.removeListener('youtube-download-progress', handleExistingProgress)
      }
    }
  }, [])

  const addDownload = (download: Omit<DownloadItem, 'id' | 'startTime'>) => {
    dispatch({ type: 'ADD_DOWNLOAD', payload: download })
  }

  const addDownloadWithId = (download: DownloadItem) => {
    dispatch({ type: 'ADD_DOWNLOAD_WITH_ID', payload: download })
  }

  const updateDownload = (id: string, updates: Partial<DownloadItem>) => {
    dispatch({ type: 'UPDATE_DOWNLOAD', payload: { id, updates } })
  }

  const removeDownload = (id: string) => {
    dispatch({ type: 'REMOVE_DOWNLOAD', payload: id })
  }

  const clearDownloads = () => {
    dispatch({ type: 'CLEAR_DOWNLOADS' })
  }

  const setDownloading = (isDownloading: boolean) => {
    dispatch({ type: 'SET_DOWNLOADING', payload: isDownloading })
  }

  const updateProgress = (id: string, progress: number) => {
    dispatch({ type: 'UPDATE_PROGRESS', payload: { id, progress } })
  }

  const completeDownload = (id: string, filePath: string) => {
    dispatch({ type: 'COMPLETE_DOWNLOAD', payload: { id, filePath } })
  }

  const failDownload = (id: string, error: string) => {
    dispatch({ type: 'FAIL_DOWNLOAD', payload: { id, error } })
  }

  const getActiveDownloads = () => {
    return state.downloads.filter(download => download.status === 'downloading')
  }

  const getCompletedDownloads = () => {
    return state.downloads.filter(download => download.status === 'completed')
  }

  const getFailedDownloads = () => {
    return state.downloads.filter(download => download.status === 'error')
  }

  const value: YouTubeDownloaderContextType = {
    state,
    addDownload,
    addDownloadWithId,
    updateDownload,
    removeDownload,
    clearDownloads,
    setDownloading,
    updateProgress,
    completeDownload,
    failDownload,
    getActiveDownloads,
    getCompletedDownloads,
    getFailedDownloads
  }

  return (
    <YouTubeDownloaderContext.Provider value={value}>
      {children}
    </YouTubeDownloaderContext.Provider>
  )
}

export function useYouTubeDownloader() {
  const context = useContext(YouTubeDownloaderContext)
  if (context === undefined) {
    throw new Error('useYouTubeDownloader must be used within a YouTubeDownloaderProvider')
  }
  return context
}
