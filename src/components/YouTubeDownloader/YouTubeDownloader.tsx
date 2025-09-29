import React, { useState, useCallback, useEffect } from 'react'
import { useSettings } from '../../contexts/SettingsContext'

interface VideoInfo {
  title: string
  duration: string
  thumbnail: string
  uploader: string
  view_count: string
}

interface DownloadProgress {
  percentage: number
  speed: string
  eta: string
}

const YouTubeDownloader: React.FC = () => {
  const { settings, updateCategory } = useSettings()
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [quality, setQuality] = useState('192')
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [downloadedFile, setDownloadedFile] = useState<string | null>(null)
  const [downloads, setDownloads] = useState<Array<{
    id: string
    url: string
    title: string
    progress: number
    status: 'downloading' | 'completed' | 'error'
    error?: string
    filePath?: string
  }>>([])
  const [urls, setUrls] = useState<Array<{ id: string; url: string; quality: string }>>([
    { id: '1', url: '', quality: '192' }
  ])

  // Listener per progresso download e libreria
  useEffect(() => {
    const handleDownloadProgress = (event: any, data: any) => {
      const { downloadId, percentage, speed, eta } = data
      
      setDownloads(prev => prev.map(download => 
        download.id === downloadId 
          ? { ...download, progress: percentage }
          : download
      ))
      
      setDownloadProgress({
        percentage,
        speed: speed || 'N/A',
        eta: eta || 'N/A'
      })
    }

    const handleLibraryAdd = (event: any, track: any) => {
      console.log('📚 [YOUTUBE] Traccia aggiunta alla libreria:', track)
      setSuccess(prev => prev + ` - Aggiunta alla libreria!`)
    }

    if (window.electronAPI?.on) {
      window.electronAPI.on('youtube-download-progress', handleDownloadProgress)
      window.electronAPI.on('library-add-track', handleLibraryAdd)
    }

    return () => {
      if (window.electronAPI?.removeListener) {
        window.electronAPI.removeListener('youtube-download-progress', handleDownloadProgress)
        window.electronAPI.removeListener('library-add-track', handleLibraryAdd)
      }
    }
  }, [])

  // Validazione URL YouTube
  const isValidYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/
    ]
    return patterns.some(pattern => pattern.test(url))
  }

  // Ottieni informazioni video
  const getVideoInfo = useCallback(async () => {
    if (!url || !isValidYouTubeUrl(url)) {
      setError('Inserisci un URL YouTube valido')
      return
    }

    setIsLoading(true)
    setError('')
    setVideoInfo(null)

    try {
      console.log('🎵 [YOUTUBE] Recupero info per URL:', url)
      const response = await window.electronAPI.getYouTubeInfo(url)
      console.log('🎵 [YOUTUBE] Risposta info:', response)
      
      if (response.success) {
        setVideoInfo(response.data)
        console.log('✅ [YOUTUBE] Info video recuperate con successo')
      } else {
        const errorMsg = response.error || 'Errore nel recupero delle informazioni video'
        console.error('❌ [YOUTUBE] Errore recupero info:', errorMsg)
        setError(errorMsg)
      }
    } catch (err) {
      console.error('❌ [YOUTUBE] Errore connessione:', err)
      setError(`Errore di connessione: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`)
    } finally {
      setIsLoading(false)
    }
  }, [url])

  // Download diretto senza info video
  const startDirectDownload = useCallback(async (downloadUrl?: string, downloadQuality?: string) => {
    const targetUrl = downloadUrl || url
    const targetQuality = downloadQuality || quality
    
    if (!targetUrl || !isValidYouTubeUrl(targetUrl)) {
      setError('Inserisci un URL YouTube valido')
      return
    }

    const downloadId = Date.now().toString()
    const downloadPath = settings.youtube?.downloadPath || './downloads/youtube/'
    
    // Aggiungi alla lista download
    setDownloads(prev => [...prev, {
      id: downloadId,
      url: targetUrl,
      title: 'Download in corso...',
      progress: 0,
      status: 'downloading'
    }])

    try {
      console.log('🎵 [YOUTUBE] Avvio download:', { targetUrl, targetQuality, downloadPath, downloadId })
      
      const response = await window.electronAPI.downloadYouTubeAudio({
        url: targetUrl,
        quality: targetQuality,
        outputPath: downloadPath,
        downloadId
      })

      console.log('🎵 [YOUTUBE] Risposta download completa:', response)

      if (response.success) {
        console.log('✅ [YOUTUBE] Download completato con successo')
        console.log('🎵 [YOUTUBE] File path ricevuto:', response.filePath)
        console.log('🎵 [YOUTUBE] Titolo ricevuto:', response.title)
        setDownloads(prev => prev.map(download => 
          download.id === downloadId 
            ? { 
                ...download, 
                status: 'completed', 
                title: response.title || 'Download completato',
                filePath: response.filePath,
                progress: 100
              }
            : download
        ))
        
        // ✅ Aggiungi alla libreria locale
        if (response.filePath) {
          try {
            console.log('🎵 [YOUTUBE] Aggiunta traccia alla libreria:', {
              title: response.title,
              artist: response.artist,
              duration: response.duration,
              filePath: response.filePath,
              fileUrl: `file://${response.filePath}`
            })
            
            // Importa il database locale
            const { localDatabase } = await import('../../database/LocalDatabase')
            
            // Crea la traccia per il database
            const trackId = await localDatabase.addTrack({
              title: response.title || 'Unknown Title',
              artist: response.artist || 'Unknown Artist',
              duration: response.duration || 0,
              url: `file://${response.filePath}`, // Converti in file:// URL
              fileUrl: `file://${response.filePath}`,
              playCount: 0,
              rating: 0
            })
            
            console.log('✅ [YOUTUBE] Traccia aggiunta alla libreria con ID:', trackId)
            
            // Notifica l'aggiornamento della libreria
            window.dispatchEvent(new CustomEvent('djconsole:db-updated'))
            window.dispatchEvent(new CustomEvent('djconsole:library-updated'))
            window.dispatchEvent(new CustomEvent('djconsole:force-library-reload'))
            
            // Notifica successo
            window.dispatchEvent(new CustomEvent('djconsole:notification', {
              detail: { 
                type: 'success', 
                message: `"${response.title}" aggiunta alla libreria!` 
              }
            }))
            
          } catch (error) {
            console.error('❌ [YOUTUBE] Errore aggiunta alla libreria:', error)
            window.dispatchEvent(new CustomEvent('djconsole:notification', {
              detail: { 
                type: 'error', 
                message: `Errore aggiunta alla libreria: ${error.message}` 
              }
            }))
          }
        }
        
        // Notifica il file manager
        if (window.electronAPI?.invoke) {
          window.electronAPI.invoke('refresh-file-manager', response.filePath)
        }
      } else {
        const errorMsg = response.error || 'Errore durante il download'
        console.error('❌ [YOUTUBE] Errore download:', errorMsg)
        setDownloads(prev => prev.map(download => 
          download.id === downloadId 
            ? { 
                ...download, 
                status: 'error', 
                error: errorMsg
              }
            : download
        ))
      }
    } catch (err) {
      const errorMsg = `Errore di connessione durante il download: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`
      console.error('❌ [YOUTUBE] Errore connessione download:', err)
      setDownloads(prev => prev.map(download => 
        download.id === downloadId 
          ? { 
              ...download, 
              status: 'error', 
              error: errorMsg
            }
          : download
      ))
    }
  }, [url, quality, settings.youtube?.downloadPath])

  // Avvia download con info video
  const startDownload = useCallback(async () => {
    if (!videoInfo || !url) return

    const downloadId = Date.now().toString()
    const downloadPath = settings.youtube?.downloadPath || './downloads/youtube/'
    
    // Aggiungi alla lista download
    setDownloads(prev => [...prev, {
      id: downloadId,
      url,
      title: videoInfo.title,
      progress: 0,
      status: 'downloading'
    }])

    try {
      const response = await window.electronAPI.downloadYouTubeAudio({
        url,
        quality,
        outputPath: downloadPath,
        downloadId
      })

      if (response.success) {
        setDownloads(prev => prev.map(download => 
          download.id === downloadId 
            ? { 
                ...download, 
                status: 'completed', 
                filePath: response.filePath,
                progress: 100
              }
            : download
        ))
        
        // ✅ Aggiungi alla libreria locale
        if (response.filePath) {
          try {
            console.log('🎵 [YOUTUBE] Aggiunta traccia alla libreria:', {
              title: videoInfo.title,
              artist: videoInfo.uploader,
              duration: videoInfo.duration_seconds,
              filePath: response.filePath,
              fileUrl: `file://${response.filePath}`
            })
            
            // Importa il database locale
            const { localDatabase } = await import('../../database/LocalDatabase')
            
            // Crea la traccia per il database
            const trackId = await localDatabase.addTrack({
              title: videoInfo.title || 'Unknown Title',
              artist: videoInfo.uploader || 'Unknown Artist',
              duration: videoInfo.duration_seconds || 0,
              url: `file://${response.filePath}`, // Converti in file:// URL
              fileUrl: `file://${response.filePath}`,
              playCount: 0,
              rating: 0
            })
            
            console.log('✅ [YOUTUBE] Traccia aggiunta alla libreria con ID:', trackId)
            
            // Notifica l'aggiornamento della libreria
            window.dispatchEvent(new CustomEvent('djconsole:db-updated'))
            window.dispatchEvent(new CustomEvent('djconsole:library-updated'))
            window.dispatchEvent(new CustomEvent('djconsole:force-library-reload'))
            
            // Notifica successo
            window.dispatchEvent(new CustomEvent('djconsole:notification', {
              detail: { 
                type: 'success', 
                message: `"${videoInfo.title}" aggiunta alla libreria!` 
              }
            }))
            
          } catch (error) {
            console.error('❌ [YOUTUBE] Errore aggiunta alla libreria:', error)
            window.dispatchEvent(new CustomEvent('djconsole:notification', {
              detail: { 
                type: 'error', 
                message: `Errore aggiunta alla libreria: ${error.message}` 
              }
            }))
          }
        }
        
        // Notifica il file manager
        if (window.electronAPI?.invoke) {
          window.electronAPI.invoke('refresh-file-manager', response.filePath)
        }
        
        setVideoInfo(null)
        setUrl('')
      } else {
        setDownloads(prev => prev.map(download => 
          download.id === downloadId 
            ? { 
                ...download, 
                status: 'error', 
                error: response.error || 'Errore durante il download'
              }
            : download
        ))
      }
    } catch (err) {
      setDownloads(prev => prev.map(download => 
        download.id === downloadId 
          ? { 
              ...download, 
              status: 'error', 
              error: 'Errore di connessione durante il download'
            }
          : download
      ))
    }
  }, [videoInfo, url, quality, settings.youtube?.downloadPath])

  // Gestione URL multipli
  const addUrlField = () => {
    const newId = Date.now().toString()
    setUrls(prev => [...prev, { id: newId, url: '', quality: '192' }])
  }

  const removeUrlField = (id: string) => {
    if (urls.length > 1) {
      setUrls(prev => prev.filter(url => url.id !== id))
    }
  }

  const updateUrl = (id: string, field: 'url' | 'quality', value: string) => {
    setUrls(prev => prev.map(url => 
      url.id === id ? { ...url, [field]: value } : url
    ))
  }

  // Download tutti gli URL
  const downloadAll = async () => {
    const validUrls = urls.filter(u => u.url.trim() && isValidYouTubeUrl(u.url.trim()))
    
    if (validUrls.length === 0) {
      setError('Inserisci almeno un URL YouTube valido')
      return
    }

    setError('')
    setSuccess('')
    
    // Avvia download per ogni URL
    for (const urlData of validUrls) {
      await startDirectDownload(urlData.url.trim(), urlData.quality)
    }
  }

  // Formatta durata
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center">
            🎵 YouTube Audio Downloader
          </h1>
          <p className="text-gray-400">
            Scarica audio MP3 da YouTube e salvalo automaticamente nella cartella configurata
          </p>
        </div>

        {/* Input URL Singolo */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">🎵 Download Singolo</h3>
          <div className="flex gap-4 mb-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Incolla qui l'URL di YouTube..."
              className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              disabled={isLoading || isDownloading}
            />
            <button
              onClick={async () => {
                try {
                  const clipboardText = await navigator.clipboard.readText()
                  if (clipboardText && isValidYouTubeUrl(clipboardText)) {
                    setUrl(clipboardText)
                    setError('')
                  } else {
                    setError('Nessun URL YouTube valido negli appunti')
                  }
                } catch (err) {
                  setError('Impossibile accedere agli appunti. Incolla manualmente l\'URL.')
                }
              }}
              disabled={isLoading || isDownloading}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              title="Incolla URL dagli appunti"
            >
              📋 Incolla
            </button>
            <button
              onClick={getVideoInfo}
              disabled={!url || isLoading || isDownloading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Caricamento...' : 'Info Video'}
            </button>
            <button
              onClick={() => startDirectDownload()}
              disabled={!url || isLoading || isDownloading}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              Download Diretto
            </button>
          </div>

          {/* Qualità */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Qualità audio:</label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              disabled={isLoading || isDownloading}
              title="Seleziona qualità audio"
            >
              <option value="128">128 kbps (Standard)</option>
              <option value="192">192 kbps (Buona)</option>
              <option value="320">320 kbps (Alta)</option>
            </select>
          </div>
        </div>

        {/* Download Multipli */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">📥 Download Multipli</h3>
            <div className="flex gap-2">
              <button
                onClick={addUrlField}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                + Aggiungi URL
              </button>
              <button
                onClick={downloadAll}
                disabled={urls.every(u => !u.url.trim()) || isDownloading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                Download Tutti
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            {urls.map((urlData, index) => (
              <div key={urlData.id} className="flex gap-3 items-center">
                <div className="flex-1">
                  <input
                    type="url"
                    value={urlData.url}
                    onChange={(e) => updateUrl(urlData.id, 'url', e.target.value)}
                    placeholder={`URL ${index + 1} - Incolla qui l'URL di YouTube...`}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    disabled={isDownloading}
                  />
                </div>
                <button
                  onClick={async () => {
                    try {
                      const clipboardText = await navigator.clipboard.readText()
                      if (clipboardText && isValidYouTubeUrl(clipboardText)) {
                        updateUrl(urlData.id, 'url', clipboardText)
                        setError('')
                      } else {
                        setError('Nessun URL YouTube valido negli appunti')
                      }
                    } catch (err) {
                      setError('Impossibile accedere agli appunti. Incolla manualmente l\'URL.')
                    }
                  }}
                  disabled={isDownloading}
                  className="px-3 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Incolla URL dagli appunti"
                >
                  📋
                </button>
                <select
                  value={urlData.quality}
                  onChange={(e) => updateUrl(urlData.id, 'quality', e.target.value)}
                  className="px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  disabled={isDownloading}
                  title="Seleziona qualità audio"
                >
                  <option value="128">128k</option>
                  <option value="192">192k</option>
                  <option value="320">320k</option>
                </select>
                {urls.length > 1 && (
                  <button
                    onClick={() => removeUrlField(urlData.id)}
                    className="px-3 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    disabled={isDownloading}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Informazioni Video */}
        {videoInfo && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex gap-6">
              <img
                src={videoInfo.thumbnail}
                alt="Thumbnail"
                className="w-48 h-36 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{videoInfo.title}</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><span className="font-medium">Canale:</span> {videoInfo.uploader}</p>
                  <p><span className="font-medium">Durata:</span> {videoInfo.duration}</p>
                  <p><span className="font-medium">Visualizzazioni:</span> {videoInfo.view_count}</p>
                </div>
                <button
                  onClick={startDownload}
                  disabled={isDownloading}
                  className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {isDownloading ? 'Download in corso...' : 'Scarica Audio MP3'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista Download */}
        {downloads.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">📥 Download in Corso</h3>
            <div className="space-y-4">
              {downloads.map((download) => (
                <div key={download.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white truncate">{download.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs ${
                      download.status === 'completed' ? 'bg-green-600 text-white' :
                      download.status === 'error' ? 'bg-red-600 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {download.status === 'completed' ? 'Completato' :
                       download.status === 'error' ? 'Errore' :
                       'Downloading'}
                    </span>
                  </div>
                  
                  {download.status === 'downloading' && (
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progresso</span>
                        <span>{Math.round(download.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${download.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {download.status === 'error' && (
                    <p className="text-red-400 text-sm">{download.error}</p>
                  )}
                  
                  {download.status === 'completed' && download.filePath && (
                    <div className="flex items-center justify-between">
                      <p className="text-green-400 text-sm">✅ Download completato</p>
                      <button
                        onClick={() => {
                          if (window.electronAPI?.invoke) {
                            window.electronAPI.invoke('open-folder', download.filePath)
                          }
                        }}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                      >
                        Apri Cartella
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {downloads.length > 0 && (
              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => setDownloads([])}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
                >
                  Pulisci Lista
                </button>
                <span className="text-sm text-gray-400">
                  {downloads.filter(d => d.status === 'downloading').length} download attivi
                </span>
              </div>
            )}
          </div>
        )}

        {/* Messaggi */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <span className="text-red-400 mr-2">❌</span>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-green-400 mr-2">✅</span>
                {success}
              </div>
              {downloadedFile && (
                <button
                  onClick={() => {
                    if (window.electronAPI?.invoke) {
                      window.electronAPI.invoke('open-folder', downloadedFile)
                    }
                  }}
                  className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm transition-colors"
                >
                  Apri Cartella
                </button>
              )}
            </div>
          </div>
        )}

        {/* Configurazione Cartella */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">📁 Configurazione Cartella Download</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={settings.youtube?.downloadPath || './downloads/youtube/'}
              onChange={(e) => updateCategory('youtube', { 
                ...settings.youtube, 
                downloadPath: e.target.value 
              })}
              className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Percorso cartella download"
            />
            <button
              onClick={async () => {
                const result = await window.electronAPI.selectFolder('youtube')
                if (result.success) {
                  updateCategory('youtube', { 
                    ...settings.youtube, 
                    downloadPath: result.path 
                  })
                }
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              Sfoglia
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            I file audio verranno salvati automaticamente in questa cartella
          </p>
        </div>
      </div>
    </div>
  )
}

export default YouTubeDownloader
