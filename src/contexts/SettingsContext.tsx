import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { localDatabase, IcecastServer } from '../database/LocalDatabase'

export interface AppSettings {
  audio: {
    sampleRate: number
    bitDepth: number
    bufferSize: number
    latency: number
    crossfadeDuration: number
    fadeInOut: boolean
    outputDevice?: string
  }
  microphone: {
    inputDevice: string
    sampleRate: number
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
    duckingPercent: number
    pushToTalkKey: string
  }
  interface: {
    theme: 'dark' | 'light' | 'infernal' | 'auto'
    language: 'en' | 'it' | 'es' | 'fr' | 'de'
    showWaveforms: boolean
    showSpectrum: boolean
    showBeatGrid: boolean
    animations: boolean
    autoAdvance: boolean
    playlistLoop: boolean
  }
  recording: {
    format: 'wav' | 'mp3' | 'flac' | 'aac'
    quality: 'low' | 'medium' | 'high'
    autoRecord: boolean
    saveLocation: string
    maxFileSize: number
  }
  streaming: {
    defaultBitrate: number
    defaultFormat: 'mp3' | 'opus' | 'aac' | 'ogg'
    channels: number
    autoConnect: boolean
    reconnectAttempts: number
    icecastServers: IcecastServer[]  // ✅ MULTIPLI SERVER
    defaultIcecastServerId?: string  // ✅ SERVER DI DEFAULT
    metadata: {
      stationUrl: string
      genre: string
      djName: string  // ✅ NICKNAME DEL DJ
    }
  }
  youtube: {
    downloadPath: string
    defaultQuality: '128' | '192' | '320'
    autoDownload: boolean
    createSubfolders: boolean
  }
}

type SettingsAction =
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'UPDATE_CATEGORY'; payload: { category: keyof AppSettings; settings: Partial<AppSettings[keyof AppSettings]> } }
  | { type: 'UPDATE_SETTING'; payload: { category: keyof AppSettings; key: string; value: any } }
  | { type: 'RESET_SETTINGS' }

interface SettingsContextType {
  settings: AppSettings
  updateSetting: (category: keyof AppSettings, key: string, value: any) => void
  updateCategory: (category: keyof AppSettings, settings: Partial<AppSettings[keyof AppSettings]>) => void
  resetSettings: () => void
  applyTheme: (theme: 'dark' | 'light' | 'infernal' | 'auto') => void
  applyLanguage: (language: string) => void
  applyWaveformSettings: (showWaveforms: boolean, showSpectrum: boolean, showBeatGrid: boolean) => void
  applyAnimationSettings: (animations: boolean) => void
}

const defaultSettings: AppSettings = {
  audio: {
    sampleRate: 48000,  // ✅ FIX: Opus supporta 48000Hz
    bitDepth: 16,
    bufferSize: 4096,   // ✅ BILANCIATO: Buffer moderato per evitare blocchi
    latency: 50,        // ✅ BILANCIATO: Latenza moderata per evitare blocchi
    crossfadeDuration: 3,
    fadeInOut: true
  },
  microphone: {
    inputDevice: 'default',
    sampleRate: 48000,  // ✅ FIX: Opus supporta 48000Hz
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    duckingPercent: 50,
    pushToTalkKey: 'Space'
  },
  interface: {
    theme: 'dark',
    language: 'it',
    showWaveforms: true,
    showSpectrum: true,
    showBeatGrid: true,
    animations: true,
    autoAdvance: true,
    playlistLoop: true
  },
  recording: {
    format: 'wav',
    quality: 'high',
    autoRecord: false,
    saveLocation: '/recordings',
    maxFileSize: 100
  },
  streaming: {
    defaultBitrate: 128,
    defaultFormat: 'mp3', // ✅ USA MP3 per compatibilità Icecast
    channels: 2,
    autoConnect: false,
    reconnectAttempts: 5,
    icecastServers: [  // ✅ SERVER ICECAST INFERNO
      {
        id: 'inferno-server',
        name: 'Inferno Server',
        host: 'dj.onlinewebone.com',
        port: 8004,
        mount: '/live',
        username: 'source',
        password: 'inferno@inferno123',
        useSSL: false,
        isDefault: true
      }
    ],
    defaultIcecastServerId: 'inferno-server',  // ✅ SERVER INFERNO DI DEFAULT
    metadata: {
      stationUrl: 'https://dj.onlinewebone.com',
      genre: 'Electronic/Live DJ',
      djName: 'Inferno Console'  // ✅ NICKNAME DEFAULT
    }
  },
  youtube: {
    downloadPath: './downloads/youtube/',
    defaultQuality: '192',
    autoDownload: false,
    createSubfolders: true
  }
}

