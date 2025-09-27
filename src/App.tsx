import React, { useMemo, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav'
import DJConsole from './components/DJConsole'
import NewDJConsole from './components/NewDJConsole'
import { RebuiltDJConsole, AutoAdvanceManager } from './components/dj-console'
// import DJRemotoServerPage from './components/DJRemotoServerPage' // Ora è un pannello nel TopNav
// Rimossi import diretti per lazy loading
// import LibraryManager from './components/LibraryManager'
// import Settings from './components/Settings'
import TestConsole from './components/TestConsole'
import { AudioProvider } from './contexts/AudioContext'
import { PlaylistProvider } from './contexts/PlaylistContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { TimerProvider } from './contexts/TimerContext'
import { StreamingProvider } from './contexts/StreamingContext'
import { DJRemotoServerProvider } from './contexts/DJRemotoServerContext'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/themes.css'
import UpdateNotification from './components/UpdateNotification'

function App() {
  // ✅ PERFORMANCE: Rimossi log di re-render per ridurre overhead CPU
  // Debug: Monitor re-render dell'intero albero (DISABILITATO per performance)
  // const renderCount = useRef(0)
  // const lastRenderTime = useRef(Date.now())

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

  // ✅ NUOVO: Listener per navigazione alle impostazioni da auto-updater
  React.useEffect(() => {
    const handleNavigateToSettings = () => {
      console.log('🔧 Navigazione alle impostazioni richiesta da auto-updater')
      // Usa React Router invece di window.location.href
      window.dispatchEvent(new CustomEvent('navigate-to-settings'))
    }
    
    // Non usare window.autoUpdater per la navigazione, usa solo eventi custom
    return () => {
      // Cleanup non necessario per eventi custom
    }
  }, [])

  // REF per forzare la stabilità - non cambia mai
  const stableRef = useRef({})
  
  // MEMOIZZA i componenti per evitare re-mount - CON REF STABILE + LAZY LOADING
  const memoizedRebuiltDJConsole = useMemo(() => <RebuiltDJConsole key="djconsole-rebuilt-stable" />, [stableRef.current])
  const memoizedDJConsole = useMemo(() => <NewDJConsole key="djconsole-v2-stable" />, [stableRef.current])
  const memoizedOldDJConsole = useMemo(() => <DJConsole key="djconsole-old-stable" />, [stableRef.current])
  
  // ✅ LAZY LOADING per componenti pesanti - Ottimizzato per avvio veloce
  const LazyLibraryManager = useMemo(() => {
    return React.lazy(() => import('./components/LibraryManager'))
  }, [])
  
  const LazySettings = useMemo(() => {
    return React.lazy(() => import('./components/Settings'))
  }, [])
  
  const LazyYouTubeDownloader = useMemo(() => {
    return React.lazy(() => import('./components/YouTubeDownloader/YouTubeDownloaderPage'))
  }, [])

  // LazyPlaylistProvider rimosso - non utilizzato
  
  const memoizedTestConsole = useMemo(() => <TestConsole key="test-stable" />, [stableRef.current])
  // const memoizedDJRemotoServerPage = useMemo(() => <DJRemotoServerPage key="dj-remoto-server-stable" />, [stableRef.current]) // Ora è un pannello

  // MEMOIZZA anche i provider per evitare re-creazione
  const memoizedProviders = useMemo(() => (
    <SettingsProvider>
      <TimerProvider>
        <AudioProvider>
          <PlaylistProvider>
            <StreamingProvider>
              <DJRemotoServerProvider>
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
                      <Route path="/youtube" element={<LazyYouTubeDownloader />} />
                      <Route path="/test" element={memoizedTestConsole} />
                    </Routes>
                  </React.Suspense>
                </main>
                
                {/* ✅ FIX AUTOPLAY: AutoAdvanceManager globale - rimane sempre attivo */}
                <AutoAdvanceManager
                  activePlaylistId={undefined} // Sarà gestito internamente
                  onTrackLoad={undefined} // Sarà gestito internamente
                  onDuplicateTrackWarning={undefined} // Sarà gestito internamente
                />
                
                {/* ✅ NUOVO: Notifiche di aggiornamento */}
                <UpdateNotification />
              </div>
              </ErrorBoundary>
              </DJRemotoServerProvider>
            </StreamingProvider>
          </PlaylistProvider>
        </AudioProvider>
      </TimerProvider>
    </SettingsProvider>
  ), [memoizedRebuiltDJConsole, memoizedDJConsole, memoizedOldDJConsole, LazyLibraryManager, LazySettings, memoizedTestConsole])

  return memoizedProviders
}

export default App
