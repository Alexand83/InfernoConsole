import { useState, useCallback } from 'react'

export interface VideoInfo {
  title: string
  duration: string
  thumbnail: string
  uploader: string
  view_count: string
  duration_seconds: number
}

export interface DownloadProgress {
  percentage: number
  speed: string
  eta: string
  downloaded_bytes: number
  total_bytes: number
}

export interface DownloadResult {
  success: boolean
  filePath?: string
  error?: string
}

export const useYouTubeDownload = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Ottieni informazioni video
  const getVideoInfo = useCallback(async (url: string): Promise<VideoInfo | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await window.electronAPI.getYouTubeInfo(url)
      if (response.success) {
        return response.data
      } else {
        setError(response.error || 'Errore nel recupero delle informazioni video')
        return null
      }
    } catch (err) {
      setError('Errore di connessione')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Avvia download
  const downloadAudio = useCallback(async (
    url: string, 
    quality: string, 
    outputPath: string
  ): Promise<DownloadResult> => {
    setIsDownloading(true)
    setError(null)
    setProgress(null)

    try {
      const response = await window.electronAPI.downloadYouTubeAudio({
        url,
        quality,
        outputPath
      })

      if (response.success) {
        return {
          success: true,
          filePath: response.filePath
        }
      } else {
        setError(response.error || 'Errore durante il download')
        return {
          success: false,
          error: response.error || 'Errore durante il download'
        }
      }
    } catch (err) {
      const errorMsg = 'Errore di connessione durante il download'
      setError(errorMsg)
      return {
        success: false,
        error: errorMsg
      }
    } finally {
      setIsDownloading(false)
      setProgress(null)
    }
  }, [])

  // Cancella errori
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Reset stato
  const reset = useCallback(() => {
    setIsLoading(false)
    setIsDownloading(false)
    setProgress(null)
    setError(null)
  }, [])

  return {
    isLoading,
    isDownloading,
    progress,
    error,
    getVideoInfo,
    downloadAudio,
    clearError,
    reset
  }
}
