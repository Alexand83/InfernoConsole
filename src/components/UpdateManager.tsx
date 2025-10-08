import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Zap, Download, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react'

import UpdateChecker from './UpdateChecker'
import DeltaUpdateChecker from './DeltaUpdateChecker'

interface UpdateManagerProps {
  currentVersion: string
  updateUrl: string
  onUpdateChecked?: (lastChecked: string) => void
}

const UpdateManager: React.FC<UpdateManagerProps> = ({
  currentVersion,
  updateUrl,
  onUpdateChecked
}) => {
  const [activeTab, setActiveTab] = useState('delta')
  const [updateSettings, setUpdateSettings] = useState({
    deltaUpdatesEnabled: true,
    autoCheckEnabled: true,
    checkInterval: 24 // hours
  })

  useEffect(() => {
    // Carica impostazioni salvate
    const savedSettings = localStorage.getItem('update-settings')
    if (savedSettings) {
      setUpdateSettings(JSON.parse(savedSettings))
    }
  }, [])

  const saveSettings = (newSettings: typeof updateSettings) => {
    setUpdateSettings(newSettings)
    localStorage.setItem('update-settings', JSON.stringify(newSettings))
  }

  const toggleDeltaUpdates = async (enabled: boolean) => {
    try {
      const { ipcRenderer } = window.electronAPI || window.require?.('electron') || {}
      if (ipcRenderer?.invoke) {
        await ipcRenderer.invoke('set-delta-updates-enabled', enabled)
        saveSettings({ ...updateSettings, deltaUpdatesEnabled: enabled })
      } else {
        // Modalità sviluppo - simula toggle
        console.log('🔧 [UPDATE MANAGER] Development mode - simulating delta updates toggle:', enabled)
        saveSettings({ ...updateSettings, deltaUpdatesEnabled: enabled })
      }
    } catch (error) {
      console.error('Error toggling delta updates:', error)
    }
  }

  const resetCache = async () => {
    try {
      const { ipcRenderer } = window.electronAPI || window.require?.('electron') || {}
      if (ipcRenderer?.invoke) {
        await ipcRenderer.invoke('reset-updater-cache')
        // Ricarica la pagina per aggiornare lo stato
        window.location.reload()
      } else {
        // Modalità sviluppo - simula reset cache
        console.log('🔧 [UPDATE MANAGER] Development mode - simulating cache reset')
        console.log('Update cache reset successfully (simulated)')
        // Ricarica la pagina per aggiornare lo stato
        window.location.reload()
      }
    } catch (error) {
      console.error('Error resetting cache:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-2 flex items-center gap-2">
        <SettingsIcon className="h-5 w-5" />
        <div className="text-lg font-semibold">Update Manager</div>
      </div>

      <div className="text-sm text-dj-light/80 bg-dj-primary rounded p-3 border border-dj-accent/20 flex gap-2 items-start">
        <Info className="h-4 w-4 mt-0.5" />
        <div>
          <strong>Delta Updates</strong> scaricano solo le differenze tra versioni (−95% di download). In caso di errore, fallback al download completo.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-dj-primary rounded p-4 border border-dj-accent/20">
          <div className="text-sm text-dj-light/60 mb-2">Current Version</div>
          <div className="text-2xl font-bold text-blue-400">{currentVersion}</div>
        </div>
        <div className="bg-dj-primary rounded p-4 border border-dj-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Delta Updates</div>
              <div className="text-xs text-dj-light/60">Abilita aggiornamenti incrementali</div>
            </div>
            <button
              onClick={() => toggleDeltaUpdates(!updateSettings.deltaUpdatesEnabled)}
              className={`px-3 py-1 rounded ${updateSettings.deltaUpdatesEnabled ? 'bg-dj-accent text-white' : 'bg-gray-600 text-gray-200'}`}
            >
              {updateSettings.deltaUpdatesEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-dj-primary rounded p-4 border border-dj-accent/20">
        <div className="mb-3 text-sm font-medium">Delta Updates</div>
        <DeltaUpdateChecker 
          onUpdateApplied={(version) => {
            console.log(`Delta update applied: ${version}`)
          }}
          onUpdateError={(error) => {
            console.error(`Delta update error: ${error}`)
          }}
        />
      </div>

      <div className="bg-dj-primary rounded p-4 border border-dj-accent/20">
        <div className="mb-2 text-sm font-medium">Standard Updates</div>
        <UpdateChecker 
          currentVersion={currentVersion}
          updateUrl={updateUrl}
          onUpdateChecked={onUpdateChecked}
        />
      </div>

      <div className="bg-dj-primary rounded p-4 border border-dj-accent/20">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Reset Update Cache</div>
          <button
            onClick={resetCache}
            className="px-3 py-2 rounded bg-dj-secondary hover:bg-dj-accent/20 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpdateManager
