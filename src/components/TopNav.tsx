import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from '../i18n'
import RemoteDJClient from './RemoteDJClient'
import DJRemotoServerPage from './DJRemotoServerPage'
import { useDJRemotoServer } from '../contexts/DJRemotoServerContext'

const TopNav = () => {
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showRemoteDJ, setShowRemoteDJ] = useState(false)
  const [isRemoteDJMinimized, setIsRemoteDJMinimized] = useState(false)
  const { showPanel: showDJRemotoServer, setShowPanel: setShowDJRemotoServer, isMinimized, setIsMinimized } = useDJRemotoServer()
  
  // Aggiorna l'ora ogni secondo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])
  
  const items = [
    { path: '/', label: t('nav.console') },
    { path: '/library', label: 'Libreria & Playlist' },
    { path: '/settings', label: t('nav.settings') },
  ]

  return (
    <header className="w-full bg-dj-primary border-b border-dj-accent/30">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="h-14 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-white font-dj font-bold">Inferno Console</div>
            <div className="text-dj-light/70 text-sm font-mono">
              {currentTime.toLocaleTimeString('it-IT', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </div>
          </div>
          <nav className="flex items-center space-x-1">
            {items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive ? 'bg-dj-accent text-white' : 'text-dj-light/80 hover:bg-dj-accent/20 hover:text-white'
                  }`
                }
              >
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
            
            {/* Pulsante DJ Remoto Client */}
            <button
              onClick={() => {
                if (isRemoteDJMinimized) {
                  setIsRemoteDJMinimized(false)
                  setShowRemoteDJ(true)
                } else {
                  setShowRemoteDJ(true)
                }
              }}
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors text-dj-light/80 hover:bg-dj-accent/20 hover:text-white"
              title="DJ Remoto Client"
            >
              <span className="font-medium">🎤 DJ Remoto</span>
              {isRemoteDJMinimized && <span className="text-xs text-dj-accent">●</span>}
            </button>

            {/* Pulsante DJ Remoto Server */}
            <button
              onClick={() => {
                // ✅ CRITICAL FIX: Reset completo quando si riapre manualmente il pannello
                console.log('🔄 [TopNav] Apertura manuale pannello DJ Remoto Server - RESET COMPLETO')
                ;(window as any).__djRemotoServerWasManuallyClosed__ = false
                
                // ✅ CRITICAL FIX: Reset completo dello stato del pannello
                sessionStorage.removeItem('djRemotoServer_showPanel')
                sessionStorage.removeItem('djRemotoServer_minimized')
                sessionStorage.removeItem('djRemotoServer_isRunning')
                sessionStorage.removeItem('djRemotoServer_info')
                sessionStorage.removeItem('djRemotoServer_connectedDJs')
                sessionStorage.removeItem('djRemotoServer_chatMessages')
                sessionStorage.removeItem('djRemotoServer_pttDJActive')
                sessionStorage.removeItem('djRemotoServer_pttLiveActive')
                console.log('✅ [TopNav] SessionStorage completamente svuotato per reset pannello')
                
                // ✅ CRITICAL FIX: Reset del context per assicurarsi che il pannello sia completamente pulito
                setIsMinimized(false)
                setShowDJRemotoServer(true)
              }}
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors text-dj-light/80 hover:bg-dj-accent/20 hover:text-white"
              title="DJ Remoto Server"
            >
              <span className="font-medium">🎤 DJ Remoto Server</span>
              {showDJRemotoServer && !(window as any).__djRemotoServerWasManuallyClosed__ && <span className="text-xs text-dj-accent">●</span>}
            </button>
          </nav>
        </div>
      </div>
      
      {/* Client DJ Remoto */}
      {showRemoteDJ && (
        <RemoteDJClient 
          onClose={() => {
            ;(window as any).__remoteDJMinimized__ = false // Reset flag per cleanup completo
            setIsRemoteDJMinimized(false)
            setShowRemoteDJ(false)
          }}
          onMinimize={() => {
            ;(window as any).__remoteDJMinimized__ = true // Imposta flag per mantenere connessione
            setIsRemoteDJMinimized(true)
            setShowRemoteDJ(false)
          }}
        />
      )}

      {/* Server DJ Remoto */}
      {showDJRemotoServer && !(window as any).__djRemotoServerWasManuallyClosed__ && (
        <div className={`fixed inset-0 z-40 ${isMinimized ? 'pointer-events-none' : 'bg-black/50'}`} onClick={() => {
          if (!isMinimized) {
            console.log('🔄 [TopNav] Click su overlay - minimizzazione pannello DJ Remoto Server')
            setIsMinimized(true)
          }
        }}>
          <div onClick={(e) => e.stopPropagation()} className={isMinimized ? 'pointer-events-auto' : ''}>
            <DJRemotoServerPage />
          </div>
        </div>
      )}
    </header>
  )
}

export default TopNav


