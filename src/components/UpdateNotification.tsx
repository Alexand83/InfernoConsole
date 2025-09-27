import React, { useState, useEffect } from 'react'
import { Download, X, Settings, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface UpdateInfo {
  version: string
  size: string
  isDownloading: boolean
  isDownloaded: boolean
  isInstalling: boolean
  progress?: number
}

const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Listener per aggiornamenti disponibili
    const handleUpdateAvailable = (event: any, info: any) => {
      setUpdateInfo({
        version: info.version,
        size: info.size,
        isDownloading: false,
        isDownloaded: false,
        isInstalling: false
      })
      setIsVisible(true)
    }

    // Listener per progresso download
    const handleDownloadProgress = (event: any, progress: any) => {
      setUpdateInfo(prev => prev ? {
        ...prev,
        isDownloading: true,
        progress: progress.percent
      } : null)
    }

    // Listener per download completato
    const handleDownloadComplete = () => {
      setUpdateInfo(prev => prev ? {
        ...prev,
        isDownloading: false,
        isDownloaded: true,
        progress: 100
      } : null)
    }

    // Listener per installazione
    const handleInstalling = () => {
      setUpdateInfo(prev => prev ? {
        ...prev,
        isInstalling: true
      } : null)
    }

    if (window.autoUpdater) {
      window.autoUpdater.onUpdateAvailable(handleUpdateAvailable)
      window.autoUpdater.onDownloadProgress(handleDownloadProgress)
      window.autoUpdater.onDownloadComplete(handleDownloadComplete)
      window.autoUpdater.onInstallingUpdate(handleInstalling)
    }

    return () => {
      if (window.autoUpdater) {
        window.autoUpdater.removeUpdateAvailableListener(handleUpdateAvailable)
        window.autoUpdater.removeDownloadProgressListener(handleDownloadProgress)
        window.autoUpdater.removeDownloadCompleteListener(handleDownloadComplete)
        window.autoUpdater.removeInstallingUpdateListener(handleInstalling)
      }
    }
  }, [])

  const handleGoToSettings = () => {
    window.dispatchEvent(new CustomEvent('navigate-to-settings'))
    setIsVisible(false)
  }

  const handleGoToInfo = () => {
    window.dispatchEvent(new CustomEvent('navigate-to-settings', { detail: { tab: 'info' } }))
    setIsVisible(false)
  }

  const handleDismiss = () => {
    setIsVisible(false)
  }

  const handleDownload = async () => {
    if (window.autoUpdater) {
      try {
        await window.autoUpdater.downloadUpdate()
      } catch (error) {
        console.error('Errore nel download:', error)
      }
    }
  }

  const handleInstall = async () => {
    if (window.autoUpdater) {
      try {
        await window.autoUpdater.installUpdate()
      } catch (error) {
        console.error('Errore nell\'installazione:', error)
      }
    }
  }

  if (!isVisible || !updateInfo) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-dj-primary border border-dj-accent/30 rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {updateInfo.isInstalling ? (
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            ) : updateInfo.isDownloaded ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <Download className="w-5 h-5 text-blue-400" />
            )}
            <h3 className="text-white font-medium">
              {updateInfo.isInstalling ? 'Installazione in corso...' :
               updateInfo.isDownloaded ? 'Download completato!' :
               updateInfo.isDownloading ? 'Download in corso...' :
               'Aggiornamento disponibile'}
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-dj-light/60 hover:text-white transition-colors"
            title="Chiudi notifica"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-dj-light/80 mb-3">
          <p>Versione {updateInfo.version} ({updateInfo.size})</p>
          {updateInfo.isDownloading && updateInfo.progress !== undefined && (
            <div className="mt-2">
              <div className="w-full bg-dj-secondary/30 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${updateInfo.progress}%` }}
                />
              </div>
              <p className="text-xs mt-1">{Math.round(updateInfo.progress)}% completato</p>
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          {!updateInfo.isDownloading && !updateInfo.isDownloaded && !updateInfo.isInstalling && (
            <>
              <button
                onClick={handleGoToInfo}
                className="flex-1 bg-dj-accent hover:bg-dj-accent/80 text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center space-x-1"
              >
                <Info className="w-4 h-4" />
                <span>Info & Download</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center space-x-1"
              >
                <Download className="w-4 h-4" />
                <span>Scarica</span>
              </button>
            </>
          )}
          
          {updateInfo.isDownloaded && !updateInfo.isInstalling && (
            <button
              onClick={handleInstall}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center space-x-1"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Installa e Riavvia</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdateNotification
