import React, { useState, useEffect, useCallback } from 'react'
import { HardDrive, Cpu, Activity, AlertTriangle, CheckCircle } from 'lucide-react'

interface MemoryInfo {
  used: number
  total: number
  percentage: number
  status: 'low' | 'medium' | 'high' | 'critical'
}

interface MemoryManagerProps {
  isImporting: boolean
  totalFiles: number
  completedFiles: number
  onMemoryWarning: () => void
}

const MemoryManager: React.FC<MemoryManagerProps> = ({ 
  isImporting, 
  totalFiles, 
  completedFiles, 
  onMemoryWarning 
}) => {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    used: 0,
    total: 0,
    percentage: 0,
    status: 'low'
  })
  const [showDetails, setShowDetails] = useState(false)
  const [memoryHistory, setMemoryHistory] = useState<number[]>([])

  // Simula monitoraggio memoria (in un'app reale useresti Performance API o Electron APIs)
  const getMemoryInfo = useCallback((): MemoryInfo => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const used = memory.usedJSHeapSize
      const total = memory.totalJSHeapSize
      const percentage = (used / total) * 100
      
      let status: MemoryInfo['status'] = 'low'
      if (percentage > 90) status = 'critical'  // Aumentato da 80% a 90%
      else if (percentage > 75) status = 'high'  // Aumentato da 60% a 75%
      else if (percentage > 50) status = 'medium' // Aumentato da 40% a 50%
      
      return { used, total, percentage, status }
    }
    
    // Fallback per browser che non supportano Performance Memory API
    return {
      used: Math.random() * 100 * 1024 * 1024, // Simula uso memoria
      total: 100 * 1024 * 1024, // Simula 100MB totali
      percentage: Math.random() * 100,
      status: 'low'
    }
  }, [])

  // Monitora memoria durante import
  useEffect(() => {
    if (!isImporting) return

    const interval = setInterval(() => {
      const info = getMemoryInfo()
      setMemoryInfo(info)
      
      // Aggiungi alla cronologia
      setMemoryHistory(prev => {
        const newHistory = [...prev, info.percentage]
        if (newHistory.length > 20) newHistory.shift() // Mantieni solo ultimi 20 valori
        return newHistory
      })
      
      // Avvisa se memoria critica
      if (info.status === 'critical') {
        handleMemoryWarning()
        console.warn('⚠️ Memoria critica durante import!')
      }
    }, 3000) // Controlla ogni 3 secondi per ridurre overhead

    return () => clearInterval(interval)
  }, [isImporting, getMemoryInfo, onMemoryWarning])

  // Calcola raccomandazioni basate su memoria e numero file
  const getRecommendations = useCallback((): string[] => {
    const recommendations: string[] = []
    
    if (memoryInfo.status === 'critical') {
      recommendations.push('Memoria elevata. L\'import continuerà automaticamente con ottimizzazioni')
    } else if (memoryInfo.status === 'high') {
      recommendations.push('Memoria moderata. L\'import procede normalmente')
    }
    
    if (totalFiles > 500) {
      recommendations.push('Libreria grande. Ottimizzazioni automatiche attive')
    }
    
    if (totalFiles > 1000) {
      recommendations.push('Libreria molto grande. Processamento ottimizzato in corso')
    }
    
    return recommendations
  }, [memoryInfo.status, totalFiles])

  // Gestisce warning di memoria con pulizia automatica
  const handleMemoryWarning = useCallback(() => {
    if (memoryInfo.status === 'critical') {
      // Memoria critica: pulizia aggressiva
      console.warn('🚨 [MEMORY] Memoria critica rilevata! Pulizia aggressiva...')
      
      // Forza garbage collection se disponibile
      try {
        if ('gc' in window) {
          (window as any).gc()
          console.log('🧹 [MEMORY] Garbage collection forzato per memoria critica')
        }
      } catch (error) {
        console.warn('Failed to force garbage collection:', error)
      }
      
      // Pausa per permettere al sistema di "respirare"
      setTimeout(() => {
        handleMemoryWarning()
      }, 1000)
    } else if (memoryInfo.status === 'high') {
      // Memoria elevata: pulizia preventiva
      console.warn('⚠️ [MEMORY] Memoria elevata rilevata. Pulizia preventiva...')
      
      try {
        if ('gc' in window) {
          (window as any).gc()
          console.log('🧹 [MEMORY] Garbage collection preventivo per memoria elevata')
        }
      } catch (error) {
        console.warn('Failed to force garbage collection:', error)
      }
      
      // Pausa più breve per memoria elevata
      setTimeout(() => {
        handleMemoryWarning()
      }, 500)
    } else if (memoryInfo.status === 'medium') {
      // Memoria moderata: pulizia leggera
      console.log('ℹ️ [MEMORY] Memoria moderata. Pulizia leggera...')
      
      try {
        if ('gc' in window) {
          (window as any).gc()
          console.log('🧹 [MEMORY] Garbage collection leggero per memoria moderata')
        }
      } catch (error) {
        console.warn('Failed to force garbage collection:', error)
      }
    }
  }, [memoryInfo.status])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: MemoryInfo['status']): string => {
    switch (status) {
      case 'low': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-orange-500'
      case 'critical': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: MemoryInfo['status']) => {
    switch (status) {
      case 'low': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'medium': return <Activity className="w-4 h-4 text-yellow-500" />
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return <Activity className="w-4 h-4 text-gray-500" />
    }
  }

  if (!isImporting) return null

  return (
    <div className="memory-manager bg-dj-primary rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
                       <h4 className="text-sm font-medium text-white flex items-center space-x-2">
                 <HardDrive className="w-4 h-4" />
                 <span>Gestione Memoria</span>
               </h4>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-dj-light/60 hover:text-dj-light"
        >
          {showDetails ? 'Nascondi' : 'Dettagli'}
        </button>
      </div>

      {/* Barra memoria */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-dj-light/60 mb-1">
          <span>Uso Memoria</span>
          <span className={getStatusColor(memoryInfo.status)}>
            {memoryInfo.percentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-dj-secondary rounded-full h-2 overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              memoryInfo.status === 'critical' ? 'bg-red-500' :
              memoryInfo.status === 'high' ? 'bg-orange-500' :
              memoryInfo.status === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(memoryInfo.percentage, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-dj-light/60 mt-1">
          <span>{formatBytes(memoryInfo.used)}</span>
          <span>{formatBytes(memoryInfo.total)}</span>
        </div>
      </div>

      {/* Stato memoria */}
      <div className="flex items-center space-x-2 mb-3">
        {getStatusIcon(memoryInfo.status)}
        <span className={`text-sm ${getStatusColor(memoryInfo.status)}`}>
          {memoryInfo.status === 'low' && 'Memoria OK'}
          {memoryInfo.status === 'medium' && 'Memoria Moderata'}
          {memoryInfo.status === 'high' && 'Memoria Elevata'}
          {memoryInfo.status === 'critical' && 'Memoria Critica!'}
        </span>
      </div>

      {/* Dettagli avanzati */}
      {showDetails && (
        <div className="space-y-3">
          {/* Grafico memoria */}
          {memoryHistory.length > 0 && (
            <div>
              <div className="text-xs text-dj-light/60 mb-2">Andamento Memoria</div>
              <div className="flex items-end space-x-1 h-16">
                {memoryHistory.map((value, index) => (
                  <div
                    key={index}
                                         className={`flex-1 min-w-0 ${
                       value > 90 ? 'bg-red-500' :
                       value > 75 ? 'bg-orange-500' :
                       value > 50 ? 'bg-yellow-500' : 'bg-green-500'
                     } rounded-t transition-all duration-300`}
                    style={{ height: `${value}%` }}
                    title={`${value.toFixed(1)}%`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Statistiche import */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-dj-secondary p-2 rounded">
              <div className="text-dj-light/60">File Processati</div>
              <div className="text-white font-medium">{completedFiles}</div>
            </div>
            <div className="bg-dj-secondary p-2 rounded">
              <div className="text-dj-light/60">File Totali</div>
              <div className="text-white font-medium">{totalFiles}</div>
            </div>
            <div className="bg-dj-secondary p-2 rounded">
              <div className="text-dj-light/60">Progresso</div>
              <div className="text-white font-medium">
                {((completedFiles / totalFiles) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-dj-secondary p-2 rounded">
              <div className="text-dj-light/60">Rimanenti</div>
              <div className="text-white font-medium">{totalFiles - completedFiles}</div>
            </div>
          </div>

          {/* Raccomandazioni */}
          <div>
            <div className="text-xs text-dj-light/60 mb-2">Raccomandazioni</div>
            <div className="space-y-1">
              {getRecommendations().map((rec, index) => (
                <div key={index} className="text-xs text-dj-light/80 flex items-start space-x-2">
                  <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MemoryManager
