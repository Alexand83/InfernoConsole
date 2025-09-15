import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Terminal, Radio, Bell, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: Date
  category: 'streaming' | 'audio' | 'app'
}

interface StreamingDebugPanelProps {
  isVisible: boolean
  onClose: () => void
  streamStatus: string
  isStreaming: boolean
  streamError: string | null
  debugMessages: string[]
}

const StreamingDebugPanel: React.FC<StreamingDebugPanelProps> = ({
  isVisible,
  onClose,
  streamStatus,
  isStreaming,
  streamError,
  debugMessages
}) => {
  const [activeTab, setActiveTab] = useState<'debug' | 'streaming' | 'audio' | 'app'>('debug')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [maxNotifications] = useState(100)

  useEffect(() => {
    // Esponi la funzione globalmente per aggiungere notifiche
    ;(window as any).addStreamingNotification = (
      type: 'success' | 'error' | 'info' | 'warning',
      title: string,
      message: string,
      category: 'streaming' | 'audio' | 'app' = 'streaming'
    ) => {
      const newNotification: Notification = {
        id: Date.now().toString(),
        type,
        title,
        message,
        timestamp: new Date(),
        category
      }

      setNotifications(prev => {
        const updated = [newNotification, ...prev]
        return updated.slice(0, maxNotifications)
      })
    }

    return () => {
      delete (window as any).addStreamingNotification
    }
  }, [maxNotifications])

  // ✅ FIX: Imposta automaticamente il tab 'debug' quando il pannello si apre
  useEffect(() => {
    if (isVisible && debugMessages.length > 0) {
      setActiveTab('debug')
    }
  }, [isVisible, debugMessages.length])


  const getStatusColor = useCallback(() => {
    if (isStreaming) return 'text-blue-400'
    if (streamStatus === 'connected') return 'text-green-400'
    if (streamStatus === 'connecting') return 'text-yellow-400'
    if (streamError) return 'text-red-400'
    return 'text-gray-400'
  }, [isStreaming, streamStatus, streamError])

  const getStatusIcon = useCallback(() => {
    if (isStreaming) return '🔵'
    if (streamStatus === 'connected') return '🟢'
    if (streamStatus === 'connecting') return '🟡'
    if (streamError) return '🔴'
    return '⚫'
  }, [isStreaming, streamStatus, streamError])

  const getIcon = useCallback((type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />
      case 'info':
        return <Info className="w-3 h-3 text-blue-500" />
      default:
        return <Info className="w-3 h-3 text-gray-500" />
    }
  }, [])

  const getTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500 bg-green-900/20'
      case 'error':
        return 'border-l-red-500 bg-red-900/20'
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-900/20'
      case 'info':
        return 'border-l-blue-500 bg-blue-900/20'
      default:
        return 'border-l-gray-500 bg-gray-900/20'
    }
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const filteredNotifications = useMemo(() => 
    notifications.filter(n => n.category === activeTab), 
    [notifications, activeTab]
  )

  const getTabCount = useCallback((category: 'streaming' | 'audio' | 'app') => {
    return notifications.filter(n => n.category === category).length
  }, [notifications])

  return (
    <div className={`fixed bottom-4 right-4 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden ${!isVisible ? 'hidden' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Notifiche & Debug</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          title="Chiudi notifiche"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status */}
      <div className="p-3 bg-gray-850 border-b border-gray-700">
        <div className="flex items-center space-x-2 mb-2">
          <Radio className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Status:</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusIcon()} {streamStatus.toUpperCase()}
            {isStreaming && ' (LIVE)'}
          </span>
        </div>
        
        {streamError && (
          <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
            <div className="text-xs text-red-400 font-mono break-words">
              ❌ {streamError}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('debug')}
          className={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'debug'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          🐛 DEBUG
        </button>
        <button
          onClick={() => setActiveTab('streaming')}
          className={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'streaming'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          📡 STREAMING ({getTabCount('streaming')})
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'audio'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          🎵 AUDIO ({getTabCount('audio')})
        </button>
        <button
          onClick={() => setActiveTab('app')}
          className={`flex-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'app'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          ⚙️ APP ({getTabCount('app')})
        </button>
      </div>

      {/* Content */}
      <div className="h-48 overflow-y-auto bg-black">
        {activeTab === 'debug' && (
          <div className="p-3">
            <div className="text-xs text-gray-500 mb-2">
              Debug Log (ultimi {debugMessages.length} messaggi):
            </div>
            
            {debugMessages.length === 0 ? (
              <div className="text-xs text-gray-600 italic">
                Nessun messaggio di debug ancora...
              </div>
            ) : (
              <div className="space-y-1">
                {debugMessages.map((msg, index) => {
                  const getMessageColor = (message: string) => {
                    if (message.includes('error') || message.includes('fail') || message.includes('Error') || message.includes('Failed')) {
                      return 'text-red-400'
                    }
                    if (message.includes('connected') || message.includes('success') || message.includes('started')) {
                      return 'text-green-400'
                    }
                    if (message.includes('connecting') || message.includes('starting')) {
                      return 'text-yellow-400'
                    }
                    return 'text-gray-300'
                  }
                  
                  return (
                    <div 
                      key={index}
                      className={`text-xs font-mono break-words ${getMessageColor(msg)}`}
                    >
                      {msg}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'streaming' || activeTab === 'audio' || activeTab === 'app') && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">
                Notifiche {activeTab === 'streaming' ? 'Streaming' : activeTab === 'audio' ? 'Audio' : 'App'}:
              </div>
              <button
                onClick={clearNotifications}
                className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800"
              >
                Pulisci
              </button>
            </div>
            
            {filteredNotifications.length === 0 ? (
              <div className="text-xs text-gray-600 italic">
                Nessuna notifica in questa categoria...
              </div>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-2 rounded border-l-2 ${getTypeColor(notification.type)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2 flex-1 min-w-0">
                        {getIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-200 mb-1">
                            {notification.title}
                          </div>
                          <div className="text-xs text-gray-300 break-words">
                            {notification.message}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {notification.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800"
                        title="Rimuovi notifica"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-gray-800 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          💡 Questo pannello si apre automaticamente in caso di errori
        </div>
      </div>
    </div>
  )
}

export default React.memo(StreamingDebugPanel)
