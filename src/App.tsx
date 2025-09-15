import React, { useMemo, useRef, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav'
import DJConsole from './components/DJConsole'
import NewDJConsole from './components/NewDJConsole'
import { RebuiltDJConsole } from './components/dj-console'
// Rimossi import diretti per lazy loading
// import LibraryManager from './components/LibraryManager'
// import Settings from './components/Settings'
import TestConsole from './components/TestConsole'
import { AudioProvider } from './contexts/AudioContext'
import { PlaylistProvider } from './contexts/PlaylistContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { TimerProvider } from './contexts/TimerContext'
import { StreamingProvider } from './contexts/StreamingContext'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/themes.css'

function App() {
  // Debug: Monitor re-render dell'intero albero
  const renderCount = useRef(0)
  const lastRenderTime = useRef(Date.now())
  
  useEffect(() => {
    renderCount.current++
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTime.current
    lastRenderTime.current = now
    
    console.log(`🔄 [APP] Re-render #${renderCount.current} - Time since last: ${timeSinceLastRender}ms`)
    
    // Stack trace per identificare cosa causa il re-render
    if (renderCount.current > 1) {
      console.trace('🔄 [APP] Stack trace for re-render')
    }
  })

  // Log quando viene richiesto il refresh (ma non ricaricare la pagina)
  React.useEffect(() => {
    const handleForceRefresh = () => {
      console.log('🔄 Force component refresh requested (but not reloading page)')
      // Non ricaricare la pagina per non perdere lo stato
      // Il problema del resume deve essere risolto diversamente
    }

    window.addEventListener('djconsole:force-component-refresh', handleForceRefresh)
    return () => {
      window.removeEventListener('djconsole:force-component-refresh', handleForceRefresh)
    }
  }, [])

  // REF per forzare la stabilità - non cambia mai
  const stableRef = useRef({})
  
  // MEMOIZZA i componenti per evitare re-mount - CON REF STABILE + LAZY LOADING
  const memoizedRebuiltDJConsole = useMemo(() => <RebuiltDJConsole key="djconsole-rebuilt-stable" />, [stableRef.current])
  const memoizedDJConsole = useMemo(() => <NewDJConsole key="djconsole-v2-stable" />, [stableRef.current])
  const memoizedOldDJConsole = useMemo(() => <DJConsole key="djconsole-old-stable" />, [stableRef.current])
  
  // LAZY LOADING per componenti pesanti
  const LazyLibraryManager = useMemo(() => {
    return React.lazy(() => import('./components/LibraryManager'))
  }, [])
  
  const LazySettings = useMemo(() => {
    return React.lazy(() => import('./components/Settings'))
  }, [])
  
  const memoizedTestConsole = useMemo(() => <TestConsole key="test-stable" />, [stableRef.current])

  // MEMOIZZA anche i provider per evitare re-creazione
  const memoizedProviders = useMemo(() => (
    <SettingsProvider>
      <TimerProvider>
        <AudioProvider>
          <PlaylistProvider>
            <StreamingProvider>
              <ErrorBoundary>
              <div className="flex flex-col min-h-screen bg-dj-dark">
                <TopNav />
                <main className="flex-1 overflow-y-auto transition-opacity duration-200 ease-in-out">
                  <React.Suspense fallback={
                    <div className="flex items-center justify-center h-full bg-dj-dark">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dj-accent"></div>
                        <div className="text-white text-sm opacity-75">Caricamento...</div>
                      </div>
                    </div>
                  }>
                    <Routes>
                      <Route path="/" element={memoizedRebuiltDJConsole} />
                      <Route path="/v2" element={memoizedDJConsole} />
                      <Route path="/old" element={memoizedOldDJConsole} />
                      <Route path="/library" element={<LazyLibraryManager />} />
                      <Route path="/settings" element={<LazySettings />} />
                      <Route path="/test" element={memoizedTestConsole} />
                    </Routes>
                  </React.Suspense>
                </main>
              </div>
              </ErrorBoundary>
            </StreamingProvider>
          </PlaylistProvider>
        </AudioProvider>
      </TimerProvider>
    </SettingsProvider>
  ), [memoizedRebuiltDJConsole, memoizedDJConsole, memoizedOldDJConsole, LazyLibraryManager, LazySettings, memoizedTestConsole])

  return memoizedProviders
}

export default App
