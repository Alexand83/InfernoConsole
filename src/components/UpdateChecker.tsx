import React, { useState, useEffect } from 'react'
import { Download, CheckCircle, AlertCircle, Clock, ExternalLink, Settings } from 'lucide-react'
import { updateConfig } from '../config/updateConfig'

interface UpdateInfo {
  version: string
  releaseDate: string
  downloadUrl: string
  changelog: string[]
  isNewer: boolean
}

interface UpdateCheckerProps {
  currentVersion: string
  updateUrl: string
  onUpdateChecked: (lastChecked: string) => void
}

const UpdateChecker: React.FC<UpdateCheckerProps> = ({ 
  currentVersion, 
  updateUrl, 
  onUpdateChecked 
}) => {
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<string>('')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState<string>('')
  const [customUpdateUrl, setCustomUpdateUrl] = useState(updateUrl)
  const [showConfig, setShowConfig] = useState(false)

  // Carica l'ultima verifica dal localStorage
  useEffect(() => {
    const saved = localStorage.getItem('djconsole_last_update_check')
    if (saved) {
      setLastChecked(saved)
    }
  }, [])

  const checkForUpdates = async () => {
    const urlToUse = customUpdateUrl || updateUrl
    
    if (!urlToUse) {
      setError('URL aggiornamenti non configurato')
      return
    }

    setIsChecking(true)
    setError('')
    
    try {
      console.log('🔄 Checking for updates from:', urlToUse)
      
      // Chiamata API per verificare gli aggiornamenti
      const response = await fetch(urlToUse, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': `${updateConfig.appName} ${currentVersion}`,
          ...(updateConfig.github.token && { 'Authorization': `token ${updateConfig.github.token}` })
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Simula la logica di confronto versioni
      const isNewer = compareVersions(data.version, currentVersion) > 0
      
      const updateData: UpdateInfo = {
        version: data.version,
        releaseDate: data.releaseDate || new Date().toISOString(),
        downloadUrl: data.downloadUrl || '',
        changelog: data.changelog || [],
        isNewer
      }
      
      setUpdateInfo(updateData)
      
      // Salva la data dell'ultima verifica
      const now = new Date().toISOString()
      setLastChecked(now)
      localStorage.setItem('djconsole_last_update_check', now)
      onUpdateChecked(now)
      
      console.log('✅ Update check completed:', updateData)
      
    } catch (err) {
      console.error('❌ Error checking for updates:', err)
      setError(err instanceof Error ? err.message : 'Errore durante la verifica aggiornamenti')
    } finally {
      setIsChecking(false)
    }
  }

  // ✅ NUOVO: Reset cache auto-updater
  const resetUpdaterCache = async () => {
    try {
      if (window.autoUpdater) {
        await window.autoUpdater.resetCache()
        console.log('✅ Cache auto-updater pulita')
        setError('')
      } else {
        setError('Auto-updater non disponibile')
      }
    } catch (err) {
      console.error('❌ Errore nel reset cache:', err)
      setError('Errore nel reset cache auto-updater')
    }
  }

  // ✅ NUOVO: Controllo forzato aggiornamenti
  const forceCheckUpdates = async () => {
    setIsChecking(true)
    setError('')
    
    try {
      if (window.autoUpdater) {
        await window.autoUpdater.forceCheckUpdates()
        console.log('✅ Controllo forzato completato')
        // Ricarica la pagina dopo il controllo forzato
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setError('Auto-updater non disponibile')
      }
    } catch (err) {
      console.error('❌ Errore nel controllo forzato:', err)
      setError('Errore nel controllo forzato aggiornamenti')
    } finally {
      setIsChecking(false)
    }
  }

  // Funzione per confrontare le versioni (es. "1.2.3" vs "1.2.4")
  const compareVersions = (version1: string, version2: string): number => {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0
      
      if (v1Part > v2Part) return 1
      if (v1Part < v2Part) return -1
    }
    
    return 0
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-4">
      {/* Controlli */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={checkForUpdates}
              disabled={isChecking || !customUpdateUrl}
              className="flex items-center space-x-2 px-4 py-2 bg-dj-accent text-white rounded-lg hover:bg-dj-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isChecking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Verifica Aggiornamenti</span>
                </>
              )}
            </button>
            
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center space-x-2 px-3 py-2 bg-dj-secondary text-dj-light hover:bg-dj-secondary/80 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Configura</span>
            </button>
            
            {/* ✅ NUOVO: Pulsanti per risolvere "build in corso" */}
            <button
              onClick={resetUpdaterCache}
              className="flex items-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              title="Pulisce la cache dell'auto-updater per risolvere problemi di 'build in corso'"
            >
              <Settings className="w-4 h-4" />
              <span>Reset Cache</span>
            </button>
            
            <button
              onClick={forceCheckUpdates}
              disabled={isChecking}
              className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Forza il controllo aggiornamenti ignorando la cache"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Forza Controllo</span>
            </button>
            
            {lastChecked && (
              <div className="flex items-center space-x-2 text-sm text-dj-light/60">
                <Clock className="w-4 h-4" />
                <span>Ultima verifica: {formatDate(lastChecked)}</span>
              </div>
            )}
          </div>
          
          {customUpdateUrl && (
            <a
              href={customUpdateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-dj-accent hover:text-dj-accent/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm">Apri URL Aggiornamenti</span>
            </a>
          )}
        </div>

        {/* Configurazione URL */}
        {showConfig && (
          <div className="bg-dj-secondary rounded-lg p-4 border border-dj-accent/20">
            <h4 className="text-sm font-medium text-white mb-3">Configurazione URL Aggiornamenti</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-dj-light/60 mb-1">URL per verificare aggiornamenti:</label>
                <input
                  type="url"
                  value={customUpdateUrl}
                  onChange={(e) => setCustomUpdateUrl(e.target.value)}
                  placeholder="https://api.github.com/repos/username/repo/releases/latest"
                  className="w-full px-3 py-2 bg-dj-primary border border-dj-accent/30 rounded-lg text-white placeholder-dj-light/40 focus:border-dj-accent focus:outline-none"
                />
              </div>
              <div className="text-xs text-dj-light/60">
                <p>Esempi di URL supportati:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>GitHub API: <code className="bg-dj-primary px-1 rounded">https://api.github.com/repos/username/repo/releases/latest</code></li>
                  <li>File JSON: <code className="bg-dj-primary px-1 rounded">https://your-server.com/updates.json</code></li>
                  <li>API personalizzata: <code className="bg-dj-primary px-1 rounded">https://your-api.com/check-updates</code></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Errori */}
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Risultati */}
      {updateInfo && (
        <div className={`p-4 rounded-lg border ${
          updateInfo.isNewer 
            ? 'bg-green-500/20 border-green-500/30' 
            : 'bg-blue-500/20 border-blue-500/30'
        }`}>
          <div className="flex items-center space-x-2 mb-3">
            {updateInfo.isNewer ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <CheckCircle className="w-5 h-5 text-blue-400" />
            )}
            <h3 className="text-lg font-medium text-white">
              {updateInfo.isNewer ? 'Aggiornamenti Disponibili!' : 'Sei Aggiornato'}
            </h3>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dj-light/60">Versione disponibile:</span>
              <span className="text-white font-medium">{updateInfo.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dj-light/60">Data rilascio:</span>
              <span className="text-white">{formatDate(updateInfo.releaseDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dj-light/60">Versione attuale:</span>
              <span className="text-white">{currentVersion}</span>
            </div>
          </div>

          {updateInfo.isNewer && updateInfo.downloadUrl && (
            <div className="mt-4">
              <a
                href={updateInfo.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Scarica Aggiornamento</span>
              </a>
            </div>
          )}

          {updateInfo.changelog.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-white mb-2">Changelog:</h4>
              <ul className="space-y-1 text-sm text-dj-light/80">
                {updateInfo.changelog.map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-dj-accent">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default UpdateChecker
