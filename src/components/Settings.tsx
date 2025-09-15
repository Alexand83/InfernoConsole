import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Volume2, Mic, Headphones, Monitor, Save, RotateCcw, Download, Upload, Globe, Shield, Database, Radio, Info, Eye, EyeOff } from 'lucide-react'
import { localDatabase } from '../database/LocalDatabase'
import { useSettings, AppSettings } from '../contexts/SettingsContext'
import { useAudio } from '../contexts/AudioContext'
import { useTranslation } from '../i18n'
import UpdateChecker from './UpdateChecker'
import LibrariesInfo from './LibrariesInfo'
import { updateConfig } from '../config/updateConfig'
import { getVersionInfo, formatVersion, getChangelog, refreshVersionInfo, downloadUpdate, installUpdate } from '../utils/versionSync'

const Settings = () => {
  const [activeTab, setActiveTab] = useState('audio')
  const [isLoading, setIsLoading] = useState(false)
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([])
  const [availableOutputs, setAvailableOutputs] = useState<MediaDeviceInfo[]>([])
  const { settings, updateSetting, resetSettings } = useSettings()
  const { getAvailableAudioOutputDevices } = useAudio()
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [editingServer, setEditingServer] = useState<string | null>(null)
  const [lastUpdateCheck, setLastUpdateCheck] = useState<string>('')
  const [versionInfo, setVersionInfo] = useState<any>(null)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  
  // Configurazione aggiornamenti
  const updateUrl = updateConfig.updateUrl
  const currentVersion = updateConfig.currentVersion

  // Carica informazioni di versione
  useEffect(() => {
    const loadVersionInfo = async () => {
      try {
        const info = await getVersionInfo()
        setVersionInfo(info)
      } catch (error) {
        console.error('Errore nel caricamento informazioni versione:', error)
      }
    }
    
    loadVersionInfo()
  }, [])

  // Listener per il progresso del download
  useEffect(() => {
    const handleDownloadProgress = (event: any, progress: any) => {
      setDownloadProgress(progress.percent)
    }

    // Aggiungi listener per il progresso del download
    if (window.electronAPI) {
      window.electronAPI.on('download-progress', handleDownloadProgress)
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeListener('download-progress', handleDownloadProgress)
      }
    }
  }, [])

  // Funzione per controllare aggiornamenti
  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true)
    try {
      refreshVersionInfo()
      const info = await getVersionInfo()
      setVersionInfo(info)
      setLastUpdateCheck(new Date().toLocaleString('it-IT'))
    } catch (error) {
      console.error('Errore nel controllo aggiornamenti:', error)
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  // Funzione per scaricare l'aggiornamento
  const handleDownloadUpdate = async () => {
    setIsDownloading(true)
    setDownloadProgress(0)
    try {
      // Prima controlla aggiornamenti, poi scarica
      await handleCheckUpdates()
      await downloadUpdate()
      alert('Download completato! Clicca "Installa e Riavvia" per applicare l\'aggiornamento.')
    } catch (error) {
      console.error('Errore nel download aggiornamento:', error)
      const errorMessage = error.message || 'Errore sconosciuto'
      
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        alert('⚠️ Release non ancora disponibile!\n\nLa nuova versione è stata rilevata ma i file non sono ancora pronti per il download.\n\nRiprova tra qualche minuto quando la build sarà completata.')
      } else if (errorMessage.includes('Please check update first')) {
        alert('⚠️ Controllo aggiornamenti richiesto!\n\nPrima di scaricare, devi controllare se ci sono aggiornamenti disponibili.\n\nClicca "Controlla aggiornamenti" e poi riprova.')
      } else {
        alert(`Errore nel download dell'aggiornamento: ${errorMessage}\n\nRiprova più tardi.`)
      }
    } finally {
      setIsDownloading(false)
    }
  }

  // Funzione per installare l'aggiornamento
  const handleInstallUpdate = async () => {
    try {
      await installUpdate()
    } catch (error) {
      console.error('Errore nell\'installazione aggiornamento:', error)
      const errorMessage = error.message || 'Errore sconosciuto'
      
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        alert('⚠️ Aggiornamento non disponibile!\n\nIl file di aggiornamento non è ancora pronto.\n\nAssicurati di aver completato il download prima di installare.')
      } else {
        alert(`Errore nell'installazione dell'aggiornamento: ${errorMessage}\n\nRiprova più tardi.`)
      }
    }
  }

  const handleSettingChange = (category: string, key: string, value: any) => {
    updateSetting(category as keyof AppSettings, key, value)
  }

  // ✅ FUNZIONI ADVANCED SETTINGS
  
  // Esporta impostazioni
  const handleExportSettings = async () => {
    try {
      const settingsData = {
        settings: settings,
        timestamp: new Date().toISOString(),
        version: versionInfo?.version || 'Unknown'
      }
      
      const dataStr = JSON.stringify(settingsData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dj-console-settings-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      console.log('✅ [SETTINGS] Impostazioni esportate con successo')
    } catch (error) {
      console.error('❌ [SETTINGS] Errore esportazione impostazioni:', error)
    }
  }

  // Importa impostazioni
  const handleImportSettings = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        
        if (data.settings) {
          // Aggiorna le impostazioni
          Object.keys(data.settings).forEach(category => {
            Object.keys(data.settings[category]).forEach(key => {
              updateSetting(category as keyof AppSettings, key, data.settings[category][key])
            })
          })
          
          console.log('✅ [SETTINGS] Impostazioni importate con successo')
        } else {
          console.error('❌ [SETTINGS] File non valido')
        }
      } catch (error) {
        console.error('❌ [SETTINGS] Errore importazione impostazioni:', error)
      }
    }
    input.click()
  }

  // Reset impostazioni
  const handleResetSettings = async (type: 'audio' | 'interface' | 'all') => {
    if (!confirm(`Sei sicuro di voler resettare le impostazioni ${type === 'all' ? 'tutte' : type}?`)) {
      return
    }
    
    try {
      if (type === 'all') {
        await resetSettings()
      } else {
        // Reset parziale - implementa logica specifica per categoria
        const defaultSettings = {
          audio: {
            sampleRate: 44100,
            bitDepth: 16,
            bufferSize: 512,
            latency: 0,
            outputDevice: 'default',
            inputDevice: 'default'
          },
          interface: {
            theme: 'auto',
            language: 'it',
            showWaveform: true,
            showSpectrum: true,
            showBeatGrid: false,
            animations: true,
            autoAdvance: false,
            playlistLoop: true
          }
        }
        
        if (type === 'audio') {
          Object.keys(defaultSettings.audio).forEach(key => {
            updateSetting('audio', key, defaultSettings.audio[key as keyof typeof defaultSettings.audio])
          })
        } else if (type === 'interface') {
          Object.keys(defaultSettings.interface).forEach(key => {
            updateSetting('interface', key, defaultSettings.interface[key as keyof typeof defaultSettings.interface])
          })
        }
      }
      
      console.log(`✅ [SETTINGS] Reset ${type} completato`)
    } catch (error) {
      console.error(`❌ [SETTINGS] Errore reset ${type}:`, error)
    }
  }

  // ✅ FUNZIONI PER GESTIRE SERVER ICECAST
  const addNewServer = async () => {
    const newServer = {
      name: 'Nuovo Server',
      host: '',
      port: 5040,
      mount: '/stream',
      username: 'source',
      password: '',
      useSSL: false,
      isDefault: false
    }
    
    try {
      const serverId = await localDatabase.addIcecastServer(newServer)
      setEditingServer(serverId)
      
      // Aggiorna i settings nel context
      const servers = await localDatabase.getIcecastServers()
      updateSetting('streaming', 'icecastServers', servers)
    } catch (error) {
      console.error('Errore aggiunta server:', error)
    }
  }

  const updateServer = async (serverId: string, field: string, value: any) => {
    try {
      await localDatabase.updateIcecastServer(serverId, { [field]: value })
      
      // Aggiorna i settings nel context
      const servers = await localDatabase.getIcecastServers()
      updateSetting('streaming', 'icecastServers', servers)
    } catch (error) {
      console.error('Errore aggiornamento server:', error)
    }
  }

  const deleteServer = async (serverId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo server?')) {
      try {
        await localDatabase.deleteIcecastServer(serverId)
        
        // Aggiorna i settings nel context
        const servers = await localDatabase.getIcecastServers()
        updateSetting('streaming', 'icecastServers', servers)
        
        // Se era il server di default, rimuovi il riferimento
        if (settings.streaming?.defaultIcecastServerId === serverId) {
          updateSetting('streaming', 'defaultIcecastServerId', undefined)
        }
      } catch (error) {
        console.error('Errore eliminazione server:', error)
      }
    }
  }

  const setDefaultServer = async (serverId: string) => {
    try {
      await localDatabase.setDefaultIcecastServer(serverId)
      
      // Aggiorna i settings nel context
      const servers = await localDatabase.getIcecastServers()
      updateSetting('streaming', 'icecastServers', servers)
      updateSetting('streaming', 'defaultIcecastServerId', serverId)
    } catch (error) {
      console.error('Errore impostazione server default:', error)
    }
  }

  // I settaggi si salvano automaticamente nel context

  // Funzione per caricare i dispositivi microfono disponibili
  const loadMicrophones = async () => {
    try {
      // Richiedi permessi per enumerare i dispositivi
      await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // Ferma il stream subito dopo aver ottenuto i permessi
          stream.getTracks().forEach(track => track.stop())
        })
        .catch(() => {
          // Ignora errori di permessi, mostreremo solo dispositivi base
        })

      const devices = await navigator.mediaDevices.enumerateDevices()
      const microphones = devices.filter(device => device.kind === 'audioinput')
      setAvailableMicrophones(microphones)
    } catch (error) {
      console.error('Error loading microphones:', error)
      // Fallback a dispositivi di base
      setAvailableMicrophones([])
    }
  }

  const loadOutputs = async () => {
    try {
      // ✅ CORREZIONE: Usa la funzione specifica per dispositivi output
      const outputDevices = await getAvailableAudioOutputDevices()
      setAvailableOutputs(outputDevices)
      
      // Carica anche i microfoni per compatibilità
      await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => s.getTracks().forEach(t => t.stop()))
        .catch(() => {})
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAvailableMicrophones(devices.filter(d => d.kind === 'audioinput'))
    } catch (error) {
      console.error('❌ [SETTINGS] Errore caricamento dispositivi audio:', error)
      setAvailableOutputs([])
      setAvailableMicrophones([])
    }
  }

  useEffect(() => {
    // Carica solo i dispositivi audio disponibili
    loadMicrophones()
    loadOutputs()

    // Listener per aggiornare la lista quando i dispositivi cambiano
    const handleDeviceChange = () => {
      loadMicrophones()
      loadOutputs()
    }
    
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange)
    
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  // resetSettings è ora gestito dal context

  const tabs = [
    { id: 'audio', label: t('settings.audio'), icon: Volume2 },
    { id: 'microphone', label: t('settings.microphone'), icon: Mic },
    { id: 'interface', label: t('settings.interface'), icon: Monitor },
    { id: 'recording', label: t('settings.recording'), icon: Database },
    { id: 'streaming', label: t('settings.streaming'), icon: Radio },
    { id: 'advanced', label: t('settings.advanced'), icon: SettingsIcon },
    { id: 'info', label: t('settings.info'), icon: Info }
  ]

  return (
    <div className="h-full bg-dj-dark text-white p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-dj font-bold text-white mb-2">{t('settings.title')}</h1>
          <p className="text-dj-light/60">{t('settings.description')}</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={resetSettings} className="dj-button-secondary flex items-center space-x-2">
            <RotateCcw className="w-4 h-4" />
            <span>{t('settings.reset')}</span>
          </button>
        </div>
      </div>

      <div className="flex h-full space-x-6">
        <div className="w-64 bg-dj-secondary rounded-xl p-4 border border-dj-accent/20">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-dj-accent text-white shadow-lg'
                      : 'text-dj-light/70 hover:bg-dj-accent/20 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex-1 bg-dj-secondary rounded-xl p-6 border border-dj-accent/20 overflow-y-auto">
          {activeTab === 'audio' && (
            <div>
              <h2 className="text-2xl font-dj font-bold text-white mb-6">{t('settings.audioSettings')}</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.sampleRate')}</label>
                    <select
                      value={settings.audio?.sampleRate || 48000}
                      onChange={(e) => handleSettingChange('audio', 'sampleRate', parseInt(e.target.value))}
                      className="dj-input w-full"
                    >
                      <option value={44100}>44.1 kHz</option>
                      <option value={48000}>48 kHz</option>
                      <option value={96000}>96 kHz</option>
                      <option value={192000}>192 kHz</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.bitDepth')}</label>
                    <select
                      value={settings.audio?.bitDepth || 16}
                      onChange={(e) => handleSettingChange('audio', 'bitDepth', parseInt(e.target.value))}
                      className="dj-input w-full"
                    >
                      <option value={16}>16-bit</option>
                      <option value={24}>24-bit</option>
                      <option value={32}>32-bit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.bufferSize')}</label>
                    <select
                      value={settings.audio?.bufferSize || 512}
                      onChange={(e) => handleSettingChange('audio', 'bufferSize', parseInt(e.target.value))}
                      className="dj-input w-full"
                    >
                      <option value={256}>256 samples</option>
                      <option value={512}>512 samples</option>
                      <option value={1024}>1024 samples</option>
                      <option value={2048}>2048 samples</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.latency')} (ms)</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={settings.audio?.latency || 10}
                      onChange={(e) => handleSettingChange('audio', 'latency', parseInt(e.target.value))}
                      className="dj-slider w-full"
                    />
                    <div className="text-center text-sm text-dj-light/60 mt-1">
                      {settings.audio?.latency || 10}ms
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.crossfadeDuration')}</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={settings.audio?.crossfadeDuration || 3}
                      onChange={(e) => handleSettingChange('audio', 'crossfadeDuration', parseFloat(e.target.value))}
                      className="dj-slider w-full"
                    />
                    <div className="text-center text-sm text-dj-light/60 mt-1">
                                              {settings.audio?.crossfadeDuration || 3}s
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.outputDeviceLocal')}</label>
                    <select
                      value={settings.audio?.outputDevice || 'default'}
                      onChange={(e) => handleSettingChange('audio', 'outputDevice', e.target.value)}
                      className="dj-input w-full"
                    >
                      <option value="default">System Default</option>
                      {availableOutputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Output ${d.deviceId.slice(0,8)}...`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.audio?.fadeInOut || true}
                        onChange={(e) => handleSettingChange('audio', 'fadeInOut', e.target.checked)}
                        className="rounded border-dj-accent/30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                      />
                      <span className="text-sm text-dj-light/60">{t('settings.fadeInOut')}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'microphone' && (
            <div>
              <h2 className="text-2xl font-dj font-bold text-white mb-6">{t('settings.microphoneSettings')}</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.inputDevice')}</label>
                  <select
                                          value={settings.microphone?.inputDevice || 'default'}
                    onChange={(e) => handleSettingChange('microphone', 'inputDevice', e.target.value)}
                    className="dj-input w-full"
                  >
                    <option value="default">Default Microphone</option>
                    {availableMicrophones.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={loadMicrophones}
                    className="mt-2 text-xs text-dj-accent hover:text-dj-highlight transition-colors"
                  >
                    🔄 Aggiorna lista dispositivi
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.sampleRate')}</label>
                    <select
                      value={settings.microphone?.sampleRate || 48000}
                      onChange={(e) => handleSettingChange('microphone', 'sampleRate', parseInt(e.target.value))}
                      className="dj-input w-full"
                    >
                      <option value={44100}>44.1 kHz</option>
                      <option value={48000}>48 kHz</option>
                      <option value={96000}>96 kHz</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.duckingPercent')}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={settings.microphone?.duckingPercent || 50}
                      onChange={(e) => handleSettingChange('microphone', 'duckingPercent', parseInt(e.target.value || '0'))}
                      className="dj-input w-full"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                                              checked={settings.microphone?.echoCancellation || true}
                      onChange={(e) => handleSettingChange('microphone', 'echoCancellation', e.target.checked)}
                      className="rounded border-dj-accent/30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                                          <span className="text-sm text-dj-light/60">{t('settings.echoCancellation')}</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.microphone.noiseSuppression}
                      onChange={(e) => handleSettingChange('microphone', 'noiseSuppression', e.target.checked)}
                      className="rounded border-dj-accent/30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                                          <span className="text-sm text-dj-light/60">{t('settings.noiseSuppression')}</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.microphone.autoGainControl}
                      onChange={(e) => handleSettingChange('microphone', 'autoGainControl', e.target.checked)}
                      className="rounded border-dj-accent/30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                                          <span className="text-sm text-dj-light/60">{t('settings.autoGainControl')}</span>
                  </label>

                  <div className="grid grid-cols-2 gap-6 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-dj-light/60 mb-2">Push-to-talk key</label>
                      <input
                        type="text"
                        value={settings.microphone.pushToTalkKey}
                        onChange={(e) => handleSettingChange('microphone', 'pushToTalkKey', e.target.value)}
                        className="dj-input w-full"
                        placeholder="Space"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interface' && (
            <div>
              <h2 className="text-2xl font-dj font-bold text-white mb-6">{t('settings.interfaceSettings')}</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.theme')}</label>
                    <select
                      value={settings.interface.theme}
                      onChange={(e) => handleSettingChange('interface', 'theme', e.target.value)}
                      className="dj-input w-full"
                    >
                      <option value="dark">{t('themes.dark')}</option>
                      <option value="light">{t('themes.light')}</option>
                      <option value="infernal">{t('themes.infernal')}</option>
                      <option value="auto">{t('themes.auto')}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('settings.language')}</label>
                    <select
                      value={settings.interface.language}
                      onChange={(e) => handleSettingChange('interface', 'language', e.target.value)}
                      className="dj-input w-full"
                    >
                      <option value="it">{t('languages.it')}</option>
                      <option value="en">{t('languages.en')}</option>
                      <option value="es">{t('languages.es')}</option>
                      <option value="fr">{t('languages.fr')}</option>
                      <option value="de">{t('languages.de')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.interface.showWaveforms}
                      onChange={(e) => handleSettingChange('interface', 'showWaveforms', e.target.checked)}
                      className="rounded border-dj-accent-30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                    <span className="text-sm text-dj-light/60">{t('settings.showWaveforms')}</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.interface.showSpectrum}
                      onChange={(e) => handleSettingChange('interface', 'showSpectrum', e.target.checked)}
                      className="rounded border-dj-accent-30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                    <span className="text-sm text-dj-light/60">{t('settings.showSpectrum')}</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.interface.showBeatGrid}
                      onChange={(e) => handleSettingChange('interface', 'showBeatGrid', e.target.checked)}
                      className="rounded border-dj-accent-30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                    <span className="text-sm text-dj-light/60">{t('settings.showBeatGrid')}</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.interface.animations}
                      onChange={(e) => handleSettingChange('interface', 'animations', e.target.checked)}
                      className="rounded border-dj-accent-30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                    <span className="text-sm text-dj-light/60">{t('settings.enableAnimations')}</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.interface.autoAdvance || false}
                      onChange={(e) => handleSettingChange('interface', 'autoAdvance', e.target.checked)}
                      className="rounded border-dj-accent-30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                    <span className="text-sm text-dj-light/60">Auto-advance: avanza automaticamente alla traccia successiva</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.interface.playlistLoop || false}
                      onChange={(e) => handleSettingChange('interface', 'playlistLoop', e.target.checked)}
                      className="rounded border-dj-accent-30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                    <span className="text-sm text-dj-light/60">Loop playlist: riparti dalla prima traccia quando finisce l'ultima</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recording' && (
            <div>
              <h2 className="text-2xl font-dj font-bold text-white mb-6">{t('recording.title')}</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('recording.format')}</label>
                    <select
                      value={settings.recording?.format || 'wav'}
                      onChange={(e) => handleSettingChange('recording', 'format', e.target.value)}
                      className="dj-input w-full"
                    >
                      <option value="wav">WAV (Uncompressed)</option>
                      <option value="mp3">MP3 (Compressed)</option>
                      <option value="flac">FLAC (Lossless)</option>
                      <option value="aac">AAC (High Quality)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('recording.quality')}</label>
                    <select
                      value={settings.recording?.quality || 'high'}
                      onChange={(e) => handleSettingChange('recording', 'quality', e.target.value)}
                      className="dj-input w-full"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="lossless">Lossless</option>
                    </select>
                  </div>
                </div>

                <div>
                                                                             <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('recording.saveLocation')}</label>
                  <input
                    type="text"
                                          value={settings.recording?.saveLocation || ''}
                    onChange={(e) => handleSettingChange('recording', 'saveLocation', e.target.value)}
                    className="dj-input w-full"
                    placeholder="/path/to/recordings"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('recording.maxFileSize')}</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={settings.recording?.maxFileSize || 100}
                      onChange={(e) => handleSettingChange('recording', 'maxFileSize', parseInt(e.target.value))}
                      className="dj-input w-full"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.recording?.autoRecord || false}
                        onChange={(e) => handleSettingChange('recording', 'autoRecord', e.target.checked)}
                        className="rounded border-dj-accent/30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                      />
                      <span className="text-sm text-dj-light/60">{t('recording.autoRecord')}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'streaming' && (
            <div>
              <h2 className="text-2xl font-dj font-bold text-white mb-6">{t('streaming.title')}</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('streaming.bitrate')} (kbps)</label>
                    <input
                      type="number"
                      min={32}
                      max={320}
                      value={settings.streaming?.defaultBitrate || 128}
                      onChange={(e) => handleSettingChange('streaming', 'defaultBitrate', parseInt(e.target.value || '0'))}
                      className="dj-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('streaming.format')}</label>
                    <select
                      value={settings.streaming?.defaultFormat || 'opus'}
                      onChange={(e) => {
                        console.log('🎛️ [SETTINGS UI] Cambio formato streaming:', e.target.value)
                        handleSettingChange('streaming', 'defaultFormat', e.target.value)
                      }}
                      className="dj-input w-full"
                    >
                      <option value="mp3">MP3</option>
                      <option value="aac">AAC</option>
                      <option value="opus">OPUS</option>
                      <option value="ogg">OGG</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('streaming.channels')}</label>
                    <select
                      value={settings.streaming?.channels || 2}
                      onChange={(e) => handleSettingChange('streaming', 'channels', parseInt(e.target.value))}
                      className="dj-input w-full"
                    >
                      <option value={1}>Mono (1 canale)</option>
                      <option value={2}>Stereo (2 canali)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={!!settings.streaming.autoConnect}
                      onChange={(e) => handleSettingChange('streaming', 'autoConnect', e.target.checked)}
                      className="rounded border-dj-accent/30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                    />
                    <span className="text-sm text-dj-light/60">{t('streaming.autoConnect')}</span>
                  </label>
                </div>

                {/* ✅ GESTIONE SERVER ICECAST MULTIPLI */}
                <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-white">Server Icecast</h3>
                    <button
                      onClick={addNewServer}
                      className="px-3 py-1 bg-dj-highlight text-dj-primary rounded text-sm font-medium hover:bg-dj-highlight/80 transition-colors"
                    >
                      + Aggiungi Server
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {settings.streaming?.icecastServers?.map((server, index) => (
                      <div key={server.id} className="bg-dj-secondary rounded-lg p-4 border border-dj-accent/10">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="defaultServer"
                              checked={server.isDefault}
                              onChange={() => setDefaultServer(server.id)}
                              className="text-dj-highlight focus:ring-dj-highlight"
                            />
                            <span className="font-medium text-white">{server.name}</span>
                            {server.isDefault && (
                              <span className="px-2 py-1 bg-dj-highlight text-dj-primary text-xs rounded">Default</span>
                            )}
                          </div>
                          <button
                            onClick={() => deleteServer(server.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Elimina
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-dj-light/60 mb-1">Nome</label>
                            <input
                              type="text"
                              value={server.name}
                              onChange={(e) => updateServer(server.id, 'name', e.target.value)}
                              className="dj-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-dj-light/60 mb-1">Host</label>
                            <input
                              type="text"
                              value={server.host}
                              onChange={(e) => updateServer(server.id, 'host', e.target.value)}
                              className="dj-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-dj-light/60 mb-1">Porta</label>
                            <input
                              type="number"
                              value={server.port}
                              onChange={(e) => updateServer(server.id, 'port', parseInt(e.target.value) || 5040)}
                              className="dj-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-dj-light/60 mb-1">Mount</label>
                            <input
                              type="text"
                              value={server.mount}
                              onChange={(e) => updateServer(server.id, 'mount', e.target.value)}
                              className="dj-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-dj-light/60 mb-1">Username</label>
                            <input
                              type="text"
                              value={server.username}
                              onChange={(e) => updateServer(server.id, 'username', e.target.value)}
                              className="dj-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-dj-light/60 mb-1">Password</label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={server.password}
                                onChange={(e) => updateServer(server.id, 'password', e.target.value)}
                                className="dj-input w-full text-sm pr-8"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-2 flex items-center"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-3 w-3 text-dj-light/60" />
                                ) : (
                                  <Eye className="h-3 w-3 text-dj-light/60" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={server.useSSL}
                              onChange={(e) => updateServer(server.id, 'useSSL', e.target.checked)}
                              className="rounded border-dj-accent/30 bg-dj-primary text-dj-highlight focus:ring-dj-highlight"
                            />
                            <span className="text-xs text-dj-light/60">SSL</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20 mt-4">
                  <h3 className="text-lg font-medium text-white mb-3">Metadati Predefiniti</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('streaming.stationName')} (Nick)</label>
                      <input
                        type="text"
                        value={settings.streaming?.metadata?.stationName || ''}
                        onChange={(e) => handleSettingChange('streaming', 'metadata.stationName', e.target.value)}
                        className="dj-input w-full"
                        placeholder="My Radio"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('streaming.stationUrl')}</label>
                      <input
                        type="text"
                        value={settings.streaming?.metadata?.stationUrl || ''}
                        onChange={(e) => handleSettingChange('streaming', 'metadata.stationUrl', e.target.value)}
                        className="dj-input w-full"
                        placeholder="https://example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dj-light/60 mb-2">{t('streaming.genre')}</label>
                      <input
                        type="text"
                        value={settings.streaming?.metadata?.genre || ''}
                        onChange={(e) => handleSettingChange('streaming', 'metadata.genre', e.target.value)}
                        className="dj-input w-full"
                        placeholder="Various"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dj-light/60 mb-2">🎤 Nickname DJ</label>
                      <input
                        type="text"
                        value={settings.streaming?.metadata?.djName || ''}
                        onChange={(e) => handleSettingChange('streaming', 'metadata.djName', e.target.value)}
                        className="dj-input w-full"
                        placeholder="Il tuo nickname"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div>
              <h2 className="text-2xl font-dj font-bold text-white mb-6">{t('settings.advancedSettings')}</h2>
              
              <div className="space-y-6">
                <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20">
                  <h3 className="text-lg font-medium text-white mb-3">{t('settings.dataManagement')}</h3>
                  <div className="flex space-x-3">
                    <button 
                      onClick={handleExportSettings}
                      className="dj-button flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{t('settings.exportSettings')}</span>
                    </button>
                    <button 
                      onClick={handleImportSettings}
                      className="dj-button-secondary flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t('settings.importSettings')}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-dj-primary rounded-lg p-4 border border-dj-accent/20">
                  <h3 className="text-lg font-medium text-white mb-3">{t('settings.resetOptions')}</h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => handleResetSettings('audio')}
                      className="w-full text-left p-3 bg-dj-secondary hover:bg-dj-accent/20 rounded-lg transition-all duration-200"
                    >
                      <div className="font-medium text-white">{t('settings.resetAudioSettings')}</div>
                      <div className="text-sm text-dj-light/60">{t('settings.resetAudioSettingsDesc')}</div>
                    </button>
                    <button 
                      onClick={() => handleResetSettings('interface')}
                      className="w-full text-left p-3 bg-dj-secondary hover:bg-dj-accent/20 rounded-lg transition-all duration-200"
                    >
                      <div className="font-medium text-white">{t('settings.resetInterfaceSettings')}</div>
                      <div className="text-sm text-dj-light/60">{t('settings.resetInterfaceSettingsDesc')}</div>
                    </button>
                    <button 
                      onClick={() => handleResetSettings('all')}
                      className="w-full text-left p-3 bg-dj-secondary hover:bg-dj-accent/20 rounded-lg transition-all duration-200"
                    >
                      <div className="font-medium text-white">{t('settings.resetAllSettings')}</div>
                      <div className="text-sm text-dj-light/60">{t('settings.resetAllSettingsDesc')}</div>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Informazioni App - Versione Funzionante */}
              <div className="bg-dj-primary rounded-lg p-6 border border-dj-accent/20">
                <h2 className="text-xl font-dj font-bold text-white mb-4">{t('settings.about')}</h2>
                <div className="space-y-2 text-sm text-dj-light/60">
                  <div>{t('settings.version')}: {versionInfo ? formatVersion(versionInfo) : 'Caricamento...'}</div>
                  <div>{t('settings.build')}: {versionInfo ? versionInfo.buildDate : 'Caricamento...'}</div>
                  <div>{t('settings.license')}: MIT</div>
                  <div>{t('settings.author')}: Alessandro(NeverAgain)</div>
                </div>
                
                {/* Pulsante per controllare aggiornamenti */}
                <div className="mt-4 pt-4 border-t border-dj-accent/20">
                  <button
                    onClick={handleCheckUpdates}
                    disabled={isCheckingUpdates}
                    className="bg-dj-accent hover:bg-dj-accent/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCheckingUpdates ? 'Controllo aggiornamenti...' : 'Controlla aggiornamenti'}
                  </button>
                  
                  {versionInfo?.isUpdateAvailable && (
                    <div className="mt-2 p-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm mb-3">
                        🚀 Aggiornamento disponibile: {versionInfo.latestVersion}
                        {!versionInfo.isReady && (
                          <span className="ml-2 text-yellow-400 text-xs">
                            (Build in corso...)
                          </span>
                        )}
                      </p>
                      
                      {/* Pulsanti per download e installazione */}
                      <div className="flex space-x-2">
                        <button
                          onClick={handleDownloadUpdate}
                          disabled={isDownloading || !versionInfo.isReady}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDownloading ? 'Download...' : 
                           !versionInfo.isReady ? 'Build in corso...' : 
                           'Scarica Aggiornamento'}
                        </button>
                        
                        <button
                          onClick={handleInstallUpdate}
                          disabled={!versionInfo.isReady}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Installa e Riavvia
                        </button>
                      </div>
                      
                      {/* Istruzioni per l'utente */}
                      <div className="mt-2 text-xs text-dj-light/60">
                        <p>📋 <strong>Istruzioni:</strong></p>
                        <p>1. Clicca "Scarica Aggiornamento" e attendi il completamento</p>
                        <p>2. Poi clicca "Installa e Riavvia" per applicare l'aggiornamento</p>
                      </div>
                      
                      {isDownloading && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${downloadProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-dj-light/60 mt-1">
                            Download in corso... {downloadProgress}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {lastUpdateCheck && (
                    <p className="text-xs text-dj-light/40 mt-2">
                      Ultimo controllo: {lastUpdateCheck}
                    </p>
                  )}
                </div>
              </div>

              {/* Librerie Utilizzate */}
              <div className="bg-dj-primary rounded-lg p-6 border border-dj-accent/20">
                <LibrariesInfo />
              </div>

              {/* Informazioni Sistema */}
              <div className="bg-dj-primary rounded-lg p-6 border border-dj-accent/20">
                <h2 className="text-xl font-dj font-bold text-white mb-4">{t('settings.systemInfo')}</h2>
                
                {/* Permessi Microfono */}
                <div className="bg-dj-secondary rounded-lg p-4 mb-6 border border-dj-accent/20">
                  <h3 className="text-lg font-medium text-white mb-3 flex items-center">
                    <Mic className="w-5 h-5 mr-2" />
                    {t('settings.microphonePermissions')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-dj-light/80">{t('settings.microphoneAccess')}</span>
                      <span className="px-2 py-1 bg-dj-success/20 text-dj-success rounded text-sm">
                        {t('common.enabled')}
                      </span>
                    </div>
                    <div className="text-sm text-dj-light/60">
                      {t('settings.microphoneAccessDesc')}
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                          stream.getTracks().forEach(track => track.stop())
                          alert(t('settings.microphonePermissionGranted'))
                        } catch (error) {
                          alert(t('settings.microphonePermissionDenied'))
                        }
                      }}
                      className="dj-button-primary flex items-center space-x-2"
                    >
                      <Shield className="w-4 h-4" />
                      <span>{t('settings.testMicrophoneAccess')}</span>
                    </button>
                  </div>
                </div>

                {/* Informazioni Browser */}
                <div className="bg-dj-secondary rounded-lg p-4 mb-6 border border-dj-accent/20">
                  <h3 className="text-lg font-medium text-white mb-3 flex items-center">
                    <Globe className="w-5 h-5 mr-2" />
                    {t('settings.browserInfo')}
                  </h3>
                  <div className="space-y-2 text-sm text-dj-light/60">
                    <div className="flex justify-between">
                      <span>{t('settings.browser')}:</span>
                      <span>{navigator.userAgent.split(' ')[0] || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('settings.platform')}:</span>
                      <span>{navigator.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('settings.language')}:</span>
                      <span>{navigator.language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>WebAudio API:</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        window.AudioContext ? 'bg-dj-success/20 text-dj-success' : 'bg-dj-error/20 text-dj-error'
                      }`}>
                        {window.AudioContext ? t('common.enabled') : t('common.disabled')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>MediaDevices API:</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        navigator.mediaDevices ? 'bg-dj-success/20 text-dj-success' : 'bg-dj-error/20 text-dj-error'
                      }`}>
                        {navigator.mediaDevices ? t('common.enabled') : t('common.disabled')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dispositivi Audio */}
                <div className="bg-dj-secondary rounded-lg p-4 mb-6 border border-dj-accent/20">
                  <h3 className="text-lg font-medium text-white mb-3 flex items-center">
                    <Headphones className="w-5 h-5 mr-2" />
                    {t('settings.audioDevices')}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-dj-light/80 mb-2">{t('settings.inputDevices')}:</div>
                      <div className="text-xs text-dj-light/60">
                        {availableMicrophones.length > 0 
                          ? `${availableMicrophones.length} ${t('settings.devicesFound')}`
                          : t('settings.noDevicesFound')
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-dj-light/80 mb-2">{t('settings.outputDevices')}:</div>
                      <div className="text-xs text-dj-light/60">
                        {availableOutputs.length > 0 
                          ? `${availableOutputs.length} ${t('settings.devicesFound')}`
                          : t('settings.noDevicesFound')
                        }
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        loadMicrophones()
                        loadOutputs()
                      }}
                      className="dj-button-secondary text-sm"
                    >
                      {t('settings.refreshDevices')}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
