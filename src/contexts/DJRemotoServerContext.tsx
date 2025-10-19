import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface DJRemotoServerContextType {
  showPanel: boolean
  setShowPanel: (show: boolean) => void
  isMinimized: boolean
  setIsMinimized: (minimized: boolean) => void
}

const DJRemotoServerContext = createContext<DJRemotoServerContextType | undefined>(undefined)

export const useDJRemotoServer = () => {
  const context = useContext(DJRemotoServerContext)
  if (!context) {
    throw new Error('useDJRemotoServer must be used within a DJRemotoServerProvider')
  }
  return context
}

interface DJRemotoServerProviderProps {
  children: ReactNode
}

export const DJRemotoServerProvider: React.FC<DJRemotoServerProviderProps> = ({ children }) => {
  // ✅ CRITICAL: Load state from sessionStorage on mount
  const [showPanel, setShowPanel] = useState(() => {
    return sessionStorage.getItem('djRemotoServer_showPanel') === 'true'
  })
  
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = sessionStorage.getItem('djRemotoServer_minimized') === 'true'
    console.log('🔄 [DJRemotoServerContext] Stato iniziale isMinimized:', saved)
    return saved
  })

  // ✅ CRITICAL: Save state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('djRemotoServer_showPanel', showPanel.toString())
  }, [showPanel])

  useEffect(() => {
    console.log('🔄 [DJRemotoServerContext] isMinimized cambiato a:', isMinimized)
    sessionStorage.setItem('djRemotoServer_minimized', isMinimized.toString())
    // ✅ NEW: Set global flag for client positioning
    ;(window as any).__djRemotoServerMinimized__ = isMinimized
  }, [isMinimized])

  // ✅ CRITICAL: Restore state when page becomes visible
  useEffect(() => {
    const handlePageShow = () => {
      // ✅ CRITICAL FIX: Non ripristinare se il pannello è stato chiuso manualmente
      if ((window as any).__djRemotoServerWasManuallyClosed__) {
        console.log('🔄 [DJRemotoServerContext] Pannello chiuso manualmente - skip ripristino stato')
        return
      }
      
      const savedShowPanel = sessionStorage.getItem('djRemotoServer_showPanel') === 'true'
      const savedMinimized = sessionStorage.getItem('djRemotoServer_minimized') === 'true'
      
      if (savedShowPanel !== showPanel) {
        setShowPanel(savedShowPanel)
      }
      if (savedMinimized !== isMinimized) {
        setIsMinimized(savedMinimized)
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [showPanel, isMinimized])

  const value: DJRemotoServerContextType = {
    showPanel,
    setShowPanel,
    isMinimized,
    setIsMinimized
  }

  return (
    <DJRemotoServerContext.Provider value={value}>
      {children}
    </DJRemotoServerContext.Provider>
  )
}
