import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Radio, Settings } from 'lucide-react'

interface DJHeaderProps {
  // PTT Props
  pttActive: boolean
  onPTTMouseDown: (e: React.MouseEvent) => void
  onPTTMouseUp: () => void
  
  // Streaming Props
  isStreaming: boolean
  streamStatus: 'disconnected' | 'connecting' | 'connected' | 'streaming'
  streamError: string | null
  onToggleStreaming: () => void
}

const DJHeader: React.FC<DJHeaderProps> = ({
  pttActive,
  onPTTMouseDown,
  onPTTMouseUp,
  isStreaming,
  streamStatus,
  streamError,
  onToggleStreaming
}) => {
  const navigate = useNavigate()

  return (
    <header className="bg-gray-900 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">DJ Console</h1>
        
        <div className="flex items-center space-x-4">
          {/* PTT Section */}
          <div className="flex flex-col items-center space-y-1">
            <button
              onMouseDown={onPTTMouseDown}
              onMouseUp={onPTTMouseUp}
              onMouseLeave={onPTTMouseUp}
              onTouchStart={(e) => {
                e.preventDefault()
                onPTTMouseDown(e as any)
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                onPTTMouseUp()
              }}
              className={`p-3 rounded-lg transition-all duration-200 select-none ${
                pttActive
                  ? 'bg-red-500 text-white shadow-lg animate-pulse ring-2 ring-red-300'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Push-to-Talk (Hold M key or mouse button)"
              style={{ 
                userSelect: 'none', 
                WebkitUserSelect: 'none', 
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserDrag: 'none'
              }}
            >
              <Mic className="w-6 h-6" />
            </button>
            
            {/* Status microfono - SOTTO il bottone PTT */}
            {pttActive && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs font-bold animate-pulse whitespace-nowrap">
                MIC ON AIR
              </span>
            )}
          </div>
          
          {/* Streaming */}
          <button
            onClick={onToggleStreaming}
            disabled={streamStatus === 'connecting'}
            className={`p-2 rounded-lg transition-all duration-200 relative ${
              isStreaming
                ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-300'
                : streamStatus === 'connecting'
                ? 'bg-yellow-500 text-white animate-pulse cursor-not-allowed'
                : streamStatus === 'connected'
                ? 'bg-green-500 text-white shadow-lg'
                : streamError
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={
              streamStatus === 'streaming' ? 'Stop Streaming' :
              streamStatus === 'connecting' ? 'Connecting...' :
              streamStatus === 'connected' ? 'Start Streaming' :
              streamError ? `Error: ${streamError}` :
              'Start Streaming'
            }
          >
            <Radio className="w-5 h-5" />
            {streamStatus === 'connecting' && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-ping"></div>
            )}
            {isStreaming && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
            )}
          </button>
          
          {/* Settings */}
          <button
            onClick={() => navigate('/settings')}
            className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg transition-all duration-200"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}

export default DJHeader














