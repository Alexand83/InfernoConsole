/**
 * 🖥️ HOST MODE CONTENT
 * Contenuto per la modalità DJ Titolare (Server)
 */

import React, { useState, useEffect } from 'react'
import { Server, Users, Mic, MicOff, Play, Square, Copy, Share2, Wifi, WifiOff, CheckCircle, AlertCircle, Volume2, Settings } from 'lucide-react'
import { useStreaming } from '../contexts/StreamingContext'

const HostModeContent: React.FC = () => {
  const { state: streamingState } = useStreaming()

  return (
    <div className="host-mode-content">
      <div className="host-mode-header">
        <h3>🖥️ Modalità DJ Titolare</h3>
        <p>Console DJ professionale per streaming live</p>
      </div>

      {/* Streaming Status */}
      <div className="streaming-status-section">
        <div className="status-header">
          <Volume2 className="w-6 h-6 text-blue-400" />
          <h4>📡 Live Streaming</h4>
        </div>
        
        <div className={`status-indicator ${streamingState.isStreaming ? 'active' : 'inactive'}`}>
          <div className="status-dot"></div>
          <span>
            {streamingState.isStreaming ? '📡 Live Streaming Attivo' : '📡 Live Streaming Inattivo'}
          </span>
        </div>
        
        {streamingState.isStreaming && (
          <div className="streaming-info">
            <p>✅ Streaming live attivo</p>
            <p>🎵 Musica in trasmissione</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="instructions-section">
        <div className="instructions-header">
          <h5>📋 Come usare la Console DJ</h5>
        </div>
        
        <div className="instructions-list">
          <div className="instruction-item">
            <span className="step-number">1</span>
            <span>🎵 Carica la tua playlist musicale</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">2</span>
            <span>🎛️ Configura le impostazioni di streaming</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">3</span>
            <span>▶️ Avvia la riproduzione</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">4</span>
            <span>📡 Attiva lo streaming live</span>
          </div>
          <div className="instruction-item">
            <span className="step-number">5</span>
            <span>🎤 Usa il microfono per commenti live</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HostModeContent
