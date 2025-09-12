import React, { useState, useEffect } from 'react'
import { Radio, Mic, MicOff, Play, Square, Settings, Wifi, WifiOff, Volume2 } from 'lucide-react'
import { StreamingManager, StreamMetadata } from '../audio/StreamingManager'
import { localDatabase } from '../database/LocalDatabase'
import { useAudio } from '../contexts/AudioContext'
import { useSettings } from '../contexts/SettingsContext'

interface StreamingControlProps {
  onStreamStart?: (streamUrl: string) => void
  onStreamStop?: () => void
  onMetadataUpdate?: (metadata: StreamMetadata) => void
}

const StreamingControl: React.FC<StreamingControlProps> = ({
  onStreamStart,
  onStreamStop,
  onMetadataUpdate
}) => {
  const [streamingManager] = useState(() => new StreamingManager())
  const { getMixedStream, audioState } = useAudio()
  const { settings } = useSettings()
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState('disconnected')
  const [streamStats, setStreamStats] = useState<any>(null)
  // Debug state
  const [debugLines, setDebugLines] = useState<string[]>([])
  const [metadata, setMetadata] = useState<StreamMetadata>({
    title: 'DJ Console Pro',
    artist: 'Live Stream',
    album: 'Live Session',
    genre: 'Electronic'
  })
  // ✅ Usa i settings invece di valori hardcoded
  const [format, setFormat] = useState<'mp3' | 'ogg' | 'aac' | 'opus'>(settings.streaming?.defaultFormat || 'opus')
  const [bitrate, setBitrate] = useState<number>(settings.streaming?.defaultBitrate || 128)
  const [sendMic, setSendMic] = useState(false)  // Disabilitato di default per evitare feedback
  const [lastMeta, setLastMeta] = useState<StreamMetadata | null>(null)

  // ✅ Sincronizza con i settings quando cambiano
  useEffect(() => {
    const newFormat = settings.streaming?.defaultFormat || 'opus'
    const newBitrate = settings.streaming?.defaultBitrate || 128
    console.log('🎛️ [STREAMING] Settings cambiati:', { format: newFormat, bitrate: newBitrate })
    setFormat(newFormat)
    setBitrate(newBitrate)
    
    // ✅ AGGIORNA IMMEDIATAMENTE il formato nel streamingManager
    ;(streamingManager as any)._desiredFormat = newFormat
    ;(streamingManager as any)._desiredBitrate = newBitrate
    console.log('🎛️ [STREAMING] StreamingManager aggiornato con formato:', newFormat, 'bitrate:', newBitrate)
  }, [settings.streaming?.defaultFormat, settings.streaming?.defaultBitrate])

  useEffect(() => {
    // Initialize server URL, credentials and streaming settings from Settings
    (async () => {
      try {
        await localDatabase.waitForInitialization()
        const s = await localDatabase.getSettings()
        // In Electron non esistono hostname/porta utili per il file://; default sensato: ws://127.0.0.1:8000
        const isElectron = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
        let defaultWs = `ws://127.0.0.1:8000`
        if (!isElectron) {
          defaultWs = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8000`
        }
        let wsUrl = (s.streaming.bridgeUrl && s.streaming.bridgeUrl.length > 0) ? s.streaming.bridgeUrl : defaultWs
        streamingManager.setServerUrl(wsUrl)
        streamingManager.setCredentials({
          host: s.streaming.icecast.host,
          port: s.streaming.icecast.port,
          username: s.streaming.icecast.username,
          password: s.streaming.icecast.password,
          mountpoint: s.streaming.icecast.mount,
          useSSL: !!s.streaming.icecast.useSSL
        })
        
        // Carica valori streaming dai settings
        setFormat(s.streaming.defaultFormat as any || 'opus')
        setBitrate(s.streaming.defaultBitrate || 128)
      } catch (e) {
        // ignore
      }
    })()

    // React to settings changes at runtime
    const onDbUpdated = async (evt: Event) => {
      try {
        const anyEvt: any = evt
        if (anyEvt?.detail?.kind && anyEvt.detail.kind !== 'settings') return
        await localDatabase.waitForInitialization()
        const s = await localDatabase.getSettings()
        const isElectron = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
        let defaultWs = `ws://127.0.0.1:8000`
        if (!isElectron) {
          defaultWs = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8000`
        }
        const wsUrl = (s.streaming.bridgeUrl && s.streaming.bridgeUrl.length > 0) ? s.streaming.bridgeUrl : defaultWs
        streamingManager.setServerUrl(wsUrl)
        
        // ✅ USA SERVER DI DEFAULT SELEZIONATO
        const defaultServer = await localDatabase.getDefaultIcecastServer()
        if (defaultServer) {
          streamingManager.setCredentials({
            host: defaultServer.host,
            port: defaultServer.port,
            username: defaultServer.username,
            password: defaultServer.password,
            mountpoint: defaultServer.mount,
            useSSL: !!defaultServer.useSSL
          })
          setDebugLines(prev => [
            `Settings reloaded: WS=${wsUrl} host=${defaultServer.host}:${defaultServer.port} mount=${defaultServer.mount} [${defaultServer.name}]`,
            ...prev
          ].slice(0, 20))
        } else {
          // Fallback ai settings legacy se non ci sono server configurati
          streamingManager.setCredentials({
            host: s.streaming.icecast?.host || 'localhost',
            port: s.streaming.icecast?.port || 5040,
            username: s.streaming.icecast?.username || 'source',
            password: s.streaming.icecast?.password || '',
            mountpoint: s.streaming.icecast?.mount || '/stream',
            useSSL: !!s.streaming.icecast?.useSSL
          })
          setDebugLines(prev => [
            `Settings reloaded: WS=${wsUrl} host=${s.streaming.icecast?.host || 'localhost'}:${s.streaming.icecast?.port || 5040} mount=${s.streaming.icecast?.mount || '/stream'} [LEGACY]`,
            ...prev
          ].slice(0, 20))
        }
      } catch {}
    }
    window.addEventListener('djconsole:db-updated', onDbUpdated as EventListener)
    
    // ✅ LISTENER PER CAMBI SERVER ICECAST
    const onServerUpdated = async () => {
      try {
        await localDatabase.waitForInitialization()
        const s = await localDatabase.getSettings()
        const defaultServer = await localDatabase.getDefaultIcecastServer()
        if (defaultServer) {
          streamingManager.setCredentials({
            host: defaultServer.host,
            port: defaultServer.port,
            username: defaultServer.username,
            password: defaultServer.password,
            mountpoint: defaultServer.mount,
            useSSL: !!defaultServer.useSSL
          })
          setDebugLines(prev => [
            `Server updated: ${defaultServer.name} (${defaultServer.host}:${defaultServer.port}${defaultServer.mount})`,
            ...prev
          ].slice(0, 20))
        }
      } catch (error) {
        console.error('Error updating server:', error)
      }
    }
    
    window.addEventListener('djconsole:db-updated', onServerUpdated as EventListener)

    // Set up callbacks
    streamingManager.setStatusCallback((status) => {
      setStreamStatus(status)
      setIsConnected(status === 'connected')
      setIsStreaming(status === 'streaming')
      
      // Emetti evento per sincronizzare con il bellissimo pulsante
      window.dispatchEvent(new CustomEvent('djconsole:streaming-status-changed', {
        detail: {
          status,
          isStreaming: status === 'streaming',
          error: null // Resetta errore quando cambia stato
        }
      }))
    })

    streamingManager.setStatsCallback((stats) => {
      setStreamStats(stats)
    })

    streamingManager.setDebugCallback((msg) => {
      setDebugLines(prev => [msg, ...prev].slice(0, 20))
      
      // Se il messaggio contiene "error" o "fail", aggiorna lo stato errore
      if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('fail')) {
        window.dispatchEvent(new CustomEvent('djconsole:streaming-status-changed', {
          detail: {
            status: streamStatus,
            isStreaming: isStreaming,
            error: msg
          }
        }))
      }
    })

    return () => {
      window.removeEventListener('djconsole:db-updated', onDbUpdated as EventListener)
      window.removeEventListener('djconsole:db-updated', onServerUpdated as EventListener)
      streamingManager.disconnect()
    }
  }, [streamingManager])

  const handleConnect = async () => {
    try {
      // Ensure latest settings at connect time
      try {
        await localDatabase.waitForInitialization()
        const s = await localDatabase.getSettings()
        const isElectron = !!((window as any).fileStore) || ((typeof navigator !== 'undefined' && (navigator.userAgent || '').includes('Electron')))
        let defaultWs = `ws://127.0.0.1:8000`
        if (!isElectron) {
          defaultWs = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8000`
        }
        const wsUrl = (s.streaming.bridgeUrl && s.streaming.bridgeUrl.length > 0) ? s.streaming.bridgeUrl : defaultWs
        streamingManager.setServerUrl(wsUrl)
        
        // ✅ USA SERVER DI DEFAULT SELEZIONATO ANCHE AL CONNECT
        const defaultServer = await localDatabase.getDefaultIcecastServer()
        if (defaultServer) {
          streamingManager.setCredentials({
            host: defaultServer.host,
            port: defaultServer.port,
            username: defaultServer.username,
            password: defaultServer.password,
            mountpoint: defaultServer.mount,
            useSSL: !!defaultServer.useSSL
          })
          console.log(`Connecting to server: ${defaultServer.name} (${defaultServer.host}:${defaultServer.port}${defaultServer.mount})`)
        } else {
          // Fallback ai settings legacy
          streamingManager.setCredentials({
            host: s.streaming.icecast?.host || 'localhost',
            port: s.streaming.icecast?.port || 5040,
            username: s.streaming.icecast?.username || 'source',
            password: s.streaming.icecast?.password || '',
            mountpoint: s.streaming.icecast?.mount || '/stream',
            useSSL: !!s.streaming.icecast?.useSSL
          })
          console.log(`Connecting to legacy server: ${s.streaming.icecast?.host || 'localhost'}:${s.streaming.icecast?.port || 5040}${s.streaming.icecast?.mount || '/stream'}`)
        }
      } catch {}
      const connected = await streamingManager.connect()
      if (connected) {
        console.log('Connected to streaming server')
        // Il callback gestirà l'evento automaticamente
      } else {
        // Emetti evento di errore connessione
        window.dispatchEvent(new CustomEvent('djconsole:streaming-status-changed', {
          detail: {
            status: 'disconnected',
            isStreaming: false,
            error: 'Failed to connect to streaming server'
          }
        }))
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  const handleDisconnect = () => {
    streamingManager.disconnect()
  }

  const handleStartStreaming = async () => {
    try {
      // Includi SEMPRE la catena microfono nello stream (gain a 0 se non attivo)
      const shouldIncludeMic = true
      const mixed = await getMixedStream(shouldIncludeMic)
      // Store desired format in credentials (used by main)
      console.log('🎛️ [STREAMING] Avvio streaming con formato:', format, 'bitrate:', bitrate)
      ;(streamingManager as any)._desiredFormat = format
      ;(streamingManager as any)._desiredBitrate = bitrate
      const ok = await streamingManager.startStreaming(mixed)
      if (!ok) {
        const errorMsg = 'Start failed: streamingManager.startStreaming returned false'
        setDebugLines(prev => [ errorMsg, ...prev ].slice(0, 20))
        
        // Emetti evento di errore
        window.dispatchEvent(new CustomEvent('djconsole:streaming-status-changed', {
          detail: {
            status: 'connected',
            isStreaming: false,
            error: errorMsg
          }
        }))
        return
      }
      setIsStreaming(true)
      onStreamStart?.(streamingManager.getStreamUrl())
      // Update metadata on server
      streamingManager.updateMetadata(metadata)
      setLastMeta(streamingManager.getLastMetadata())
    } catch (error) {
      console.error('Failed to start streaming:', error)
      const errorMsg = `Start error: ${error instanceof Error ? error.message : String(error)}`
      setDebugLines(prev => [ errorMsg, ...prev ].slice(0, 20))
      
      // Emetti evento di errore
      window.dispatchEvent(new CustomEvent('djconsole:streaming-status-changed', {
        detail: {
          status: 'connected',
          isStreaming: false,
          error: errorMsg
        }
      }))
    }
  }

  const handleStopStreaming = () => {
    streamingManager.stopStreaming()
    setIsStreaming(false)
    onStreamStop?.()
    
    // Emetti evento di stop
    window.dispatchEvent(new CustomEvent('djconsole:streaming-status-changed', {
      detail: {
        status: 'connected',
        isStreaming: false,
        error: null
      }
    }))
  }

  const handleMetadataChange = (field: keyof StreamMetadata, value: string) => {
    const newMetadata = { ...metadata, [field]: value }
    setMetadata(newMetadata)
    
    if (isStreaming) {
      streamingManager.updateMetadata(newMetadata)
      setLastMeta(streamingManager.getLastMetadata())
    }
    
    onMetadataUpdate?.(newMetadata)
  }

  return (
    <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Radio className="w-5 h-5 text-dj-highlight" />
          <h3 className="text-lg font-dj font-bold text-white">Live Streaming</h3>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            streamStatus === 'connected' ? 'bg-dj-success' :
            streamStatus === 'streaming' ? 'bg-dj-highlight' :
            streamStatus === 'error' ? 'bg-dj-error' : 'bg-dj-light/40'
          }`}></div>
          <span className="text-sm text-dj-light/60 capitalize">{streamStatus}</span>
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="text-xs text-dj-light/70 hover:text-white underline underline-offset-2"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="text-xs text-dj-light/70 hover:text-white underline underline-offset-2"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Connection Controls */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-1">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-dj-success" />
          ) : (
            <WifiOff className="w-4 h-4 text-dj-light/60" />
          )}
          <span className="text-sm text-dj-light">
            {isConnected ? 'Connected to Server' : 'Not Connected'}
          </span>
        </div>
        <div className="text-xs text-dj-light/60 mb-3">Server: {streamingManager.getServerUrl()}</div>
        
        <div className="flex space-x-2">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-dj-accent hover:bg-dj-highlight text-white rounded-lg transition-all duration-200 flex items-center space-x-2"
            >
              <Wifi className="w-4 h-4" />
              <span>Connect to Server</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-dj-secondary hover:bg-dj-accent text-dj-light rounded-lg transition-all duration-200 flex items-center space-x-2"
            >
              <WifiOff className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* Streaming Controls */}
      {isConnected && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <Radio className="w-4 h-4 text-dj-highlight" />
            <span className="text-sm text-dj-light">Stream Control</span>
          </div>
          
          <div className="flex space-x-2">
            <label className="flex items-center space-x-1 text-xs">
              <input type="checkbox" checked={sendMic} onChange={e => setSendMic(e.target.checked)} />
              <span>Send Mic</span>
            </label>
            <div className="flex items-center space-x-2 text-xs">
              <span>Format</span>
              <select 
                value={format} 
                onChange={e => setFormat(e.target.value as any)} 
                className="dj-input py-1 px-2"
                title="Select audio format"
                aria-label="Audio format selection"
              >
                <option value="opus">Opus (Ogg)</option>
                <option value="mp3">MP3</option>
                <option value="ogg">Vorbis (Ogg)</option>
                <option value="aac">AAC</option>
              </select>
              <span>Bitrate</span>
              <select 
                value={bitrate} 
                onChange={e => setBitrate(parseInt(e.target.value))} 
                className="dj-input py-1 px-2"
                title="Select bitrate"
                aria-label="Bitrate selection"
              >
                <option value={96}>96</option>
                <option value={128}>128</option>
                <option value={192}>192</option>
              </select>
            </div>
            {!isStreaming ? (
              <button
                onClick={handleStartStreaming}
                className="px-4 py-2 bg-dj-highlight hover:bg-dj-accent text-white rounded-lg transition-all duration-200 flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Start Streaming</span>
              </button>
            ) : (
              <button
                onClick={handleStopStreaming}
                className="px-4 py-2 bg-dj-error hover:bg-red-600 text-white rounded-lg transition-all duration-200 flex items-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop Streaming</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Metadata Editor */}
      {isConnected && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <Settings className="w-4 h-4 text-dj-accent" />
            <span className="text-sm text-dj-light">Stream Metadata</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Title</label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => handleMetadataChange('title', e.target.value)}
                className="w-full dj-input bg-dj-secondary border-dj-accent/30 text-sm"
                placeholder="Track title"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Artist</label>
              <input
                type="text"
                value={metadata.artist}
                onChange={(e) => handleMetadataChange('artist', e.target.value)}
                className="w-full dj-input bg-dj-secondary border-dj-accent/30 text-sm"
                placeholder="Artist name"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Album</label>
              <input
                type="text"
                value={metadata.album || ''}
                onChange={(e) => handleMetadataChange('album', e.target.value)}
                className="w-full dj-input bg-dj-secondary border-dj-accent/30 text-sm"
                placeholder="Album name"
              />
            </div>
            
            <div>
              <label className="block text-xs text-dj-light/60 mb-1">Genre</label>
              <input
                type="text"
                value={metadata.genre || ''}
                onChange={(e) => handleMetadataChange('genre', e.target.value)}
                className="w-full dj-input bg-dj-secondary border-dj-accent/30 text-sm"
                placeholder="Genre"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stream Stats */}
      {isStreaming && streamStats && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <Volume2 className="w-4 h-4 text-dj-accent" />
            <span className="text-sm text-dj-light">Stream Statistics</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-dj-light/60">Listeners:</span>
              <span className="text-white ml-2">{streamStats.listeners || 0}</span>
            </div>
            <div>
              <span className="text-dj-light/60">Bitrate:</span>
              <span className="text-white ml-2">{streamStats.bitrate || 128}kbps</span>
            </div>
            <div>
              <span className="text-dj-light/60">Uptime:</span>
              <span className="text-white ml-2">{Math.floor(streamStats.uptime / 60)}m</span>
            </div>
            <div>
              <span className="text-dj-light/60">Status:</span>
              <span className="text-dj-success ml-2">Live</span>
            </div>
          </div>
        </div>
      )}

      {/* Stream URL */}
      {isStreaming && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <Radio className="w-4 h-4 text-dj-highlight" />
            <span className="text-sm text-dj-light">Stream URL</span>
          </div>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={streamingManager.getPublicStreamUrl()}
              readOnly
              className="flex-1 dj-input bg-dj-secondary border-dj-accent/30 text-sm text-dj-light/60"
              title="Stream URL for listeners"
              aria-label="Public stream URL"
            />
            <button
              onClick={() => navigator.clipboard.writeText(streamingManager.getPublicStreamUrl())}
              className="px-3 py-2 bg-dj-secondary hover:bg-dj-accent text-dj-light rounded transition-all duration-200"
            >
              Copy
            </button>
          </div>
          
          <p className="text-xs text-dj-light/40 mt-2">
            Share this URL with your listeners to tune in to your live stream
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-dj-light/70">
            <div>
              <div className="text-dj-light/60">Last metadata sent</div>
              <div>Title: {lastMeta?.title || '-'}</div>
              <div>Artist: {lastMeta?.artist || '-'}</div>
            </div>
            <div>
              <div className="text-dj-light/60">HTTP base</div>
              <div>{streamingManager.getHttpBaseUrl()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Debug info removed for clean UI */}
      {/* Quick Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mic className="w-4 h-4 text-dj-accent" />
          <span className="text-xs text-dj-light/60">Microphone Active</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-dj-success rounded-full animate-pulse"></div>
          <span className="text-xs text-dj-light/60">Audio Mixing</span>
        </div>
      </div>
    </div>
  )
}

export default StreamingControl
