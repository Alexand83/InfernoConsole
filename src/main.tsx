import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './styles/themes.css'
import { setLanguage } from './i18n'

// Inizializza la lingua (default: italiano)
setLanguage('it')

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

// Loading Screen Component
const LoadingScreen = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #0b1221 0%, #1a1a2e 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    zIndex: 9999
  }}>
    <div style={{
      width: '60px',
      height: '60px',
      border: '4px solid #333',
      borderTop: '4px solid #ff6b6b',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginBottom: '20px'
    }}></div>
    <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: 'bold' }}>Inferno Console</h2>
    <p style={{ margin: 0, opacity: 0.7, fontSize: '14px' }}>Caricamento in corso...</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)

// App con Loading Screen
const AppWithLoading = () => {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simula caricamento iniziale
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500) // 1.5 secondi di loading

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <Router>
      <App />
    </Router>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithLoading />
  </React.StrictMode>,
)

// Global error hooks in renderer
try {
  window.addEventListener('error', (e) => {
    try { (window as any).log?.error?.(`window.onerror: ${e.message}`) } catch {}
  })
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    try { (window as any).log?.error?.(`unhandledrejection: ${String(e.reason)}`) } catch {}
  })
} catch {}
