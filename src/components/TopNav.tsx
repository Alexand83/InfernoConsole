import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from '../i18n'
import RemoteDJClient from './RemoteDJClient'

const TopNav = () => {
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showRemoteDJ, setShowRemoteDJ] = useState(false)
  const [isRemoteDJMinimized, setIsRemoteDJMinimized] = useState(false)
  
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
            
            {/* Pulsante DJ Remoto */}
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
              title="DJ Remoto"
            >
              <span className="font-medium">🎤 DJ Remoto</span>
              {isRemoteDJMinimized && <span className="text-xs text-dj-accent">●</span>}
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
    </header>
  )
}

export default TopNav


