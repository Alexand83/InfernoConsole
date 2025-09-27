import React, { useState, useEffect, useRef } from 'react'
import { Radio, Mic, MicOff, Play, Square, Settings, Wifi, WifiOff, Volume2 } from 'lucide-react'
import ContinuousStreamingManager, { StreamConfig } from '../audio/ContinuousStreamingManager'
import { localDatabase } from '../database/LocalDatabase'
import { useAudio } from '../contexts/AudioContext'
import { useSettings } from '../contexts/SettingsContext'

interface ContinuousStreamingControlProps {
  onStreamStart?: (streamUrl: string) => void
  onStreamStop?: () => void
  onMetadataUpdate?: (metadata: any) => void
}

const ContinuousStreamingControl: React.FC<ContinuousStreamingControlProps> = ({
  onStreamStart,
  onStreamStop,
  onMetadataUpdate
}) => {
  const [streamingManager] = useState(() => new ContinuousStreamingManager())
  const { getMixedStream, audioState } = useAudio()
  const { settings } = useSettings()
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState('disconnected')
  const [debugLines, setDebugLines] = useState<string[]>([])
  const [metadata, setMetadata] = useState({
    title: 'Inferno Console - LIVE',
    artist: 'Continuous Stream',
    album: 'Live Session',
    genre: 'Electronic'
  })
  
  // ✅ Configurazione streaming da settings
  const [format, setFormat] = useState<'opus' | 'mp3'>(settings.streaming?.defaultFormat || 'opus')
  const [bitrate, setBitrate] = useState<number>(settings.streaming?.defaultBitrate || 128)
  const [sendMic, setSendMic] = useState(false)

  // ✅ Sincronizza con i settings quando cambiano
  useEffect(() => {
    const newFormat = settings.streaming?.defaultFormat || 'opus'
    const newBitrate = settings.streaming?.defaultBitrate || 128
    console.log('🎛️ [CONTINUOUS STREAMING] Settings cambiati:', { format: newFormat, bitrate: newBitrate })
    setFormat(newFormat as 'opus' | 'mp3')
    setBitrate(newBitrate)
  }, [settings.streaming?.defaultFormat, settings.streaming?.defaultBitrate])
  
  // Ref per gestire l'audio stream
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    // Inizializza il manager con i callback
    streamingManager.setCallbacks({
      onStatusChange: (status) => {
        setIsConnected(status.isConnected)
        setIsStreaming(status.isStreaming)
        setStreamStatus(status.isStreaming ? 'streaming' : status.isConnected ? 'connected' : 'disconnected')
        
        if (status.lastError) {
          addDebugLine(`❌ Errore: ${status.lastError}`)
        }
      },
      onError: (error) => {
        addDebugLine(`❌ Errore: ${error}`)
      },
      onDebug: (message) => {
        addDebugLine(`🔍 ${message}`)
      }
    })

    // Carica configurazione server di default
    loadDefaultServerConfig()
  }, [])

  const loadDefaultServerConfig = async () => {
    try {
      await localDatabase.waitForInitialization()
      const defaultServer = await localDatabase.getDefaultIcecastServer()
      if (defaultServer) {
        addDebugLine(`📡 Server di default: ${defaultServer.name} (${defaultServer.host}:${defaultServer.port})`)
      }
    } catch (error) {
      addDebugLine(`❌ Errore caricamento server: ${error}`)
    }
  }

  const addDebugLine = (line: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugLines(prev => [...prev.slice(-9), `[${timestamp}] ${line}`])
  }

  const handleConnect = async () => {
    try {
      addDebugLine('🔌 Connessione in corso...')
      
      // Ottieni configurazione server
      const defaultServer = await localDatabase.getDefaultIcecastServer()
      if (!defaultServer) {
        addDebugLine('❌ Nessun server configurato')
        return
      }

      // Configura streaming
      const config: StreamConfig = {
        host: defaultServer.host,
        port: defaultServer.port,
        username: defaultServer.username,
        password: defaultServer.password,
        mountpoint: defaultServer.mountpoint,
        useSSL: defaultServer.useSSL,
        bitrate: bitrate,
        format: format
      }

      addDebugLine(`📡 Configurazione: ${config.host}:${config.port}${config.mountpoint}`)
      addDebugLine(`🎵 Formato: ${config.format} @ ${config.bitrate}kbps`)

      // Avvia streaming continuo
      const success = await streamingManager.startStreaming(config)
      
      if (success) {
        addDebugLine('✅ Streaming continuo avviato!')
        onStreamStart?.(`${config.host}:${config.port}${config.mountpoint}`)
      } else {
        addDebugLine('❌ Errore avvio streaming')
      }
      
    } catch (error) {
      addDebugLine(`❌ Errore connessione: ${error}`)
    }
  }

  const handleDisconnect = async () => {
    try {
      addDebugLine('🛑 Arresto streaming...')
      await streamingManager.stopStreaming()
      addDebugLine('✅ Streaming arrestato')
      onStreamStop?.()
    } catch (error) {
      addDebugLine(`❌ Errore arresto: ${error}`)
    }
  }

  const handleToggleMic = () => {
    setSendMic(!sendMic)
    addDebugLine(`🎤 Microfono ${!sendMic ? 'attivato' : 'disattivato'}`)
  }

  const getStatusIcon = () => {
    if (isStreaming) return <Radio className="w-5 h-5 text-green-500" />
    if (isConnected) return <Wifi className="w-5 h-5 text-yellow-500" />
    return <WifiOff className="w-5 h-5 text-red-500" />
  }

  const getStatusText = () => {
    if (isStreaming) return 'STREAMING CONTINUO'
    if (isConnected) return 'CONNESSO'
    return 'DISCONNESSO'
  }

  const getStatusColor = () => {
    if (isStreaming) return 'text-green-500'
    if (isConnected) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Streaming Continuo</h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Configurazione */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Formato
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'opus' | 'mp3')}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          >
            <option value="opus">Opus (Ultra-Latenza)</option>
            <option value="mp3">MP3 (Compatibilità)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Bitrate
          </label>
          <select
            value={bitrate}
            onChange={(e) => setBitrate(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          >
            <option value={64}>64 kbps</option>
            <option value={128}>128 kbps</option>
            <option value={192}>192 kbps</option>
            <option value={256}>256 kbps</option>
          </select>
        </div>
      </div>

      {/* Controlli */}
      <div className="flex space-x-2">
        <button
          onClick={isStreaming ? handleDisconnect : handleConnect}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            isStreaming
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isStreaming ? (
            <>
              <Square className="w-4 h-4 mr-2 inline" />
              STOP STREAMING
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2 inline" />
              AVVIA STREAMING
            </>
          )}
        </button>
        
        <button
          onClick={handleToggleMic}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            sendMic
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          }`}
        >
          {sendMic ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
      </div>

      {/* Debug Console */}
      <div className="bg-black rounded-md p-3 h-32 overflow-y-auto">
        <div className="text-xs text-green-400 font-mono space-y-1">
          {debugLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400">
        <p>⚡ <strong>Streaming Continuo:</strong> Elimina lag e blocchi</p>
        <p>🎵 <strong>Ultra-Latenza:</strong> Frame 2.5ms per massima responsività</p>
        <p>🔄 <strong>Buffer Circolare:</strong> Gestione audio in tempo reale</p>
      </div>
    </div>
  )
}

export default ContinuousStreamingControl
