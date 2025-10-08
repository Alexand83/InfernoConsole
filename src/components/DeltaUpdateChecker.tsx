import React, { useState, useEffect } from 'react'
// Replaced custom UI components with basic elements to avoid missing deps
import { 
  Download, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Zap,
  FileText,
  Clock,
  HardDrive
} from 'lucide-react'

interface DeltaFile {
  path: string
  hash: string
  size: number
  delta: {
    from: string
    patchUrl: string
    patchSize: number
    hasOldVersion: boolean
  }
}

interface DeltaUpdateInfo {
  version: string
  previousVersion: string
  totalSize: number
  files: DeltaFile[]
  updateType: 'delta' | 'full'
}

interface DeltaUpdateCheckerProps {
  onUpdateApplied?: (version: string) => void
  onUpdateError?: (error: string) => void
}

const DeltaUpdateChecker: React.FC<DeltaUpdateCheckerProps> = ({
  onUpdateApplied,
  onUpdateError
}) => {
  const [updateInfo, setUpdateInfo] = useState<DeltaUpdateInfo | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [lastUpdateInfo, setLastUpdateInfo] = useState<any>(null)

  useEffect(() => {
    // Carica info sull'ultimo aggiornamento
    loadLastUpdateInfo()
    
    // Setup listener per eventi delta update
    const { ipcRenderer } = window.electronAPI || window.require?.('electron') || {}
    
    // Se non siamo in modalità Electron (sviluppo), simula il comportamento
    if (!ipcRenderer?.on) {
      console.log('🔧 [DELTA CHECKER] Development mode - simulating delta update system')
      // Non mostrare errore in modalità sviluppo, simula il sistema
      return
    }
    
    const handleDeltaUpdateAvailable = (event: any, info: DeltaUpdateInfo) => {
      setUpdateInfo(info)
      setError('')
    }
    
    const handleDeltaUpdateProgress = (event: any, progress: any) => {
      setUpdateProgress(progress.percent || 0)
      setUpdateStatus(progress.status || '')
      
      if (progress.status === 'completed') {
        setIsUpdating(false)
        setUpdateInfo(null)
        onUpdateApplied?.(updateInfo?.version || '')
        loadLastUpdateInfo()
      } else if (progress.status === 'error') {
        setIsUpdating(false)
        setError(progress.error || 'Update failed')
        onUpdateError?.(progress.error || 'Update failed')
      }
    }
    
    if (ipcRenderer?.on) {
      ipcRenderer.on('delta-update-available', handleDeltaUpdateAvailable)
      ipcRenderer.on('delta-update-progress', handleDeltaUpdateProgress)
    }
    
    return () => {
      if (ipcRenderer?.removeListener) {
        ipcRenderer.removeListener('delta-update-available', handleDeltaUpdateAvailable)
        ipcRenderer.removeListener('delta-update-progress', handleDeltaUpdateProgress)
      }
    }
  }, [updateInfo?.version, onUpdateApplied, onUpdateError])

  const loadLastUpdateInfo = async () => {
    try {
      const { ipcRenderer } = window.electronAPI || window.require?.('electron') || {}
      if (ipcRenderer?.invoke) {
        const lastUpdate = await ipcRenderer.invoke('get-last-delta-update-info')
        setLastUpdateInfo(lastUpdate)
      } else {
        // Modalità sviluppo - simula info
        setLastUpdateInfo({
          version: '1.4.108',
          lastCheck: new Date().toISOString(),
          deltaUpdatesEnabled: true,
          type: 'Delta Update',
          applied: new Date().toISOString(),
          size: 3300
        })
      }
    } catch (error) {
      console.error('Error loading last update info:', error)
    }
  }

  const checkForUpdates = async () => {
    setIsChecking(true)
    setError('')
    setUpdateInfo(null)
    
    try {
      const { ipcRenderer } = window.electronAPI || window.require?.('electron') || {}
      if (ipcRenderer?.invoke) {
        const result = await ipcRenderer.invoke('check-delta-updates')
        
        if (result && result.needsUpdate) {
          setUpdateInfo(result)
        } else {
          setUpdateStatus('App is up to date')
        }
      } else {
        // Modalità sviluppo - testa con file reali
        console.log('🔧 [DELTA CHECKER] Development mode - testing with real files')
        
        // Simula controllo con file reali
        try {
          // In Electron, usiamo il path corretto per i file locali
          const response = await fetch('./releases/v1.4.109/manifest.json')
          if (response.ok) {
            const manifest = await response.json()
            console.log('📄 [DELTA CHECKER] Manifest loaded:', manifest)
            setUpdateInfo({
              version: manifest.version,
              needsUpdate: true,
              deltaSize: manifest.totalSize,
              fullSize: manifest.fullSize,
              savings: manifest.savings,
              patches: manifest.files.map((file: any) => ({
                file: file.path,
                size: file.delta.patchSize
              }))
            })
          } else {
            console.log('❌ [DELTA CHECKER] Manifest not found, using fallback data')
            // Fallback ai dati simulati se il file non esiste
            setUpdateInfo({
              version: '1.4.109',
              needsUpdate: true,
              deltaSize: 3300,
              fullSize: 77000000,
              savings: '95.7%',
              patches: [
                { file: 'main.exe', size: 1200 },
                { file: 'app.asar', size: 1800 },
                { file: 'config.json', size: 300 }
              ]
            })
          }
        } catch (error) {
          console.log('❌ [DELTA CHECKER] Error loading manifest:', error)
          console.log('🔄 [DELTA CHECKER] Using fallback data')
          // Fallback ai dati simulati se il file non esiste
          setUpdateInfo({
            version: '1.4.109',
            needsUpdate: true,
            deltaSize: 3300,
            fullSize: 77000000,
            savings: '95.7%',
            patches: [
              { file: 'main.exe', size: 1200 },
              { file: 'app.asar', size: 1800 },
              { file: 'config.json', size: 300 }
            ]
          })
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to check for updates')
    } finally {
      setIsChecking(false)
    }
  }

  const applyUpdate = async () => {
    if (!updateInfo) return
    
    setIsUpdating(true)
    setUpdateProgress(0)
    setError('')
    setUpdateStatus('Starting update...')
    
    try {
      const { ipcRenderer } = window.electronAPI || window.require?.('electron') || {}
      if (ipcRenderer?.invoke) {
        await ipcRenderer.invoke('apply-delta-update', updateInfo)
      } else {
        // Modalità sviluppo - simula applicazione aggiornamento
        console.log('🔧 [DELTA CHECKER] Development mode - simulating update application')
        
        // Simula progresso
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 200))
          setUpdateProgress(i)
          
          if (i === 20) setUpdateStatus('Downloading patches...')
          else if (i === 50) setUpdateStatus('Applying patches...')
          else if (i === 80) setUpdateStatus('Verifying integrity...')
          else if (i === 100) setUpdateStatus('Update completed!')
        }
        
        setIsUpdating(false)
        setUpdateInfo(null)
        onUpdateApplied?.(updateInfo.version)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Update failed')
      setIsUpdating(false)
    }
  }

  const formatBytes = (bytes: number | string | undefined): string => {
    if (!bytes || bytes === 0 || isNaN(Number(bytes))) return '0 Bytes'
    const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes
    if (isNaN(numBytes)) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(numBytes) / Math.log(k))
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Never'
    return date.toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20">
        <div className="flex items-center gap-2 text-white font-medium mb-1">
          <Zap className="h-5 w-5 text-orange-500" />
          Delta Updates
          {!window.electronAPI && (
            <span className="ml-2 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">
              DEV MODE
            </span>
          )}
        </div>
        <div className="text-xs text-dj-light/60 mb-3">Aggiornamenti incrementali veloci che scaricano solo le differenze</div>
        <div className="flex gap-2">
          <button 
            onClick={checkForUpdates} 
            disabled={isChecking || isUpdating}
            className="dj-button flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>
      </div>

      {/* Last Update Info */}
      {lastUpdateInfo && (
        <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20">
          <div className="flex items-center gap-2 mb-2 text-white font-medium">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Last Update
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-dj-light/80">
            <div>
              <span className="font-medium text-white">Version:</span> {lastUpdateInfo.version}
            </div>
            <div>
              <span className="font-medium text-white">Applied:</span> {formatDate(lastUpdateInfo.appliedAt)}
            </div>
            <div>
              <span className="font-medium text-white">Type:</span> <span className="ml-2 px-2 py-0.5 rounded bg-dj-secondary text-xs">{lastUpdateInfo.updateType}</span>
            </div>
            <div>
              <span className="font-medium text-white">Size:</span> {formatBytes(lastUpdateInfo.totalSize)}
            </div>
          </div>
        </div>
      )}

      {/* Update Available */}
      {updateInfo && (
        <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20 space-y-4">
          <div className="flex items-center gap-2 text-white font-medium">
            <Download className="h-5 w-5 text-blue-500" />
            Update Available
          </div>
          <div className="text-xs text-dj-light/60">Version {updateInfo.previousVersion || '1.4.108'} → {updateInfo.version}</div>
            {/* Update Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span>Size: {formatBytes(updateInfo.totalSize || updateInfo.deltaSize || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Files: {updateInfo.files?.length || updateInfo.patches?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Type: <span className="ml-2 px-2 py-0.5 rounded bg-dj-secondary text-xs">{updateInfo.updateType || 'Delta Update'}</span></span>
              </div>
              {updateInfo.savings && (
                <div className="flex items-center gap-2">
                  <span className="text-green-400">💾</span>
                  <span>Savings: <span className="text-green-400 font-medium">{updateInfo.savings}</span></span>
                </div>
              )}
            </div>

            {/* Files List */}
            {(updateInfo.files?.length > 0 || updateInfo.patches?.length > 0) && (
              <div>
                <h4 className="font-medium mb-2">Files to update:</h4>
                <div className="space-y-1">
                  {(updateInfo.files || updateInfo.patches || []).map((file, index) => (
                    <div key={index} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                      <span className="font-mono">{file.path || file.file}</span>
                      <span className="text-gray-500">{formatBytes(file.delta?.patchSize || file.size || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Update Button */}
            <button 
              onClick={applyUpdate} 
              disabled={isUpdating}
              className="w-full dj-button flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Updating...' : 'Apply Update'}
            </button>
        </div>
      )}

      {/* Update Progress */}
      {isUpdating && (
        <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20 space-y-3">
          <div className="flex items-center gap-2 text-white font-medium">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
            Applying Update
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }}></div>
          </div>
          <div className="text-center text-sm text-dj-light/60">
              {updateStatus && (
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  {updateStatus}
                </div>
              )}
              <div className="mt-1">{updateProgress}% complete</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-dj-error/20 border border-dj-error/30 text-dj-error rounded p-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4" />
          <div>{error}</div>
        </div>
      )}

      {/* Status */}
      {updateStatus && !isUpdating && !error && (
        <div className="bg-dj-success/20 border border-dj-success/30 text-dj-success rounded p-3 text-sm flex items-start gap-2">
          <CheckCircle className="h-4 w-4" />
          <div>{updateStatus}</div>
        </div>
      )}
    </div>
  )
}

export default DeltaUpdateChecker
