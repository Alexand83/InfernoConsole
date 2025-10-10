import React, { useState } from 'react'
import { Download, CheckCircle, AlertCircle, Clock, X, Eye } from 'lucide-react'
import { useYouTubeDownloader } from '../../contexts/YouTubeDownloaderContext'

const BackgroundDownloadIndicator: React.FC = () => {
  const { getActiveDownloads, getCompletedDownloads, getFailedDownloads, removeDownload, clearDownloads } = useYouTubeDownloader()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  const activeDownloads = getActiveDownloads()
  const completedDownloads = getCompletedDownloads()
  const failedDownloads = getFailedDownloads()
  
  const totalActive = activeDownloads.length
  const totalCompleted = completedDownloads.length
  const totalFailed = failedDownloads.length

  // Mostra di nuovo l'indicatore se ci sono download attivi, anche se era stato chiuso
  React.useEffect(() => {
    if (totalActive > 0) {
      setIsVisible(true)
    }
  }, [totalActive])

  // Non mostrare l'indicatore se non ci sono download o se è stato chiuso
  if ((totalActive === 0 && totalCompleted === 0 && totalFailed === 0) || !isVisible) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
      {/* Indicatore compatto */}
      <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:bg-gray-700 transition-colors rounded-lg flex-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="relative">
              <Download className="text-blue-400" size={20} />
              {totalActive > 0 && (
                <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {totalActive}
                </div>
              )}
            </div>
            <div>
              <div className="text-white font-medium text-sm">
                YouTube Downloads
              </div>
              <div className="text-gray-400 text-xs">
                {totalActive > 0 && `${totalActive} attivi`}
                {totalCompleted > 0 && ` • ${totalCompleted} completati`}
                {totalFailed > 0 && ` • ${totalFailed} falliti`}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {totalActive > 0 && (
              <Clock className="text-blue-400 animate-spin" size={16} />
            )}
            <Eye 
              size={16} 
              className="text-gray-400 cursor-pointer hover:text-gray-300 transition-colors"
              onClick={() => setIsExpanded(!isExpanded)}
            />
            <X 
              size={16} 
              className="text-gray-400 cursor-pointer hover:text-red-400 transition-colors"
              onClick={() => setIsVisible(false)}
            />
          </div>
        </div>

        {/* Contenuto espanso */}
        {isExpanded && (
          <div className="border-t border-gray-600 p-3 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {/* Download attivi */}
              {activeDownloads.map((download) => (
                <div key={download.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium text-sm truncate flex-1">
                      {download.title}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <Clock className="text-blue-400 animate-spin" size={16} />
                      <X 
                        size={14} 
                        className="text-gray-400 cursor-pointer hover:text-red-400 transition-colors"
                        onClick={() => {
                          if (window.confirm('Stoppare questo download?')) {
                            removeDownload(download.id)
                            // TODO: Implementare stop download nel main process
                          }
                        }}
                        title="Stoppa download"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 bg-gray-600 rounded-full h-2 mr-3">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${download.progress}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs">{download.progress}%</span>
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {download.quality}k • {download.url}
                  </div>
                </div>
              ))}

              {/* Download completati */}
              {showCompleted && completedDownloads.slice(-5).map((download) => (
                <div key={download.id} className="bg-green-900 border border-green-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-green-200 font-medium text-sm truncate flex-1">
                      {download.title}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="text-green-400" size={16} />
                      <X 
                        size={14} 
                        className="text-gray-400 cursor-pointer hover:text-red-400 transition-colors"
                        onClick={() => removeDownload(download.id)}
                      />
                    </div>
                  </div>
                  <div className="text-green-300 text-xs">
                    Completato • {download.quality}k
                  </div>
                </div>
              ))}

              {/* Download falliti */}
              {failedDownloads.slice(-3).map((download) => (
                <div key={download.id} className="bg-red-900 border border-red-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-red-200 font-medium text-sm truncate flex-1">
                      {download.title}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="text-red-400" size={16} />
                      <X 
                        size={14} 
                        className="text-gray-400 cursor-pointer hover:text-red-400 transition-colors"
                        onClick={() => removeDownload(download.id)}
                      />
                    </div>
                  </div>
                  <div className="text-red-300 text-xs">
                    {download.error}
                  </div>
                </div>
              ))}

              {/* Controlli */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                  >
                    {showCompleted ? 'Nascondi' : 'Mostra'} completati
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="text-gray-400 hover:text-gray-300 text-xs font-medium"
                  >
                    Minimizza
                  </button>
                  {(totalCompleted > 0 || totalFailed > 0) && (
                    <button
                      onClick={() => {
                        if (window.confirm('Cancellare tutti i download completati e falliti?')) {
                          clearDownloads()
                        }
                      }}
                      className="text-red-400 hover:text-red-300 text-xs font-medium"
                    >
                      Cancella tutti
                    </button>
                  )}
                </div>
                <div className="text-gray-400 text-xs">
                  {totalActive + totalCompleted + totalFailed} totali
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BackgroundDownloadIndicator
