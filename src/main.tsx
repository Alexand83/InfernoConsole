import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './styles/themes.css'
import { setLanguage } from './i18n'

// Inizializza la lingua (default: italiano)
setLanguage('it')

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
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