function settingsReducer(state: AppSettings, action: SettingsAction): AppSettings {
  switch (action.type) {
    case 'SET_SETTINGS':
      return action.payload
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        [action.payload.category]: {
          ...state[action.payload.category],
          ...action.payload.settings
        }
      }
    case 'UPDATE_SETTING':
      const keys = action.payload.key.split('.')
      const category = action.payload.category
      
      if (keys.length === 1) {
        // Chiave semplice
        return {
          ...state,
          [category]: {
            ...state[category],
            [keys[0]]: action.payload.value
          }
        }
      } else {
        // Chiave annidata (es: 'icecast.host')
        const [mainKey, subKey] = keys
        return {
          ...state,
          [category]: {
            ...state[category],
            [mainKey]: {
              ...state[category][mainKey],
              [subKey]: action.payload.value
            }
          }
        }
      }
    case 'RESET_SETTINGS':
      return defaultSettings
    default:
      return state
  }
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, dispatch] = useReducer(settingsReducer, defaultSettings)
  const isInitialized = useRef(false)

  // Funzione per assicurarsi che tutte le sezioni delle impostazioni siano presenti
  const ensureAllSettings = (savedSettings: any): AppSettings => {
    const mergedSettings = {
      ...defaultSettings,
      ...savedSettings,
      audio: { ...defaultSettings.audio, ...savedSettings?.audio },
      microphone: { ...defaultSettings.microphone, ...savedSettings?.microphone },
      interface: { ...defaultSettings.interface, ...savedSettings?.interface },
      recording: { ...defaultSettings.recording, ...savedSettings?.recording },
      streaming: { 
        ...defaultSettings.streaming, 
        ...savedSettings?.streaming,
        // ✅ GESTIONE SERVER MULTIPLI
        icecastServers: savedSettings?.streaming?.icecastServers || defaultSettings.streaming.icecastServers,
        defaultIcecastServerId: savedSettings?.streaming?.defaultIcecastServerId || defaultSettings.streaming.defaultIcecastServerId
      }
    }

    // ✅ MIGRAZIONE PASSWORD: Aggiorna la password del server Inferno se esiste
    if (mergedSettings.streaming.icecastServers) {
      const infernoServer = mergedSettings.streaming.icecastServers.find(server => server.id === 'inferno-server')
      if (infernoServer) {
        // Aggiorna la password del server Inferno con quella più recente
        infernoServer.password = 'inferno@inferno123'
        console.log('🔄 [SETTINGS] Password server Inferno aggiornata automaticamente')
      }
    }

    return mergedSettings
  }

  // ✅ OPTIMIZATION: Carica i settaggi dal database all'avvio - Non bloccante per avvio veloce
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // ✅ OPTIMIZATION: Caricamento settings ultra-veloce
        const savedSettings = await localDatabase.getSettings().catch(() => null)
        
        // Inizializzazione database completamente in background
        localDatabase.waitForInitialization().catch(() => {})
        
        if (savedSettings) {
          const completeSettings = ensureAllSettings(savedSettings)
          dispatch({ type: 'SET_SETTINGS', payload: completeSettings })
        }
      } catch (error) {
        console.warn('Failed to load settings:', error)
        // Fallback ai settings di default se il caricamento fallisce
        dispatch({ type: 'SET_SETTINGS', payload: defaultSettings })
      } finally {
        isInitialized.current = true
      }
    }
    
    // Caricamento asincrono non bloccante
    loadSettings()
  }, [])

  // Applica i settaggi quando cambiano
  useEffect(() => {
    if (!isInitialized.current) return

    const applySettings = async () => {
      try {
        // Salva nel database
        await localDatabase.updateSettings(settings)
        
        // Applica i settaggi in tempo reale
        applyTheme(settings.interface.theme)
        applyLanguage(settings.interface.language)
        applyWaveformSettings(
          settings.interface.showWaveforms,
          settings.interface.showSpectrum,
          settings.interface.showBeatGrid
        )
        applyAnimationSettings(settings.interface.animations)
        
        // Emetti evento per aggiornare altri componenti
        window.dispatchEvent(new CustomEvent('djconsole:settings-updated', { detail: settings }))
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    }

    applySettings()
  }, [settings])

  const updateSetting = (category: keyof AppSettings, key: string, value: any) => {
    console.log('🔧 [SETTINGS] Aggiornamento setting:', { category, key, value })
    dispatch({ type: 'UPDATE_SETTING', payload: { category, key, value } })
  }

  const updateCategory = (category: keyof AppSettings, settings: Partial<AppSettings[keyof AppSettings]>) => {
    dispatch({ type: 'UPDATE_CATEGORY', payload: { category, settings } })
  }

  const resetSettings = () => {
    dispatch({ type: 'RESET_SETTINGS' })
  }

  // Applica il tema in tempo reale
  const applyTheme = (theme: 'dark' | 'light' | 'infernal' | 'auto') => {
    const root = document.documentElement
    
    if (theme === 'auto') {
      // Rileva automaticamente il tema del sistema
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const isDark = mediaQuery.matches
      
      root.classList.toggle('dark', isDark)
      root.classList.toggle('light', !isDark)
      root.classList.remove('infernal')
      
      // Listener per cambiamenti del sistema
      mediaQuery.addEventListener('change', (e) => {
        root.classList.toggle('dark', e.matches)
        root.classList.toggle('light', !e.matches)
        root.classList.remove('infernal')
      })
    } else {
      root.classList.remove('dark', 'light', 'infernal')
      root.classList.add(theme)
    }
  }

  // Applica la lingua in tempo reale
  const applyLanguage = (language: string) => {
    document.documentElement.lang = language
    
    // Importa e applica le traduzioni
    import('../i18n').then(({ setLanguage }) => {
      setLanguage(language as any)
    })
    
    // Emetti evento per i componenti che devono aggiornarsi
    window.dispatchEvent(new CustomEvent('djconsole:language-changed', { detail: language }))
  }

  // Applica le impostazioni dei waveform
  const applyWaveformSettings = (showWaveforms: boolean, showSpectrum: boolean, showBeatGrid: boolean) => {
    // Emetti eventi per i componenti che devono mostrare/nascondere elementi
    window.dispatchEvent(new CustomEvent('djconsole:waveform-settings-changed', {
      detail: { showWaveforms, showSpectrum, showBeatGrid }
    }))
  }

  // Applica le impostazioni delle animazioni
  const applyAnimationSettings = (animations: boolean) => {
    const root = document.documentElement
    root.style.setProperty('--enable-animations', animations ? '1' : '0')
    
    // Emetti evento per i componenti che devono abilitare/disabilitare animazioni
    window.dispatchEvent(new CustomEvent('djconsole:animation-settings-changed', {
      detail: { animations }
    }))
  }

  const value: SettingsContextType = {
    settings,
    updateSetting,
    updateCategory,
    resetSettings,
    applyTheme,
    applyLanguage,
    applyWaveformSettings,
    applyAnimationSettings
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
